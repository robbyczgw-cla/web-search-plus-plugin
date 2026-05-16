import type { RuntimeConfig } from "./runtime-config.ts";

type Json = Record<string, any>;

export type ExtractProviderName = "tavily" | "exa" | "linkup" | "firecrawl" | "you";
export type ExtractFormat = "markdown" | "html";

export type ExtractImage = {
  alt?: string;
  url: string;
};

export type ExtractResult = {
  url: string;
  title: string;
  content: string;
  raw_content: string;
  provider: ExtractProviderName;
  images?: ExtractImage[];
  raw_html?: string;
  metadata?: Json;
  error?: string;
};

export type ExtractResponse = {
  provider: string;
  results: ExtractResult[];
  error?: string;
  fallback_errors?: Json[];
  routing?: {
    provider?: string;
    requested_provider: string;
    fallback_used?: boolean;
    fallback_errors?: Json[];
  };
};

export const EXTRACT_PROVIDER_PRIORITY: ExtractProviderName[] = ["tavily", "exa", "linkup", "firecrawl", "you"];
export const EXTRACT_PARAMETERS_SCHEMA = {
  type: "object",
  required: ["urls"],
  properties: {
    urls: { type: "array", items: { type: "string" }, description: "URLs to extract" },
    provider: {
      type: "string",
      enum: ["auto", "firecrawl", "linkup", "tavily", "exa", "you"],
      description: "Force a provider, or use auto fallback routing (default: auto)",
    },
    format: {
      type: "string",
      enum: ["markdown", "html"],
      description: "Output format for extracted content (default: markdown)",
    },
    include_images: { type: "boolean", description: "Include image metadata when supported" },
    include_raw_html: { type: "boolean", description: "Include raw HTML when supported" },
    render_js: { type: "boolean", description: "Render JavaScript before extraction when supported" },
  },
};

function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split("/").filter(Boolean).pop();
    return lastSegment || parsed.hostname || url;
  } catch {
    return url;
  }
}

function normalizeExtractResult(
  provider: ExtractProviderName,
  url: string,
  title = "",
  content = "",
  rawContent?: string,
  extra: Partial<Omit<ExtractResult, "url" | "title" | "content" | "raw_content" | "provider">> = {},
): ExtractResult {
  const result: ExtractResult = {
    url,
    title: title || titleFromUrl(url),
    content: content || "",
    raw_content: rawContent ?? content ?? "",
    provider,
  };
  for (const [key, value] of Object.entries(extra)) {
    if (value != null) (result as any)[key] = value;
  }
  return result;
}

function normalizeImages(images: any): ExtractImage[] | undefined {
  if (!Array.isArray(images)) return undefined;
  const normalized = images
    .map((image) => {
      if (!image) return null;
      if (typeof image === "string") return { url: image };
      if (typeof image.url === "string" && image.url) {
        return { alt: typeof image.alt === "string" ? image.alt : undefined, url: image.url };
      }
      return null;
    })
    .filter(Boolean) as ExtractImage[];
  return normalized.length ? normalized : undefined;
}

