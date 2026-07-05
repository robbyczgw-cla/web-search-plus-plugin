// Config-first search locale resolution with query-aware language inference
// (Hermes v2.9 parity).
//
// Providers with country/language request parameters used to receive hardcoded
// us/en defaults. Resolution is now centralized here:
//
// - Country is config-first. Precedence: explicit location hint in the query
//   (curated city/country table) > pluginConfig.localeCountry > "us".
// - Language is query-aware. Precedence: pluginConfig.localeLanguage; the
//   value "auto" enables conservative query language inference > "en".
//
// Query language never implies a country: a German query may come from Austria
// or Switzerland just as well as Germany, so only explicit location hints or
// configuration move the region.

import type { RuntimeConfig } from "./runtime-config.ts";

type Json = Record<string, any>;

export const FALLBACK_COUNTRY = "us";
export const FALLBACK_LANGUAGE = "en";

// localeLanguage value that enables query language inference.
export const AUTO_LANGUAGE = "auto";

// Providers whose request carries country and/or language parameters. The
// plugin's SerpBase endpoint takes no locale parameters, so it is absent here.
export const LOCALE_PROVIDERS = new Set(["serper", "brave", "querit", "firecrawl", "you", "searxng"]);

// Small curated table of unambiguous location hints. Only well-known city and
// country names are listed; generic example queries such as
// "mejores restaurantes Madrid" resolve to the matching country.
// Deliberately small: unknown places simply do not hint.
export const LOCATION_COUNTRY_HINTS: Record<string, string> = {
  // Austria
  wien: "at", vienna: "at", graz: "at", salzburg: "at",
  innsbruck: "at", "österreich": "at", austria: "at",
  // Germany
  berlin: "de", "münchen": "de", munich: "de", hamburg: "de",
  frankfurt: "de", deutschland: "de", germany: "de",
  // Switzerland
  "zürich": "ch", zurich: "ch", schweiz: "ch", switzerland: "ch",
  // France
  paris: "fr", lyon: "fr", marseille: "fr", france: "fr",
  // Spain
  madrid: "es", barcelona: "es", "españa": "es", spain: "es",
  // Italy
  rome: "it", roma: "it", milano: "it", milan: "it", italia: "it", italy: "it",
  // Portugal
  lisbon: "pt", lisboa: "pt", portugal: "pt",
  // Netherlands
  amsterdam: "nl", rotterdam: "nl", netherlands: "nl",
  // United Kingdom
  london: "gb", manchester: "gb", "united kingdom": "gb",
  // United States
  "new york": "us", chicago: "us", "san francisco": "us", usa: "us",
};

// Minimum number of distinct signals before a language inference is trusted.
export const LANGUAGE_INFERENCE_MIN_MATCHES = 2;

// Common function/search words per supported language. Words shared between
// languages (e.g. "que" in es/fr/pt) may appear in several sets; the strict
// single-winner rule in inferQueryLanguage keeps those from mis-firing.
const LANGUAGE_INFERENCE_STOPWORDS: Record<string, Set<string>> = {
  en: new Set(["the", "and", "what", "how", "where", "when", "which", "who", "best", "near", "hours", "open", "with", "from", "for", "are", "is", "was", "does", "latest", "today", "new"]),
  de: new Set(["der", "die", "das", "und", "oder", "nicht", "ist", "sind", "ein", "eine", "einen", "mit", "für", "von", "wie", "wo", "was", "warum", "welche", "beste", "besten", "gibt", "öffnungszeiten", "heute", "morgen", "preis", "kaufen", "günstig", "nähe"]),
  es: new Set(["el", "los", "las", "una", "unos", "que", "qué", "cómo", "dónde", "cuál", "por", "para", "con", "mejores", "mejor", "cerca", "hoy", "horario", "horarios", "abierto", "abiertos", "tiendas", "restaurantes", "precio", "precios", "donde", "como"]),
  fr: new Set(["le", "les", "des", "une", "du", "où", "quel", "quelle", "quels", "quelles", "meilleur", "meilleure", "meilleurs", "meilleures", "horaires", "ouvert", "ouverts", "ouverture", "aujourd", "hui", "près", "proche", "avec", "pour", "prix", "cher", "que"]),
  it: new Set(["il", "lo", "gli", "che", "come", "dove", "quale", "quali", "migliori", "migliore", "orari", "orario", "aperto", "aperti", "vicino", "con", "oggi", "prezzo", "prezzi", "negozi", "ristoranti", "della", "delle"]),
  pt: new Set(["os", "do", "dos", "das", "um", "uma", "que", "como", "onde", "qual", "quais", "melhores", "melhor", "horários", "aberto", "perto", "hoje", "preço", "lojas", "com", "você", "para", "restaurantes"]),
  nl: new Set(["het", "een", "waar", "hoe", "welke", "beste", "goedkoop", "goedkoopste", "vandaag", "morgen", "openingstijden", "winkel", "winkels", "dichtbij", "buurt", "naar", "zijn", "niet", "voor"]),
};

