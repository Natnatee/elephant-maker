export const DRAFT_KEY = "elephant-maker:submission:v1";
export const MAX_BIN_SIZE = 16 * 1024 * 1024;
export const MAX_COVER_SIZE = 8 * 1024 * 1024;
export const MAX_GUIDE_SIZE = 50 * 1024 * 1024;
const guideTypes = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
  "application/pdf": "document",
  "text/plain": "text",
  "text/markdown": "text",
} as const;
export type GuideFileMetadata = {
  name: string;
  size: number;
  type: keyof typeof guideTypes;
  kind: "image" | "video" | "document" | "text";
};
export function guideFileMetadata(file: {
  name: string;
  size: number;
  type: string;
}): GuideFileMetadata | null {
  // Some browsers omit MIME types for plain text and Markdown files only.
  const type =
    file.type ||
    (/\.md$/i.test(file.name)
      ? "text/markdown"
      : /\.txt$/i.test(file.name)
        ? "text/plain"
        : "");
  if (!Object.hasOwn(guideTypes, type)) return null;
  const allowedType = type as GuideFileMetadata["type"];
  const metadata = {
    name: file.name,
    size: file.size,
    type: allowedType,
    kind: guideTypes[allowedType],
  };
  return isGuideFileMetadata(metadata) ? metadata : null;
}
export function isGuideFileMetadata(
  value: unknown,
): value is GuideFileMetadata {
  if (!value || typeof value !== "object") return false;
  const file = value as Record<string, unknown>;
  return (
    typeof file.name === "string" &&
    !!file.name.trim() &&
    typeof file.size === "number" &&
    Number.isFinite(file.size) &&
    file.size > 0 &&
    file.size <= MAX_GUIDE_SIZE &&
    typeof file.type === "string" &&
    Object.hasOwn(guideTypes, file.type) &&
    file.kind === guideTypes[file.type as GuideFileMetadata["type"]]
  );
}
export type CoverMetadata = {
  name: string;
  size: number;
  type: "image/jpeg" | "image/png" | "image/webp";
};
export function isCoverMetadata(value: unknown): value is CoverMetadata {
  if (!value || typeof value !== "object") return false;
  const cover = value as Record<string, unknown>;
  return (
    typeof cover.name === "string" &&
    typeof cover.size === "number" &&
    Number.isFinite(cover.size) &&
    cover.size > 0 &&
    cover.size <= MAX_COVER_SIZE &&
    ["image/jpeg", "image/png", "image/webp"].includes(String(cover.type))
  );
}
export const requiresGuide = (readiness: string): boolean =>
  readiness === "ทดสอบแล้ว" || readiness === "ready";
