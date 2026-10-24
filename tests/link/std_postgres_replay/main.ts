// nish/net/postgres against PostgreSQL 18 itself: the exchanges
// tests/postgres/record.mjs recorded from a live server, replayed byte for
// byte. Every write the client queues must equal the recorded one, and every
// recorded answer is fed back in pieces of 1 byte, of 7, and whole, the
// events and the values each row decodes to logged and compared with what
// the server sent. A change to the client's framing, its parser or its
// decoders shows here as a log that differs.
import {
  PgArrayWalker,
  PgConfig,
  PgConnection,
  PG_ARRAY_ELEMENT,
  PG_ARRAY_END,
  PG_ARRAY_NULL,
  PG_COMPLETE,
  PG_DESCRIBED,
  PG_ERROR,
  PG_FAILED,
  PG_GROUP_DONE,
  PG_NEED_MORE,
  PG_NOTICE,
  PG_READY,
  PG_ROW,
} from "nish/net/postgres";
import { readFileBytesSync } from "nish:fs";
import { secret, wipe } from "nish:secret";
import { Suite } from "nish/testing";

const DIR: string = "tests/postgres/recordings/";
const NONCE: string = "nish-postgres-test";
const PASSWORD: string = "correct horse battery staple";
const OID_BOOL: i32 = 16;
const OID_INT4: i32 = 23;
const OID_TEXT: i32 = 25;
const OID_TEXT_ARRAY: i32 = 1009;
const OID_TIMESTAMPTZ: i32 = 1184;

/** One line of a recording: what the client wrote, or what the server answered. */
class Record {
  readonly write: boolean;
  readonly bytes: u8[];

  constructor(write: boolean, bytes: u8[]) {
    this.write = write;
    this.bytes = bytes;
  }
}

const hexDigit = (c: i32): i32 => {
  if (c >= 48 && c <= 57) {
    return c - 48;
  }
  if (c >= 97 && c <= 102) {
    return c - 87;
  }
  return -1;
};

/** The `>` and `<` lines of `name`'s recording, `#` comments skipped. */
const load = (name: string): Record[] => {
  const records: Record[] = [];
  const file: u8[] | null = readFileBytesSync(`${DIR}${name}.txt`);
  if (file === null) {
    return records;
  }
  const n: i32 = toI32(file.length);
  let p: i32 = 0;
  while (p < n) {
    let end: i32 = p;
    while (end < n && toI32(file[end]) !== 10) {
      end++;
    }
    const kind: i32 = toI32(file[p]);
    if ((kind === 62 || kind === 60) && end - p >= 2) {
      const bytes: u8[] = [];
      for (let i: i32 = p + 2; i + 1 < end; i += 2) {
        bytes.push(toU8(hexDigit(toI32(file[i])) * 16 + hexDigit(toI32(file[i + 1]))));
      }
      records.push(new Record(kind === 62, bytes));
    }
    p = end + 1;
  }
  return records;
};

const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

const statusName = (status: i32): string => (status === 73 ? "I" : status === 84 ? "T" : status === 69 ? "E" : "?");

/** A connection played against one recording, its events written to `log`. */
class Replay {
  readonly conn: PgConnection;
  readonly log: string[];
  private readonly records: Record[];
  private at: i32 = 0;
  private readonly chunk: i32;
  private types: i32[];
  private readonly walker: PgArrayWalker;
  private readonly stamp: u8[];
  private readonly element: u8[];

  constructor(name: string, user: string, database: string, password: string, chunk: i32) {
    this.log = [];
    this.types = [];
    this.walker = new PgArrayWalker();
    this.stamp = new Array<u8>(24);
    this.element = new Array<u8>(64);
    this.records = load(name);
    this.chunk = chunk;
    const config = new PgConfig();
    config.user = user;
    config.database = database;
    const secretPassword = secret(bytesOf(password));
    this.conn = new PgConnection(config, secretPassword, bytesOf(NONCE));
    wipe(secretPassword);
    if (this.records.length === 0) {
      this.log.push(`no recording ${name}`);
    }
  }

