import type { Metadata } from "next";
import { PublicShell } from "@/components/app/PublicShell";
import styles from "../account.module.css";

export const metadata: Metadata = { title: "Términos de uso · Landing IA" };

/** Terms accepted at registration (security policy, "Uso del sistema"). Version 2026-11. */
export default function TermsPage() {
  return (
    <PublicShell>
      <main className={`${styles.content} ${styles.legal}`}>
        <header className={styles.contentHeader}>
          <div>
            <h1 className={styles.contentTitle}>Términos de uso</h1>
            <p className={styles.muted}>Versión 2026-11. Al crear una cuenta aceptas estas reglas y guardamos la fecha de aceptación.</p>
          </div>
        </header>

        <section>
          <h2>Qué puedes hacer</h2>
          <p>Crear tu cuenta, describir tu emprendimiento para generar landing pages legítimas, editarlas, cambiar su estilo, agregar tus propias fotos y enlaces de contacto, y eliminarlas cuando quieras. Cada persona actúa solo sobre sus propios proyectos.</p>
        </section>

        <section>
          <h2>Qué está prohibido</h2>
          <ul>
            <li>Crear páginas que imiten a otra empresa, banco o institución, o que pidan contraseñas o datos de tarjetas (suplantación).</li>
            <li>Generar contenido para malware, fraudes o actividades ilícitas.</li>
            <li>Intentar cambiar las reglas del generador con instrucciones ocultas (inyección de instrucciones).</li>
            <li>Escribir en las descripciones contraseñas, llaves de acceso, números de tarjeta o datos personales de otras personas.</li>
            <li>Integrar cobros o pagos en línea: Landing IA solo crea landings informativas con botones de contacto.</li>
            <li>Intentar acceder a proyectos ajenos, atacar o escanear la plataforma, compartir tu cuenta o evadir los límites de uso.</li>
          </ul>
        </section>

        <section>
          <h2>Límites de uso</h2>
          <p>Para que el servicio alcance para todas las personas: 60 solicitudes por minuto, 3 páginas nuevas por día y 50 imágenes por día, de hasta 4 MB cada una. Puedes seguir editando tus páginas aunque alcances el límite de páginas nuevas.</p>
        </section>

        <section>
          <h2>Cómo aplicamos estas reglas</h2>
          <p>Las descripciones se revisan automáticamente antes de llegar a la IA. Una solicitud que infringe estas reglas se rechaza y se registra. Tras 3 rechazos en 24 horas, el generador se bloquea durante 24 horas. Las faltas graves, como suplantación o malware, pueden llevar a la suspensión definitiva de la cuenta y, si hay delito, al aviso a las autoridades.</p>
        </section>

        <section>
          <h2>Tus datos</h2>
          <p>Antes de enviar tu descripción a la IA quitamos correos, teléfonos e identificadores personales. Tu contraseña se guarda solo como un hash Argon2id y nunca aparece en los registros. Al crear o cambiar tu contraseña comprobamos si aparece en filtraciones conocidas; para eso solo se envían los primeros 5 caracteres de su huella SHA-1, nunca la contraseña. Puedes eliminar tu cuenta y tus proyectos desde tu perfil.</p>
        </section>

        <section>
          <h2>Tu cuenta</h2>
          <p>Usa una contraseña de al menos 15 caracteres que no uses en otro sitio. Tras 5 intentos fallidos el inicio de sesión se bloquea temporalmente, y la sesión se cierra después de 30 minutos sin actividad. Revisa el contenido generado antes de compartir tu landing: eres responsable de lo que publicas.</p>
        </section>
      </main>
    </PublicShell>
  );
}
