#!/usr/bin/env node
// Times `JsonDocument` with ranges off and with ranges on, each against a
// byte-identical copy of its own binary, in interleaved rounds, so the noise
// band is measured on the same machine at the same time as the figure it
// bounds (CLAUDE.md, `Measured:`). Every run prints its checksum, and every
// binary must print the same one for a case.
//
// With `--before <nish>`, every program but the ranges-on one is built a second
// time by that compiler, whose own `std/` it links (a compiler built from
// `main`, say), and that build and its copy run in the same rounds: what the
// change costs a program that keeps no ranges. The ranges-on program needs
// `keepRanges`, so only the compiler under test builds it.
//
// The cases, each its own set of binaries interleaved round by round:
//
//   parse      bench/json-value/main.ts (ranges off, `off`) and ranged.ts
//              (ranges on, `on`) over bench/json-compare's corpora,
//              twitter.json, citm_catalog.json and canada.json (fetched into
//              its cache on first use, so that needs the network once), `--mb`
//              megabytes of input per run, and bench/json-compare/sample.json
//   builders   bench/json-value/builders.ts: `new*`, `push` and `set`, ranges
//              off, `--builds` documents per run
//   tokenize, typed, typed-reuse
//              bench/json-compare/main.ts's workloads, as its run.mjs runs
//              them, which reach nish/json-tokenizer and nish/json-typed but
//              not nish/json-value: a check that the change moves nothing
//              around it
//
// The rounds are bench/json-compare/rounds.mjs's, per case.
//
// With `--instructions`, nothing is timed: every binary of every case runs once
// under cachegrind and the table is its retired instructions, the copy's beside
// its original's, so a count that is not deterministic shows as a nonzero
// band. The child's environment is bench/run.mjs's `--instructions` one (libc,
// SIMD and hash key pinned, argv[0] relative), and the case adds
//
//   http       bench/http1-server.ts answering `--requests` POSTs of
//              bench/http-payload.json to /json-echo-doc, one at a time over
//              one keep-alive connection, then returning from `main`
//
// `--mb` defaults to 16 and `--builds` to 500 there, as cachegrind runs a
// program about fifty times slower. It needs valgrind on PATH.
//
//   node bench/json-value/measure.mjs [--rounds 15] [--mb 64] [--builds 2000] [--compiler build/nish] [--before <nish>]
//   node bench/json-value/measure.mjs --instructions [--mb 16] [--builds 500] [--requests 2000] [--before <nish>]
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

import { compilerFrom } from "../compiler.mjs";
import { CACHE, fetchAll } from "../json-compare/fetch.mjs";
import { roundOrder, roundsFor } from "../json-compare/rounds.mjs";

const root = path.resolve(import.meta.dirname, "..", "..");
const after = compilerFrom(process.argv.slice(2));
const rest = after.rest;
const flag = (name, fallback) => {
  const at = rest.indexOf(name);
  return at >= 0 && at + 1 < rest.length ? rest[at + 1] : fallback;
};
const asked = Number(flag("--rounds", "15"));
const before = flag("--before", null);
const counting = rest.includes("--instructions");
const mb = Number(flag("--mb", counting ? "16" : "64"));
const builds = Number(flag("--builds", counting ? "500" : "2000"));
const requests = Number(flag("--requests", "2000"));

const outDir = path.join(root, "build", "bench-json-value");
fs.rmSync(outDir, { recursive: true, force: true });

// bench/run.mjs's pinned environment for a counted run, which says why each is pinned.
const PINNED_LIBC = [
  "glibc.cpu.hwcaps=-AVX_Fast_Unaligned_Load,-AVX2,-AVX512F,-AVX512VL,-ERMS,-FSRM,-SSSE3",
  "glibc.cpu.x86_non_temporal_threshold=0x0fffffffffffffff",
  "glibc.cpu.x86_rep_movsb_threshold=0x0fffffffffffffff",
  "glibc.cpu.x86_rep_stosb_threshold=0x0fffffffffffffff",
].join(":");
const FIXED_KEY = "fixed-key.so";

