// Records the PostgreSQL exchanges `tests/link/std_postgres_replay` replays
// through nish/net/postgres, into `tests/postgres/recordings/`.
//
//   node tests/postgres/record.mjs [/usr/lib/postgresql/18/bin]
//
// The script starts a throwaway cluster from the given binaries, listening on
// 127.0.0.1 only, with `scram-sha-256` for every role but `trusty` (trust)
// and `plain` (cleartext `password`), and plays each scenario below as a
// client. Its frames are built exactly as PgConnection builds them: the
// replay test makes the same calls and compares its output with every `>`
// line byte for byte, so a change to the client's framing shows here first.
// The SCRAM client nonce is the fixed 18 bytes `NONCE`, which the replay
// gives PgConnection; the server's nonce, the salt and the backend's key are
// whatever the server chose, and are recorded with the rest.
//
// A recording is lines of text: `# ` a comment, `> ` the hex of what the
// client wrote in one go, `< ` the hex of what the server answered before the
// client's next write (or before it closed the connection). The cluster is
// stopped and deleted at the end, also on failure.

import { spawnSync } from "node:child_process"
import { createHash, createHmac, pbkdf2Sync } from "node:crypto"
import { chownSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { createConnection, createServer } from "node:net"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const BIN = process.argv[2] ?? "/usr/lib/postgresql/18/bin"
const OUT = join(dirname(fileURLToPath(import.meta.url)), "recordings")
const NONCE = Buffer.from("nish-postgres-test", "latin1")
const PASSWORD = "correct horse battery staple"
const POSTGRES_UID = 102
const POSTGRES_GID = 104

// --- The client's frames, as PgConnection writes them ---------------------------

class Frames {
  constructor() {
    this.parts = []
  }

  take() {
    const out = Buffer.concat(this.parts)
    this.parts = []
    return out
  }

  message(type, body) {
    const head = Buffer.alloc(5)
    head[0] = type.charCodeAt(0)
    head.writeInt32BE(body.length + 4, 1)
    this.parts.push(head, body)
  }

  startup(user, database) {
    const pairs = [["user", user]]
    if (database.length > 0) pairs.push(["database", database])
    pairs.push(["client_encoding", "UTF8"], ["DateStyle", "ISO"], ["TimeZone", "UTC"])
    const body = Buffer.concat([
      int32(196608),
      ...pairs.map(([k, v]) => Buffer.concat([cstring(k), cstring(v)])),
      Buffer.from([0]),
    ])
    this.parts.push(int32(body.length + 4), body)
  }

  prepare(name, sql, types) {
    this.message(
      "P",
      Buffer.concat([cstring(name), cstring(sql), int16(types.length), ...types.map(int32)])
    )
    this.message("D", Buffer.concat([Buffer.from("S"), cstring(name)]))
  }

  closeStatement(name) {
    this.message("C", Buffer.concat([Buffer.from("S"), cstring(name)]))
  }

  // `params` holds strings (text), bigints (paramInt), arrays (paramTextArray) and null.
  bind(name, params) {
    const values = params.map((p) => {
      if (p === null) return int32(-1)
      let bytes
      if (typeof p === "bigint") bytes = Buffer.from(p.toString(), "latin1")
      else if (Array.isArray(p))
        bytes = Buffer.from(`{${p.map((s) => `"${s.replace(/["\\]/g, "\\$&")}"`).join(",")}}`, "utf8")
      else bytes = Buffer.from(p, "utf8")
      return Buffer.concat([int32(bytes.length), bytes])
    })
    this.message(
      "B",
      Buffer.concat([Buffer.from([0]), cstring(name), int16(0), int16(params.length), ...values, int16(0)])
    )
    this.message("E", Buffer.concat([Buffer.from([0]), int32(0)]))
  }

  sync() {
    this.message("S", Buffer.alloc(0))
  }

  terminate() {
    this.message("X", Buffer.alloc(0))
  }
}

const int32 = (v) => {
  const b = Buffer.alloc(4)
  b.writeInt32BE(v)
  return b
}
const int16 = (v) => {
  const b = Buffer.alloc(2)
  b.writeUInt16BE(v)
  return b
}
const cstring = (s) => Buffer.concat([Buffer.from(s, "utf8"), Buffer.from([0])])

// --- SCRAM-SHA-256 (RFC 5802, RFC 7677), for the client side of a recording -----

const hmac = (key, data) => createHmac("sha256", key).update(data).digest()

