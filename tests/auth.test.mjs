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
const validation = loadModule("../src/lib/auth/validation.ts");

test("password and display name validation enforce exact boundaries", () => {
  for (const length of [8, 128]) assert.equal(validation.passwordError("a".repeat(length)), null);
  for (const length of [0, 7, 129]) assert.equal(typeof validation.passwordError("a".repeat(length)), "string");
  for (const value of ["a", "ชื่อผู้ใช้", "  Alice  ", "a".repeat(100)])
    assert.equal(validation.displayNameError(value), null);
  for (const value of ["", "   ", "a".repeat(101), "a\u0000b", "a\nb", "a\tb", "a\u007fb"])
    assert.equal(typeof validation.displayNameError(value), "string");
});

test("post-auth paths go directly to safe destinations without onboarding", () => {
  for (const [value, expected] of [
    [null, "/account"], [undefined, "/account"],
    ["https://evil.invalid", "/account"],
    ["/account/setup?next=/submit", "/account"],
    ...["/account/password", "/account/password?next=https://evil.invalid#secret", "/account/password/", "/account/password-extra", "/ACCOUNT/password", "/submit?q=a&tab=b#guide"].map(value => [value, value]),
  ]) assert.equal(redirect.getPostAuthPath(value), expected, String(value));
});

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
    "/account/setup",
    "/account/setup?next=/submit",
    "/ACCOUNT/SETUP/child",
    "/account/%73etup",
    "/submit/../account/setup",
    "/auth/confirm",
    "/%2Fother.invalid",
    "/%0d%0aLocation:evil",
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
function authRoute(file, auth) {
  const store = {};
  return loadModule(file, {
    "@/lib/auth/redirect": redirect,
    "next/headers": { cookies: async () => store },
    "@/lib/supabase/server": {
      createClient: async (received) => {
        assert.equal(received, store);
        return { auth };
      },
    },
  });
}

async function assertRedirect(response, target, secrets = [], confirmation = false) {
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), `http://localhost:3000${target}`);
  assert.match(response.headers.get("cache-control"), /(?:^|,\s*)no-store(?:,|$)/);
  if (confirmation) assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  const body = await response.text();
  assert.equal(body, "");
  const output = JSON.stringify([...response.headers]) + body;
  for (const secret of secrets) assert.ok(!output.includes(secret), secret);
}

test("callback sanitizes thrown exchange errors and omitted or malicious next destinations", async () => {
  const failing = authRoute("../src/app/auth/callback/route.ts", {
    exchangeCodeForSession: async () => { throw new Error("private-provider-secret"); },
  });
  await assertRedirect(await failing.GET(new Request("http://localhost:3000/auth/callback?code=private-code")), "/login?error=oauth_failed", ["private-code", "private-provider-secret"]);
  const success = callback(async () => ({ error: null }));
  for (const next of [null, "https://evil.invalid", "/%5cevil.invalid", "/auth/confirm", "/account/setup?next=/submit"]) {
    const url = new URL("http://localhost:3000/auth/callback?code=private-code");
    if (next !== null) url.searchParams.set("next", next);
    await assertRedirect(await success.GET(new Request(url)), "/account", ["private-code"]);
  }
});

test("confirm rejects missing tokens and unsafe OTP types without calling auth", async () => {
  const route = loadModule("../src/app/auth/confirm/route.ts", {
    "@/lib/auth/redirect": redirect,
    "next/headers": { cookies: () => assert.fail("Invalid input must not access cookies") },
    "@/lib/supabase/server": { createClient: () => assert.fail("Invalid input must not create client") },
  });
  for (const query of ["", "type=email", "token_hash=&type=email", "token_hash=private-token", ...["invite", "magiclink", "email_change", "sms", "phone_change", "EMAIL", "Recovery", "__proto__", "constructor", "", "email/signup"].map(type => `token_hash=private-token&type=${encodeURIComponent(type)}`)]) {
    await assertRedirect(await route.GET(new Request(`http://localhost:3000/auth/confirm?${query}`)), "/login?error=confirmation_failed", ["private-token"], true);
  }
});

test("confirm verifies supported OTP types and safely routes successful confirmations", async () => {
  for (const type of ["email", "signup", "recovery"]) {
    for (const [next, target] of [
      [null, "/account"],
      ["/submit?q=one#two", "/submit?q=one#two"],
      ["https://evil.invalid", "/account"],
      ["//evil.invalid", "/account"],
      ["/%5cevil.invalid", "/account"],
      ["/account/setup", "/account"],
      ["/auth/callback", "/account"],
      ["/account/password?tab=security#reset", "/account/password?tab=security#reset"],
    ]) {
      let calls = 0;
      const route = authRoute("../src/app/auth/confirm/route.ts", { verifyOtp: async (options) => {
        calls++;
        assert.deepEqual(options, { token_hash: "private-token", type });
        return { error: null };
      } });
      const url = new URL("http://localhost:3000/auth/confirm");
      url.searchParams.set("token_hash", "private-token");
      url.searchParams.set("type", type);
      if (next !== null) url.searchParams.set("next", next);
      await assertRedirect(await route.GET(new Request(url)), type === "recovery" ? "/account/password" : target, ["private-token"], true);
      assert.equal(calls, 1);
    }
  }
});

