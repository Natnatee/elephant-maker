import type { Step } from "./types";

// Allow web links and same-site files, but not executable or protocol-relative URLs.
export function safeContentUrl(value: string | null | undefined): string | undefined {
  const url = value?.trim();
  if (!url || /[\u0000-\u0020\u007f\\]/.test(url)) return undefined;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password ? url : undefined;
  } catch {
    return undefined;
  }
}

export function projectArticle(article: string | undefined, steps: Step[]): string {
  if (article?.trim()) return article;
  return steps.map((step) => [
    `### ${step.order}. ${step.title}`,
    step.description,
    step.safetyNote ? `> ข้อควรระวัง: ${step.safetyNote}` : "",
  ].filter(Boolean).join("\n\n")).join("\n\n");
}
