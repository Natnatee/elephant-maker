import "server-only";

import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import { join } from "node:path";

export const MAX_LOCAL_FIRMWARE_BYTES = 16 * 1024 * 1024;

export type LocalTestFlashManifest = {
  id: "esp32-c3-check";
  name: "ESP32_C3_CHECK";
  chip: "ESP32-C3";
  board: "ESP32-C3 SuperMini";
  flashBytes: 4194304;
  byteLength: number;
  sha256: string;
  applicationOffset: 65536;
  scope: "local-only";
  includesWifiCredentials: true;
  preparedAt: string;
};

export function isLocalTestFlashRequestAllowed(
  request: Pick<Request, "url" | "headers">,
  environment: { NODE_ENV?: string; VERCEL?: string },
): boolean {
  if (
    environment.NODE_ENV !== "development" ||
    environment.VERCEL !== undefined
  )
    return false;
  try {
    const url = new URL(request.url);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
      return false;
    if (request.headers.get("x-elephant-local-test") !== "1") return false;
    const site = request.headers.get("sec-fetch-site");
    if (site !== null && site !== "same-origin" && site !== "none")
      return false;
    const origin = request.headers.get("origin");
    return origin === null || origin === url.origin;
  } catch {
    return false;
  }
}

export function validateLocalTestFlashManifest(
  value: unknown,
): LocalTestFlashManifest | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const data = value as Record<string, unknown>;
  const fixed = {
    id: "esp32-c3-check",
    name: "ESP32_C3_CHECK",
    chip: "ESP32-C3",
    board: "ESP32-C3 SuperMini",
    flashBytes: 4194304,
    applicationOffset: 65536,
    scope: "local-only",
    includesWifiCredentials: true,
  } as const;
  const keys = [...Object.keys(fixed), "byteLength", "sha256", "preparedAt"];
  if (
    Object.keys(data).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(data, key))
  )
    return null;
  if (Object.entries(fixed).some(([key, expected]) => data[key] !== expected))
    return null;
  if (
    typeof data.byteLength !== "number" ||
    !Number.isSafeInteger(data.byteLength) ||
    data.byteLength <= fixed.applicationOffset ||
    data.byteLength > fixed.flashBytes
  )
    return null;
  if (typeof data.sha256 !== "string" || !/^[a-fA-F0-9]{64}$/.test(data.sha256))
    return null;
  if (
    typeof data.preparedAt !== "string" ||
    data.preparedAt.length > 64 ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      data.preparedAt,
    ) ||
    !Number.isFinite(Date.parse(data.preparedAt))
  )
    return null;
  return {
    ...fixed,
    byteLength: data.byteLength,
    sha256: data.sha256,
    preparedAt: data.preparedAt,
  };
}

async function readCappedFile(path: string, cap: number): Promise<Buffer> {
  const file = await open(path, "r");
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size <= 0 || stat.size > cap)
      throw new Error("Invalid local firmware");
    // One extra byte detects growth without an unbounded readFile allocation.
    const bytes = Buffer.alloc(stat.size + 1);
    let length = 0;
    while (length < bytes.length) {
      const result = await file.read(
        bytes,
        length,
        bytes.length - length,
        null,
      );
      if (result.bytesRead === 0) break;
      length += result.bytesRead;
    }
    if (length !== stat.size) throw new Error("Invalid local firmware");
    return bytes.subarray(0, length);
  } finally {
    await file.close();
  }
}

export async function readLocalTestFlashFirmware(): Promise<{
  manifest: LocalTestFlashManifest;
  bytes: Uint8Array;
}> {
  const directory = join(process.cwd(), ".local-firmware", "esp32-c3-check");
  const raw = await readCappedFile(join(directory, "manifest.json"), 16 * 1024);
  const manifest = validateLocalTestFlashManifest(
    JSON.parse(raw.toString("utf8")),
  );
  if (!manifest) throw new Error("Invalid local firmware");
  const bytes = await readCappedFile(
    join(directory, "merged.bin"),
    MAX_LOCAL_FIRMWARE_BYTES,
  );
  if (
    bytes.length !== manifest.byteLength ||
    createHash("sha256").update(bytes).digest("hex") !==
      manifest.sha256.toLowerCase()
  ) {
    throw new Error("Invalid local firmware");
  }
  return { manifest, bytes: new Uint8Array(bytes) };
}