export type BinMetadata = { name: string; size: number; offset: string };
export type Draft = {
  title: string;
  summary: string;
  category: string;
  readiness: string;
  cover: CoverMetadata | null;
  materials: string;
  steps: string;
  guideFiles: GuideFileMetadata[];
  compatibilityNotes: string;
  contact: string;
  license: string;
  firmware: boolean;
  chip: string;
  board: string;
  version: string;
  mode: "merged" | "multipart";
  files: BinMetadata[];
};
export const emptyDraft = (): Draft => ({
  title: "",
  summary: "",
  category: "",
  readiness: "",
  cover: null,
  materials: "",
  steps: "",
  guideFiles: [],
  compatibilityNotes: "",
  contact: "",
  license: "",
  firmware: false,
  chip: "",
  board: "",
  version: "",
  mode: "merged",
  files: [],
});
export function validateStep(draft: Draft, step: number): string[] {
  const errors: string[] = [];
  const required = (value: string, label: string) => {
    if (!value.trim()) errors.push(`กรุณาระบุ${label}`);
  };
  if (step === 0) {
    required(draft.title, "ชื่อผลงาน");
    required(draft.summary, "คำอธิบายสั้น");
    required(draft.category, "หมวดหมู่");
    required(draft.readiness, "ระดับความพร้อม");
  }
  if (step === 0 && draft.cover !== null && !isCoverMetadata(draft.cover))
    errors.push(
      "รูปปกต้องเป็น JPEG, PNG หรือ WebP ขนาดมากกว่า 0 และไม่เกิน 8 MiB",
    );
  if (step === 1) {
    if (
      requiresGuide(draft.readiness) &&
      !draft.steps.trim() &&
      !draft.guideFiles.length
    )
      errors.push("กรุณาระบุขั้นตอนการทำหรือเลือกไฟล์คู่มืออย่างน้อยหนึ่งไฟล์");
    if (!draft.guideFiles.every(isGuideFileMetadata))
      errors.push(
        "ไฟล์คู่มือต้องเป็นรูป วิดีโอ PDF ข้อความ หรือ Markdown ที่ไม่ว่างและไม่เกิน 50 MiB ต่อไฟล์",
      );
  }
  if (step === 2 && draft.firmware) {
    required(draft.chip, "ชิป");
    required(draft.board, "บอร์ด");
    required(draft.version, "เวอร์ชัน firmware");
    if (!draft.files.length)
      errors.push("กรุณาเลือกไฟล์ .bin อย่างน้อยหนึ่งไฟล์");
    if (draft.mode === "merged" && draft.files.length !== 1)
      errors.push("แบบ merged ต้องมีไฟล์ .bin เดียว");
    const offsets = new Set<string>();
    for (const file of draft.files) {
      if (
        !/\.bin$/i.test(file.name) ||
        file.size <= 0 ||
        file.size > MAX_BIN_SIZE
      )
        errors.push(
          `${file.name}: ต้องเป็น .bin ขนาดมากกว่า 0 และไม่เกิน 16 MiB`,
        );
      if (draft.mode === "multipart") {
        if (
          !/^0x[0-9a-f]+$/i.test(file.offset) ||
          !Number.isSafeInteger(Number(file.offset))
        )
          errors.push(
            `${file.name}: ระบุ offset ฐานสิบหก เช่น 0x… ตาม manifest จริง`,
          );
        else {
          const normalized = Number(file.offset).toString(16);
          if (offsets.has(normalized))
            errors.push(`${file.name}: offset ซ้ำกับไฟล์อื่น`);
          offsets.add(normalized);
        }
      }
    }
  }
  return errors;
}
export function saveDraft(draft: Draft, step: number): void {
  // Store an explicit metadata-only snapshot, never File objects or binary contents.
  const snapshot = {
    ...draft,
    cover: draft.cover
      ? {
          name: draft.cover.name,
          size: draft.cover.size,
          type: draft.cover.type,
        }
      : null,
    guideFiles: draft.guideFiles.map(({ name, size, type, kind }) => ({
      name,
      size,
      type,
      kind,
    })),
    files: draft.files.map(({ name, size, offset }) => ({
      name,
      size,
      offset,
    })),
  };
  localStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      schema: 1,
      draft: snapshot,
      step,
      savedAt: new Date().toISOString(),
    }),
  );
}
export function loadDraft(): {
  draft: Draft;
  step: number;
  savedAt: string;
} | null {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") throw new Error("Invalid draft");
  const record = value as Record<string, unknown>;
  if (record.schema !== 1 || !record.draft || typeof record.draft !== "object")
    throw new Error("Invalid draft");
  const data = record.draft as Record<string, unknown>;
  const defaults = emptyDraft();
  for (const key of Object.keys(defaults)) {
    if (
      key !== "files" &&
      key !== "cover" &&
      key !== "guideFiles" &&
      !(key === "compatibilityNotes" && data[key] === undefined) &&
      typeof data[key] !== typeof defaults[key as keyof Draft]
    )
      throw new Error("Invalid draft");
  }
  if (
    !Array.isArray(data.files) ||
    !data.files.every((file: unknown) => {
      if (!file || typeof file !== "object") return false;
      const item = file as Record<string, unknown>;
      return (
        typeof item.name === "string" &&
        typeof item.size === "number" &&
        Number.isFinite(item.size) &&
        typeof item.offset === "string"
      );
    }) ||
    !["merged", "multipart"].includes(String(data.mode))
  )
    throw new Error("Invalid draft");
  if (
    data.cover !== undefined &&
    data.cover !== null &&
    !isCoverMetadata(data.cover)
  )
    throw new Error("Invalid cover metadata");
  if (
    data.guideFiles !== undefined &&
    (!Array.isArray(data.guideFiles) ||
      !data.guideFiles.every(isGuideFileMetadata))
  )
    throw new Error("Invalid guide metadata");
  const draft = emptyDraft();
  for (const key of Object.keys(defaults)) {
    if (key !== "cover" && data[key] !== undefined)
      Object.assign(draft, { [key]: data[key] });
  }
  draft.cover = isCoverMetadata(data.cover)
    ? { name: data.cover.name, size: data.cover.size, type: data.cover.type }
    : null;
  draft.guideFiles = draft.guideFiles.map(({ name, size, type, kind }) => ({
    name,
    size,
    type,
    kind,
  }));
  draft.files = draft.files.map(({ name, size, offset }) => ({
    name,
    size,
    offset,
  }));
  return {
    draft,
    step:
      typeof record.step === "number" && [0, 1, 2].includes(record.step)
        ? record.step
        : 0,
    savedAt: typeof record.savedAt === "string" ? record.savedAt : "",
  };
}
