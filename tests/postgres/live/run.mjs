#!/usr/bin/env node
// The live suite of nish/net/postgres's PgPool and carrier, against a real
// PostgreSQL server: the scenarios of `live.ts`, each compared with
// `expected/<scenario>.out`, `../carrier.ts` serving HTTP while a query
// sleeps, and the carrier reporting a server it cannot reach (`refused`) and
// one that resets the connection (`reset`).
//
//   node tests/postgres/live/run.mjs [--update] [scenario ...]
//
// With `$PG_TEST_URL` (postgres://user:password@127.0.0.1:port/database, a
// role that may create a schema; the programs connect to 127.0.0.1 only, so
// another host is refused) it runs against that server; otherwise it
// starts a throwaway PostgreSQL 18 cluster under `$PG_BIN`
// (/usr/lib/postgresql/18/bin). It is not part of `tests/run.js`: CI's
// `postgres-live` job runs it against a `postgres:18` service.
//
// The `unix` scenario connects through the server's Unix socket, named by a
// `postgres://` URL with a percent-encoded directory as its host, and logs in
// with a wrong password: the throwaway cluster maps this OS user to the role
// by `peer`, and a server under `$PG_TEST_URL` must `trust` local
// connections, with `$PG_TEST_SOCKET_DIR` naming its socket directory. With
// `$PG_TEST_URL` and no `$PG_TEST_SOCKET_DIR`, `unix` is skipped.
import { spawn, spawnSync } from "node:child_process";
import {
  chownSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { request } from "node:http";
import { createServer } from "node:net";
import { tmpdir, userInfo } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const NISH = join(ROOT, "build", "nish");
const BIN = process.env.PG_BIN ?? "/usr/lib/postgresql/18/bin";
const SCENARIOS = ["auth", "groups", "terminate", "pipeline", "arrays", "binary", "conduit", "batch", "unix"];
const CHECKS = [...SCENARIOS, "carrier", "refused", "reset"];
const UPDATE = process.argv.includes("--update");
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith("--"));
for (const name of ONLY) {
  if (!CHECKS.includes(name)) {
    console.error(`unknown check ${name}; the checks are ${CHECKS.join(", ")}`);
    process.exit(2);
  }
}
const wanted = (name) => ONLY.length === 0 || ONLY.includes(name);

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

/** The uid and gid of the `postgres` user, which owns a cluster started as root. */
const postgresIds = () => ({
  uid: Number(run("id", ["-u", "postgres"]).trim()),
  gid: Number(run("id", ["-g", "postgres"]).trim()),
});

/** A cluster of our own: a scram-sha-256 role owning a fresh database. */
const startCluster = async () => {
  if (!existsSync(join(BIN, "initdb"))) {
    throw new Error(
      `no initdb in ${BIN}: install PostgreSQL 18, set $PG_BIN to its bin directory, or set $PG_TEST_URL`,
    );
  }
  const owner = process.getuid() === 0 ? postgresIds() : null;
  const dir = mkdtempSync(join(tmpdir(), "nish-pg-live-"));
  const data = join(dir, "data");
  if (owner) chownSync(dir, owner.uid, owner.gid);
  const port = await freePort();
  run(
    join(BIN, "initdb"),
    ["-D", data, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--no-locale"],
    true,
  );
  const hba = join(data, "pg_hba.conf");
  writeFileSync(
    hba,
    "local all postgres trust\nlocal all nish_live peer map=live\nhost all all 127.0.0.1/32 scram-sha-256\n",
  );
  if (owner) chownSync(hba, owner.uid, owner.gid);
  // Peer: whoever runs the live programs logs in as nish_live, no password.
  const ident = join(data, "pg_ident.conf");
  writeFileSync(ident, `live ${userInfo().username} nish_live\n`);
  if (owner) chownSync(ident, owner.uid, owner.gid);
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
    socket: dir,
    stop,
  };
};

const fromUrl = (text) => {
  const url = new URL(text);
  // URL keeps an IPv6 host's brackets and lowercases only special schemes'.
  const host = url.hostname.toLowerCase();
  if (!["127.0.0.1", "localhost", "[::1]", ""].includes(host)) {
    throw new Error(
      `$PG_TEST_URL names ${url.hostname}; the live programs connect to 127.0.0.1 only`,
    );
  }
  return {
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    socket: process.env.PG_TEST_SOCKET_DIR || null,
    stop: () => {},
  };
};

/**
 * The statements of a SQL file: `--` and block comments dropped, split on
 * each `;` outside a quoted string or identifier. It reads only what
 * schema.sql and fixture.sql hold: no dollar quotes, no `E''` escapes, no
 * nested block comments, and a block comment between two tokens joins them
 * into one (`a`, an empty comment, `b` reads as `ab`).
 */
const statements = (file) => {
  const text = readFileSync(join(HERE, file), "utf8");
  const out = [];
  let current = "";
  let k = 0;
  while (k < text.length) {
    const c = text[k];
    if (c === "'" || c === '"') {
      const end = text.indexOf(c, k + 1);
      if (end < 0) throw new Error(`${file}: an unterminated ${c}`);
      // A doubled quote inside the string is read as two adjacent strings.
      current += text.slice(k, end + 1);
      k = end + 1;
    } else if (text.startsWith("--", k)) {
      const end = text.indexOf("\n", k);
      k = end < 0 ? text.length : end;
    } else if (text.startsWith("/*", k)) {
      const end = text.indexOf("*/", k + 2);
      if (end < 0) throw new Error(`${file}: an unterminated block comment`);
      k = end + 2;
    } else if (c === ";") {
      out.push(current.trim());
      current = "";
      k += 1;
    } else {
      current += c;
      k += 1;
    }
  }
  out.push(current.trim());
  return out.filter((s) => s.length > 0);
};

