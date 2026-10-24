#!/usr/bin/env node
// The live suite of nish/net/postgres's PgPool and carrier, against a real
// PostgreSQL server: the scenarios of `live.ts`, each compared with
// `expected/<scenario>.out`, `../carrier.ts` serving HTTP while a query
// sleeps, and the carrier reporting a server it cannot reach.
//
//   node tests/postgres/live/run.mjs [--update] [scenario ...]
//
// With `$PG_TEST_URL` (postgres://user:password@127.0.0.1:port/database, a
// role that may create a schema) it runs against that server; otherwise it
// starts a throwaway PostgreSQL 18 cluster under `$PG_BIN`
// (/usr/lib/postgresql/18/bin). It is not part of `tests/run.js`: CI's
// `postgres-live` job runs it against a `postgres:18` service.
import { spawn, spawnSync } from "node:child_process";
import {
  chownSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { request } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const NISH = join(ROOT, "build", "nish");
const BIN = process.env.PG_BIN ?? "/usr/lib/postgresql/18/bin";
/** The `postgres` user of the Debian packages, which owns a cluster started as root. */
const POSTGRES_UID = 102;
const POSTGRES_GID = 104;
const SCENARIOS = ["auth", "groups", "terminate", "pipeline", "conduit"];
const UPDATE = process.argv.includes("--update");
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const run = (cmd, args, asPostgres) => {
  const argv =
    asPostgres && process.getuid() === 0
      ? ["runuser", ["-u", "postgres", "--", cmd, ...args]]
      : [cmd, args];
  const r = spawnSync(argv[0], argv[1], { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed:\n${r.stdout}${r.stderr}`);
  }
  return r.stdout;
};

const freePort = () =>
  new Promise((resolve) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

/** A cluster of our own: a scram-sha-256 role owning a fresh database. */
const startCluster = async () => {
  const dir = mkdtempSync(join(tmpdir(), "nish-pg-live-"));
  const data = join(dir, "data");
  if (process.getuid() === 0) chownSync(dir, POSTGRES_UID, POSTGRES_GID);
  const port = await freePort();
  run(
    join(BIN, "initdb"),
    ["-D", data, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--no-locale"],
    true,
  );
  const hba = join(data, "pg_hba.conf");
  writeFileSync(
    hba,
    "local all postgres trust\nhost all all 127.0.0.1/32 scram-sha-256\n",
  );
  if (process.getuid() === 0) chownSync(hba, POSTGRES_UID, POSTGRES_GID);
  const opts = `-c listen_addresses=127.0.0.1 -c port=${port} -c unix_socket_directories=${dir} -c fsync=off`;
  run(
    join(BIN, "pg_ctl"),
    ["-D", data, "-o", opts, "-l", join(dir, "log"), "-w", "start"],
    true,
  );
  const stop = () => {
    run(join(BIN, "pg_ctl"), ["-D", data, "-m", "immediate", "stop"], true);
    rmSync(dir, { recursive: true, force: true });
  };
  try {
    for (const sql of [
      "create role nish_live login password 'nish-live'",
      "create database nish_live owner nish_live",
    ]) {
      run(
        join(BIN, "psql"),
        ["-h", dir, "-p", String(port), "-U", "postgres", "-qAt", "-c", sql],
        true,
      );
    }
  } catch (e) {
    stop();
    throw e;
  }
  return {
    port,
    user: "nish_live",
    password: "nish-live",
    database: "nish_live",
    stop,
  };
};

const fromUrl = (text) => {
  const url = new URL(text);
  return {
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    stop: () => {},
  };
};

/** The statements of a SQL file: comments dropped, split on `;`. */
const statements = (file) =>
  readFileSync(join(HERE, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

const compile = (source, out) => {
  const r = spawnSync(NISH, [source, "--link", out], { encoding: "utf8" });
  if (r.status !== 0)
    throw new Error(`nish ${source} failed:\n${r.stdout}${r.stderr}`);
};

/** `live <scenario>` against the server; its stdout and exit status. */
const live = (exe, db, scenario, sql = []) => {
  const args = [
    scenario,
    String(db.port),
    db.user,
    db.password,
    db.database,
    ...sql,
  ];
  const r = spawnSync(exe, args, { encoding: "utf8", timeout: 120_000 });
  return { out: r.stdout ?? "", status: r.status, err: r.stderr ?? "" };
};

/** The carrier sleeps a query for two seconds; `/` asked half a second in must be served while it sleeps. */
const carrier = async (exe, db) => {
  const http = await freePort();
  const child = spawn(exe, [
    String(db.port),
    db.user,
    db.password,
    db.database,
    String(http),
    "2",
  ]);
  let out = "";
  child.stdout.on("data", (d) => {
    out += d;
  });
  const exited = new Promise((resolve) => child.on("exit", resolve));
  await new Promise((resolve) => setTimeout(resolve, 500));
  const body = await new Promise((resolve) => {
    const req = request({ host: "127.0.0.1", port: http, path: "/" }, (res) => {
      let text = "";
      res.on("data", (d) => {
        text += d;
      });
      res.on("end", () => resolve(text));
    });
    req.on("error", (e) => resolve(`error: ${e.message}`));
    req.end();
  });
  const timer = setTimeout(() => child.kill(), 30_000);
  const status = await exited;
  clearTimeout(timer);
  const want = "http served while the query is in flight\nslept 2\n";
  return {
    ok: status === 0 && body === "query in flight\n" && out === want,
    detail: `status ${status}, body ${JSON.stringify(body)}, stdout ${JSON.stringify(out)}`,
  };
};

/** With nothing listening on its PostgreSQL port, the carrier must report the query lost and the slot failed, not wait. */
const refused = async (exe) => {
  const port = await freePort();
  const http = await freePort();
  const r = spawnSync(exe, [String(port), "u", "p", "d", String(http), "2"], {
    encoding: "utf8",
    timeout: 30_000,
  });
  const want = "request 0 lost\nslot 0 failed: 9\n";
  return {
    ok: r.status === 1 && r.stdout === want,
    detail: `status ${r.status}, stdout ${JSON.stringify(r.stdout)}`,
  };
};

const main = async () => {
  const db = process.env.PG_TEST_URL
    ? fromUrl(process.env.PG_TEST_URL)
    : await startCluster();
  const work = mkdtempSync(join(tmpdir(), "nish-live-"));
  let failed = 0;
  let passed = 0;
  try {
    const exe = join(work, "live");
    compile(join(HERE, "live.ts"), exe);
    compile(join(HERE, "..", "carrier.ts"), join(work, "carrier"));

    const setup = [
      "drop schema if exists nish_live cascade",
      "create schema nish_live",
      ...statements("schema.sql"),
      "create table live_uniq (k int primary key)",
      "insert into live_uniq values (1)",
      ...statements("fixture.sql"),
    ];
    const made = live(exe, db, "exec", setup);
    if (made.status !== 0)
      throw new Error(`setup failed:\n${made.out}${made.err}`);

    mkdirSync(join(HERE, "expected"), { recursive: true });
    for (const scenario of SCENARIOS) {
      if (ONLY.length > 0 && !ONLY.includes(scenario)) continue;
      const got = live(exe, db, scenario);
      const text = `${got.out}exit ${got.status}\n`;
      const file = join(HERE, "expected", `${scenario}.out`);
      if (UPDATE) writeFileSync(file, text);
      const want = readFileSync(file, "utf8");
      if (text === want) {
        passed += 1;
        console.log(`ok   ${scenario}`);
      } else {
        failed += 1;
        console.log(
          `FAIL ${scenario}\n--- expected\n${want}--- got\n${text}${got.err}`,
        );
      }
    }
    if (ONLY.length === 0 || ONLY.includes("carrier")) {
      const c = await carrier(join(work, "carrier"), db);
      if (c.ok) {
        passed += 1;
        console.log("ok   carrier");
      } else {
        failed += 1;
        console.log(`FAIL carrier: ${c.detail}`);
      }
    }
    if (ONLY.length === 0 || ONLY.includes("refused")) {
      const r = await refused(join(work, "carrier"));
      if (r.ok) {
        passed += 1;
        console.log("ok   refused");
      } else {
        failed += 1;
        console.log(`FAIL refused: ${r.detail}`);
      }
    }
    live(exe, db, "exec", ["drop schema nish_live cascade"]);
  } finally {
    rmSync(work, { recursive: true, force: true });
    db.stop();
  }
  console.log(`${passed} passed, ${failed} failed, 0 skipped`);
  process.exitCode = failed === 0 ? 0 : 1;
};

await main();
