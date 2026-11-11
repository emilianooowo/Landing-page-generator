"use client";

import { Component, type ReactNode } from "react";

type Props = { sectionType: string; children: ReactNode };
type State = { error: Error | null };

/**
 * The schema layer stops bad DATA. This stops bad RENDERING — a variant that
 * throws on an edge case its schema happily allowed. Without it, one broken
 * component unmounts the entire preview tree, which is exactly the failure the
 * brief says must never happen.
 */
export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`Section "${this.props.sectionType}" failed to render:`, error);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <section
        style={{
          padding: "4rem 1.5rem",
          background: "var(--page-surface)",
          borderBlock: "1px solid var(--page-border)",
          color: "var(--page-muted)",
          textAlign: "center",
        }}
      >
        <p>No se pudo mostrar esta sección de la página.</p>
        {process.env.NODE_ENV !== "production" && (
          <pre
            style={{
              marginTop: "0.75rem",
              fontSize: "0.75rem",
              whiteSpace: "pre-wrap",
              textAlign: "left",
            }}
          >
            {this.state.error.message}
          </pre>
        )}
      </section>
    );
  }
}