  /** The client's queued output must be the next recorded write. */
  wrote(): void {
    const conn = this.conn;
    const start: i32 = conn.outputStart();
    const n: i32 = conn.outputEnd() - start;
    if (this.at >= toI32(this.records.length) || !this.records[this.at].write) {
      this.log.push(`write of ${n} bytes where the server spoke`);
      return;
    }
    const want: u8[] = this.records[this.at].bytes;
    this.at += 1;
    const out: u8[] = conn.outputBuffer();
    let same: boolean = n === toI32(want.length);
    for (let i: i32 = 0; same && i < n; i++) {
      same = out[start + i] === want[i];
    }
    this.log.push(same ? `wrote ${n}` : `wrote ${n} bytes, not the recorded ${want.length}`);
    conn.sent(n);
  }

  /** Feeds the next recorded answer, logging every event, then the end of the stream if it was the last. */
  answer(): void {
    if (this.at >= toI32(this.records.length) || this.records[this.at].write) {
      this.log.push("no answer recorded");
      return;
    }
    const bytes: u8[] = this.records[this.at].bytes;
    this.at += 1;
    const n: i32 = toI32(bytes.length);
    const step: i32 = this.chunk > 0 ? this.chunk : n;
    let fed: i32 = 0;
    while (fed < n) {
      const want: i32 = n - fed < step ? n - fed : step;
      fed += this.conn.receive(bytes, fed, want);
      if (this.drain()) {
        return;
      }
    }
    if (this.at === toI32(this.records.length)) {
      this.event(this.conn.closed());
    }
  }

  /** Reads every whole message; true once the connection has failed. */
  private drain(): boolean {
    while (true) {
      const event: i32 = this.conn.next();
      if (event === PG_NEED_MORE) {
        return false;
      }
      this.event(event);
      if (event === PG_FAILED) {
        return true;
      }
    }
  }

  private event(event: i32): void {
    const conn = this.conn;
    if (event === PG_READY) {
      this.log.push(`ready ${statusName(conn.txStatus)} pid ${conn.backendPid > 0} ${conn.serverVersion}`);
    } else if (event === PG_DESCRIBED) {
      const types: i32[] = [];
      const names: string[] = [];
      for (let c: i32 = 0; c < conn.columns; c++) {
        types.push(conn.columnType(c));
        names.push(`${conn.columnType(c)}`);
      }
      this.types = types;
      this.log.push(`described ${names.join(",")}`);
    } else if (event === PG_ROW) {
      this.log.push(`row ${this.row()}`);
    } else if (event === PG_COMPLETE) {
      this.log.push(`complete ${this.tag()} ${conn.tagRows()}`);
    } else if (event === PG_ERROR) {
      const e = conn.lastError;
      this.log.push(e === null ? "error" : `error ${e.severity} ${e.code} ${e.message}`);
    } else if (event === PG_NOTICE) {
      const e = conn.lastNotice;
      this.log.push(e === null ? "notice" : `notice ${e.severity} ${e.code} ${conn.notices}`);
    } else if (event === PG_GROUP_DONE) {
      this.log.push(`done ${statusName(conn.txStatus)} failed ${conn.groupFailed} in flight ${conn.inFlight}`);
    } else if (event === PG_FAILED) {
      const e = conn.lastError;
      this.log.push(`failed ${conn.failure}${e === null ? "" : ` ${e.severity} ${e.code}`}`);
    } else {
      this.log.push(`event ${event}`);
    }
  }

  private tag(): string {
    const words: string[] = ["SELECT", "INSERT", "CREATE TABLE", "CREATE"];
    for (const word of words) {
      if (this.conn.tagIs(word)) {
        return word;
      }
    }
    return this.conn.tagIs("") ? "(empty)" : "?";
  }