async function requestJson(url: string, init: RequestInit, timeout = 30): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeout) * 1000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const message = data?.error || data?.message || data?.detail || data?.warning || `HTTP ${response.status}`;
      throw new Error(String(message));
    }
    return data;
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error(`Request timed out after ${timeout}s`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function getExtractApiKey(provider: ExtractProviderName, runtimeConfig: RuntimeConfig): string | undefined {
  const keyMap: Record<ExtractProviderName, string | undefined> = {
    firecrawl: runtimeConfig.firecrawlApiKey,
    linkup: runtimeConfig.linkupApiKey,
    tavily: runtimeConfig.tavilyApiKey,
    exa: runtimeConfig.exaApiKey,
    you: runtimeConfig.youApiKey,
  };
  return keyMap[provider];
}

export function hasAnyExtractProviderCredential(runtimeConfig: RuntimeConfig): boolean {
  return EXTRACT_PROVIDER_PRIORITY.some((provider) => Boolean(getExtractApiKey(provider, runtimeConfig)));
}

export async function extractFirecrawl(
  urls: string[],
  apiKey: string,
  outputFormat: ExtractFormat = "markdown",
  includeImages = false,
  includeRawHtml = false,
  renderJs = false,
  apiUrl = "https://api.firecrawl.dev/v2/scrape",
  timeout = 60,
): Promise<ExtractResponse> {
  const formats = outputFormat === "html" ? ["html"] : ["markdown"];
  if (includeRawHtml && !formats.includes("html")) formats.push("html");

  const results: ExtractResult[] = [];
  for (const url of urls) {
    try {
      const body: Json = { url, formats };
      if (renderJs) body.waitFor = 1000;
      const data = await requestJson(apiUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, timeout);

      if (data?.success === false) {
        results.push(normalizeExtractResult("firecrawl", url, "", "", undefined, { error: String(data.error || data.warning || "Firecrawl scrape failed") }));
        continue;
      }

      const payload = data?.data && typeof data.data === "object" ? data.data : data;
      const metadata = payload?.metadata && typeof payload.metadata === "object" ? payload.metadata : {};
      const finalUrl = metadata.sourceURL || metadata.url || url;
      const title = metadata.title || "";
      const markdown = String(payload?.markdown || "");
      const html = String(payload?.html || payload?.rawHtml || "");
      const content = outputFormat === "html" ? html : markdown || html;

      let images: ExtractImage[] | undefined;
      if (includeImages) {
        const seen = new Set<string>();
        const parsedImages: ExtractImage[] = [];
        const ogImage = metadata.ogImage || metadata["og:image"];
        if (typeof ogImage === "string" && ogImage && !seen.has(ogImage)) {
          parsedImages.push({ alt: "og:image", url: ogImage });
          seen.add(ogImage);
        }
        for (const match of markdown.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
          const imageUrl = match[2];
          if (!imageUrl || seen.has(imageUrl)) continue;
          parsedImages.push({ alt: match[1] || undefined, url: imageUrl });
          seen.add(imageUrl);
        }
        images = parsedImages.length ? parsedImages : undefined;
      }

      results.push(normalizeExtractResult("firecrawl", finalUrl, title, content, content, {
        raw_html: html || undefined,
        images,
        metadata,
      }));
    } catch (error: any) {
      results.push(normalizeExtractResult("firecrawl", url, "", "", undefined, { error: String(error?.message || error) }));
    }
  }

  return { provider: "firecrawl", results };
}

export async function extractLinkup(
  urls: string[],
  apiKey: string,
  outputFormat: ExtractFormat = "markdown",
  includeImages = false,
  includeRawHtml = false,
  renderJs = false,
  apiUrl = "https://api.linkup.so/v1/fetch",
  timeout = 30,
): Promise<ExtractResponse> {
  const results: ExtractResult[] = [];
  for (const url of urls) {
    try {
      const data = await requestJson(apiUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          extractImages: includeImages,
          includeRawHtml: includeRawHtml || outputFormat === "html",
          renderJs,
        }),
      }, timeout);

      if (data?.error) {
        results.push(normalizeExtractResult("linkup", url, "", "", undefined, { error: String(data.error) }));
        continue;
      }

      const markdown = String(data?.markdown || "");
      const rawHtml = String(data?.rawHtml || data?.raw_html || "");
      const content = outputFormat === "html" ? rawHtml : markdown || rawHtml;
      results.push(normalizeExtractResult("linkup", url, "", content, content, {
        raw_html: rawHtml || undefined,
        images: includeImages ? normalizeImages(data?.images) : undefined,
        metadata: data?.metadata && typeof data.metadata === "object" ? data.metadata : undefined,
      }));
    } catch (error: any) {
      results.push(normalizeExtractResult("linkup", url, "", "", undefined, { error: String(error?.message || error) }));
    }
  }
  return { provider: "linkup", results };
}

export async function extractTavily(
  urls: string[],
  apiKey: string,
  outputFormat: ExtractFormat = "markdown",
  includeImages = false,
  _includeRawHtml = false,
  _renderJs = false,
  apiUrl = "https://api.tavily.com/extract",
  timeout = 30,
): Promise<ExtractResponse> {
  void outputFormat;
  const data = await requestJson(apiUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ urls, include_images: includeImages }),
  }, timeout);

  const results: ExtractResult[] = [];
  for (const item of Array.isArray(data?.results) ? data.results : []) {
    const url = String(item?.url || "");
    const content = String(item?.raw_content || item?.content || "");
    results.push(normalizeExtractResult("tavily", url, String(item?.title || ""), content, content, {
      images: includeImages ? normalizeImages(item?.images) : undefined,
      metadata: item?.metadata && typeof item.metadata === "object" ? item.metadata : undefined,
    }));
  }
  for (const failed of Array.isArray(data?.failed_results) ? data.failed_results : []) {
    results.push(normalizeExtractResult("tavily", String(failed?.url || ""), "", "", undefined, {
      error: String(failed?.error || "Tavily extract failed"),
    }));
  }

  return { provider: "tavily", results };
}

export async function extractExa(
  urls: string[],
  apiKey: string,
  outputFormat: ExtractFormat = "markdown",
  includeImages = false,
  _includeRawHtml = false,
  _renderJs = false,
  apiUrl = "https://api.exa.ai/contents",
  timeout = 30,
): Promise<ExtractResponse> {
  void outputFormat;
  const data = await requestJson(apiUrl, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ urls, text: true }),
  }, timeout);

  const results = (Array.isArray(data?.results) ? data.results : []).map((item: any) => {
    const url = String(item?.url || item?.id || "");
    const content = String(item?.text || item?.summary || "");
    const metadata: Json = {};
    if (item?.summary != null) metadata.summary = item.summary;
    if (item?.highlights != null) metadata.highlights = item.highlights;
    if (item?.publishedDate != null) metadata.published_date = item.publishedDate;
    if (item?.author != null) metadata.author = item.author;
    if (item?.favicon != null) metadata.favicon = item.favicon;
    return normalizeExtractResult("exa", url, String(item?.title || ""), content, content, {
      images: includeImages && item?.image ? [{ alt: "image", url: String(item.image) }] : undefined,
      metadata: Object.keys(metadata).length ? metadata : undefined,
    });
  });

  return { provider: "exa", results };
}

