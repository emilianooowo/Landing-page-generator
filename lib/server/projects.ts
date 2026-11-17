import { stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { BusinessBrief } from "@/lib/schemas/brief";
import { LANDING_STYLE_IDS } from "@/lib/schemas/primitives";
import { Section } from "@/lib/schemas/section";
import { query, transaction, type Db } from "@/lib/server/db";
import { uploadsDir } from "@/lib/uploads";

/**
 * Projects on the server (security policy, "Confidencialidad"): every query
 * filters by owner, so asking for someone else's project behaves exactly like
 * asking for one that does not exist.
 */
export const ProjectInput = z.object({
  id: z.string().regex(/^p_[a-z0-9]{4,36}$/),
  name: z.string().trim().max(120).optional(),
  description: z.string().trim().min(1).max(2000),
  brief: BusinessBrief,
  sections: z.array(Section).max(4).refine(
    (sections) => sections.every((section) => section.status === "valid" || section.status === "fallback"),
    "Solo se guardan secciones terminadas.",
  ),
  createdAt: z.string().datetime({ offset: true }).optional(),
});
export type ProjectInput = z.infer<typeof ProjectInput>;

export type StoredProjectDto = ProjectInput & { ownerId: string; createdAt: string };

type ProjectRow = { id: string; usuario_id: string; nombre: string | null; descripcion: string; estilo_id: string | null; creado_en: Date };
type BriefRow = {
  nombre_negocio: string; tiene_nombre_negocio: boolean; a_que_se_dedica: string; publico: string; tono: string[];
  color_marca: string | null; mundo_imagen: string; accion_deseada: string; puntos_clave: string[]; tiene_clientes: boolean; secciones: string[];
};
type SectionRow = { id: string; tipo_seccion_id: string; variante_id: string; contenido: unknown; estilo: unknown; estado: string };

const PHOTO = /^\/api\/uploads\/(up_[a-f0-9]{24})\.(jpg|png|webp)$/;
const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

/**
 * The photo's normalized reference. Only images that are unowned (uploaded as a
 * guest) or already owned by this user can be referenced; they get claimed.
 */
async function photoId(db: Db, ownerId: string, url: string | undefined): Promise<string | null> {
  const match = url ? PHOTO.exec(url) : null;
  if (!match) return null;
  const [, id, ext] = match;
  const claimed = await db.query(
    "UPDATE imagenes SET usuario_id = $2 WHERE id = $1 AND (usuario_id IS NULL OR usuario_id = $2) RETURNING id",
    [id, ownerId],
  );
  if (claimed.rowCount) return id;
  const existing = await db.query("SELECT 1 FROM imagenes WHERE id = $1", [id]);
  if (existing.rowCount) return null; // someone else's image
  // Uploaded before images were recorded: register it if the file is there.
  try {
    const info = await stat(path.join(/*turbopackIgnore: true*/ uploadsDir(), `${id}.${ext}`));
    await db.query(
      "INSERT INTO imagenes (id, extension, tipo_mime, tamano_bytes, usuario_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING",
      [id, ext, MIME[ext as keyof typeof MIME], info.size, ownerId],
    );
    return id;
  } catch {
    return null;
  }
}

/** Creates or updates. Returns false when the id belongs to another account (or was deleted). */
export async function saveProject(ownerId: string, input: ProjectInput): Promise<boolean> {
  return transaction(async (db) => {
    const style = input.brief.style && (LANDING_STYLE_IDS as readonly string[]).includes(input.brief.style) ? input.brief.style : null;
    const saved = await db.query(
      `INSERT INTO proyectos (id, usuario_id, nombre, descripcion, estilo_id, creado_en)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now()))
       ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion, estilo_id = EXCLUDED.estilo_id
         WHERE proyectos.usuario_id = EXCLUDED.usuario_id AND proyectos.eliminado_en IS NULL
       RETURNING id`,
      [input.id, ownerId, input.name || null, input.description, style, input.createdAt ?? null],
    );
    if (!saved.rowCount) return false;

    const b = input.brief;
    await db.query(
      `INSERT INTO briefs (proyecto_id, nombre_negocio, tiene_nombre_negocio, a_que_se_dedica, publico, tono, color_marca,
                           mundo_imagen, accion_deseada, puntos_clave, tiene_clientes, secciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (proyecto_id) DO UPDATE SET nombre_negocio = $2, tiene_nombre_negocio = $3, a_que_se_dedica = $4, publico = $5,
         tono = $6, color_marca = $7, mundo_imagen = $8, accion_deseada = $9, puntos_clave = $10, tiene_clientes = $11, secciones = $12`,
      [input.id, b.businessName, b.hasBusinessName, b.whatTheyDo, b.audience, b.vibe, b.brandColor ?? null,
        b.imageWorld, b.desiredAction, b.keyPoints, b.hasCustomers, b.sections],
    );

    await db.query("DELETE FROM secciones WHERE proyecto_id = $1", [input.id]);
    for (const [index, section] of input.sections.entries()) {
      const photo = section.style.photo;
      const fotoId = await photoId(db, ownerId, photo?.url);
      const style = fotoId ? section.style : { ...section.style, photo: undefined };
      await db.query(
        `INSERT INTO secciones (proyecto_id, id, orden, tipo_seccion_id, variante_id, contenido, estilo, estado, foto_id, foto_alt)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [input.id, section.id, index, section.type, section.variant, JSON.stringify(section.content), JSON.stringify(style),
          section.status, fotoId, fotoId ? photo?.alt ?? null : null],
      );
    }
    return true;
  });
}

function toBrief(row: BriefRow, style: string | null): unknown {
  return {
    businessName: row.nombre_negocio,
    hasBusinessName: row.tiene_nombre_negocio,
    whatTheyDo: row.a_que_se_dedica,
    audience: row.publico,
    vibe: row.tono,
    ...(row.color_marca ? { brandColor: row.color_marca } : {}),
    imageWorld: row.mundo_imagen,
    desiredAction: row.accion_deseada,
    keyPoints: row.puntos_clave,
    hasCustomers: row.tiene_clientes,
    sections: row.secciones,
    ...(style ? { style } : {}),
  };
}

async function hydrate(projects: ProjectRow[]): Promise<StoredProjectDto[]> {
  if (!projects.length) return [];
  const ids = projects.map((project) => project.id);
  const briefs = await query<BriefRow & { proyecto_id: string }>("SELECT * FROM briefs WHERE proyecto_id = ANY($1)", [ids]);
  const sections = await query<SectionRow & { proyecto_id: string }>(
    "SELECT proyecto_id, id, tipo_seccion_id, variante_id, contenido, estilo, estado FROM secciones WHERE proyecto_id = ANY($1) ORDER BY orden",
    [ids],
  );
  return projects.flatMap((project) => {
    const brief = briefs.find((row) => row.proyecto_id === project.id);
    if (!brief) return [];
    const parsedBrief = BusinessBrief.safeParse(toBrief(brief, project.estilo_id));
    if (!parsedBrief.success) return [];
    const parsedSections = sections
      .filter((row) => row.proyecto_id === project.id)
      .map((row) => Section.safeParse({ id: row.id, type: row.tipo_seccion_id, variant: row.variante_id, content: row.contenido, style: row.estilo, status: row.estado }))
      .flatMap((result) => (result.success ? [result.data] : []));
    return [{
      id: project.id,
      ownerId: project.usuario_id,
      ...(project.nombre ? { name: project.nombre } : {}),
      description: project.descripcion,
      brief: parsedBrief.data,
      sections: parsedSections,
      createdAt: project.creado_en.toISOString(),
    }];
  });
}

export async function listProjects(ownerId: string): Promise<StoredProjectDto[]> {
  return hydrate(await query<ProjectRow>(
    "SELECT * FROM proyectos WHERE usuario_id = $1 AND eliminado_en IS NULL ORDER BY creado_en DESC LIMIT 200",
    [ownerId],
  ));
}

export async function getProject(ownerId: string, id: string): Promise<StoredProjectDto | null> {
  return (await hydrate(await query<ProjectRow>(
    "SELECT * FROM proyectos WHERE id = $1 AND usuario_id = $2 AND eliminado_en IS NULL",
    [id, ownerId],
  )))[0] ?? null;
}

/** True when the project exists but belongs to someone else: worth an audit entry. */
export async function belongsToAnother(ownerId: string, id: string): Promise<boolean> {
  return (await query("SELECT 1 FROM proyectos WHERE id = $1 AND usuario_id <> $2", [id, ownerId])).length > 0;
}

/** Soft delete: recoverable by an administrator for 30 days, then purged. */
export async function deleteProject(ownerId: string, id: string): Promise<boolean> {
  return (await query(
    "UPDATE proyectos SET eliminado_en = now() WHERE id = $1 AND usuario_id = $2 AND eliminado_en IS NULL RETURNING id",
    [id, ownerId],
  )).length > 0;
}
