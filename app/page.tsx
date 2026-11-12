"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { FollowUpPrompt } from "@/components/intake";
import { StylePicker } from "@/components/intake/StylePicker";
import { PublicShell } from "@/components/app/PublicShell";
import type { BusinessBrief, FollowUpQuestion } from "@/lib/schemas/brief";
import type { LandingStyleId } from "@/lib/schemas/primitives";
import { newProjectId, saveProject } from "@/lib/store";
import { recommendedStyle } from "@/lib/styles/landingStyles";
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
  const [questions, setQuestions] = useState<FollowUpQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [partial, setPartial] = useState<Partial<BusinessBrief>>({});
  /** Set once the brief is complete: the last step is choosing the style. */
  const [pendingBrief, setPendingBrief] = useState<BusinessBrief | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Grow the description box with its text (up to the CSS max-height, then it
  // scrolls). Measured with the height transition off, because measuring while
  // it animates returns the in-between height. Set on the element directly, so
  // an unchanged height can't leave it stuck at the measuring size.
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const fit = () => {
      const previous = textarea.style.height;
      textarea.style.transition = "none";
      textarea.style.height = "auto";
      const next = `${Math.min(textarea.scrollHeight, 240)}px`;
      textarea.style.height = previous || next;
      void textarea.offsetHeight; // commit the old height so the transition starts from it
      textarea.style.transition = "";
      textarea.style.height = next;
    };

    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
    // Re-run when the box remounts (coming back from the questions or style step).
  }, [description, pendingBrief, questions.length]);

  function chooseStyle(brief: BusinessBrief) {
    setPendingBrief(brief);
  }

  function go(brief: BusinessBrief, style: LandingStyleId) {
    setBusy(true);
    const id = newProjectId();
    const project = { id, description, brief: { ...brief, style }, sections: [], createdAt: new Date().toISOString() };
    saveProject(project);
    router.push(`/project/${id}`);
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const outcome = await post("/api/parse-brief", { description });
      if (outcome.status === "complete" && outcome.brief) return chooseStyle(outcome.brief);
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
      if (outcome.status === "complete" && outcome.brief) return chooseStyle(outcome.brief);
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
          <h1 id="home-title">{pendingBrief ? "Elige el estilo de tu landing" : "Cuéntanos tu emprendimiento"}</h1>
        </div>

        {pendingBrief ? (
          <StylePicker
            recommended={recommendedStyle(pendingBrief)}
            businessLabel={pendingBrief.hasBusinessName && pendingBrief.businessName.trim() ? pendingBrief.businessName : "Tu emprendimiento"}
            busy={busy}
            onBack={() => setPendingBrief(null)}
            onConfirm={(style) => go(pendingBrief, style)}
          />
        ) : questions.length === 0 ? (
          <div className={styles.formArea}>
            <form className={styles.describeBox} onSubmit={(event) => { event.preventDefault(); void start(); }}>
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                rows={1}
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