const compile = (source, out) => {
  const r = spawnSync(NISH, [source, "--link", out], { encoding: "utf8" });
  if (r.status !== 0)
    throw new Error(`nish ${source} failed:\n${r.stdout}${r.stderr}`);
};

/** `live <scenario>` against the server; its stdout and exit status. */
const live = (exe, db, scenario, sql = []) => {
  // `unix` names the socket's directory as a URL's percent-encoded host.
  const where =
    scenario === "unix"
      ? `postgres://${db.user}@${encodeURIComponent(db.socket)}:${db.port}/${db.database}`
      : String(db.port);
  const args = [
    scenario,
    where,
    db.user,
    db.password,
    db.database,
    ...sql,
  ];
  const r = spawnSync(exe, args, { encoding: "utf8", timeout: 120_000 });
  return { out: r.stdout ?? "", status: r.status, err: r.stderr ?? "" };
};

/** Resolves once `out()` holds `line`, or with false after `ms` or once `child` exits without it. */
const waitFor = (child, out, line, ms) =>
  new Promise((resolve) => {
    const start = Date.now();
    let gone = child.exitCode !== null || child.signalCode !== null;
    child.once("exit", () => {
      gone = true;
    });
    const poll = () => {
      if (out().split("\n").includes(line)) resolve(true);
      else if (gone || Date.now() - start > ms) resolve(false);
      else setTimeout(poll, 10);
    };
    poll();
  });

/** The carrier sleeps a query for two seconds; `/`, asked once it says the query is sent, must be served while it sleeps. */
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
  if (!(await waitFor(child, () => out, "query sent", 30_000))) {
    child.kill();
    await exited;
    return { ok: false, detail: `no "query sent" line: stdout ${JSON.stringify(out)}` };
  }
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
  const want =
    "listening\nquery sent\nhttp served while the query is in flight\nslept 2\n";
  return {
    ok: status === 0 && body === "query in flight\n" && out === want,
    detail: `status ${status}, body ${JSON.stringify(body)}, stdout ${JSON.stringify(out)}`,
  };
};

/** With nothing listening on its PostgreSQL port, the carrier must fail the query at once with the connect's error, not wait. */
const refused = async (exe) => {
  const port = await freePort();
  const http = await freePort();
  const r = spawnSync(exe, [String(port), "u", "p", "d", String(http), "2"], {
    encoding: "utf8",
    timeout: 30_000,
  });
  // -111 is ECONNREFUSED, whether the connect fails at once or at its result;
  // -110 would be the connect timeout, the wait this check rules out.
  const want = "listening\nnap failed: failure 9, socket -111\n";
  return {
    ok: r.status === 1 && r.stdout === want,
    detail: `status ${r.status}, stdout ${JSON.stringify(r.stdout)}`,
  };
};

/**
 * A server that resets the connection once the startup message arrives: the
 * carrier's read fails with ECONNRESET, not 0, and must end the connection
 * there, failing the query with that error, rather than leave the readable
 * socket to the next turn.
 */
const reset = async (exe) => {
  const server = createServer((socket) => {
    socket.once("data", () => socket.resetAndDestroy());
    socket.on("error", () => {});
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const http = await freePort();
  const child = spawn(exe, [String(port), "u", "p", "d", String(http), "2"]);
  let out = "";
  child.stdout.on("data", (d) => {
    out += d;
  });
  const timer = setTimeout(() => child.kill(), 30_000);
  const status = await new Promise((resolve) => child.on("exit", resolve));
  clearTimeout(timer);
  await new Promise((resolve) => server.close(resolve));
  // -104 is ECONNRESET; Linux reports it to one read, and the next reads 0.
  // The socket error pins the close to the failed read rather than to that
  // later 0, which ends the connection with no error.
  const want = "listening\nnap failed: failure 9, socket -104\n";
  return {
    ok: status === 1 && out === want,
    detail: `status ${status}, stdout ${JSON.stringify(out)}`,
  };
};

const main = async () => {
  const db = process.env.PG_TEST_URL
    ? fromUrl(process.env.PG_TEST_URL)
    : await startCluster();
  const work = mkdtempSync(join(tmpdir(), "nish-live-"));
  let failed = 0;
  let passed = 0;
  let skipped = CHECKS.filter((name) => !wanted(name)).length;
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
      "create table live_rows (k int primary key)",
      ...statements("fixture.sql"),
    ];
    const made = live(exe, db, "exec", setup);
    if (made.status !== 0)
      throw new Error(`setup failed:\n${made.out}${made.err}`);

    mkdirSync(join(HERE, "expected"), { recursive: true });
    for (const scenario of SCENARIOS) {
      if (!wanted(scenario)) continue;
      if (scenario === "unix" && !db.socket) {
        skipped += 1;
        console.log("skip unix: $PG_TEST_URL without $PG_TEST_SOCKET_DIR");
        continue;
      }
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
    const checks = [
      ["carrier", () => carrier(join(work, "carrier"), db)],
      ["refused", () => refused(join(work, "carrier"))],
      ["reset", () => reset(join(work, "carrier"))],
    ];
    for (const [name, check] of checks) {
      if (!wanted(name)) continue;
      const c = await check();
      if (c.ok) {
        passed += 1;
        console.log(`ok   ${name}`);
      } else {
        failed += 1;
        console.log(`FAIL ${name}: ${c.detail}`);
      }
    }
    live(exe, db, "exec", ["drop schema nish_live cascade"]);
  } finally {
    rmSync(work, { recursive: true, force: true });
    db.stop();
  }
  console.log(`${passed} passed, ${failed} failed, ${skipped} skipped`);
  process.exitCode = failed === 0 ? 0 : 1;
};

await main();
