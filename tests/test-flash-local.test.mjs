import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as crypto from "node:crypto";
import * as path from "node:path";
import ts from "typescript";

function load(relative, dependencies) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(relative, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  );
  const compiledModule = { exports: {} };
  new Function("module", "exports", "require", outputText)(
    compiledModule,
    compiledModule.exports,
    (id) => {
      assert.ok(
        Object.hasOwn(dependencies, id),
        `Unexpected dependency: ${id}`,
      );
      return dependencies[id];
    },
  );
  return compiledModule.exports;
}

// Synthetic bytes only: never open the user's prepared firmware or credentials.
const bytes = Buffer.alloc(65537, 0xa5);
const valid = () => ({
  id: "esp32-c3-check",
  name: "ESP32_C3_CHECK",
  chip: "ESP32-C3",
  board: "ESP32-C3 SuperMini",
  flashBytes: 4194304,
  byteLength: bytes.length,
  sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  applicationOffset: 65536,
  scope: "local-only",
  includesWifiCredentials: true,
  preparedAt: "2026-10-14T00:00:00.000Z",
});
let manifest = valid();
let binary = bytes;
let opens = 0;
const lib = load("../src/lib/test-flash-local.ts", {
  "server-only": {},
  "node:crypto": crypto,
  "node:path": path,
  "node:fs/promises": {
    async open(filename) {
      opens++;
      assert.ok(
        filename ===
          path.join(
            process.cwd(),
            ".local-firmware",
            "esp32-c3-check",
            "manifest.json",
          ) ||
          filename ===
            path.join(
              process.cwd(),
              ".local-firmware",
              "esp32-c3-check",
              "merged.bin",
            ),
      );
      const content = filename.endsWith("manifest.json")
        ? Buffer.from(JSON.stringify(manifest))
        : binary;
      let position = 0;
      return {
        async stat() {
          return { isFile: () => true, size: content.length };
        },
        async read(target, offset, length) {
          const count = content.copy(
            target,
            offset,
            position,
            position + length,
          );
          position += count;
          return { bytesRead: count };
        },
        async close() {},
      };
    },
  },
});
const request = (
  url = "http://localhost:3000/api/test-flash/esp32-c3-check",
  headers = {},
) =>
  new Request(url, { headers: { "x-elephant-local-test": "1", ...headers } });
const env = { NODE_ENV: "development" };

test("gate fails closed outside development or whenever VERCEL is set", () => {
  for (const NODE_ENV of [undefined, "production", "test", "Development"]) {
    assert.equal(
      lib.isLocalTestFlashRequestAllowed(request(), { NODE_ENV }),
      false,
    );
  }
  for (const VERCEL of ["", "0", "1"]) {
    assert.equal(
      lib.isLocalTestFlashRequestAllowed(request(), { ...env, VERCEL }),
      false,
    );
  }
});

test("gate accepts only loopback and explicit local-test header", () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    assert.equal(
      lib.isLocalTestFlashRequestAllowed(request(`http://${host}:3000/`), env),
      true,
    );
  }
  for (const host of [
    "example.com",
    "192.168.1.2",
    "0.0.0.0",
    "localhost.example.com",
    "localhost.",
  ]) {
    assert.equal(
      lib.isLocalTestFlashRequestAllowed(request(`http://${host}/`), env),
      false,
    );
  }
  for (const value of ["", "0", "true", "1, 1"]) {
    assert.equal(
      lib.isLocalTestFlashRequestAllowed(
        request(undefined, { "x-elephant-local-test": value }),
        env,
      ),
      false,
    );
  }
  assert.equal(
    lib.isLocalTestFlashRequestAllowed(new Request("http://localhost/"), env),
    false,
  );
  assert.equal(
    lib.isLocalTestFlashRequestAllowed(
      { url: "invalid", headers: new Headers() },
      env,
    ),
    false,
  );
});

test("gate enforces exact Origin and Sec-Fetch-Site", () => {
  for (const site of ["same-origin", "none"]) {
    assert.equal(
      lib.isLocalTestFlashRequestAllowed(
        request(undefined, { "sec-fetch-site": site }),
        env,
      ),
      true,
    );
  }
  for (const site of ["cross-site", "same-site", "", "unexpected"]) {
    assert.equal(
      lib.isLocalTestFlashRequestAllowed(
        request(undefined, { "sec-fetch-site": site }),
        env,
      ),
      false,
    );
  }
  assert.equal(
    lib.isLocalTestFlashRequestAllowed(
      request(undefined, { origin: "http://localhost:3000" }),
      env,
    ),
    true,
  );
  assert.equal(
    lib.isLocalTestFlashRequestAllowed(
      request("http://127.0.0.1:3000/", {
        origin: "http://127.0.0.1:3000",
        host: "localhost:3000",
      }),
      env,
    ),
    true,
  );
  assert.equal(
    lib.isLocalTestFlashRequestAllowed(
      request(undefined, {
        origin: "http://127.0.0.1:3000",
        host: "127.0.0.1:3000",
        "x-forwarded-host": "127.0.0.1:3000",
      }),
      env,
    ),
    false,
  );
  for (const origin of [
    "null",
    "http://localhost",
    "https://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3000/",
  ]) {
    assert.equal(
      lib.isLocalTestFlashRequestAllowed(request(undefined, { origin }), env),
      false,
    );
  }
});

