-- =============================================================================
-- Landing IA — Migración 002: seguridad (Políticas de Seguridad del Sistema)
--
-- Cuentas en el servidor: roles, verificación de correo, sesiones con token de
-- renovación rotativo, doble factor (TOTP), historial de contraseñas, bloqueos
-- por cuenta y por IP, sanciones, cuotas, bitácora de auditoría inalterable,
-- borrado lógico y retención.
-- =============================================================================

BEGIN;
SET search_path TO landing_ia;

-- -----------------------------------------------------------------------------
-- Usuarios: rol, estado, verificación, doble factor y marcas de contraseña
-- -----------------------------------------------------------------------------

ALTER TABLE usuarios
    ADD COLUMN rol                     VARCHAR(15)  NOT NULL DEFAULT 'usuario'
        CHECK (rol IN ('usuario', 'analista', 'administrador')),
    ADD COLUMN estado                  VARCHAR(12)  NOT NULL DEFAULT 'activo'
        CHECK (estado IN ('activo', 'suspendido', 'eliminado')),
    ADD COLUMN suspendido_hasta        TIMESTAMPTZ,                 -- NULL con estado 'suspendido' = definitiva
    ADD COLUMN correo_verificado_en    TIMESTAMPTZ,
    ADD COLUMN terminos_aceptados_en   TIMESTAMPTZ,
    ADD COLUMN terminos_version        VARCHAR(10),
    ADD COLUMN contrasena_cambiada_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    ADD COLUMN cambio_obligatorio      BOOLEAN      NOT NULL DEFAULT FALSE,
    ADD COLUMN totp_secreto_cifrado    TEXT,                        -- AES-256-GCM, nunca en claro
    ADD COLUMN totp_pendiente_cifrado  TEXT,                        -- secreto en configuración, aún sin confirmar
    ADD COLUMN totp_activado_en        TIMESTAMPTZ,
    ADD COLUMN totp_ultimo_paso        BIGINT,                      -- evita reutilizar un código ya usado
    ADD COLUMN ultimo_acceso_en        TIMESTAMPTZ,
    ADD COLUMN aviso_inactividad_en    TIMESTAMPTZ,
    ADD COLUMN eliminado_en            TIMESTAMPTZ,
    ADD CONSTRAINT usuarios_eliminado_coherente CHECK ((estado = 'eliminado') = (eliminado_en IS NOT NULL));

-- El servidor usa Argon2id en formato PHC: la sal va dentro del hash.
ALTER TABLE usuarios DROP COLUMN sal_contrasena;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_hash_argon2id CHECK (hash_contrasena LIKE '$argon2id$%');

