/**
 * Minimal OpenRouter client. Uses the OpenAI-compatible chat-completions
 * endpoint, which means we can swap models (Claude / GPT / Gemini) by
 * changing OPENROUTER_MODEL without touching code.
 */

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export interface ChatRole {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatRole[];
  model?: string;
  /** Set true to ask for JSON-mode output. */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  /** Hard cap on the round-trip; OpenRouter sometimes hangs on cold models. */
  timeoutMs?: number;
}

export class OpenRouterError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export async function chatCompletion(opts: ChatCompletionOptions): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new OpenRouterError("OPENROUTER_API_KEY is not set in env.");
  }

  const model = opts.model ?? process.env.OPENROUTER_MODEL ?? "anthropic/claude-haiku-4.5";
  const referer = process.env.APP_URL || "http://localhost:3000";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 25_000);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": referer,
        "X-Title": "Kick Off Coach",
      },
      body: JSON.stringify({
        model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 800,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new OpenRouterError("OpenRouter request timed out.");
    }
    throw new OpenRouterError(
      `OpenRouter network error: ${err instanceof Error ? err.message : "unknown"}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new OpenRouterError(
      `OpenRouter ${res.status}: ${body.slice(0, 300) || res.statusText}`,
      res.status,
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new OpenRouterError("OpenRouter returned an empty response.");
  }
  return content;
}
