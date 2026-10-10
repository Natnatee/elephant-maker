import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";

function loadModule(file, imports) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const result = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) => {
      if (!(name in imports)) throw new Error(`Unexpected test import ${name}`);
      return imports[name];
    },
    result,
    result.exports,
  );
  return result.exports;
}
const config = {
  getSupabaseConfig: () => ({
    url: "https://example.supabase.co",
    publishableKey: "test-publishable-key",
  }),
};

test("configuration fails clearly when public environment is missing", () => {
  const before = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
  const { getSupabaseConfig } = loadModule("../src/lib/supabase/config.ts", {});
  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    assert.throws(getSupabaseConfig, /Missing NEXT_PUBLIC_SUPABASE/);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
    assert.deepEqual(getSupabaseConfig(), config.getSupabaseConfig());
  } finally {
    if (before.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = before.url;
    if (before.key === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = before.key;
  }
});
test("browser helper uses the public client configuration", () => {
  const client = {};
  const helper = loadModule("../src/lib/supabase/client.ts", {
    "./config": config,
    "@supabase/ssr": {
      createBrowserClient(url, key) {
        assert.equal(url, config.getSupabaseConfig().url);
        assert.equal(key, config.getSupabaseConfig().publishableKey);
        return client;
      },
    },
  });
  assert.equal(helper.createClient(), client);
});
test("server helper reads async cookies and writes cookie options", async () => {
  const writes = [];
  const store = {
    getAll: () => [{ name: "session", value: "old" }],
    set: (...args) => writes.push(args),
  };
  const helper = loadModule("../src/lib/supabase/server.ts", {
    "./config": config,
    "next/headers": { cookies: async () => store },
    "@supabase/ssr": { createServerClient: (_url, _key, options) => options },
  });
  const client = await helper.createClient();
  assert.equal(client.cookies.getAll()[0].value, "old");
  client.cookies.setAll([
    { name: "session", value: "new", options: { httpOnly: true } },
  ]);
  assert.deepEqual(writes, [["session", "new", { httpOnly: true }]]);
  const readonly = await helper.createClient({
    getAll: () => [],
    set: () => {
      throw new Error("Server Component cookie write");
    },
  });
  assert.doesNotThrow(() =>
    readonly.cookies.setAll([{ name: "session", value: "new", options: {} }]),
  );
});
test("proxy calls getClaims and preserves refreshed cookies and cache headers across writes", async () => {
  let verified = false;
  const helper = loadModule("../src/lib/supabase/proxy.ts", {
    "./config": config,
    "next/server": { NextResponse },
    "@supabase/ssr": {
      createServerClient: (_url, _key, options) => ({
        auth: {
          async getClaims() {
            verified = true;
            options.cookies.setAll(
              [
                {
                  name: "session",
                  value: "refreshed",
                  options: { path: "/", httpOnly: true },
                },
              ],
              {
                "Cache-Control": "private, no-store",
                Expires: "0",
                Pragma: "no-cache",
              },
            );
            options.cookies.setAll(
              [
                {
                  name: "session-extra",
                  value: "second-write",
                  options: { path: "/" },
                },
              ],
              {},
            );
            return { data: null, error: null };
          },
        },
      }),
    },
  });
  const request = new NextRequest("http://localhost:3000/submit");
  const response = await helper.updateSession(request);
  assert.ok(verified);
  assert.equal(request.cookies.get("session").value, "refreshed");
  assert.equal(response.cookies.get("session").value, "refreshed");
  assert.equal(response.cookies.get("session").httpOnly, true);
  assert.equal(response.cookies.get("session-extra").value, "second-write");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("Pragma"), "no-cache");
  assert.ok(
    response.headers
      .get("x-middleware-request-cookie")
      .includes("session=refreshed"),
  );
});
test("anonymous requests are not redirected and do not write session cookies", async () => {
  const helper = loadModule("../src/lib/supabase/proxy.ts", {
    "./config": config,
    "next/server": { NextResponse },
    "@supabase/ssr": {
      createServerClient: () => ({
        auth: { getClaims: async () => ({ data: null, error: null }) },
      }),
    },
  });
  const response = await helper.updateSession(
    new NextRequest("http://localhost:3000/"),
  );
  assert.equal(response.status, 200);
  assert.equal(response.cookies.getAll().length, 0);
  assert.equal(response.headers.get("location"), null);
});
