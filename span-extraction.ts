export type SemanticSpan = {
  start: number;
  end: number;
  text: string;
  score: number;
};

export type SpanRanker = (candidateText: string, normalizedQuery: string) => number;

type Candidate = {
  start: number;
  end: number;
  text: string;
};

const TOKEN_RE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu;
const PARAGRAPH_BREAK_RE = /(?:\r?\n[\t \f\v]*){2,}/g;
const SENTENCE_END_RE = /(?<=[.!?])(?:["'’)\]]*)\s+/gu;

function codepoints(text: string): string[] {
  return Array.from(text);
}

function codeUnitToCodepointMap(text: string): number[] {
  const map = new Array<number>(text.length + 1).fill(0);
  let codeUnitIndex = 0;
  let codepointIndex = 0;
  for (const point of text) {
    for (let offset = 0; offset < point.length; offset += 1) {
      map[codeUnitIndex + offset] = codepointIndex;
    }
    codeUnitIndex += point.length;
    codepointIndex += 1;
    map[codeUnitIndex] = codepointIndex;
  }
  return map;
}

function trimCandidate(points: string[], start: number, end: number): Candidate | null {
  while (start < end && /\s/u.test(points[start])) start += 1;
  while (end > start && /\s/u.test(points[end - 1])) end -= 1;
  return start < end ? { start, end, text: points.slice(start, end).join("") } : null;
}

function splitLongSegment(points: string[], start: number, end: number, limit: number): Candidate[] {
  const pieces: Candidate[] = [];
  let cursor = start;
  while (cursor < end) {
    let boundary = Math.min(end, cursor + limit);
    if (boundary < end) {
      const earliestBreak = cursor + Math.max(1, Math.floor(limit / 2));
      for (let index = boundary; index >= earliestBreak; index -= 1) {
        if (/\s/u.test(points[index - 1])) {
          boundary = index;
          break;
        }
      }
    }
    const candidate = trimCandidate(points, cursor, boundary);
    if (candidate) pieces.push(candidate);
    cursor = boundary;
    while (cursor < end && /\s/u.test(points[cursor])) cursor += 1;
  }
  return pieces;
}

function findRanges(text: string, expression: RegExp, start = 0, end = text.length): Array<[number, number]> {
  const mapping = codeUnitToCodepointMap(text);
  const ranges: Array<[number, number]> = [];
  expression.lastIndex = start;
  let cursor = start;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(text)) && match.index < end) {
    ranges.push([mapping[cursor], mapping[match.index]]);
    cursor = match.index + match[0].length;
    if (!match[0].length) expression.lastIndex += 1;
  }
  ranges.push([mapping[cursor], mapping[end]]);
  return ranges;
}

function candidates(text: string, maxSpanChars: number): Candidate[] {
  const points = codepoints(text);
  const mapping = codeUnitToCodepointMap(text);
  const paragraphRanges = findRanges(text, PARAGRAPH_BREAK_RE);
  const all: Candidate[] = [];

  for (const [paragraphStart, paragraphEnd] of paragraphRanges) {
    const paragraphStartUnits = text.slice(0, mapping.findIndex((value) => value === paragraphStart)).length;
    let paragraphEndUnits = text.length;
    for (let index = paragraphStartUnits; index < mapping.length; index += 1) {
      if (mapping[index] === paragraphEnd) {
        paragraphEndUnits = index;
        break;
      }
    }
    const sentenceRanges = findRanges(text, SENTENCE_END_RE, paragraphStartUnits, paragraphEndUnits);
    const sentenceCandidates: Candidate[] = [];
    for (const [start, end] of sentenceRanges) {
      const candidate = trimCandidate(points, start, end);
      if (!candidate) continue;
      if (candidate.end - candidate.start <= maxSpanChars) {
        sentenceCandidates.push(candidate);
      } else {
        sentenceCandidates.push(...splitLongSegment(points, candidate.start, candidate.end, maxSpanChars));
      }
    }
    all.push(...sentenceCandidates);
    for (let index = 0; index + 1 < sentenceCandidates.length; index += 1) {
      const start = sentenceCandidates[index].start;
      const end = sentenceCandidates[index + 1].end;
      if (end - start <= maxSpanChars) {
        all.push({ start, end, text: points.slice(start, end).join("") });
      }
    }
  }

  return [...new Map(all.map((candidate) => [`${candidate.start}:${candidate.end}`, candidate])).values()]
    .sort((left, right) => left.start - right.start || left.end - right.end);
}

