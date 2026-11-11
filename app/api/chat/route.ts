import { NextResponse } from "next/server";
import { z } from "zod";
import { BusinessBrief } from "@/lib/schemas/brief";
import { buildChatSystemPrompt } from "@/lib/ai/prompts/chatPrompt";

export const runtime = "nodejs";

const ChatMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

const Body = z.object({
  message: z.string().trim().min(1).max(1000),
  history: z.array(ChatMessage).max(20).default([]),
  brief: BusinessBrief,
  description: z.string().min(1),
});

const MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export async function POST(request: Request) {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "El chat no está configurado." },
      { status: 500 },
    );
  }

  const body = Body.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success) {
    return NextResponse.json(
      { error: "La solicitud no es válida." },
      { status: 400 },
    );
  }

  const { message, history, brief, description } = body.data;

  const systemPrompt = buildChatSystemPrompt(brief, description);

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ];

  let response: Response;

  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
        stream: true,
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudo conectar con el servicio de IA." },
      { status: 502 },
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      {
        error: `El servicio de IA respondió con un error (${response.status}).`,
      },
      { status: 502 },
    );
  }

  /**
   * Pipe the SSE stream from Groq back to the client as plain text chunks.
   *
   * The client reads this with a standard ReadableStream reader — no EventSource
   * needed, which avoids CORS and reconnection complexity.
   */
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          // Keep the last (potentially incomplete) line in the buffer.
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const payload = trimmed.slice(6);
            if (payload === "[DONE]") continue;

            try {
              const json = JSON.parse(payload);
              const token =
                json.choices?.[0]?.delta?.content;
              if (token) {
                controller.enqueue(encoder.encode(token));
              }
            } catch {
              // Skip malformed SSE lines.
            }
          }
        }
      } catch {
        // Stream interrupted — close gracefully.
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    },
  });
}
