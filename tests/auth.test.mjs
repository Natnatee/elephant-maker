import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function loadModule(file, imports = {}) {
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
const redirect = loadModule("../src/lib/auth/redirect.ts");

test("auth next path accepts same-origin paths but blocks open redirects and loops", () => {
  for (const value of [
    null,
    undefined,
    "",
    "https://evil.invalid",
    "//evil.invalid",
    "/\\evil.invalid",
    "/%2f%2fevil.invalid",
    "/%5cevil.invalid",
    "/auth/callback",
    "/login?next=bad",
    "/a\n",
    "/%00",
    "/%ZZ",
    "/%61uth/callback",
    "/a/../login",
    "javascript:bad",
  ]) {
    assert.equal(redirect.getSafeNextPath(value), "/account", String(value));
  }
  for (const value of [
    "/account",
    "/submit",
    "/projects/example?tab=files#guide",
    "/?q=esp32",
  ])
    assert.equal(redirect.getSafeNextPath(value), value);
});
function callback(exchange) {
  return loadModule("../src/app/auth/callback/route.ts", {
    "@/lib/auth/redirect": redirect,
    "next/headers": { cookies: async () => ({}) },
    "@/lib/supabase/server": {
      createClient: async () => ({
        auth: { exchangeCodeForSession: exchange },
      }),
    },
  });
}
test("callback without code or with provider errors fails closed without exposing raw messages", async () => {
  const helper = callback(() => assert.fail("Must not exchange missing code"));
  for (const path of [
    "/auth/callback",
    "/auth/callback?error=secret-provider-message&code=anything",
  ]) {
    const response = await helper.GET(
      new Request(`http://localhost:3000${path}`),
    );
    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("location"),
      "http://localhost:3000/login?error=oauth_failed",
    );
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});
test("successful callback exchanges PKCE code and never redirects to another origin", async () => {
  let received;
  const helper = callback(async (code) => {
    received = code;
    return { error: null };
  });
  for (const [next, target] of [
    ["/submit", "/submit"],
    ["//evil.invalid", "/account"],
  ]) {
    const url = new URL("http://localhost:3000/auth/callback");
    url.searchParams.set("code", "test-pkce-code");
    url.searchParams.set("next", next);
    const response = await helper.GET(new Request(url));
    assert.equal(received, "test-pkce-code");
    assert.equal(
      response.headers.get("location"),
      `http://localhost:3000${target}`,
    );
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});
test("failed code exchange has a sanitized error redirect", async () => {
  const helper = callback(async () => ({
    error: { message: "private-token-value" },
  }));
  const response = await helper.GET(
    new Request("http://localhost:3000/auth/callback?code=expired"),
  );
  assert.equal(
    response.headers.get("location"),
    "http://localhost:3000/login?error=oauth_failed",
  );
  assert.ok(!(await response.text()).includes("private-token-value"));
});
test("signout is POST-only, checks Origin and uses local scope", async () => {
  let calls = 0;
  const helper = loadModule("../src/app/auth/signout/route.ts", {
    "next/headers": { cookies: async () => ({}) },
    "@/lib/supabase/server": {
      createClient: async () => ({
        auth: {
          signOut: async (options) => {
            assert.equal(options.scope, "local");
            calls++;
            return { error: null };
          },
        },
      }),
    },
  });
  assert.equal(helper.GET, undefined);
  for (const origin of [undefined, "https://evil.invalid"]) {
    const response = await helper.POST(
      new Request("http://localhost:3000/auth/signout", {
        method: "POST",
        headers: origin ? { origin } : {},
      }),
    );
    assert.equal(response.status, 403);
    assert.equal(calls, 0);
  }
  const response = await helper.POST(
    new Request("http://localhost:3000/auth/signout", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    }),
  );
  assert.equal(calls, 1);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "http://localhost:3000/login");
  assert.equal(response.headers.get("cache-control"), "no-store");
});