function tokens(text: string): string[] {
  return [...text.matchAll(TOKEN_RE)].map((match) => match[0].toLocaleLowerCase());
}

function lexicalScore(candidate: Candidate, query: string, total: number): number {
  const candidateTokens = tokens(candidate.text);
  if (!candidateTokens.length) return 0;
  const uniqueTokens = new Set(candidateTokens);
  const lexicalDensity = Math.min(candidateTokens.length, 80) / Math.max(1, codepoints(candidate.text).length / 8);
  const diversity = uniqueTokens.size / candidateTokens.length;
  const densityScore = Math.min(1, lexicalDensity / 4) + 0.2 * diversity;
  const positionPrior = 0.08 * (1 - candidate.start / Math.max(1, total));
  const queryTokens = tokens(query);
  if (!queryTokens.length) return densityScore + positionPrior;

  const queryUnique = new Set(queryTokens);
  const termOverlap = [...queryUnique].filter((token) => uniqueTokens.has(token)).length / queryUnique.size;
  const queryShingles = new Set(queryTokens.slice(0, -1).map((token, index) => `${token}\0${queryTokens[index + 1]}`));
  const candidateShingles = new Set(candidateTokens.slice(0, -1).map((token, index) => `${token}\0${candidateTokens[index + 1]}`));
  const shingleOverlap = queryShingles.size
    ? [...queryShingles].filter((shingle) => candidateShingles.has(shingle)).length / queryShingles.size
    : 0;
  const occurrences = [...queryUnique].reduce(
    (sum, token) => sum + candidateTokens.filter((candidateToken) => candidateToken === token).length,
    0,
  );
  const occurrenceBonus = Math.min(1, occurrences / Math.max(1, queryTokens.length));
  return 4 * termOverlap + 2 * shingleOverlap + 0.5 * occurrenceBonus + 0.2 * densityScore + positionPrior;
}

export function selectSpans(
  text: string,
  query?: string,
  options: { maxSpans?: number; maxSpanChars?: number; ranker?: SpanRanker } = {},
): SemanticSpan[] {
  const maxSpans = options.maxSpans ?? 3;
  const maxSpanChars = options.maxSpanChars ?? 600;
  if (!Number.isInteger(maxSpans) || !Number.isInteger(maxSpanChars)) throw new TypeError("Span limits must be integers");
  if (maxSpans <= 0 || maxSpanChars <= 0) return [];
  const normalized = text.normalize("NFC");
  const normalizedQuery = (query || "").normalize("NFC").trim();
  const ranked = candidates(normalized, maxSpanChars).map((candidate) => {
    const score = options.ranker
      ? options.ranker(candidate.text, normalizedQuery)
      : lexicalScore(candidate, normalizedQuery, codepoints(normalized).length);
    if (!Number.isFinite(score)) throw new Error("Span ranker scores must be finite numbers");
    return { candidate, score };
  });
  ranked.sort((left, right) => right.score - left.score || left.candidate.start - right.candidate.start || left.candidate.end - right.candidate.end);

  const selected: Array<{ candidate: Candidate; score: number }> = [];
  for (const item of ranked) {
    if (selected.some(({ candidate }) => item.candidate.start < candidate.end && candidate.start < item.candidate.end)) continue;
    selected.push(item);
    if (selected.length >= maxSpans) break;
  }
  selected.sort((left, right) => left.candidate.start - right.candidate.start);
  return selected.map(({ candidate, score }) => ({ ...candidate, score }));
}
