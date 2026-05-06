import { getServiceSupabase } from "@/lib/supabase/server";

export interface KbHit {
  id: string;
  slug: string;
  title: string;
  body: string;
  tags: string[];
}

/**
 * Multi-pass full-text search over kb_articles. The trigger writes
 * search_tsv with the `simple` config (no stemming, no stopwords), so we
 * search with the same config.
 *
 *   1. websearch  — strict AND over the whole question.
 *   2. OR-tokens  — split into words, OR them, lenient match.
 *   3. ILIKE      — substring match against title/body when tsv tokens miss.
 */
export async function searchKnowledgeBase(
  query: string,
  limit = 3,
): Promise<KbHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const supabase = getServiceSupabase();

  // Pass 1 — websearch (strict).
  const { data: strict } = await supabase
    .from("kb_articles")
    .select("id, slug, title, body, tags")
    .textSearch("search_tsv", trimmed, { type: "websearch", config: "simple" })
    .limit(limit);
  if (strict && strict.length > 0) return strict.map(rowToHit);

  // Pass 2 — OR over significant tokens.
  const tokens = tokenize(trimmed);
  if (tokens.length > 0) {
    const orQuery = tokens.join(" | ");
    const { data: lenient } = await supabase
      .from("kb_articles")
      .select("id, slug, title, body, tags")
      .textSearch("search_tsv", orQuery, { type: "plain", config: "simple" })
      .limit(limit);
    if (lenient && lenient.length > 0) return lenient.map(rowToHit);
  }

  // Pass 3 — ILIKE fallback for substrings tsv won't catch.
  for (const tok of tokens) {
    const like = `%${tok.replace(/[%_\\]/g, "\\$&")}%`;
    const { data: ilike } = await supabase
      .from("kb_articles")
      .select("id, slug, title, body, tags")
      .or(`title.ilike.${like},body.ilike.${like}`)
      .limit(limit);
    if (ilike && ilike.length > 0) return ilike.map(rowToHit);
  }

  return [];
}

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "i", "me", "my", "we", "our", "you", "your", "they", "them", "their",
  "do", "does", "did", "of", "in", "on", "at", "to", "for", "with", "and",
  "or", "but", "if", "as", "by", "from", "this", "that", "these", "those",
  "can", "could", "would", "should", "have", "has", "had", "what", "when",
  "where", "why", "how", "much", "any", "some", "there", "here",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function rowToHit(row: {
  id: string;
  slug: string;
  title: string;
  body: string;
  tags: string[] | null;
}): KbHit {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    body: row.body,
    tags: row.tags ?? [],
  };
}

/** Concatenate hits into a system-prompt-friendly block. */
export function formatHitsForPrompt(hits: KbHit[]): string {
  if (hits.length === 0) return "(no matches)";
  return hits
    .map(
      (h, i) =>
        `[${i + 1}] ${h.title}\n${h.body}\nTags: ${h.tags.join(", ") || "—"}`,
    )
    .join("\n\n");
}
