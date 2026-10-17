// Isolated in-memory PostgreSQL simulation, not complete Supabase validation.
// No Supabase API, credentials, persistent database, or application build involved.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { delimiter, resolve } from "node:path";

const packagePath = (process.env.PATH ?? "")
  .split(delimiter)
  .map((entry) => resolve(entry, "../@electric-sql/pglite/package.json"))
  .find((candidate) => existsSync(candidate));
if (!packagePath) {
  throw new Error(
    'PGlite not found alongside PATH entries. Run: pnpm --package=@electric-sql/pglite --shell-mode dlx "node tests/schema-smoke.mjs"',
  );
}
const require = createRequire(packagePath);
const { PGlite } = require("@electric-sql/pglite");
const migrationDirectory = new URL("../supabase/migrations/", import.meta.url);
const migrationFiles = (await readdir(migrationDirectory))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const migration = (
  await Promise.all(
    migrationFiles.map((name) =>
      readFile(new URL(name, migrationDirectory), "utf8"),
    ),
  )
).join("\n");
const originalTests = await readFile(
  new URL("../supabase/tests/rls.sql", import.meta.url),
  "utf8",
);
// These are psql client directives, not PostgreSQL statements. Reject other directives.
const tests = originalTests
  .split(/\r?\n/)
  .map((line) => {
    if (!line.startsWith("\\")) return line;
    if (
      line === "\\set ON_ERROR_STOP on" ||
      line === "\\echo 'RLS tests passed; all fixtures rolled back.'"
    )
      return "";
    throw new Error(`Unsupported psql directive: ${line}`);
  })
  .join("\n");
const db = new PGlite();
let phase = "bootstrap";
try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create schema storage;
    create table auth.users (
      id uuid primary key,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
            raw_app_meta_data jsonb not null default '{}'::jsonb,
            email text
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    revoke all on function auth.uid() from public;
    grant usage on schema auth, storage to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets(id),
      name text not null,
      owner uuid,
      metadata jsonb,
      unique(bucket_id, name)
    );
    alter table storage.objects enable row level security;
    grant select, insert, update, delete on storage.objects to authenticated;
    grant select on storage.objects to anon;
  `);
  phase = "supabase/migrations/*.sql";
  const usernameMigration = "20261017000000_member_usernames.sql";
  assert.equal(migrationFiles.at(-1), usernameMigration);
  for (const name of migrationFiles) {
    if (name === usernameMigration) {
      await db.exec(`
        insert into auth.users(id, raw_app_meta_data, raw_user_meta_data)
        values ('55555555-5555-4555-8555-555555555555', '{"provider":"email"}', '{"username":"legacy_name","name":"Legacy Maker"}');
      `);
    }
    await db.exec(await readFile(new URL(name, migrationDirectory), "utf8"));
  }
  const { rows: legacy } = await db.query(`
    select username, name from public.profiles
    where id = '55555555-5555-4555-8555-555555555555'
  `);
  assert.deepEqual(legacy, [{ username: null, name: "Legacy Maker" }]);
  await db.exec("delete from auth.users where id = '55555555-5555-4555-855PASS: original migration executed.");

  const tables = [
    "auth.users",
    "public.profiles",
    "public.projects",
    "public.steps",
    "public.step_files",
    "public.materials",
    "public.files",
    "public.firmware_releases",
    "public.firmware_parts",
    "public.tags",
    "public.project_tags",
    "storage.buckets",
    "storage.objects",
  ];
  async function snapshot() {
    const counts = {};
    for (const table of tables) {
      const { rows } = await db.query(
        `select count(*)::integer as count from ${table}`,
      );
      counts[table] = rows[0].count;
    }
    return counts;
  }
  const baseline = await snapshot();
  phase = "supabase/tests/rls.sql";
  await db.exec(tests);
  console.log(
    "PASS: original SQL RLS tests (profile trigger, owner/nonowner permissions, private storage).",
  );
  phase = "rollback read check";
  const { rows: role } = await db.query(
    "select current_user = session_user as reset",
  );
  assert.equal(role[0].reset, true, "test role must be reset");
  assert.deepEqual(
    await snapshot(),
    baseline,
    "all fixture row counts must return to their pre-test values",
  );
  const { rows: fixtures } = await db.query(`
    select
      not exists (select 1 from auth.users where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'))
      and not exists (select 1 from public.projects where slug in ('rls-public', 'rls-draft')) as removed
  `);
  assert.equal(
    fixtures[0].removed,
    true,
    "test users and projects must be rolled back",
  );
  const { rows: bucket } = await db.query(
    "select public from storage.buckets where id = 'project-assets'",
  );
  assert.equal(bucket.length, 1);
  assert.equal(
    bucket[0].public,
    false,
    "migration private bucket must survive test rollback",
  );
  console.log(
    "PASS: rollback verified by reads; migration schema and private bucket remain.",
  );
  console.log(
    "LIMITATION: local PGlite/bootstrap simulation only; no Supabase Auth/Storage API or deployed environment validation.",
  );
} catch (error) {
  console.error(`FAIL during ${phase}`);
  for (const field of [
    "message",
    "code",
    "detail",
    "hint",
    "position",
    "internalPosition",
    "internalQuery",
    "where",
  ]) {
    if (error[field] !== undefined) console.error(`${field}: ${error[field]}`);
  }
  process.exitCode = 1;
  // A failing multi-statement exec leaves the test transaction aborted.
  // Roll it back explicitly and verify no fixture escaped the transaction.
  if (phase === "supabase/tests/rls.sql") {
    try {
      await db.exec("rollback; reset role;");
      const { rows } = await db.query(`
        select
          (select count(*)::integer from auth.users) as users,
          (select count(*)::integer from public.profiles) as profiles,
          (select count(*)::integer from public.projects) as projects,
          (select count(*)::integer from storage.objects) as objects,
          (select count(*)::integer from storage.buckets where id = 'project-assets' and not public) as private_buckets
      `);
      assert.deepEqual(rows[0], {
        users: 0,
        profiles: 0,
        projects: 0,
        objects: 0,
        private_buckets: 1,
      });
      console.log(
        "PASS: explicit rollback after SQL failure verified by reads; fixtures removed, private migration bucket remains.",
      );
      console.log(
        "NOT PASSED: remaining SQL assertions were not executed. This is only an isolated PGlite simulation.",
      );
    } catch (rollbackError) {
      console.error("FAIL during failure rollback read check:", rollbackError);
    }
  }
} finally {
  await db.close();
}