  /** The row's columns, each read by its described type. */
  private row(): string {
    const conn = this.conn;
    const parts: string[] = [];
    for (let c: i32 = 0; c < conn.columns; c++) {
      const type: i32 = c < toI32(this.types.length) ? this.types[c] : 0;
      if (conn.isNull(c)) {
        parts.push("NULL");
      } else if (type === OID_INT4) {
        parts.push(`${conn.int(c)}`);
      } else if (type === OID_BOOL) {
        parts.push(`${conn.bool(c)}`);
      } else if (type === OID_TIMESTAMPTZ) {
        const n: i32 = conn.text.timestamp(conn.inputBuffer(), conn.colStart(c), conn.colLength(c), this.stamp, 0);
        parts.push(n < 0 ? "bad timestamp" : String.fromBytes(this.stamp, 0, n));
      } else if (type === OID_TEXT_ARRAY) {
        parts.push(this.array(c));
      } else if (type === OID_TEXT && conn.colLength(c) > 64) {
        parts.push(`${conn.colLength(c)} bytes`);
      } else {
        parts.push(conn.columnText(c));
      }
    }
    if (conn.text.failed) {
      parts.push("decode failed");
      conn.text.reset();
    }
    return parts.join("|");
  }

  private array(c: i32): string {
    const w = this.walker;
    w.begin(this.conn.inputBuffer(), this.conn.colStart(c), this.conn.colLength(c));
    const items: string[] = [];
    while (true) {
      const r: i32 = w.next();
      if (r === PG_ARRAY_END) {
        break;
      }
      if (r === PG_ARRAY_NULL) {
        items.push("(null)");
      } else if (r === PG_ARRAY_ELEMENT) {
        const n: i32 = w.copy(this.element, 0);
        items.push(n < 0 ? "(too long)" : `<${String.fromBytes(this.element, 0, n)}>`);
      } else {
        items.push("(bad)");
        break;
      }
    }
    return `[${items.join(",")}]`;
  }
}

/** Trust, then four pipelined writes covering every result shape, then Terminate. */
const trustQuery = (chunk: i32): string[] => {
  const r = new Replay("trust-query", "trusty", "nish", "", chunk);
  const conn = r.conn;
  const none: i32[] = [];
  r.wrote();
  r.answer();

  conn.prepare(
    "s1",
    "select $1::int4 + 1, true, 'héllo'::text, '2024-01-02 03:04:05.123456+00'::timestamptz, " +
      "array['a\"b', 'c\\d', null, 'x y', 'NULL']::text[], null::text",
    [OID_INT4],
  );
  conn.bindStart("s1");
  conn.paramInt(toI64(41));
  conn.bindEnd();
  conn.sync();
  conn.prepare("s2", "create temp table t (id int4, tags text[])", none);
  conn.bindStart("s2");
  conn.bindEnd();
  conn.sync();
  conn.prepare("s3", "insert into t values ($1, $2), ($3, $4)", none);
  conn.bindStart("s3");
  conn.paramInt(toI64(-1));
  conn.paramTextArray(["q\"uote", "back\\slash", ""]);
  conn.paramText("2");
  conn.paramNull();
  conn.bindEnd();
  conn.sync();
  r.log.push(`in flight ${conn.inFlight}`);
  r.wrote();
  r.answer();

  conn.prepare("s4", "select 1 / $1::int4", none);
  conn.bindStart("s4");
  conn.paramInt(toI64(0));
  conn.bindEnd();
  conn.sync();
  conn.prepare("s5", "select id, tags from t order by id", none);
  conn.bindStart("s5");
  conn.bindEnd();
  conn.sync();
  r.wrote();
  r.answer();

  conn.prepare("s6", "create temp table if not exists t (id int4)", none);
  conn.bindStart("s6");
  conn.bindEnd();
  conn.sync();
  conn.prepare("", "", none);
  conn.bindStart("");
  conn.bindEnd();
  conn.sync();
  conn.prepare("s7", "select repeat('x', $1::int4)", none);
  conn.bindStart("s7");
  conn.paramInt(toI64(20000));
  conn.bindEnd();
  conn.sync();
  r.wrote();
  r.answer();

  conn.closeStatement("s1");
  conn.sync();
  r.wrote();
  r.answer();

  conn.terminate();
  r.wrote();
  r.log.push(`closed ${conn.closed()} ${conn.failure}`);
  return r.log;
};

const VERSION: string = "18.6 (Ubuntu 18.6-1.pgdg24.04+2)";