test("manifest requires exact whitelist, literals and limits", () => {
  assert.deepEqual(lib.validateLocalTestFlashManifest(valid()), valid());
  for (const value of [null, [], "text", { ...valid(), extra: "secret" }]) {
    assert.equal(lib.validateLocalTestFlashManifest(value), null);
  }
  for (const key of Object.keys(valid())) {
    const missing = valid();
    delete missing[key];
    assert.equal(lib.validateLocalTestFlashManifest(missing), null, key);
  }
  const invalid = {
    id: ["other"],
    name: ["other"],
    chip: ["ESP32"],
    board: ["other"],
    flashBytes: [8388608],
    applicationOffset: [0],
    scope: ["public"],
    includesWifiCredentials: [false],
    byteLength: [0, 65536, 4194305, NaN, Infinity, 65537.5, "65537"],
    sha256: ["a".repeat(63), "g".repeat(64), "a".repeat(65)],
    preparedAt: ["", "yesterday", "2026-99-99T00:00:00Z", "a".repeat(65)],
  };
  for (const [key, values] of Object.entries(invalid)) {
    for (const value of values)
      assert.equal(
        lib.validateLocalTestFlashManifest({ ...valid(), [key]: value }),
        null,
        key,
      );
  }
});

test("reader checks fixed paths, caps, byteLength and SHA-256 on each read", async () => {
  manifest = valid();
  binary = bytes;
  assert.deepEqual((await lib.readLocalTestFlashFirmware()).manifest, valid());
  manifest = { ...valid(), sha256: "0".repeat(64) };
  await assert.rejects(lib.readLocalTestFlashFirmware());
  manifest = { ...valid(), byteLength: bytes.length + 1 };
  await assert.rejects(lib.readLocalTestFlashFirmware());
  manifest = valid();
  binary = Buffer.alloc(lib.MAX_LOCAL_FIRMWARE_BYTES + 1);
  await assert.rejects(lib.readLocalTestFlashFirmware());
  binary = bytes;
  manifest = { ...valid(), preparedAt: "a".repeat(17000) };
  await assert.rejects(lib.readLocalTestFlashFirmware());
  manifest = valid();
});

test("route returns direct metadata or binary; errors are generic with security headers", async () => {
  let reads = 0;
  const route = load("../src/app/api/test-flash/esp32-c3-check/route.ts", {
    "@/lib/test-flash-local": {
      isLocalTestFlashRequestAllowed: lib.isLocalTestFlashRequestAllowed,
      async readLocalTestFlashFirmware() {
        reads++;
        if (manifest.sha256 !== valid().sha256)
          throw new Error("corrupted private/path secret-password");
        return { manifest, bytes: new Uint8Array(bytes) };
      },
    },
  });
  assert.equal(Object.hasOwn(route, "dynamic"), false);
  assert.equal(Object.hasOwn(route, "runtime"), false);
  const fileOpensBefore = opens;
  const oldNodeEnv = process.env.NODE_ENV;
  const oldVercel = process.env.VERCEL;
  function check(response, status) {
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(
      response.headers.get("cross-origin-resource-policy"),
      "same-origin",
    );
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  }
  try {
    process.env.NODE_ENV = "development";
    delete process.env.VERCEL;
    const metadata = await route.GET(request());
    check(metadata, 200);
    assert.deepEqual(await metadata.json(), valid());
    const download = await route.GET(
      request(
        "http://localhost:3000/api/test-flash/esp32-c3-check?download=1&path=ignored",
      ),
    );
    check(download, 200);
    assert.equal(
      download.headers.get("content-type"),
      "application/octet-stream",
    );
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
    manifest = { ...valid(), sha256: "0".repeat(64) };
    const invalid = await route.GET(request());
    check(invalid, 500);
    assert.deepEqual(await invalid.json(), {
      error: "Local firmware unavailable",
    });
    manifest = valid();
    for (const [code, status] of [
      ["ENOENT", 404],
      ["EACCES", 500],
    ]) {
      const failingRoute = load(
        "../src/app/api/test-flash/esp32-c3-check/route.ts",
        {
          "@/lib/test-flash-local": {
            ...lib,
            async readLocalTestFlashFirmware() {
              throw Object.assign(new Error("private/path secret-password"), {
                code,
              });
            },
          },
        },
      );
      const failure = await failingRoute.GET(request());
      check(failure, status);
      assert.deepEqual(await failure.json(), {
        error: status === 404 ? "Not found" : "Local firmware unavailable",
      });
    }
    const before = reads;
    process.env.NODE_ENV = "production";
    let urlReads = 0;
    const productionRequest = request();
    check(
      await route.GET({
        get url() {
          urlReads++;
          return productionRequest.url;
        },
        headers: productionRequest.headers,
      }),
      404,
    );
    assert.ok(
      urlReads > 0,
      "production must access request-time URL rather than prerender a cached 404",
    );
    check(
      await route.GET(
        request(
          "http://127.0.0.1:3000/api/test-flash/esp32-c3-check?download=1",
        ),
      ),
      404,
    );
    for (const method of ["HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"])
      check(await route[method](request()), 404);
    assert.equal(
      reads,
      before,
      "production must never read even an available bundle",
    );
    assert.equal(
      opens,
      fileOpensBefore,
      "route tests must never invoke the file reader",
    );
    process.env.NODE_ENV = "development";
    check(await route.OPTIONS(request()), 405);
  } finally {
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldNodeEnv;
    if (oldVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = oldVercel;
    manifest = valid();
  }
});
