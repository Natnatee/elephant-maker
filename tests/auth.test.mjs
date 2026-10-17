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

test("validation normalizes usernames and checks boundaries and reserved names", () => {
  assert.equal(validation.normalizeUsername("  UsEr_123  "), "user_123");
  for (const value of ["abc", "A_1", "a".repeat(24), "  hello  "])
    assert.equal(validation.usernameError(value), null, value);
  for (const value of ["", "ab", "a".repeat(25), "a-b", "a b", "ผู้ใช้", "abc\nxyz", "admin", " ADMIN ", "administrator", "root", "support", "system", "elephantmaker"])
    assert.equal(typeof validation.usernameError(value), "string", value);
});

test("password and display name validation enforce exact boundaries", () => {
  for (const length of [8, 128]) assert.equal(validation.passwordError("a".repeat(length)), null);
  for (const length of [0, 7, 129]) assert.equal(typeof validation.passwordError("a".repeat(length)), "string");
  for (const value of ["a", "ชื่อผู้ใช้", "  Alice  ", "a".repeat(100)])
    assert.equal(validation.displayNameError(value), null);
  for (const value of ["", "   ", "a".repeat(101), "a\u0000b", "a\nb", "a\tb", "a\u007fb"])
    assert.equal(typeof validation.displayNameError(value), "string");
});