const trustQueryLog = (): string[] => [
  "wrote 83",
  `ready I pid true ${VERSION}`,
  "in flight 3",
  "wrote 437",
  "described 23,16,25,1184,1009,25",
  "row 42|true|héllo|2024-01-02T03:04:05.123Z|[<a\"b>,<c\\d>,(null),<x y>,<NULL>]|NULL",
  "complete SELECT 1",
  "done I failed false in flight 2",
  "described ",
  "complete CREATE TABLE -1",
  "done I failed false in flight 1",
  "described ",
  "complete INSERT 2",
  "done I failed false in flight 0",
  "wrote 158",
  "described 23",
  "error ERROR 22012 division by zero",
  "done I failed true in flight 1",
  "described 23,1009",
  "row -1|[<q\"uote>,<back\\slash>,<>]",
  "row 2|NULL",
  "complete SELECT 2",
  "done I failed false in flight 0",
  "wrote 224",
  "described ",
  "notice NOTICE 42P07 1",
  "complete CREATE TABLE -1",
  "done I failed false in flight 2",
  "described ",
  "complete (empty) -1",
  "done I failed false in flight 1",
  "described 25",
  "row 20000 bytes",
  "complete SELECT 1",
  "done I failed false in flight 0",
  "wrote 14",
  "done I failed false in flight 0",
  "wrote 5",
  "closed 8 9",
];

/** SCRAM-SHA-256 to the end: the proof, the server's signature checked, one query, then Terminate. */
const scramOk = (chunk: i32): string[] => {
  const r = new Replay("scram-ok", "scrammy", "nish", PASSWORD, chunk);
  const conn = r.conn;
  const none: i32[] = [];
  r.wrote();
  r.answer();
  r.wrote();
  r.answer();
  r.wrote();
  r.answer();
  conn.prepare("", "select current_user", none);
  conn.bindStart("");
  conn.bindEnd();
  conn.sync();
  r.wrote();
  r.answer();
  conn.terminate();
  r.wrote();
  r.log.push(`closed ${conn.closed()} ${conn.failure}`);
  return r.log;
};

const scramOkLog = (): string[] => [
  "wrote 84",
  "wrote 55",
  "wrote 109",
  `ready I pid true ${VERSION}`,
  "wrote 63",
  "described 19",
  "row scrammy",
  "complete SELECT 1",
  "done I failed false in flight 0",
  "wrote 5",
  "closed 8 9",
];

/** The proof from the wrong password, which the server refuses. */
const scramWrongPassword = (chunk: i32): string[] => {
  const r = new Replay("scram-wrong-password", "scrammy", "nish", "wrong password", chunk);
  r.wrote();
  r.answer();
  r.wrote();
  r.answer();
  r.wrote();
  r.answer();
  return r.log;
};

const scramWrongPasswordLog = (): string[] => ["wrote 84", "wrote 55", "wrote 109", "failed 7 FATAL 28P01"];

const noDatabase = (chunk: i32): string[] => {
  const r = new Replay("no-database", "trusty", "missing", "", chunk);
  r.wrote();
  r.answer();
  return r.log;
};

const noDatabaseLog = (): string[] => ["wrote 86", "failed 7 FATAL 3D000"];

const cleartext = (chunk: i32): string[] => {
  const r = new Replay("cleartext", "plain", "nish", "plain", chunk);
  r.wrote();
  r.answer();
  return r.log;
};

const cleartextLog = (): string[] => ["wrote 82", "failed 4"];

export const main = (): number => {
  const t = new Suite("postgres replay");
  const chunks: i32[] = [1, 7, 0];
  for (const chunk of chunks) {
    const by: string = chunk > 0 ? `in ${chunk}-byte pieces` : "whole";
    t.eqLines(`trust-query, ${by}`, trustQuery(chunk), trustQueryLog());
    t.eqLines(`scram-ok, ${by}`, scramOk(chunk), scramOkLog());
    t.eqLines(`scram-wrong-password, ${by}`, scramWrongPassword(chunk), scramWrongPasswordLog());
    t.eqLines(`no-database, ${by}`, noDatabase(chunk), noDatabaseLog());
    t.eqLines(`cleartext, ${by}`, cleartext(chunk), cleartextLog());
  }
  return t.done();
};
