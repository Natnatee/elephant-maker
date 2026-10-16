import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const require = createRequire(import.meta.url);
const development = process.argv.includes("--dev");
const port = development ? "3101" : "3100";
if (!development) {
  const trace = JSON.parse(
    readFileSync(
      ".next/server/app/api/test-flash/esp32-c3-check/route.js.nft.json",
      "utf8",
    ),
  );
  if (trace.files.some((filename) => filename.includes(".local-firmware")))
    throw new Error(
      "Private firmware must not appear in production deployment traces",
    );
}
const server = spawn(
  process.execPath,
  [
    require.resolve("next/dist/bin/next"),
    development ? "dev" : "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    port,
  ],
  { stdio: "inherit" },
);
const origin = `http://127.0.0.1:${port}`;
function stop(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } catch {
      child.kill();
    }
  } else child.kill("SIGTERM");
}
let test;
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null)
      throw new Error("Test server stopped before readiness");
    try {
      if (
        (
          await fetch(`${origin}/test-flash`, {
            signal: AbortSignal.timeout(1500),
          })
        ).ok
      ) {
        ready = true;
        break;
      }
    } catch {}
    await sleep(500);
  }
  if (!ready) throw new Error("Test server readiness timed out");
  test = spawn(
    process.execPath,
    [
      "tests/browser-test-flash.mjs",
      ...(development ? ["--local-package"] : []),
    ],
    {
      stdio: "inherit",
      env: { ...process.env, TEST_BASE_URL: origin },
    },
  );
  const timeout = globalThis.setTimeout(() => stop(test), 60000);
  try {
    const code = await new Promise((resolve, reject) => {
      test.once("error", reject);
      test.once("exit", (code) => resolve(code));
    });
    if (code !== 0) throw new Error(`Browser test failed with exit ${code}`);
  } finally {
    clearTimeout(timeout);
  }
} finally {
  stop(test);
  stop(server);
}