const scramFinal = (password, clientFirstBare, serverFirst) => {
  const fields = Object.fromEntries(serverFirst.split(",").map((f) => [f[0], f.slice(2)]))
  const salted = pbkdf2Sync(password, Buffer.from(fields.s, "base64"), Number(fields.i), 32, "sha256")
  const clientKey = hmac(salted, "Client Key")
  const storedKey = createHash("sha256").update(clientKey).digest()
  const withoutProof = `c=biws,r=${fields.r}`
  const authMessage = `${clientFirstBare},${serverFirst},${withoutProof}`
  const signature = hmac(storedKey, authMessage)
  const proof = Buffer.from(clientKey.map((b, i) => b ^ signature[i]))
  return `${withoutProof},p=${proof.toString("base64")}`
}

// --- A connection that records ---------------------------------------------------

// The server's messages since `from`, as [type, body] pairs, whole ones only.
const messages = (buf) => {
  const out = []
  let p = 0
  while (buf.length - p >= 5) {
    const length = buf.readInt32BE(p + 1)
    if (buf.length - p - 1 < length) break
    out.push([String.fromCharCode(buf[p]), buf.subarray(p + 5, p + 1 + length)])
    p += 1 + length
  }
  return out
}

class Recorder {
  constructor(port) {
    this.port = port
    this.lines = []
    this.pending = Buffer.alloc(0)
    this.ended = false
    this.waiter = null
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = createConnection({ host: "127.0.0.1", port: this.port }, resolve)
      this.socket.on("error", reject)
      this.socket.on("data", (d) => {
        this.pending = Buffer.concat([this.pending, d])
        this.wake()
      })
      this.socket.on("close", () => {
        this.ended = true
        this.wake()
      })
    })
  }

  wake() {
    if (this.waiter !== null && (this.ended || this.waiter.done(messages(this.pending)))) {
      const w = this.waiter
      this.waiter = null
      w.resolve()
    }
  }

  // Writes `bytes`, then waits until `done(messages)` holds or the server closes.
  async exchange(bytes, done) {
    this.lines.push(`> ${bytes.toString("hex")}`)
    this.socket.write(bytes)
    if (done === null) return []
    await new Promise((resolve) => {
      this.waiter = { done, resolve }
      this.wake()
    })
    const answer = this.pending
    this.pending = Buffer.alloc(0)
    if (answer.length > 0) this.lines.push(`< ${answer.toString("hex")}`)
    return messages(answer)
  }

  async close() {
    this.socket.end()
    if (!this.ended) await new Promise((resolve) => this.socket.on("close", resolve))
    if (this.pending.length > 0) this.lines.push(`< ${this.pending.toString("hex")}`)
  }
}

// Done after `n` ReadyForQuery messages.
const ready = (n) => (ms) => ms.filter(([t]) => t === "Z").length >= n
// Done at an authentication request that wants an answer, or at ReadyForQuery.
const authStep = (ms) => ms.some(([t, b]) => (t === "R" && b.readInt32BE(0) !== 0) || t === "Z")
// Done only when the server closes the connection.
const closed = () => false

// --- The scenarios ---------------------------------------------------------------

const scenarios = {
  // Trust authentication, then pipelined groups over every result shape the
  // client reads: integers, booleans, text, a timestamp, a text[] with escapes
  // and NULLs, a NULL column, row counts, an error mid-pipeline, a notice, an
  // empty statement, a row larger than the input buffer, and a Close.
  async "trust-query"(r) {
    const f = new Frames()
    f.startup("trusty", "nish")
    await r.exchange(f.take(), ready(1))

    f.prepare(
      "s1",
      "select $1::int4 + 1, true, 'h\u00e9llo'::text, '2024-01-02 03:04:05.123456+00'::timestamptz, " +
        "array['a\"b', 'c\\d', null, 'x y', 'NULL']::text[], null::text",
      [23]
    )
    f.bind("s1", [41n])
    f.sync()
    f.prepare("s2", "create temp table t (id int4, tags text[])", [])
    f.bind("s2", [])
    f.sync()
    f.prepare("s3", "insert into t values ($1, $2), ($3, $4)", [])
    f.bind("s3", [-1n, ["q\"uote", "back\\slash", ""], "2", null])
    f.sync()
    await r.exchange(f.take(), ready(3))

    f.prepare("s4", "select 1 / $1::int4", [])
    f.bind("s4", [0n])
    f.sync()
    f.prepare("s5", "select id, tags from t order by id", [])
    f.bind("s5", [])
    f.sync()
    await r.exchange(f.take(), ready(2))

    f.prepare("s6", "create temp table if not exists t (id int4)", [])
    f.bind("s6", [])
    f.sync()
    f.prepare("", "", [])
    f.bind("", [])
    f.sync()
    f.prepare("s7", "select repeat('x', $1::int4)", [])
    f.bind("s7", [20000n])
    f.sync()
    await r.exchange(f.take(), ready(3))

    f.closeStatement("s1")
    f.sync()
    await r.exchange(f.take(), ready(1))

    f.terminate()
    await r.exchange(f.take(), null)
  },

  // SCRAM-SHA-256 with the right password, then a query and Terminate.
  async "scram-ok"(r) {
    await scram(r, "scrammy", PASSWORD)
    const f = new Frames()
    f.prepare("", "select current_user", [])
    f.bind("", [])
    f.sync()
    await r.exchange(f.take(), ready(1))
    f.terminate()
    await r.exchange(f.take(), null)
  },

  // SCRAM-SHA-256 with a wrong password: the server answers the proof with FATAL 28P01.
  async "scram-wrong-password"(r) {
    await scram(r, "scrammy", "wrong password")
  },

  // A database that does not exist: FATAL 3D000 after authentication.
  async "no-database"(r) {
    const f = new Frames()
    f.startup("trusty", "missing")
    await r.exchange(f.take(), closed)
  },

  // Cleartext password authentication, which the client refuses: the request is all there is.
  async cleartext(r) {
    const f = new Frames()
    f.startup("plain", "nish")
    await r.exchange(f.take(), authStep)
  },
}

