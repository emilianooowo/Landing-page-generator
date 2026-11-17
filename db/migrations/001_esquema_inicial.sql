-- =============================================================================
-- Landing IA — Script de base de datos
-- Motor: PostgreSQL 16 (compatible con PostgreSQL 13 o superior)
--
-- Modela los datos que hoy maneja la aplicación:
--   * cuentas de usuario            (hoy en localStorage: lpg:accounts)
--   * proyectos y su brief           (hoy en localStorage: lpg:projects:<usuario>)
--   * secciones generadas            (dentro de cada proyecto)
--   * imágenes subidas               (hoy en disco: <DATA_DIR>/uploads)
--   * bitácora de intentos de la IA  (esquema GenerationAttempt)
--   * landings publicadas            (módulo de publicación propuesto para el VPS)
--
-- Las reglas (longitudes, valores permitidos, formatos) son las mismas que
-- valida la aplicación con Zod en lib/schemas/*.ts.
--
-- Uso:
--   createdb landing_ia
--   psql -d landing_ia -v ON_ERROR_STOP=1 -f 01_esquema_landing_ia.sql
-- =============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS landing_ia;
SET search_path TO landing_ia;

-- -----------------------------------------------------------------------------
-- Catálogos
-- -----------------------------------------------------------------------------

-- Tipos de sección que puede tener una landing (lib/schemas/primitives.ts).
CREATE TABLE tipos_seccion (
    id          VARCHAR(20) PRIMARY KEY,
    nombre      VARCHAR(60) NOT NULL,
    descripcion TEXT        NOT NULL
);

-- Diseños (variantes) disponibles por tipo de sección (lib/variants/catalog.ts).
CREATE TABLE variantes (
    tipo_seccion_id  VARCHAR(20) NOT NULL REFERENCES tipos_seccion (id),
    id               VARCHAR(40) NOT NULL,
    etiqueta         VARCHAR(60) NOT NULL,
    guia             TEXT        NOT NULL,
    requiere_imagen  BOOLEAN     NOT NULL DEFAULT FALSE,
    es_respaldo      BOOLEAN     NOT NULL DEFAULT FALSE,
    PRIMARY KEY (tipo_seccion_id, id)
);

-- Estilos de landing que se eligen al crear un proyecto (lib/styles/landingStyles.ts).
CREATE TABLE estilos_landing (
    id                VARCHAR(20) PRIMARY KEY,
    nombre            VARCHAR(40) NOT NULL,
    descripcion       TEXT        NOT NULL,
    color_acento      CHAR(7)     NOT NULL CHECK (color_acento ~ '^#[0-9a-fA-F]{6}$'),
    tipografia        VARCHAR(10) NOT NULL CHECK (tipografia IN ('serif', 'grotesk', 'round')),
    tema              VARCHAR(5)  NOT NULL CHECK (tema IN ('light', 'dark')),
    animacion         VARCHAR(10) NOT NULL CHECK (animacion IN ('subtle', 'balanced', 'lively')),
    formas_flotantes  SMALLINT    NOT NULL CHECK (formas_flotantes BETWEEN 0 AND 6),
    brillo_cursor     BOOLEAN     NOT NULL,
    tono_redaccion    TEXT        NOT NULL
);

-- Diseños que corresponden a cada estilo, en orden de preferencia.
CREATE TABLE estilo_variantes (
    estilo_id        VARCHAR(20) NOT NULL REFERENCES estilos_landing (id),
    tipo_seccion_id  VARCHAR(20) NOT NULL,
    variante_id      VARCHAR(40) NOT NULL,
    orden            SMALLINT    NOT NULL CHECK (orden >= 1),
    PRIMARY KEY (estilo_id, tipo_seccion_id, variante_id),
    UNIQUE (estilo_id, tipo_seccion_id, orden),
    FOREIGN KEY (tipo_seccion_id, variante_id) REFERENCES variantes (tipo_seccion_id, id)
);

-- -----------------------------------------------------------------------------
-- Usuarios
-- -----------------------------------------------------------------------------

CREATE TABLE usuarios (
    id               VARCHAR(40)  PRIMARY KEY,               -- 'u_<uuid>'
    nombre           VARCHAR(120) NOT NULL CHECK (btrim(nombre) <> ''),
    correo           VARCHAR(254) NOT NULL,
    hash_contrasena  TEXT         NOT NULL,                  -- en servidor: argon2id o bcrypt
    sal_contrasena   TEXT,                                   -- solo si el algoritmo la requiere aparte
    creado_en        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT usuarios_correo_formato CHECK (correo ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
    CONSTRAINT usuarios_correo_minusculas CHECK (correo = lower(correo))
);
CREATE UNIQUE INDEX usuarios_correo_unico ON usuarios (correo);

-- -----------------------------------------------------------------------------
-- Imágenes subidas
-- -----------------------------------------------------------------------------

-- El archivo vive en disco: <DATA_DIR>/uploads/<id>.<extension>
-- y se sirve en /api/uploads/<id>.<extension>.
CREATE TABLE imagenes (
    id            CHAR(27)     PRIMARY KEY CHECK (id ~ '^up_[a-f0-9]{24}$'),
    extension     VARCHAR(4)   NOT NULL CHECK (extension IN ('jpg', 'png', 'webp')),
    tipo_mime     VARCHAR(20)  NOT NULL CHECK (tipo_mime IN ('image/jpeg', 'image/png', 'image/webp')),
    tamano_bytes  INTEGER      NOT NULL CHECK (tamano_bytes > 0 AND tamano_bytes <= 4194304),
    usuario_id    VARCHAR(40)  REFERENCES usuarios (id) ON DELETE SET NULL,
    creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT imagenes_mime_coincide CHECK (
        (extension = 'jpg'  AND tipo_mime = 'image/jpeg') OR
        (extension = 'png'  AND tipo_mime = 'image/png')  OR
        (extension = 'webp' AND tipo_mime = 'image/webp')
    )
);

-- -----------------------------------------------------------------------------
-- Proyectos y brief del negocio
-- -----------------------------------------------------------------------------

CREATE TABLE proyectos (
    id              VARCHAR(40)  PRIMARY KEY,                -- 'p_<base36>'
    usuario_id      VARCHAR(40)  NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    nombre          VARCHAR(120),                            -- nombre visible opcional
    descripcion     TEXT         NOT NULL CHECK (btrim(descripcion) <> ''),  -- texto original de la persona
    estilo_id       VARCHAR(20)  REFERENCES estilos_landing (id),            -- NULL en proyectos anteriores a los estilos
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX proyectos_usuario_idx ON proyectos (usuario_id, creado_en DESC);

-- Brief: lo que la IA dedujo del negocio (lib/schemas/brief.ts). Relación 1:1.
CREATE TABLE briefs (
    proyecto_id           VARCHAR(40)  PRIMARY KEY REFERENCES proyectos (id) ON DELETE CASCADE,
    nombre_negocio        VARCHAR(60)  NOT NULL CHECK (btrim(nombre_negocio) <> ''),
    tiene_nombre_negocio  BOOLEAN      NOT NULL DEFAULT FALSE,
    a_que_se_dedica       VARCHAR(200) NOT NULL CHECK (btrim(a_que_se_dedica) <> ''),
    publico               VARCHAR(120) NOT NULL CHECK (btrim(publico) <> ''),
    tono                  VARCHAR(10)[] NOT NULL,
    color_marca           VARCHAR(7)   CHECK (color_marca ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'),
    mundo_imagen          VARCHAR(20)  NOT NULL CHECK (mundo_imagen IN (
                              'people-team', 'people-portrait', 'workspace', 'product-object', 'food-drink',
                              'nature', 'architecture', 'texture-abstract', 'tools-craft', 'screens-tech')),
    accion_deseada        VARCHAR(40)  NOT NULL CHECK (btrim(accion_deseada) <> ''),
    puntos_clave          VARCHAR(80)[] NOT NULL DEFAULT '{}',
    tiene_clientes        BOOLEAN      NOT NULL DEFAULT FALSE,
    secciones             VARCHAR(20)[] NOT NULL,
    CONSTRAINT briefs_tono_valido CHECK (
        cardinality(tono) BETWEEN 1 AND 2 AND
        tono <@ ARRAY['bold', 'calm', 'playful', 'premium', 'technical', 'warm', 'minimal']::VARCHAR(10)[]
    ),
    CONSTRAINT briefs_puntos_clave_max CHECK (cardinality(puntos_clave) <= 6),
    CONSTRAINT briefs_secciones_validas CHECK (
        cardinality(secciones) BETWEEN 2 AND 4 AND
        secciones <@ ARRAY['hero', 'features', 'testimonials', 'cta']::VARCHAR(20)[]
    )
);

-- -----------------------------------------------------------------------------
-- Secciones de cada landing
-- -----------------------------------------------------------------------------

-- contenido: textos de la sección según su tipo (lib/schemas/{hero,features,testimonials,cta}.ts).
-- estilo:    valores visuales calculados por la app (acento, semilla, animación…).
-- La foto propia de la sección se guarda normalizada en foto_id / foto_alt.
CREATE TABLE secciones (
    proyecto_id      VARCHAR(40)  NOT NULL REFERENCES proyectos (id) ON DELETE CASCADE,
    id               VARCHAR(40)  NOT NULL,                  -- p. ej. 'hero-0'
    orden            SMALLINT     NOT NULL CHECK (orden >= 0),
    tipo_seccion_id  VARCHAR(20)  NOT NULL,
    variante_id      VARCHAR(40)  NOT NULL,
    contenido        JSONB        NOT NULL CHECK (jsonb_typeof(contenido) = 'object'),
    estilo           JSONB        NOT NULL CHECK (jsonb_typeof(estilo) = 'object'),
    estado           VARCHAR(10)  NOT NULL CHECK (estado IN ('valid', 'fallback')),
    foto_id          CHAR(27)     REFERENCES imagenes (id) ON DELETE SET NULL,
    foto_alt         VARCHAR(120),
    actualizado_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (proyecto_id, id),
    UNIQUE (proyecto_id, orden),
    FOREIGN KEY (tipo_seccion_id, variante_id) REFERENCES variantes (tipo_seccion_id, id),
    CONSTRAINT secciones_foto_con_texto CHECK (foto_id IS NULL OR (foto_alt IS NOT NULL AND btrim(foto_alt) <> '')),
    CONSTRAINT secciones_contenido_titulo CHECK (contenido ? 'headline')
);

-- Enlaces de los botones (lib/links.ts): solo WhatsApp, teléfono, correo, web o '#'.
CREATE OR REPLACE FUNCTION enlace_es_seguro(href TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
    SELECT href IS NULL
        OR href = '#'
        OR href ~ '^https://wa\.me/[0-9]{10,15}$'
        OR href ~ '^tel:\+[0-9]{10,15}$'
        OR href ~ '^mailto:[^\s@<>()"]+@[^\s@<>()"]+\.[^\s@<>()"]{2,}$'
        OR href ~* '^https?://[^\s<>"]+\.[^\s<>"]+$'
$$;

ALTER TABLE secciones ADD CONSTRAINT secciones_enlaces_seguros CHECK (
    enlace_es_seguro(contenido #>> '{primaryCta,href}') AND
    enlace_es_seguro(contenido #>> '{secondaryCta,href}')
);

-- -----------------------------------------------------------------------------
-- Bitácora de la IA (lib/schemas/section.ts → GenerationAttempt)
-- -----------------------------------------------------------------------------

CREATE TABLE intentos_generacion (
    id               BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    proyecto_id      VARCHAR(40)  NOT NULL REFERENCES proyectos (id) ON DELETE CASCADE,
    seccion_id       VARCHAR(40)  NOT NULL,
    tipo_seccion_id  VARCHAR(20)  NOT NULL REFERENCES tipos_seccion (id),
    numero_intento   SMALLINT     NOT NULL CHECK (numero_intento BETWEEN 1 AND 2),
    resultado        VARCHAR(15)  NOT NULL CHECK (resultado IN ('valid', 'schema-error', 'api-error', 'fallback')),
    error            TEXT,
    creado_en        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX intentos_proyecto_idx ON intentos_generacion (proyecto_id, creado_en DESC);

-- -----------------------------------------------------------------------------
-- Publicación en el VPS (módulo propuesto, ver Propuesta de despliegue)
-- -----------------------------------------------------------------------------

-- Copia publicada de una landing, servida en /l/<slug>.
CREATE TABLE landings_publicadas (
    slug                VARCHAR(80)  PRIMARY KEY CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    proyecto_id         VARCHAR(40)  NOT NULL UNIQUE REFERENCES proyectos (id) ON DELETE CASCADE,
    hash_token_edicion  TEXT         NOT NULL,               -- hash del token secreto para republicar/despublicar
    contenido           JSONB        NOT NULL,               -- brief + secciones en el momento de publicar
    publicado_en        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Fecha de actualización automática
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION marcar_actualizado() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER usuarios_actualizado    BEFORE UPDATE ON usuarios            FOR EACH ROW EXECUTE FUNCTION marcar_actualizado();
CREATE TRIGGER proyectos_actualizado   BEFORE UPDATE ON proyectos           FOR EACH ROW EXECUTE FUNCTION marcar_actualizado();
CREATE TRIGGER secciones_actualizado   BEFORE UPDATE ON secciones           FOR EACH ROW EXECUTE FUNCTION marcar_actualizado();
CREATE TRIGGER publicadas_actualizado  BEFORE UPDATE ON landings_publicadas FOR EACH ROW EXECUTE FUNCTION marcar_actualizado();

-- -----------------------------------------------------------------------------
-- Vista de apoyo: listado de proyectos como lo muestra el panel
-- -----------------------------------------------------------------------------

CREATE VIEW v_proyectos AS
SELECT p.id,
       p.usuario_id,
       COALESCE(p.nombre, CASE WHEN b.tiene_nombre_negocio THEN b.nombre_negocio END, b.a_que_se_dedica) AS titulo,
       e.nombre                AS estilo,
       COUNT(s.id)             AS total_secciones,
       COUNT(s.foto_id)        AS secciones_con_foto,
       lp.slug                 AS slug_publicado,
       p.creado_en,
       p.actualizado_en
FROM proyectos p
JOIN briefs b                   ON b.proyecto_id = p.id
LEFT JOIN estilos_landing e     ON e.id = p.estilo_id
LEFT JOIN secciones s           ON s.proyecto_id = p.id
LEFT JOIN landings_publicadas lp ON lp.proyecto_id = p.id
GROUP BY p.id, b.proyecto_id, e.nombre, lp.slug;

-- =============================================================================
-- Datos de catálogo
-- =============================================================================

INSERT INTO tipos_seccion (id, nombre, descripcion) VALUES
  ('hero',         'Sección principal',       'Lo primero que ve la visita: título, texto de apoyo y botón principal.'),
  ('features',     'Productos y servicios',   'De 3 a 6 puntos concretos sobre lo que ofrece el negocio.'),
  ('testimonials', 'Opiniones de clientes',   'De 1 a 4 opiniones. Solo se incluye si el negocio ya tiene clientes.'),
  ('cta',          'Cierre de la página',     'Invitación final a la acción con su botón.');

INSERT INTO variantes (tipo_seccion_id, id, etiqueta, guia, requiere_imagen, es_respaldo) VALUES
  ('hero', 'aurora-veil',          'Calmado y luminoso',    'Texto centrado sobre un degradado que se mueve lentamente.',            FALSE, TRUE),
  ('hero', 'floating-glass-split', 'Enérgico y flotante',   'Texto de un lado y una tarjeta de imagen flotante del otro.',          TRUE,  FALSE),
  ('hero', 'spotlight-monolith',   'Directo y enfocado',    'Un panel alto con una luz que sigue el cursor.',                       FALSE, FALSE),
  ('hero', 'orbital-stack',        'Cifras al frente',      'Un título con cifras alrededor; solo con datos reales.',               FALSE, FALSE),
  ('features', 'glass-grid',       'Ordenado y parejo',     'Tarjetas del mismo tamaño en una cuadrícula.',                         FALSE, TRUE),
  ('features', 'depth-bento',      'Una idea principal',    'Tarjetas de distintos tamaños con una al frente.',                     TRUE,  FALSE),
  ('features', 'floating-column',  'En orden',              'Una columna vertical que se mueve al desplazarse.',                    FALSE, FALSE),
  ('features', 'orbit-ring',       'Creativo y circular',   'Tarjetas alrededor de un centro luminoso.',                            FALSE, FALSE),
  ('testimonials', 'glass-carousel',   'Desliza y descubre',     'De dos a cuatro opiniones con una al frente a la vez.',       FALSE, FALSE),
  ('testimonials', 'floating-cards',   'Espontáneo y dinámico',  'Opiniones flotando a distintas profundidades.',               FALSE, FALSE),
  ('testimonials', 'single-spotlight', 'Una opinión destacada',  'Una sola opinión grande bajo un brillo sutil.',               FALSE, TRUE),
  ('testimonials', 'depth-marquee',    'En movimiento',          'Opiniones desplazándose en dos niveles.',                     FALSE, FALSE),
  ('cta', 'glow-band',      'Directo y llamativo', 'Una franja de lado a lado con un botón que pulsa.',               FALSE, FALSE),
  ('cta', 'glass-monolith', 'Sutil y cuidado',     'Un panel de vidrio flotante sobre colores en movimiento.',        FALSE, TRUE),
  ('cta', 'split-orbital',  'Muestra e invita',    'Texto junto a una imagen con capas de profundidad.',              TRUE,  FALSE),
  ('cta', 'aurora-wave',    'Suave y fluido',      'Una onda de color en movimiento que acompaña el texto.',          FALSE, FALSE);

INSERT INTO estilos_landing (id, nombre, descripcion, color_acento, tipografia, tema, animacion, formas_flotantes, brillo_cursor, tono_redaccion) VALUES
  ('minimal', 'Minimalista',      'Limpio, con mucho espacio y pocos elementos. Tu mensaje al centro.',                      '#3d5a73', 'grotesk', 'light', 'subtle',   1, FALSE, 'Frases cortas y claras, sin adornos ni exclamaciones.'),
  ('elegant', 'Elegante',         'Oscuro, sobrio y con tipografía con serifa. Ideal para algo especial o de alto valor.',  '#a8834a', 'serif',   'dark',  'subtle',   2, TRUE,  'Tono sobrio y cuidado, con vocabulario refinado y frases breves.'),
  ('warm',    'Cálido y cercano', 'Colores tierra y un tono amable, como platicar con tu clientela de siempre.',             '#c2603a', 'serif',   'light', 'balanced', 3, TRUE,  'Tono cercano y amable, hablándole de tú a la persona.'),
  ('bold',    'Audaz',            'Contraste fuerte, colores intensos y mucho movimiento. Para no pasar desapercibido.',    '#e0442f', 'grotesk', 'dark',  'lively',   5, TRUE,  'Frases contundentes y directas, con verbos de acción.'),
  ('playful', 'Divertido',        'Formas redondeadas, colores alegres y un tono desenfadado.',                             '#d94f8a', 'round',   'light', 'lively',   5, TRUE,  'Tono divertido y desenfadado, sin perder claridad.'),
  ('tech',    'Tecnológico',      'Oscuro, preciso y moderno. Para servicios profesionales, digitales o técnicos.',         '#2a7fd4', 'grotesk', 'dark',  'balanced', 3, TRUE,  'Tono preciso y profesional, concreto y sin tecnicismos innecesarios.');

INSERT INTO estilo_variantes (estilo_id, tipo_seccion_id, variante_id, orden) VALUES
  ('minimal', 'hero', 'aurora-veil', 1), ('minimal', 'hero', 'spotlight-monolith', 2),
  ('minimal', 'features', 'glass-grid', 1), ('minimal', 'features', 'floating-column', 2),
  ('minimal', 'testimonials', 'single-spotlight', 1), ('minimal', 'testimonials', 'glass-carousel', 2),
  ('minimal', 'cta', 'glass-monolith', 1), ('minimal', 'cta', 'aurora-wave', 2),

  ('elegant', 'hero', 'spotlight-monolith', 1), ('elegant', 'hero', 'aurora-veil', 2),
  ('elegant', 'features', 'depth-bento', 1), ('elegant', 'features', 'glass-grid', 2),
  ('elegant', 'testimonials', 'single-spotlight', 1), ('elegant', 'testimonials', 'glass-carousel', 2),
  ('elegant', 'cta', 'glass-monolith', 1), ('elegant', 'cta', 'aurora-wave', 2),

  ('warm', 'hero', 'floating-glass-split', 1), ('warm', 'hero', 'aurora-veil', 2),
  ('warm', 'features', 'floating-column', 1), ('warm', 'features', 'orbit-ring', 2),
  ('warm', 'testimonials', 'floating-cards', 1), ('warm', 'testimonials', 'glass-carousel', 2),
  ('warm', 'cta', 'split-orbital', 1), ('warm', 'cta', 'aurora-wave', 2),

  ('bold', 'hero', 'floating-glass-split', 1), ('bold', 'hero', 'orbital-stack', 2),
  ('bold', 'features', 'depth-bento', 1), ('bold', 'features', 'glass-grid', 2),
  ('bold', 'testimonials', 'depth-marquee', 1), ('bold', 'testimonials', 'floating-cards', 2),
  ('bold', 'cta', 'glow-band', 1), ('bold', 'cta', 'split-orbital', 2),

  ('playful', 'hero', 'floating-glass-split', 1), ('playful', 'hero', 'aurora-veil', 2),
  ('playful', 'features', 'orbit-ring', 1), ('playful', 'features', 'glass-grid', 2),
  ('playful', 'testimonials', 'floating-cards', 1), ('playful', 'testimonials', 'depth-marquee', 2),
  ('playful', 'cta', 'glow-band', 1), ('playful', 'cta', 'split-orbital', 2),

  ('tech', 'hero', 'spotlight-monolith', 1), ('tech', 'hero', 'orbital-stack', 2),
  ('tech', 'features', 'glass-grid', 1), ('tech', 'features', 'depth-bento', 2),
  ('tech', 'testimonials', 'glass-carousel', 1), ('tech', 'testimonials', 'single-spotlight', 2),
  ('tech', 'cta', 'aurora-wave', 1), ('tech', 'cta', 'glass-monolith', 2);

COMMIT;
