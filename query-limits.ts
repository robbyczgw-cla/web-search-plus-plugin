/**
 * Per-provider query length limits (Hermes Web Search Plus 5.0.1/5.0.2 idea,
 * reduced to what this plugin sends: it appends no site: operators).
 *
 * Only limits the provider documents belong here. Brave's Web Search API
 * accepts at most 600 characters and 75 words in `q`.
 */
export const MAX_QUERY_CHARS = 2000;

export type QueryLimit = { chars: number; words: number };

export const PROVIDER_QUERY_LIMITS: Record<string, QueryLimit> = {
  brave: { chars: 600, words: 75 },
};

export type QueryFit = {
  query: string;
  /** Present only when the query was shortened; sizes only, never query text. */
  truncated?: { provider: string; limit_chars: number; limit_words: number; original_chars: number; original_words: number; sent_chars: number; sent_words: number };
};

export function capQueryLength(query: string): string {
  const chars = Array.from(query);
  return chars.length > MAX_QUERY_CHARS ? chars.slice(0, MAX_QUERY_CHARS).join("").trim() : query;
}

/** Shorten `text` at a word boundary so it fits the provider's documented limit. */
export function fitQuery(provider: string, text: string): QueryFit {
  const limit = PROVIDER_QUERY_LIMITS[provider];
  const words = text.split(/\s+/).filter(Boolean);
  if (!limit || (text.length <= limit.chars && words.length <= limit.words)) return { query: text };

  const kept: string[] = [];
  let used = 0;
  for (const word of words) {
    const add = word.length + (kept.length ? 1 : 0);
    if (used + add > limit.chars || kept.length + 1 > limit.words) break;
    kept.push(word);
    used += add;
  }
  // One token longer than the limit: cut it rather than send nothing.
  if (!kept.length && words.length) kept.push(words[0].slice(0, limit.chars));
  const query = kept.join(" ");
  return {
    query,
    truncated: {
      provider,
      limit_chars: limit.chars,
      limit_words: limit.words,
      original_chars: text.length,
      original_words: words.length,
      sent_chars: query.length,
      sent_words: kept.length,
    },
  };
}