const scram = async (r, user, password) => {
  const f = new Frames()
  f.startup(user, "nish")
  await r.exchange(f.take(), authStep)
  const bare = `n=,r=${NONCE.toString("base64")}`
  const first = `n,,${bare}`
  f.message(
    "p",
    Buffer.concat([cstring("SCRAM-SHA-256"), int32(first.length), Buffer.from(first, "latin1")])
  )
  const answer = await r.exchange(f.take(), authStep)
  const [, body] = answer.find(([t]) => t === "R")
  const serverFirst = body.subarray(4).toString("latin1")
  f.message("p", Buffer.from(scramFinal(password, bare, serverFirst), "latin1"))
  await r.exchange(f.take(), (ms) => ms.some(([t]) => t === "Z"))
}

// --- The cluster -----------------------------------------------------------------

const run = (cmd, args, asPostgres) => {
  const argv = asPostgres && process.getuid() === 0 ? ["runuser", ["-u", "postgres", "--", cmd, ...args]] : [cmd, args]
  const r = spawnSync(argv[0], argv[1], { encoding: "utf8" })
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed:\n${r.stdout}${r.stderr}`)
  }
  return r.stdout
}

const freePort = () =>
  new Promise((resolve) => {
    const s = createServer()
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
  })

const main = async () => {
  const dir = mkdtempSync(join(tmpdir(), "nish-pg-"))
  const data = join(dir, "data")
  if (process.getuid() === 0) chownSync(dir, POSTGRES_UID, POSTGRES_GID)
  const port = await freePort()
  let started = false
  try {
    run(join(BIN, "initdb"), ["-D", data, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--no-locale"], true)
    writeFileSync(
      join(data, "pg_hba.conf"),
      [
        "local all postgres trust",
        "host all trusty 127.0.0.1/32 trust",
        "host all plain 127.0.0.1/32 password",
        "host all all 127.0.0.1/32 scram-sha-256",
        "",
      ].join("\n")
    )
    if (process.getuid() === 0) chownSync(join(data, "pg_hba.conf"), POSTGRES_UID, POSTGRES_GID)
    const opts = `-c listen_addresses=127.0.0.1 -c port=${port} -c unix_socket_directories=${dir} -c fsync=off`
    run(join(BIN, "pg_ctl"), ["-D", data, "-o", opts, "-l", join(dir, "log"), "-w", "start"], true)
    started = true
    const sql = [
      "create role trusty login",
      `create role scrammy login password '${PASSWORD}'`,
      "create role plain login password 'plain'",
      "create database nish owner trusty",
    ]
    for (const s of sql) run(join(BIN, "psql"), ["-h", dir, "-p", String(port), "-U", "postgres", "-qAt", "-c", s], true)
    const version = run(join(BIN, "postgres"), ["--version"], false).trim()

    for (const [name, play] of Object.entries(scenarios)) {
      const r = new Recorder(port)
      await r.connect()
      await play(r)
      await r.close()
      const header = [
        `# ${name}: recorded by tests/postgres/record.mjs from ${version}`,
        `# client nonce: ${NONCE.toString("hex")}`,
      ]
      writeFileSync(join(OUT, `${name}.txt`), `${[...header, ...r.lines].join("\n")}\n`)
      console.log(`${name}: ${r.lines.length} lines`)
    }
  } finally {
    if (started) run(join(BIN, "pg_ctl"), ["-D", data, "-m", "immediate", "stop"], true)
    rmSync(dir, { recursive: true, force: true })
  }
}

await main()