test("post-auth paths wrap safe destinations and only bypass setup for the exact password pathname", () => {
  for (const [value, expected] of [
    [null, "/account/setup?next=%2Faccount"],
    [undefined, "/account/setup?next=%2Faccount"],
    ["https://evil.invalid", "/account/setup?next=%2Faccount"],
    ["/account/setup?next=/submit", "/account/setup?next=%2Faccount"],
    ["/account/password", "/account/password"],
    ["/account/password?next=https://evil.invalid#secret", "/account/password"],
    ["/account/password/", "/account/setup?next=%2Faccount%2Fpassword%2F"],
    ["/account/password-extra", "/account/setup?next=%2Faccount%2Fpassword-extra"],
    ["/ACCOUNT/password", "/account/setup?next=%2FACCOUNT%2Fpassword"],
    ["/submit?q=a&tab=b#guide", "/account/setup?next=%2Fsubmit%3Fq%3Da%26tab%3Db%23guide"],
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
    await assertRedirect(await success.GET(new Request(url)), "/account/setup?next=%2Faccount", ["private-code"]);
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
      [null, "/account/setup?next=%2Faccount"],
      ["/submit?q=one#two", "/account/setup?next=%2Fsubmit%3Fq%3Done%23two"],
      ["https://evil.invalid", "/account/setup?next=%2Faccount"],
      ["//evil.invalid", "/account/setup?next=%2Faccount"],
      ["/%5cevil.invalid", "/account/setup?next=%2Faccount"],
      ["/account/setup", "/account/setup?next=%2Faccount"],
      ["/auth/callback", "/account/setup?next=%2Faccount"],
      ["/account/password?token=discard-me", "/account/password"],
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
      await assertRedirect(await route.GET(new Request(url)), type === "recovery" ? "/account/password" : target, ["private-token", "discard-me"], true);
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
  const navigation = new Error("test redirect");
  const builder = {
    select(value) { calls.push(["select", value]); return this; },
    update(value) { calls.push(["update", value]); return this; },
    eq(key, value) { calls.push(["eq", key, value]); return this; },
    is(key, value) { calls.push(["is", key, value]); return this; },
    async maybeSingle() {
      calls.push(["maybeSingle"]);
      return options.results?.shift() ?? { data: { username: null }, error: null };
    },
  };
  const actions = loadModule("../src/app/account/actions.ts", {
    "@/lib/auth/redirect": redirect,
    "@/lib/auth/validation": validation,
    "next/headers": { cookies: async () => { calls.push(["cookies"]); return store; } },
    "next/navigation": { redirect: (path) => { calls.push(["redirect", path]); throw navigation; } },
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
  return { actions, calls, navigation };
}

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

test("completeProfile normalizes username and performs owner-scoped, unset-only update", async () => {
  const { actions, calls, navigation } = accountActions({ results: [
    { data: { username: null }, error: null },
    { data: { username: "new_user" }, error: null },
  ] });
  await assert.rejects(actions.completeProfile({}, form({ username: " New_USER ", next: "//evil.invalid", id: "attacker-id" })), error => error === navigation);
  assert.deepEqual(calls, [
    ["cookies"], ["client"], ["getUser"],
    ["from", "profiles"], ["select", "username"], ["eq", "id", "owner-id"], ["maybeSingle"],
    ["from", "profiles"], ["update", { username: "new_user" }], ["eq", "id", "owner-id"], ["is", "username", null], ["select", "username"], ["maybeSingle"],
    ["revalidate", "/account"], ["redirect", "/account"],
  ]);
});

test("completeProfile preserves existing usernames and redirects to safe next", async () => {
  const { actions, calls, navigation } = accountActions({ results: [{ data: { username: "existing" }, error: null }] });
  await assert.rejects(actions.completeProfile({}, form({ username: "different", next: "/submit" })), error => error === navigation);
  assert.ok(!calls.some(([method]) => method === "update"));
  assert.deepEqual(calls.at(-1), ["redirect", "/submit"]);
});

test("account actions reject invalid input before accessing cookies or auth", async () => {
  for (const [action, values] of [["completeProfile", { username: "admin" }], ["completeProfile", {}], ["updateDisplayName", { name: "a\u0000b" }], ["updateDisplayName", {}]]) {
    const { actions, calls } = accountActions();
    assert.equal(typeof (await actions[action]({}, form(values))).error, "string");
    assert.deepEqual(calls, []);
  }
});

test("account actions require verified user and sanitize authentication failures", async () => {
  for (const options of [
    { auth: { data: { user: null }, error: null } },
    { auth: { data: { user: { id: "owner-id" } }, error: { message: "private-auth-secret" } } },
    { throws: true },
  ]) {
    for (const action of ["completeProfile", "updateDisplayName"]) {
      const { actions, calls } = accountActions(options);
      const result = await actions[action]({}, form({ username: "valid_user", name: "Alice" }));
      assert.equal(typeof result.error, "string");
      assert.ok(!JSON.stringify(result).includes("private-auth-secret"));
      assert.ok(!calls.some(([method]) => ["from", "revalidate", "redirect"].includes(method)));
    }
  }
});

test("updateDisplayName trims input, scopes update to owner and revalidates profile", async () => {
  for (const username of ["existing", null]) {
    const { actions, calls } = accountActions({ results: [{ data: { username }, error: null }] });
    const result = await actions.updateDisplayName({}, form({ name: "  Alice  ", id: "attacker-id" }));
    assert.equal(typeof result.success, "string");
    assert.deepEqual(calls, [
      ["cookies"], ["client"], ["getUser"], ["from", "profiles"], ["update", { name: "Alice" }],
      ["eq", "id", "owner-id"], ["select", "username"], ["maybeSingle"], ["revalidate", "/account"],
      ...(username ? [["revalidate", "/u/existing"]] : []),
    ]);
  }
});

test("account profile read/write failures and update races return sanitized errors", async () => {
  const secret = "private-database-secret";
  const failure = { data: null, error: { message: secret } };
  for (const [action, results] of [
    ["completeProfile", [failure]],
    ["completeProfile", [{ data: null, error: null }]],
    ["completeProfile", [{ data: { username: null }, error: null }, failure]],
    ["completeProfile", [{ data: { username: null }, error: null }, { data: null, error: { code: "23505", message: secret } }]],
    ["completeProfile", [{ data: { username: null }, error: null }, { data: null, error: null }]],
    ["updateDisplayName", [failure]],
    ["updateDisplayName", [{ data: null, error: null }]],
  ]) {
    const { actions, calls } = accountActions({ results });
    const result = await actions[action]({}, form({ username: "valid_user", name: "Alice" }));
    assert.equal(typeof result.error, "string");
    assert.ok(!JSON.stringify(result).includes(secret));
    assert.ok(!calls.some(([method]) => ["revalidate", "redirect"].includes(method)));
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
    ["/submit", "/account/setup?next=%2Fsubmit"],
    ["//evil.invalid", "/account/setup?next=%2Faccount"],
    ["/account/setup", "/account/setup?next=%2Faccount"],
    ["/account/password?token=private", "/account/password"],
    ["/projects/example?tab=files#guide", "/account/setup?next=%2Fprojects%2Fexample%3Ftab%3Dfiles%23guide"],
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