/** `program` built by `compiler` into `<outDir>/<name>/`, as `label` and a byte-identical copy beside it. */
const build = (compiler, program, name, label) => {
  const dir = path.join(outDir, name);
  const app = path.join(dir, "app");
  execFileSync(
    compiler.cmd,
    [
      ...compiler.prefix,
      program,
      "-o",
      `${dir}/`,
      "--link",
      app,
      "--profile",
      "speed",
    ],
    {
      cwd: root,
      stdio: ["ignore", "ignore", "inherit"],
    },
  );
  const copy = path.join(dir, "app-copy");
  fs.copyFileSync(app, copy);
  fs.chmodSync(copy, 0o755);
  return [
    { label, exe: app },
    { label: `${label}-copy`, exe: copy },
  ];
};

const head = (program, name, label) => build(after, program, name, label);
const base = (program, name, label) =>
  before === null
    ? []
    : build(compilerFrom(["--compiler", before]), program, name, label);
const parseImpls = [
  ...head("bench/json-value/main.ts", "off-after", "off"),
  ...head("bench/json-value/ranged.ts", "on-after", "on"),
  ...base("bench/json-value/main.ts", "off-before", "before"),
];
const builderImpls = [
  ...head("bench/json-value/builders.ts", "builders-after", "head"),
  ...base("bench/json-value/builders.ts", "builders-before", "before"),
];
const compareImpls = [
  ...head("bench/json-compare/main.ts", "compare-after", "head"),
  ...base("bench/json-compare/main.ts", "compare-before", "before"),
];
const serverImpls = counting
  ? [
      ...head("bench/http1-server.ts", "http-after", "head"),
      ...base("bench/http1-server.ts", "http-before", "before"),
    ]
  : [];

fetchAll([]);
const isDigit = (b) => b >= 0x30 && b <= 0x39;
// The last digit that follows another, as bench/json-compare/run.mjs picks the one tokenize rewrites.
const digitAt = (doc) => {
  for (let i = doc.length - 1; i > 0; i--) {
    if (isDigit(doc[i]) && isDigit(doc[i - 1])) {
      return i;
    }
  }
  return -1;
};
// The last digit of the first performance's `start`, as run.mjs picks the one typed rewrites.
const startAt = (doc) => {
  const text = doc.toString("latin1");
  const from = Math.max(0, text.indexOf('"performances"'));
  const match = /"start"\s*:\s*\d+/.exec(text.slice(from));
  return match === null ? -1 : from + match.index + match[0].length - 1;
};
const corpus = (f) => path.join(CACHE, "corpus", f);
// Every program prints its checksum line, then `ns <elapsed>` for every iteration together.
const runOnce = (exe, args, iterations) => {
  const [checksum, timing] = execFileSync(exe, args.map(String), {
    encoding: "utf8",
  })
    .trim()
    .split("\n");
  return { checksum, ns: Number(/^ns (\d+)$/.exec(timing)[1]) / iterations };
};
const sized = (file) => {
  const doc = fs.readFileSync(file);
  return {
    doc,
    bytes: doc.length,
    iterations: Math.max(1, Math.round((mb * 1024 * 1024) / doc.length)),
  };
};
const pairs = (labels) =>
  before === null ? labels.filter(([, b]) => b !== "before") : labels;
const cases = [
  ...[
    corpus("twitter.json"),
    corpus("citm_catalog.json"),
    corpus("canada.json"),
    path.join(root, "bench", "json-compare", "sample.json"),
  ].map((file) => {
    const { doc, bytes, iterations } = sized(file);
    const at = digitAt(doc);
    return {
      name: `parse, ${path.basename(file)}, ${bytes} bytes`,
      impls: parseImpls,
      ratios: pairs([
        ["on", "off"],
        ["off", "before"],
      ]),
      args: [file, iterations, at],
      run: (exe) => runOnce(exe, [file, iterations, at], iterations),
    };
  }),
  {
    name: `builders, ${builds} documents of 1,100 values`,
    impls: builderImpls,
    ratios: pairs([["head", "before"]]),
    args: [builds],
    run: (exe) => runOnce(exe, [builds], builds),
  },
  ...[
    ["tokenize", "twitter.json", digitAt],
    ["tokenize", "citm_catalog.json", digitAt],
    ["tokenize", "canada.json", digitAt],
    ["typed", "citm_catalog.json", startAt],
    ["typed-reuse", "citm_catalog.json", startAt],
  ].map(([workload, f, pick]) => {
    const file = corpus(f);
    const { doc, bytes, iterations } = sized(file);
    const at = pick(doc);
    return {
      name: `${workload}, ${f}, ${bytes} bytes`,
      impls: compareImpls,
      ratios: pairs([["head", "before"]]),
      args: [workload, file, iterations, at],
      run: (exe) => runOnce(exe, [workload, file, iterations, at], iterations),
    };
  }),
];