export async function extractYou(
  urls: string[],
  apiKey: string,
  outputFormat: ExtractFormat = "markdown",
  includeImages = false,
  includeRawHtml = false,
  _renderJs = false,
  apiUrl = "https://ydc-index.io/v1/contents",
  timeout = 30,
): Promise<ExtractResponse> {
  void includeImages;
  const formats = [outputFormat === "html" ? "html" : "markdown"];
  if (includeRawHtml && !formats.includes("html")) formats.push("html");
  if (!formats.includes("metadata")) formats.push("metadata");
  const data = await requestJson(apiUrl, {
    method: "POST",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ urls, formats, crawl_timeout: Math.max(1, Math.min(timeout, 60)) }),
  }, timeout);

  const rawItems = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : Array.isArray(data?.data) ? data.data : [];
  const results = rawItems.map((item: any) => {
    const url = String(item?.url || "");
    const markdown = String(item?.markdown || "");
    const html = String(item?.html || "");
    const content = outputFormat === "html" ? html : markdown || html;
    return normalizeExtractResult("you", url, String(item?.title || ""), content, content, {
      raw_html: html || undefined,
      metadata: item?.metadata && typeof item.metadata === "object" ? item.metadata : undefined,
    });
  });

  return { provider: "you", results };
}

export async function extractPlus(
  urls: string[],
  provider: ExtractProviderName | "auto" = "auto",
  outputFormat: ExtractFormat = "markdown",
  includeImages = false,
  includeRawHtml = false,
  renderJs = false,
  runtimeConfig: RuntimeConfig = {},
): Promise<ExtractResponse> {
  const requestedProvider = provider || "auto";
  if (!Array.isArray(urls) || urls.length === 0) {
    return {
      provider: requestedProvider,
      results: [],
      error: "No URLs provided",
      routing: { requested_provider: requestedProvider },
    };
  }

  const cleanedUrls = urls.map((url) => (typeof url === "string" ? url.trim() : url));
  const invalidUrls = cleanedUrls.filter((url) => typeof url !== "string" || !/^https?:\/\//.test(url));
  if (invalidUrls.length) {
    return {
      provider: requestedProvider,
      results: [],
      error: `Invalid URL(s) — must start with http:// or https://: ${JSON.stringify(invalidUrls)}`,
      routing: { requested_provider: requestedProvider },
    };
  }

  const providers = requestedProvider === "auto"
    ? EXTRACT_PROVIDER_PRIORITY
    : [requestedProvider, ...EXTRACT_PROVIDER_PRIORITY.filter((item) => item !== requestedProvider)] as ExtractProviderName[];

  const errors: Json[] = [];
  for (const currentProvider of providers) {
    if (!EXTRACT_PROVIDER_PRIORITY.includes(currentProvider)) {
      errors.push({ provider: currentProvider, error: `Provider ${currentProvider} does not support extraction` });
      continue;
    }

    const providerCredential = getExtractApiKey(currentProvider, runtimeConfig);
    if (!providerCredential) {
      errors.push({ provider: currentProvider, error: "missing_api_key" });
      continue;
    }

    try {
      let result: ExtractResponse;
      if (currentProvider === "tavily") {
        result = await extractTavily(cleanedUrls as string[], providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "exa") {
        result = await extractExa(cleanedUrls as string[], providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "linkup") {
        result = await extractLinkup(cleanedUrls as string[], providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "firecrawl") {
        result = await extractFirecrawl(cleanedUrls as string[], providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else {
        result = await extractYou(cleanedUrls as string[], providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      }

      const resultList = Array.isArray(result.results) ? result.results : [];
      const allUrlsFailed = resultList.length > 0 && resultList.every((item) => item?.error);
      if (allUrlsFailed) {
        errors.push({ provider: currentProvider, error: "all_urls_failed", details: resultList.map((item) => item.error) });
        continue;
      }

      return {
        ...result,
        routing: {
          provider: currentProvider,
          requested_provider: requestedProvider,
          fallback_used: errors.length > 0,
          fallback_errors: errors,
        },
      };
    } catch (error: any) {
      errors.push({ provider: currentProvider, error: String(error?.message || error) });
    }
  }

  return {
    provider: requestedProvider,
    results: [],
    error: "All extraction providers failed",
    fallback_errors: errors,
    routing: { requested_provider: requestedProvider, fallback_used: errors.length > 0, fallback_errors: errors },
  };
}