// Distinctive characters that count as one additional signal per language.
const LANGUAGE_INFERENCE_CHAR_HINTS: Record<string, string> = {
  de: "äöüß",
  es: "ñ¿¡",
  pt: "ãõ",
  fr: "œ",
};

export function providerSupportsLocale(provider: string): boolean {
  return LOCALE_PROVIDERS.has(provider);
}

// Return the ISO 3166-1 alpha-2 country for an explicit location hint. Only
// returns a country when every hint in the query agrees on a single country;
// conflicting hints (e.g. a "Paris vs Madrid" comparison) resolve to null so
// configuration keeps deciding.
export function detectLocationCountry(query?: string | null): string | null {
  if (!query) return null;
  const lowered = query.toLowerCase();
  const countries = new Set<string>();
  for (const [place, country] of Object.entries(LOCATION_COUNTRY_HINTS)) {
    const escaped = place.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}($|[^\\p{L}\\p{N}_])`, "iu").test(lowered)) countries.add(country);
  }
  return countries.size === 1 ? [...countries][0] : null;
}

// Infer the query language conservatively for locale defaults. Returns an ISO
// 639-1 code when at least LANGUAGE_INFERENCE_MIN_MATCHES distinct signals
// point to a single language that strictly beats every other candidate.
// Returns null when the evidence is missing or ambiguous so callers fall back
// to their configured default (for example "Wiener Kaffeehaus Öffnungszeiten"
// infers "de", while a terse technical query such as "DAC R2R NOS" infers
// nothing).
export function inferQueryLanguage(query: string): string | null {
  if (!query) return null;
  const lowered = query.toLowerCase();
  const words = new Set(lowered.match(/[\p{L}\p{N}_]+/gu) || []);
  const counts: Record<string, number> = {};
  for (const [language, stopwords] of Object.entries(LANGUAGE_INFERENCE_STOPWORDS)) {
    let count = 0;
    for (const word of words) if (stopwords.has(word)) count += 1;
    for (const char of LANGUAGE_INFERENCE_CHAR_HINTS[language] || "") {
      if (lowered.includes(char)) count += 1;
    }
    if (count) counts[language] = count;
  }
  const ranked = Object.entries(counts).sort(([la, ca], [lb, cb]) => cb - ca || la.localeCompare(lb));
  if (!ranked.length) return null;
  const [bestLanguage, bestCount] = ranked[0];
  if (bestCount < LANGUAGE_INFERENCE_MIN_MATCHES) return null;
  if (ranked.length > 1 && ranked[1][1] === bestCount) return null;
  return bestLanguage;
}

export type ResolvedLocale = {
  country: string;
  language: string;
  metadata: Json;
};

// Resolve (country, language, metadata) for a provider request.
//
// Precedence:
//   country:  location hint in query > pluginConfig.localeCountry > "us"
//   language: pluginConfig.localeLanguage ("auto" enables conservative query
//             inference) > "en"
//
// The metadata dict follows the freshness/search_type reporting pattern.
// Country codes are normalized to lowercase; providers that need uppercase
// upper-case them in their own request builders.
export function resolveLocale(provider: string, runtimeConfig: RuntimeConfig, query?: string | null): ResolvedLocale {
  const configuredCountry = String(runtimeConfig.localeCountry || "").trim().toLowerCase();
  const configuredLanguage = String(runtimeConfig.localeLanguage || "").trim().toLowerCase();

  let country: string;
  let countrySource: string;
  const hinted = detectLocationCountry(query);
  if (hinted) {
    country = hinted;
    countrySource = "hint";
  } else if (configuredCountry) {
    country = configuredCountry;
    countrySource = "config";
  } else {
    country = FALLBACK_COUNTRY;
    countrySource = "fallback";
  }

  let language: string;
  let languageSource: string;
  const autoLanguage = configuredLanguage === AUTO_LANGUAGE;
  if (configuredLanguage && !autoLanguage) {
    language = configuredLanguage;
    languageSource = "config";
  } else {
    const inferred = autoLanguage ? inferQueryLanguage(query || "") : null;
    if (inferred) {
      language = inferred;
      languageSource = "inferred";
    } else {
      language = FALLBACK_LANGUAGE;
      languageSource = "fallback";
    }
  }

  return {
    country,
    language,
    metadata: { country, language, source: { country: countrySource, language: languageSource } },
  };
}