if (counting) {
  cases.push({
    name: `http, ${requests} POSTs of bench/http-payload.json to /json-echo-doc`,
    impls: serverImpls,
    ratios: pairs([["head", "before"]]),
    serve: true,
  });
  await countAll();
  process.exit(process.exitCode ?? 0);
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 === 1
    ? s[(s.length - 1) / 2]
    : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const min = (xs) => Math.min(...xs);
const pct = (a, b) => `${((Math.abs(a - b) / b) * 100).toFixed(1)}%`;
const out = [];
cases.forEach((c, k) => {
  const rounds = roundsFor(c.impls.length, asked);
  const t = new Map(c.impls.map((i) => [i.label, []]));
  const sums = new Set();
  for (let r = 0; r < rounds; r++) {
    process.stderr.write(`${c.name}: round ${r + 1} of ${rounds}\n`);
    for (const impl of roundOrder(c.impls, r)) {
      const got = c.run(impl.exe);
      sums.add(got.checksum);
      t.get(impl.label).push(got.ns);
    }
  }
  if (k > 0) {
    out.push("");
  }
  out.push(
    `${c.name}: ${rounds} interleaved rounds of ${c.impls.length} binaries, checksum ${[...sums].join(", ")}`,
  );
  if (sums.size !== 1) {
    process.exitCode = 1;
    out.push("  checksums disagree");
  }
  for (const [label, xs] of t) {
    out.push(
      `  ${label.padEnd(13)} min ${min(xs).toFixed(0)} ns/run, median ${median(xs).toFixed(0)} ns/run`,
    );
  }
  for (const label of c.impls
    .map((i) => i.label)
    .filter((l) => !l.endsWith("-copy"))) {
    out.push(
      `  noise band, ${label} against its byte-identical copy: min ${pct(min(t.get(label)), min(t.get(`${label}-copy`)))}, median ${pct(median(t.get(label)), median(t.get(`${label}-copy`)))}`,
    );
  }
  const ratio = (a, b, f) => (f(t.get(a)) / f(t.get(b))).toFixed(3);
  for (const [a, b] of c.ratios) {
    out.push(
      `  ${a} / ${b}: min ${ratio(a, b, min)}x, median ${ratio(a, b, median)}x`,
    );
  }
});
process.stdout.write(`${out.join("\n")}\n`);

/** `exe` and `args` under cachegrind, from `exe`'s own directory: the child, and the file its summary lands in. */
function underCachegrind(exe, args, stdio) {
  const dir = path.dirname(exe);
  fs.copyFileSync(path.join(outDir, FIXED_KEY), path.join(dir, FIXED_KEY));
  const file = `${exe}.cachegrind`;
  const argv = [
    "--tool=cachegrind",
    "--cache-sim=no",
    `--cachegrind-out-file=${file}`,
    `./${path.basename(exe)}`,
    ...args.map(String),
  ];
  const options = {
    cwd: dir,
    env: {
      GLIBC_TUNABLES: PINNED_LIBC,
      NISH_SIMD: "base",
      LD_PRELOAD: `./${FIXED_KEY}`,
    },
    encoding: "utf8",
  };
  return { argv, options, file };
}

/** The `summary:` count cachegrind wrote to `file`. */
function summary(file) {
  const m = fs.readFileSync(file, "utf8").match(/^summary: (\d+)$/m);
  if (!m) {
    throw new Error(`no summary line in ${file}`);
  }
  return Number(m[1]);
}

/** A program case's binary, counted once: its count and its checksum line. */
function countRun(c, impl) {
  const { argv, options, file } = underCachegrind(impl.exe, c.args, null);
  const r = spawnSync("valgrind", argv, {
    ...options,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (r.status !== 0) {
    throw new Error(
      `${impl.exe} ${c.args.join(" ")}: exit ${r.status}\n${r.stderr}`,
    );
  }
  return { count: summary(file), checksum: r.stdout.trim().split("\n")[0] };
}

/**
 * A server binary, counted once: started under cachegrind with `requests` as
 * its limit, sent that many POSTs one at a time over one connection, each
 * after the last answer has fully arrived, and waited for until it returns.
 * The checksum is every answer's status line and body length, which must be
 * the same for every binary.
 */
async function countServer(impl, port) {
  const payload = fs.readFileSync(
    path.join(root, "bench", "http-payload.json"),
  );
  const request = Buffer.concat([
    Buffer.from(
      `POST /json-echo-doc HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: ${payload.length}\r\n\r\n`,
    ),
    payload,
  ]);
  const { argv, options, file } = underCachegrind(impl.exe, [
    port,
    16,
    requests,
  ]);
  const child = spawn("valgrind", argv, {
    ...options,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (d) => (stderr += d));
  const exited = new Promise((resolve) =>
    child.on("exit", (code) => resolve(code)),
  );
  await new Promise((resolve, reject) => {
    let out = "";
    child.stdout.on("data", (d) => {
      out += d;
      if (out.includes("listening")) {
        resolve();
      }
    });
    exited.then((code) =>
      reject(
        new Error(`${impl.exe} exited ${code} before listening\n${stderr}`),
      ),
    );
  });
  const answers = new Set();
  await new Promise((resolve, reject) => {
    const socket = net.connect(port, "127.0.0.1");
    let pending = Buffer.alloc(0);
    let sent = 0;
    const send = () => {
      sent++;
      socket.write(request);
    };
    socket.on("connect", send);
    socket.on("error", reject);
    socket.on("data", (d) => {
      pending = Buffer.concat([pending, d]);
      const end = pending.indexOf("\r\n\r\n");
      if (end < 0) {
        return;
      }
      const headers = pending.subarray(0, end).toString("latin1");
      const length = Number(/content-length: *(\d+)/i.exec(headers)?.[1] ?? 0);
      if (pending.length < end + 4 + length) {
        return;
      }
      answers.add(`${headers.split("\r\n")[0]}, ${length} bytes`);
      pending = pending.subarray(end + 4 + length);
      if (sent < requests) {
        send();
      } else {
        socket.end();
        resolve();
      }
    });
  });
  const code = await exited;
  if (code !== 0) {
    throw new Error(`${impl.exe}: exit ${code}\n${stderr}`);
  }
  return { count: summary(file), checksum: [...answers].join("; ") };
}

/** A free port on 127.0.0.1, as the kernel picks one. */
function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

/** `--instructions`: every binary of every case counted once, as one table. */
async function countAll() {
  execFileSync("cc", [
    "-O2",
    "-shared",
    "-fPIC",
    path.join(root, "bench", "fixed-key.c"),
    "-o",
    path.join(outDir, FIXED_KEY),
  ]);
  const out = [];
  for (const [k, c] of cases.entries()) {
    const counts = new Map();
    const sums = new Set();
    for (const impl of c.impls) {
      process.stderr.write(`${c.name}: ${impl.label}\n`);
      const got = c.serve
        ? await countServer(impl, await freePort())
        : countRun(c, impl);
      sums.add(got.checksum);
      counts.set(impl.label, got.count);
    }
    if (k > 0) {
      out.push("");
    }
    out.push(
      `${c.name}: retired instructions, checksum ${[...sums].join(", ")}`,
    );
    if (sums.size !== 1) {
      process.exitCode = 1;
      out.push("  checksums disagree");
    }
    for (const [label, n] of counts) {
      out.push(`  ${label.padEnd(13)} ${n}`);
    }
    for (const label of c.impls
      .map((i) => i.label)
      .filter((l) => !l.endsWith("-copy"))) {
      const band =
        Math.abs(counts.get(label) - counts.get(`${label}-copy`)) /
        counts.get(`${label}-copy`);
      out.push(
        `  band, ${label} against its byte-identical copy: ${(band * 100).toFixed(3)}%`,
      );
    }
    for (const [a, b] of c.ratios) {
      const d = (counts.get(a) - counts.get(b)) / counts.get(b);
      out.push(
        `  ${a} / ${b}: ${(counts.get(a) / counts.get(b)).toFixed(5)}x (${d >= 0 ? "+" : ""}${(d * 100).toFixed(3)}%)`,
      );
    }
  }
  process.stdout.write(`${out.join("\n")}\n`);
}