-- Últimas contraseñas (política de contraseñas, "Historial"). La vigente está en usuarios.
CREATE TABLE historial_contrasenas (
    id               BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id       VARCHAR(40)  NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    hash_contrasena  TEXT         NOT NULL CHECK (hash_contrasena LIKE '$argon2id$%'),
    creado_en        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX historial_usuario_idx ON historial_contrasenas (usuario_id, creado_en DESC);

-- -----------------------------------------------------------------------------
-- Sesiones (token de acceso JWT de 15 min + token de renovación de 7 días)
-- -----------------------------------------------------------------------------

-- Solo se guarda el hash SHA-256 del token de renovación. Cada renovación crea
-- una fila nueva de la misma familia y revoca la anterior; si se presenta un
-- token ya rotado, se revoca toda la familia (posible robo).
CREATE TABLE sesiones (
    id                   UUID         PRIMARY KEY,
    familia_id           UUID         NOT NULL,
    usuario_id           VARCHAR(40)  NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    hash_renovacion      CHAR(64)     NOT NULL UNIQUE,
    nivel                VARCHAR(15)  NOT NULL DEFAULT 'completo'
        CHECK (nivel IN ('completo', 'configurar_2fa')),
    creada_en            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expira_en            TIMESTAMPTZ  NOT NULL,
    ultima_actividad_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    revocada_en          TIMESTAMPTZ,
    motivo_revocacion    VARCHAR(40),
    ip_enmascarada       VARCHAR(45),
    agente               VARCHAR(200)
);
CREATE INDEX sesiones_usuario_idx ON sesiones (usuario_id) WHERE revocada_en IS NULL;
CREATE INDEX sesiones_familia_idx ON sesiones (familia_id);

-- -----------------------------------------------------------------------------
-- Tokens enviados por correo (verificación y restablecimiento)
-- -----------------------------------------------------------------------------

CREATE TABLE tokens_correo (
    id          BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id  VARCHAR(40)  NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    tipo        VARCHAR(15)  NOT NULL CHECK (tipo IN ('verificacion', 'restablecer')),
    hash_token  CHAR(64)     NOT NULL UNIQUE,                 -- SHA-256; el token solo viaja en el enlace
    correo      VARCHAR(254) NOT NULL,                        -- a qué dirección se envió
    expira_en   TIMESTAMPTZ  NOT NULL,
    usado_en    TIMESTAMPTZ,
    creado_en   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX tokens_usuario_idx ON tokens_correo (usuario_id, tipo);

-- -----------------------------------------------------------------------------
-- Bloqueos (política de contraseñas, "Bloqueo")
-- -----------------------------------------------------------------------------

-- Por correo, exista o no la cuenta, para no revelar qué correos están registrados.
CREATE TABLE bloqueos_cuenta (
    correo               VARCHAR(254) PRIMARY KEY,
    fallos_ventana       SMALLINT     NOT NULL DEFAULT 0,
    ventana_inicio       TIMESTAMPTZ,
    fallos_totales       INTEGER      NOT NULL DEFAULT 0,
    nivel                SMALLINT     NOT NULL DEFAULT 0,
    bloqueado_hasta      TIMESTAMPTZ,
    requiere_restablecer BOOLEAN      NOT NULL DEFAULT FALSE,  -- a los 10 fallos
    requiere_admin       BOOLEAN      NOT NULL DEFAULT FALSE,  -- personal: solo otro administrador lo levanta
    actualizado_en       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Fallos por IP. La IP se guarda como HMAC: sirve para contar, no para identificar.
CREATE TABLE fallos_ip (
    id         BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ip_hash    CHAR(64)     NOT NULL,
    creado_en  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX fallos_ip_idx ON fallos_ip (ip_hash, creado_en DESC);

CREATE TABLE bloqueos_ip (
    ip_hash    CHAR(64)     PRIMARY KEY,
    hasta      TIMESTAMPTZ  NOT NULL,
    motivo     VARCHAR(40)  NOT NULL,
    creado_en  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Sanciones (política de uso, "Sanciones")
-- -----------------------------------------------------------------------------

CREATE TABLE sanciones (
    id             BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id     VARCHAR(40)  NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    tipo           VARCHAR(25)  NOT NULL CHECK (tipo IN ('advertencia', 'suspension_temporal', 'suspension_definitiva')),
    motivo         TEXT         NOT NULL CHECK (btrim(motivo) <> ''),
    hasta          TIMESTAMPTZ,
    aplicada_por   VARCHAR(40)  REFERENCES usuarios (id) ON DELETE SET NULL,
    creada_en      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    levantada_en   TIMESTAMPTZ,
    levantada_por  VARCHAR(40)  REFERENCES usuarios (id) ON DELETE SET NULL,
    CONSTRAINT sanciones_temporal_con_fecha CHECK ((tipo = 'suspension_temporal') = (hasta IS NOT NULL))
);
CREATE INDEX sanciones_usuario_idx ON sanciones (usuario_id, creada_en DESC);

-- -----------------------------------------------------------------------------
-- Cuotas (política de uso, "Uso de recursos")
-- -----------------------------------------------------------------------------

-- Una fila por landing nueva. Clave: la cuenta o, sin sesión, el HMAC de la IP.
CREATE TABLE uso_generaciones (
    id         BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    clave      VARCHAR(80)  NOT NULL,
    creado_en  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX uso_generaciones_idx ON uso_generaciones (clave, creado_en DESC);

-- -----------------------------------------------------------------------------
-- Bitácora de auditoría: quién hizo qué y cuándo. Solo se escribe.
-- -----------------------------------------------------------------------------

CREATE TABLE bitacora_auditoria (
    id              BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ocurrido_en     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actor_id        VARCHAR(40),                              -- sin FK: el registro sobrevive a la cuenta
    actor_rol       VARCHAR(15),
    accion          VARCHAR(60)  NOT NULL,
    resultado       VARCHAR(10)  NOT NULL DEFAULT 'exito' CHECK (resultado IN ('exito', 'fallo', 'denegado')),
    objetivo_tipo   VARCHAR(20),
    objetivo_id     VARCHAR(80),
    ip_enmascarada  VARCHAR(45),
    id_solicitud    UUID,
    detalles        JSONB        NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX bitacora_fecha_idx  ON bitacora_auditoria (ocurrido_en DESC);
CREATE INDEX bitacora_actor_idx  ON bitacora_auditoria (actor_id, ocurrido_en DESC);
CREATE INDEX bitacora_accion_idx ON bitacora_auditoria (accion, ocurrido_en DESC);

-- No se puede modificar ni borrar. La única excepción es la purga de retención
-- (registros de más de 12 meses), que la tarea programada habilita en su transacción.
CREATE OR REPLACE FUNCTION bitacora_inalterable() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE'
       AND current_setting('landing_ia.purga_retencion', true) = 'si'
       AND OLD.ocurrido_en < now() - INTERVAL '12 months' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'La bitácora de auditoría no se puede modificar ni borrar (%).', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER bitacora_sin_cambios
    BEFORE UPDATE OR DELETE ON bitacora_auditoria
    FOR EACH ROW EXECUTE FUNCTION bitacora_inalterable();

CREATE TRIGGER bitacora_sin_truncar
    BEFORE TRUNCATE ON bitacora_auditoria
    FOR EACH STATEMENT EXECUTE FUNCTION bitacora_inalterable();

-- -----------------------------------------------------------------------------
-- Borrado lógico de proyectos (30 días de espera antes del borrado definitivo)
-- -----------------------------------------------------------------------------

ALTER TABLE proyectos ADD COLUMN eliminado_en TIMESTAMPTZ;
DROP INDEX proyectos_usuario_idx;
CREATE INDEX proyectos_usuario_idx ON proyectos (usuario_id, creado_en DESC) WHERE eliminado_en IS NULL;

CREATE INDEX imagenes_usuario_idx ON imagenes (usuario_id);

-- -----------------------------------------------------------------------------
-- Rol de base de datos de la aplicación (mínimo privilegio)
-- -----------------------------------------------------------------------------

-- Rol de grupo sin inicio de sesión. En el servidor se crea un usuario con
-- LOGIN miembro de este rol (ver manual de instalación). No puede cambiar la
-- estructura, y en la bitácora solo puede insertar y leer.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'landing_ia_app') THEN
        CREATE ROLE landing_ia_app NOLOGIN;
    END IF;
END;
$$;

GRANT USAGE ON SCHEMA landing_ia TO landing_ia_app;
GRANT SELECT ON ALL TABLES IN SCHEMA landing_ia TO landing_ia_app;
GRANT INSERT, UPDATE, DELETE ON
    usuarios, historial_contrasenas, sesiones, tokens_correo, bloqueos_cuenta, fallos_ip, bloqueos_ip,
    sanciones, uso_generaciones, imagenes, proyectos, briefs, secciones, intentos_generacion, landings_publicadas
    TO landing_ia_app;
GRANT INSERT ON bitacora_auditoria TO landing_ia_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA landing_ia TO landing_ia_app;
REVOKE CREATE ON SCHEMA landing_ia FROM PUBLIC;

COMMIT;
