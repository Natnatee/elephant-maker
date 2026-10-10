import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import ts from "typescript";

const fixture = JSON.parse(
  readFileSync(new URL("../src/data/mock-db.json", import.meta.url), "utf8"),
);
// Compile isolated pure modules in memory; no generated test files or new runtime dependencies.
function loadModule(path, imports = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const testModule = { exports: {} };
  const require = (name) => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
    return imports[name];
  };
  new Function("require", "module", "exports", outputText)(
    require,
    testModule,
    testModule.exports,
  );
  return testModule.exports;
}
const data = loadModule("../src/lib/data.ts", {
  "@/data/mock-db.json": fixture,
});
const drafts = loadModule("../src/lib/drafts.ts");
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};

test("fixture has unique IDs and slugs", () => {
  for (const [table, rows] of Object.entries(fixture)) {
    if (table === "project_tags") continue;
    assert.equal(new Set(rows.map((row) => row.id)).size, rows.length, table);
  }
  assert.equal(
    new Set(fixture.projects.map((p) => p.slug)).size,
    fixture.projects.length,
  );
});
test("relational references and local images exist", () => {
  const ids = (table) => new Set(fixture[table].map((r) => r.id));
  for (const p of fixture.projects) {
    assert.ok(ids("profiles").has(p.ownerId));
    assert.ok(existsSync(new URL(`../public${p.cover}`, import.meta.url)));
  }
  for (const table of [
    "steps",
    "materials",
    "files",
    "firmwareReleases",
    "project_tags",
  ]) {
    for (const row of fixture[table])
      assert.ok(ids("projects").has(row.projectId), table);
  }
  for (const row of fixture.project_tags) assert.ok(ids("tags").has(row.tagId));
  for (const row of fixture.firmwareParts) {
    assert.ok(ids("firmwareReleases").has(row.releaseId));
    assert.ok(ids("files").has(row.fileId));
    const release = fixture.firmwareReleases.find(
      (r) => r.id === row.releaseId,
    );
    assert.equal(
      fixture.files.find((f) => f.id === row.fileId).projectId,
      release.projectId,
    );
  }
});
test("public queries do not expose drafts", () => {
  assert.equal(data.getProjects().length, 6);
  const draft = fixture.projects.find((p) => p.status === "draft");
  assert.ok(draft);
  assert.equal(data.getProjectBySlug(draft.slug), undefined);
  assert.equal(data.getProjectDetails(draft.id), undefined);
  assert.equal(data.getProjectBySlug("does-not-exist"), undefined);
});
test("detail composes owner, sorted guide, tags and release files", () => {
  const project = data.getProjects()[0];
  const detail = data.getProjectDetails(project.id);
  assert.equal(detail.owner.id, project.ownerId);
  assert.ok(detail.tags.length);
  assert.deepEqual(
    detail.steps.map((s) => s.order),
    detail.steps.map((s) => s.order).sort((a, b) => a - b),
  );
  for (const release of detail.firmwareReleases)
    for (const part of release.parts) assert.ok(part.file);
});
test("demo firmware never has a usable download URL", () => {
  for (const file of fixture.files) {
    assert.equal(file.isDemo, true);
    assert.equal(file.url, null);
  }
  for (const release of fixture.firmwareReleases)
    assert.equal(release.isDemo, true);
});
test("basic submission required fields reject blank and whitespace", () => {
  assert.equal(drafts.validateStep(drafts.emptyDraft(), 0).length, 4);
  assert.ok(
    drafts.validateStep({ ...drafts.emptyDraft(), title: "  " }, 0).length,
  );
});
test("showcase does not force a complete guide; ready does", () => {
  assert.deepEqual(
    drafts.validateStep({ ...drafts.emptyDraft(), readiness: "showcase" }, 1),
    [],
  );
  assert.equal(
    drafts.validateStep({ ...drafts.emptyDraft(), readiness: "ready" }, 1)
      .length,
    2,
  );
});
test("firmware validation checks file type, size, mode and unique hex offsets", () => {
  const base = {
    ...drafts.emptyDraft(),
    firmware: true,
    chip: "ESP32",
    board: "Test",
    version: "0.1",
    files: [{ name: "demo.bin", size: 1024, offset: "" }],
  };
  assert.deepEqual(drafts.validateStep(base, 2), []);
  assert.ok(
    drafts.validateStep(
      {
        ...base,
        files: [{ name: "bad.zip", size: drafts.MAX_BIN_SIZE + 1, offset: "" }],
      },
      2,
    ).length,
  );
  assert.ok(
    drafts
      .validateStep(
        {
          ...base,
          mode: "multipart",
          files: [
            { name: "a.bin", size: 1, offset: "0x1000" },
            { name: "b.bin", size: 1, offset: "0x01000" },
          ],
        },
        2,
      )
      .some((e) => e.includes("ซ้ำ")),
  );
  assert.ok(drafts.validateStep({ ...base, mode: "multipart" }, 2).length);
});
test("cover metadata validates allowed formats and size", () => {
  assert.ok(
    drafts.isCoverMetadata({ name: "cover.png", size: 100, type: "image/png" }),
  );
  assert.equal(
    drafts.isCoverMetadata({
      name: "cover.svg",
      size: 100,
      type: "image/svg+xml",
    }),
    false,
  );
  assert.equal(
    drafts.isCoverMetadata({
      name: "cover.png",
      size: drafts.MAX_COVER_SIZE + 1,
      type: "image/png",
    }),
    false,
  );
});
test("draft round-trip stores metadata only", () => {
  memory.clear();
  const draft = {
    ...drafts.emptyDraft(),
    title: "ตัวอย่าง",
    cover: {
      name: "photo.png",
      size: 100,
      type: "image/png",
      bytes: "never-store",
    },
    files: [{ name: "a.bin", size: 100, offset: "", bytes: "never-store" }],
  };
  drafts.saveDraft(draft, 1);
  assert.ok(!memory.get(drafts.DRAFT_KEY).includes("never-store"));
  const saved = drafts.loadDraft();
  assert.equal(saved.draft.title, draft.title);
  assert.equal(saved.step, 1);
  assert.equal(saved.draft.cover.name, "photo.png");
});
test("old drafts without cover resume and malformed drafts fail safely", () => {
  memory.clear();
  const old = drafts.emptyDraft();
  delete old.cover;
  memory.set(
    drafts.DRAFT_KEY,
    JSON.stringify({ schema: 1, draft: old, step: 99 }),
  );
  assert.equal(drafts.loadDraft().draft.cover, null);
  assert.equal(drafts.loadDraft().step, 0);
  memory.set(drafts.DRAFT_KEY, "{broken");
  assert.throws(() => drafts.loadDraft());
  memory.set(drafts.DRAFT_KEY, JSON.stringify({ schema: 2, draft: old }));
  assert.throws(() => drafts.loadDraft());
});
