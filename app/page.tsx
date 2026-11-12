"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FollowUpPrompt } from "@/components/intake";
import { PublicShell } from "@/components/app/PublicShell";
import type { BusinessBrief, FollowUpQuestion } from "@/lib/schemas/brief";
import { newProjectId, saveProject } from "@/lib/store";
import styles from "./home.module.css";

const SUGGESTIONS = [
  "Vendo brownies y galletas en mi universidad.",
  "Hago pulseras y accesorios personalizados.",
  "Doy asesorías de matemáticas para secundaria.",
];

type BriefResponse = {
  error?: string;
  status?: "complete" | "needs-input";
  brief?: BusinessBrief;
  partial?: Partial<BusinessBrief>;
  questions?: FollowUpQuestion[];
};

async function post(url: string, body: unknown) {
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("No se pudo conectar con el servicio de IA. Inténtalo de nuevo.");
  }
  let data: BriefResponse;
  try {
    data = await response.json();
  } catch {
    throw new Error("El servicio respondió con información no válida.");
  }
  if (!response.ok) throw new Error(data.error ?? "Ocurrió un error. Inténtalo de nuevo.");
  return data;
}

export default function Home() {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [description, setDescription] = useState("");
  const [textareaHeight, setTextareaHeight] = useState(38);
  const [questions, setQuestions] = useState<FollowUpQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [partial, setPartial] = useState<Partial<BusinessBrief>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    setTextareaHeight(Math.max(38, Math.min(textarea.scrollHeight, 240)));
  }, [description]);

  function go(brief: BusinessBrief) {
    const id = newProjectId();
    const project = { id, description, brief, sections: [], createdAt: new Date().toISOString() };
    saveProject(project);
    router.push(`/project/${id}`);
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const outcome = await post("/api/parse-brief", { description });
      if (outcome.status === "complete" && outcome.brief) return go(outcome.brief);
      setPartial(outcome.partial ?? {});
      setQuestions(outcome.questions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const outcome = await post("/api/parse-brief", {
        description,
        partial,
        answers: questions.map((question, i) => ({ question, answer: answers[i] })),
      });
      if (outcome.status === "complete" && outcome.brief) return go(outcome.brief);
      setError("Aún falta un poco de información. Agrega más detalles a tu descripción.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function updateDescription(value: string) {
    setDescription(value);
  }

  return (
    <PublicShell>
    <main className={styles.homePage}>
      <section className={styles.content} aria-labelledby="home-title">
        <div className={styles.intro}>
          <h1 id="home-title">Cuéntanos tu emprendimiento</h1>
        </div>

        {questions.length === 0 ? (
          <div className={styles.formArea}>
            <form className={styles.describeBox} onSubmit={(event) => { event.preventDefault(); void start(); }}>
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                rows={1}
                style={{ height: textareaHeight }}
                value={description}
                onChange={(event) => updateDescription(event.target.value)}
                placeholder="Cuéntanos qué ofreces…"
                aria-label="Describe tu emprendimiento"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    void start();
                  }
                }}
              />
              <button
                type="submit"
                className={styles.sendButton}
                aria-label={busy ? "Preparando tu página" : "Enviar descripción"}
                title="Enviar descripción"
                disabled={busy || !description.trim()}
              >
                {busy ? (
                  <span className={styles.spinner} aria-hidden="true" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M21.5 2.5 10.9 13.1m10.6-10.6-6.7 19-3.9-8.4-8.4-3.9 19-6.7Z" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </form>

            <div className={styles.suggestions} aria-label="Ideas para empezar">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  className={styles.suggestion}
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    updateDescription(suggestion);
                    textareaRef.current?.focus();
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.followUp}>
            <FollowUpPrompt
              questions={questions}
              answers={answers}
              onAnswer={(i, v) => setAnswers((a) => ({ ...a, [i]: v }))}
              onSubmit={finish}
              busy={busy}
            />
          </div>
        )}

        {error && <p className={styles.error} role="alert">{error}</p>}
      </section>
    </main>
    </PublicShell>
  );
}