test("confirm sanitizes returned and thrown auth errors for every supported type", async () => {
  for (const type of ["email", "signup", "recovery"]) {
    for (const throws of [false, true]) {
      const route = authRoute("../src/app/auth/confirm/route.ts", { verifyOtp: async () => {
        if (throws) throw new Error("private-provider-secret");
        return { error: { message: "private-provider-secret" } };
      } });
      await assertRedirect(await route.GET(new Request(`http://localhost:3000/auth/confirm?token_hash=private-token&type=${type}&next=/submit`)), "/login?error=confirmation_failed", ["private-token", "private-provider-secret"], true);
    }
  }
});

function accountActions(options = {}) {
  const calls = [];
  const store = {};
  const builder = {
    select(value) { calls.push(["select", value]); return this; },
    update(value) { calls.push(["update", value]); return this; },
    eq(key, value) { calls.push(["eq", key, value]); return this; },
    async maybeSingle() {
      calls.push(["maybeSingle"]);
      if (options.databaseThrows) throw new Error("private-database-secret");
      return options.results?.shift() ?? { data: { id: "owner-id" }, error: null };
    },
  };
  const actions = loadModule("../src/app/account/actions.ts", {
    "@/lib/auth/redirect": redirect,
    "@/lib/auth/validation": validation,
    "next/headers": { cookies: async () => { calls.push(["cookies"]); return store; } },
    "next/cache": { revalidatePath: (path) => calls.push(["revalidate", path]) },
    "@/lib/supabase/server": { createClient: async (received) => {
      assert.equal(received, store);
      calls.push(["client"]);
      return {
        auth: { getUser: async () => {
          calls.push(["getUser"]);
          if (options.throws) throw new Error("private-auth-secret");
          return options.auth ?? { data: { user: { id: "owner-id" } }, error: null };
        } },
        from: (table) => { calls.push(["from", table]); return builder; },
      };
    } },
  });
  return { actions, calls };
}

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

test("display name rejects invalid input before accessing cookies or auth", async () => {
  for (const values of [{}, { name: "   " }, { name: "a b" }, { name: "a".repeat(101) }]) {
    const { actions, calls } = accountActions();
    assert.equal(typeof (await actions.updateDisplayName({}, form(values))).error, "string");
    assert.deepEqual(calls, []);
  }
});

test("display name requires verified user and sanitizes authentication failures", async () => {
  for (const options of [
    { auth: { data: { user: null }, error: null } },
    { auth: { data: { user: { id: "owner-id" } }, error: { message: "private-auth-secret" } } },
    { throws: true },
  ]) {
    const { actions, calls } = accountActions(options);
    const result = await actions.updateDisplayName({}, form({ name: "ชื่อซ้ำได้" }));
    assert.equal(typeof result.error, "string");
    assert.ok(!JSON.stringify(result).includes("private-auth-secret"));
    assert.ok(!calls.some(([method]) => ["from", "revalidate"].includes(method)));
  }
});

test("updateDisplayName trims Thai names, allows duplicates and scopes writes to verified owner", async () => {
  const { actions, calls } = accountActions();
  for (let attempt = 0; attempt < 2; attempt++) {
    calls.length = 0;
    assert.deepEqual(await actions.updateDisplayName({}, form({ name: "  ชื่อซ้ำได้  ", id: "attacker-id" })), { success: "บันทึกชื่อแล้ว" });
    assert.deepEqual(calls, [
      ["cookies"], ["client"], ["getUser"], ["from", "profiles"], ["update", { name: "ชื่อซ้ำได้" }],
      ["eq", "id", "owner-id"], ["select", "id"], ["maybeSingle"],
      ["revalidate", "/account"], ["revalidate", "/u/owner-id"],
    ]);
  }
});

test("profile write failures and update races return sanitized errors without revalidation", async () => {
  for (const options of [
    { results: [{ data: null, error: { message: "private-database-secret" } }] },
    { results: [{ data: null, error: null }] },
    { databaseThrows: true },
  ]) {
    const { actions, calls } = accountActions(options);
    const result = await actions.updateDisplayName({}, form({ name: "Alice" }));
    assert.equal(typeof result.error, "string");
    assert.ok(!JSON.stringify(result).includes("private-database-secret"));
    assert.ok(!calls.some(([method]) => method === "revalidate"));
  }
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
    ["/account/setup", "/account"],
    ["/account/password?tab=security#reset", "/account/password?tab=security#reset"],
    ["/projects/example?tab=files#guide", "/projects/example?tab=files#guide"],
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
