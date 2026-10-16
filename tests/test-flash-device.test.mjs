import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, webcrypto } from "node:crypto";
import ts from "typescript";
import SparkMD5 from "spark-md5";

function loadSource(name, dependencies = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  );
  const compiledModule = { exports: {} };
  const require = (id) => {
    assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`);
    return dependencies[id];
  };
  new Function("module", "exports", "require", "crypto", outputText)(
    compiledModule,
    compiledModule.exports,
    require,
    webcrypto,
  );
  return compiledModule.exports;
}
const parser = loadSource("test-flash-package");
const { validateTestFlashPackage: validate } = parser;

const safeSecurity = () => ({
  chipId: 5,
  flashCryptCnt: 0,
  parsedFlags: { SECURE_BOOT_EN: false, SECURE_DOWNLOAD_ENABLE: false },
});
const unsafeSecurity = [
  ["chip ID", () => ({ ...safeSecurity(), chipId: 9 })],
  [
    "secure boot",
    () => ({
      ...safeSecurity(),
      parsedFlags: { ...safeSecurity().parsedFlags, SECURE_BOOT_EN: true },
    }),
  ],
  [
    "secure download",
    () => ({
      ...safeSecurity(),
      parsedFlags: {
        ...safeSecurity().parsedFlags,
        SECURE_DOWNLOAD_ENABLE: true,
      },
    }),
  ],
  ["flash encryption", () => ({ ...safeSecurity(), flashCryptCnt: 1 })],
];

function harness(options = {}) {
  const calls = [];
  const lastLoader = { current: undefined };
  const lastTransport = { current: undefined };
  class Transport {
    constructor(port, tracing) {
      calls.push(["transport", port, tracing]);
      lastTransport.current = this;
    }
    async disconnect() {
      calls.push(["disconnect"]);
    }
  }
  class ESPLoader {
    constructor(config) {
      lastLoader.current = this;
      this.config = config;
      this.chip = {
        CHIP_NAME: options.chipName ?? "ESP32-C3",
        getChipDescription: async () => "Mock C3",
        getMajorChipVersion: async () => options.major ?? 1,
        getMinorChipVersion: async () => options.minor ?? 3,
      };
    }
    async connect(...args) {
      calls.push(["connect", ...args]);
    }
    async getSecurityInfo() {
      calls.push(["security"]);
      return options.security ?? safeSecurity();
    }
    async writeReg(...args) {
      calls.push(["writeReg", ...args]);
    }
    async readReg(address) {
      calls.push(["readReg", address]);
      return 0x1234;
    }
    async runStub() {
      calls.push(["stub"]);
      this.IS_STUB = options.stub !== false;
    }
    async detectFlashSize() {
      calls.push(["detectFlashSize"]);
      return Object.hasOwn(options, "flashSize") ? options.flashSize : "4MB";
    }
    async writeFlash(config) {
      calls.push(["writeFlash", config]);
    }
  }
  const api = loadSource("test-flash-device", {
    "./test-flash-package": parser,
    "spark-md5": { default: SparkMD5 },
    "esptool-js": { ESPLoader, Transport },
  });
  return {
    api,
    calls,
    get loader() {
      return lastLoader.current;
    },
    get transport() {
      return lastTransport.current;
    },
    device(overrides = {}) {
      return {
        loader: new ESPLoader({}),
        revision: 103,
        flashBytes: 4 * 1024 * 1024,
        ...overrides,
      };
    },
  };
}

function image(bytes, offset, hash) {
  const view = new DataView(bytes.buffer);
  bytes.fill(0, offset, offset + 24);
  bytes[offset] = 0xe9;
  bytes[offset + 1] = 2;
  bytes[offset + 3] = 0x20;
  view.setUint16(offset + 12, 5, true);
  bytes[offset + 23] = Number(hash);
  let cursor = offset + 24;
  let checksum = 0xef;
  for (const length of [3, 5]) {
    view.setUint32(cursor, 0x3fc80000, true);
    view.setUint32(cursor + 4, length, true);
    bytes.fill(0x12, cursor + 8, cursor + 8 + length);
    for (let i = 0; i < length; i++) checksum ^= 0x12;
    cursor += 8 + length;
  }
  const end = offset + Math.ceil((cursor - offset + 1) / 16) * 16;
  bytes.fill(0, cursor, end);
  bytes[end - 1] = checksum;
  if (hash)
    bytes.set(
      createHash("sha256").update(bytes.subarray(offset, end)).digest(),
      end,
    );
  return end + (hash ? 32 : 0);
}
function fixture({ hash = false, md5 = false } = {}) {
  const bytes = new Uint8Array(0x11000).fill(0xff);
  const view = new DataView(bytes.buffer);
  image(bytes, 0, hash);
  for (const [index, type, subtype, offset, size] of [
    [0, 1, 2, 0x9000, 0x6000],
    [1, 0, 0, 0x10000, 0x100000],
  ]) {
    const cursor = 0x8000 + index * 32;
    bytes.fill(0, cursor, cursor + 32);
    view.setUint16(cursor, 0x50aa, true);
    bytes[cursor + 2] = type;
    bytes[cursor + 3] = subtype;
    view.setUint32(cursor + 4, offset, true);
    view.setUint32(cursor + 8, size, true);
  }
  if (md5) {
    view.setUint16(0x8040, 0xebeb, true);
    bytes.set(
      createHash("md5").update(bytes.subarray(0x8000, 0x8040)).digest(),
      0x8050,
    );
  }
  return bytes.slice(0, image(bytes, 0x10000, hash));
}
function revisionHeader(bytes, offset, legacy, minimum, maximum) {
  const view = new DataView(bytes.buffer);
  bytes[offset + 14] = legacy;
  view.setUint16(offset + 15, minimum, true);
  view.setUint16(offset + 17, maximum, true);
}
const noFlash = (calls) =>
  assert.equal(calls.filter(([name]) => name === "writeFlash").length, 0);

const prepareCalls = [
  ["writeReg", 0x600080a8, 0x50d83aa1],
  ["writeReg", 0x60008090, 0],
  ["writeReg", 0x600080a8, 0],
  ["writeReg", 0x600080b0, 0x8f1d312a],
  ["readReg", 0x600080ac],
  ["writeReg", 0x600080ac, 0x1234 | 0x80000000],
  ["writeReg", 0x600080b0, 0],
];
test("prepare disables RTC watchdog and enables autofeed in exact unlock/relock order", async () => {
  const h = harness();
  await h.api.prepareC3DownloadSession(h.device().loader);
  assert.deepEqual(h.calls, prepareCalls);
});
for (const failedIndex of [1, 4, 5]) {
  test(`prepare relocks protected registers after failure at operation ${failedIndex}`, async () => {
    const { api } = harness();
    const calls = [];
    const error = new Error("register operation failed");
    const operation = async (...args) => {
      calls.push(args);
      if (calls.length - 1 === failedIndex) throw error;
      return 0x1234;
    };
    await assert.rejects(
      api.prepareC3DownloadSession({
        writeReg: (...args) => operation("writeReg", ...args),
        readReg: (...args) => operation("readReg", ...args),
      }),
      (actual) => actual === error,
    );
    const relock =
      failedIndex === 1
        ? ["writeReg", 0x600080a8, 0]
        : ["writeReg", 0x600080b0, 0];
    assert.deepEqual(calls, [
      ...prepareCalls.slice(0, failedIndex + 1),
      relock,
    ]);
  });
}

test("inspect uses manual ROM connect, prepares before stub, and returns full revision", async () => {
  const h = harness();
  const port = {};
  const device = await h.api.inspectFlashDevice(port, () => {});
  assert.deepEqual(h.calls, [
    ["transport", port, false],
    ["connect", "no_reset", 3],
    ["security"],
    ...prepareCalls,
    ["stub"],
    ["detectFlashSize"],
  ]);
  assert.equal(device.loader, h.loader);
  assert.equal(device.transport, h.transport);
  assert.equal(device.description, "Mock C3");
  assert.equal(device.revision, 103);
  assert.equal(device.flashBytes, 4 * 1024 * 1024);
  assert.equal(device.flashSize, "4MB");
  assert.equal(h.loader.config.baudrate, 115200);
  assert.equal(h.loader.config.romBaudrate, 115200);
});
for (const [name, options] of [
  ["wrong chip family", { chipName: "ESP32-S3" }],
  ...unsafeSecurity.map(([name, security]) => [name, { security: security() }]),
]) {
  test(`inspect rejects ${name} and disconnects before register writes or stub`, async () => {
    const h = harness(options);
    await assert.rejects(
      h.api.inspectFlashDevice({}, () => {}),
      /ESP32-C3|Secure Boot/,
    );
    assert.deepEqual(
      h.calls.map(([name]) => name),
      [
        "transport",
        "connect",
        ...(options.chipName ? [] : ["security"]),
        "disconnect",
      ],
    );
  });
}
for (const flashSize of [undefined, "", "32MB", "4MiB", "0MB", "4MB "]) {
  test(`inspect refuses readiness for flash size ${JSON.stringify(flashSize)}`, async () => {
    const h = harness({ flashSize });
    await assert.rejects(
      h.api.inspectFlashDevice({}, () => {}),
      /Flash/,
    );
    assert.deepEqual(h.calls.at(-1), ["disconnect"]);
    noFlash(h.calls);
  });
}
for (const size of [1, 2, 4, 8, 16]) {
  test(`inspect accepts whitelisted ${size}MB flash`, async () => {
    const h = harness({ flashSize: `${size}MB` });
    assert.equal(
      (await h.api.inspectFlashDevice({}, () => {})).flashBytes,
      size * 1024 * 1024,
    );
  });
}
test("inspect disconnects if RAM stub does not start", async () => {
  const h = harness({ stub: false });
  await assert.rejects(
    h.api.inspectFlashDevice({}, () => {}),
    /RAM/,
  );
  assert.deepEqual(h.calls.at(-1), ["disconnect"]);
  assert.ok(!h.calls.some(([name]) => name === "detectFlashSize"));
});

test("install writes validated merged bytes at zero with explicit erase, keep options and real MD5", async () => {
  const h = harness();
  const bytes = fixture({ hash: true, md5: true });
  const original = bytes.slice();
  const progress = [];
  await h.api.installFlashPackage(h.device(), bytes, (...args) =>
    progress.push(args),
  );
  assert.deepEqual(
    h.calls.map(([name]) => name),
    ["security", "writeFlash"],
  );
  const config = h.calls[1][1];
  assert.deepEqual(config.fileArray, [{ data: bytes, address: 0 }]);
  assert.equal(config.fileArray[0].data, bytes);
  assert.equal(config.eraseAll, true);
  assert.equal(config.compress, true);
  for (const key of ["flashMode", "flashFreq", "flashSize"])
    assert.equal(config[key], "keep");
  assert.equal(typeof config.calculateMD5Hash, "function");
  for (const data of [bytes, Uint8Array.of(0, 128, 255, 1)]) {
    assert.equal(
      config.calculateMD5Hash(data),
      createHash("md5").update(data).digest("hex"),
    );
  }
  config.reportProgress(0, 17, 42);
  assert.deepEqual(progress, [[17, 42]]);
  assert.deepEqual(bytes, original);
});
for (const [name, security] of unsafeSecurity) {
  test(`install rejects ${name} without writeFlash`, async () => {
    const h = harness({ security: security() });
    await assert.rejects(
      h.api.installFlashPackage(h.device(), fixture(), () => {}),
      /ความปลอดภัย/,
    );
    assert.deepEqual(h.calls, [["security"]]);
    noFlash(h.calls);
  });
}
test("install rejects flash capacity mismatch before security or writeFlash", async () => {
  const h = harness();
  await assert.rejects(
    h.api.installFlashPackage(
      h.device({ flashBytes: 2 * 1024 * 1024 }),
      fixture(),
      () => {},
    ),
    /ขนาด Flash/,
  );
  assert.deepEqual(h.calls, []);
});

const revisionCases = [
  ["legacy v1.0 below minor 3", 100, 3, 0, 0, false],
  ["legacy inclusive minor 3", 103, 3, 0, 0, true],
  ["legacy ignores full minimum when max is zero", 103, 3, 500, 0, true],
  ["default max falls back to legacy", 100, 3, 0, 65535, false],
  ["default max legacy inclusive", 103, 3, 0, 65535, true],
  ["full lower boundary", 100, 9, 100, 103, true],
  ["full upper boundary", 103, 9, 100, 103, true],
  ["full below minimum", 99, 0, 100, 103, false],
  ["full above maximum", 104, 0, 100, 103, false],
  ["full default max below minimum", 100, 0, 103, 65535, false],
  ["full default max inclusive minimum", 103, 9, 103, 65535, true],
  ["modern zero minimum ignores legacy with finite max", 100, 9, 0, 103, true],
  ["modern zero minimum and default max", 100, 0, 0, 65535, true],
];
for (const offset of [0, 0x10000]) {
  for (const [
    name,
    revision,
    legacy,
    minimum,
    maximum,
    allowed,
  ] of revisionCases) {
    test(`${offset === 0 ? "boot" : "app"} revision: ${name}`, async () => {
      const h = harness();
      const bytes = fixture();
      revisionHeader(bytes, offset, legacy, minimum, maximum);
      const info = validate(bytes);
      const device = h.device({ revision });
      if (allowed) {
        assert.doesNotThrow(() =>
          h.api.checkFlashCompatibility(device, bytes, info),
        );
        await h.api.installFlashPackage(device, bytes, () => {});
        assert.deepEqual(
          h.calls.map(([name]) => name),
          ["security", "writeFlash"],
        );
      } else {
        assert.throws(
          () => h.api.checkFlashCompatibility(device, bytes, info),
          /revision/,
        );
        await assert.rejects(
          h.api.installFlashPackage(device, bytes, () => {}),
          /revision/,
        );
        assert.deepEqual(h.calls, []);
        noFlash(h.calls);
      }
    });
  }
}

test("integrity accepts independently generated SHA256 for both images and partition MD5", async () => {
  const { api } = harness();
  const bytes = fixture({ hash: true, md5: true });
  await api.verifyPackageIntegrity(bytes, validate(bytes));
  const wrapped = new Uint8Array(bytes.length + 9);
  wrapped.set(bytes, 5);
  const slice = wrapped.subarray(5, 5 + bytes.length);
  await api.verifyPackageIntegrity(slice, validate(slice));
});
for (const offset of [0, 0x10000]) {
  for (const corruption of ["digest", "header"]) {
    test(`integrity rejects ${offset === 0 ? "boot" : "app"} SHA256 ${corruption} corruption before write`, async () => {
      const h = harness();
      const bytes = fixture({ hash: true, md5: true });
      bytes[offset + (corruption === "digest" ? 64 : 4)] ^= 1;
      const info = validate(bytes);
      await assert.rejects(
        h.api.verifyPackageIntegrity(bytes, info),
        /SHA-256/,
      );
      await assert.rejects(
        h.api.installFlashPackage(h.device(), bytes, () => {}),
        /SHA-256/,
      );
      assert.deepEqual(h.calls, []);
    });
  }
}
for (const corruption of ["digest", "entry"]) {
  test(`integrity rejects partition MD5 ${corruption} corruption before write`, async () => {
    const h = harness();
    const bytes = fixture({ md5: true });
    bytes[corruption === "digest" ? 0x8050 : 0x8010] ^= 1;
    const info = validate(bytes);
    await assert.rejects(h.api.verifyPackageIntegrity(bytes, info), /MD5/);
    await assert.rejects(
      h.api.installFlashPackage(h.device(), bytes, () => {}),
      /MD5/,
    );
    assert.deepEqual(h.calls, []);
  });
}
test("integrity accepts legacy images without optional hashes", async () => {
  const { api } = harness();
  const bytes = fixture();
  await api.verifyPackageIntegrity(bytes, validate(bytes));
});
