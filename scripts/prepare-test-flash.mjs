import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const directory = process.argv[2] && path.resolve(process.argv[2]);
if (!directory)
  throw new Error(
    "Usage: pnpm prepare:test-flash <PlatformIO build environment directory>",
  );
const metadata = JSON.parse(
  readFileSync(path.join(directory, "project-metadata.json"), "utf8"),
);
const environment = path.basename(directory);
const images = metadata[environment]?.extra?.flash_images;
if (!Array.isArray(images))
  throw new Error(
    "Generate PlatformIO project metadata before preparing this package",
  );
const binary = (name) => {
  const filename = path.join(directory, name);
  const bytes = new Uint8Array(readFileSync(filename));
  if (!bytes.length || bytes.length > 16 * 1024 * 1024)
    throw new Error(`Invalid binary size: ${name}`);
  return bytes;
};
const offsetFor = (name) => {
  const image = images.find(
    (entry) => path.resolve(entry.path) === path.join(directory, name),
  );
  if (!image || !/^0x[0-9a-f]+$/i.test(image.offset))
    throw new Error(`Missing verified PlatformIO flash offset for ${name}`);
  return Number(image.offset);
};
const bootOffset = offsetFor("bootloader.bin");
const tableOffset = offsetFor("partitions.bin");
if (bootOffset !== 0 || tableOffset !== 0x8000)
  throw new Error(
    "Only the reviewed C3 bootloader/partition layout is supported",
  );
const boot = binary("bootloader.bin");
const partitions = binary("partitions.bin");
const app = binary("firmware.bin");
if (partitions.length > 0x1000 || boot.length > tableOffset)
  throw new Error("Bootloader / partition overlap");
const view = new DataView(
  partitions.buffer,
  partitions.byteOffset,
  partitions.byteLength,
);
const applications = [];
for (let offset = 0; offset + 32 <= partitions.length; offset += 32) {
  if (view.getUint16(offset, true) !== 0x50aa) break;
  if (
    partitions[offset + 2] === 0 &&
    [0, 0x10].includes(partitions[offset + 3])
  )
    applications.push({
      subtype: partitions[offset + 3],
      offset: view.getUint32(offset + 4, true),
    });
}
const selected =
  applications.find((entry) => entry.subtype === 0) ??
  applications.find((entry) => entry.subtype === 0x10);
if (!selected)
  throw new Error(
    "Cannot determine factory / ota_0 application offset from the built partition table",
  );
const applicationOffset = selected.offset;
if (
  applicationOffset < tableOffset + 0x1000 ||
  applicationOffset + app.length > 16 * 1024 * 1024
)
  throw new Error("Application exceeds supported layout");
// Use only reviewed images; eraseAll makes otadata unnecessary and selects factory / ota_0.
// Do not embed PlatformIO boot_app0 or any saved NVS/otadata in the package.
const merged = new Uint8Array(applicationOffset + app.length).fill(0xff);
merged.set(boot, bootOffset);
merged.set(partitions, tableOffset);
merged.set(app, applicationOffset);
function compile(relative, dependencies = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(path.join(root, relative), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    },
  );
  const compiledModule = { exports: {} };
  new Function("module", "exports", "require", outputText)(
    compiledModule,
    compiledModule.exports,
    (name) => dependencies[name] ?? require(name),
  );
  return compiledModule.exports;
}
const parser = compile("src/lib/test-flash-package.ts");
const { verifyPackageIntegrity } = compile("src/lib/test-flash-device.ts", {
  "./test-flash-package": parser,
});
const info = parser.validateTestFlashPackage(merged);
await verifyPackageIntegrity(merged, info);
const destination = path.join(root, ".local-firmware", "esp32-c3-check");
if (existsSync(path.join(root, "public", "firmware")))
  console.warn(
    "Keep private firmware out of public/; this script writes only to .local-firmware/",
  );
mkdirSync(destination, { recursive: true });
const manifest = {
  id: "esp32-c3-check",
  name: "ESP32_C3_CHECK",
  chip: "ESP32-C3",
  board: "ESP32-C3 SuperMini",
  flashBytes: info.flashBytes,
  byteLength: merged.length,
  sha256: createHash("sha256").update(merged).digest("hex"),
  applicationOffset,
  scope: "local-only",
  includesWifiCredentials: true,
  preparedAt: new Date().toISOString(),
};
writeFileSync(path.join(destination, "merged.bin"), merged);
writeFileSync(
  path.join(destination, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  `Prepared local-only ESP32_C3_CHECK: ${info.chip}, ${info.flashSizeLabel}, ${merged.length} bytes`,
);
console.log(
  `Verified offsets: bootloader=0x${bootOffset.toString(16)}, partitions=0x${tableOffset.toString(16)}, ${info.applicationKind}=0x${applicationOffset.toString(16)}`,
);
console.log(
  "Image checksums, embedded SHA-256 and partition MD5 passed. No hardware was accessed.",
);
console.log(
  "Open http://localhost:3000/test-flash using pnpm dev. Do not upload this binary publicly.",
);
