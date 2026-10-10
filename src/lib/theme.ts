import { readFile } from "node:fs/promises";
import path from "node:path";

/** OG images have no DOM/CSS cascade; read the same palette instead of duplicating colors. */
export async function getSharePalette() {
  const css = await readFile(
    path.join(process.cwd(), "src/app/globals.css"),
    "utf8",
  );
  const root = css.match(/:root\s*\{([^}]+)\}/)?.[1];
  if (!root) throw new Error("Theme :root palette is missing");
  const tokens = new Map(
    [...root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [
      match[1],
      match[2].trim(),
    ]),
  );
  function resolve(name: string, visited = new Set<string>()): string {
    if (visited.has(name)) throw new Error(`Circular theme token: ${name}`);
    visited.add(name);
    const value = tokens.get(name);
    if (!value) throw new Error(`Missing theme token: ${name}`);
    const alias = value.match(/^var\((--[\w-]+)\)$/);
    return alias ? resolve(alias[1], visited) : value;
  }
  return {
    background: resolve("--share-background"),
    foreground: resolve("--share-foreground"),
    accent: resolve("--share-accent"),
    muted: resolve("--share-muted"),
  };
}
