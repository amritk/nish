// nish/net/postgres against PostgreSQL 18 itself: the exchanges
// tests/postgres/record.mjs recorded from a live server, replayed byte for
// byte. Every write the client queues must equal the recorded one, and every
// recorded answer is fed back in pieces of 1 byte, of 7, and whole, the
// events and the values each row decodes to logged and compared with what
// the server sent. A change to the client's framing, its parser or its
// decoders shows here as a log that differs.
//
// Then every recording is cut at every offset of what the server sent: the
// client is fed that much, told the stream ended, and must have failed with
// one of the defined PG_ERR_ codes, never panicked or hung. The totals per
// code are pinned below. Last, a seeded mutation fuzz (fuzz.ts) feeds every
// scenario answers with a byte flipped, inserted or deleted, or cut short,
// every row decoded as it comes, and pins what the mutants end as.
import {
  PgArrayWalker,
  PgConfig,
  PgConnection,
  PG_ARRAY_ELEMENT,
  PG_ARRAY_END,
  PG_ARRAY_NULL,
  PG_COMPLETE,
  PG_DESCRIBED,
  PG_ERR_SETTING,
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
import { pgBelow, pgMutate, pgXorshift } from "./fuzz";

const DIR: string = "tests/postgres/recordings/";
const NONCE: string = "nish-postgres-test";
const PASSWORD: string = "correct horse battery staple";
const OID_BOOL: i32 = 16;
const OID_INT8: i32 = 20;
/** 2^53 + 1, the first integer a double cannot hold. */
const PAST_2_53: i64 = 9007199254740993;
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

/** The number of bytes the server sent in `records`. */
const serverBytes = (records: Record[]): i32 => {
  let n: i32 = 0;
  for (const r of records) {
    if (!r.write) {
      n += toI32(r.bytes.length);
    }
  }
  return n;
};

/**
 * A connection played against one recording, its events written to `log`.
 * With `cut` at 0 or more, only the first `cut` bytes the server sent are
 * fed, nothing is logged, and the client's writes are taken as sent. A
 * `mutant` replaces the recording, for the fuzz.
 */
class Replay {
  readonly conn: PgConnection;
  readonly log: string[];
  private readonly records: Record[];
  private at: i32 = 0;
  private readonly chunk: i32;
  private readonly cut: i32;
  private fed: i32 = 0;
  private types: i32[];
  private readonly walker: PgArrayWalker;
  private readonly stamp: u8[];
  private readonly element: u8[];

  constructor(name: string, user: string, database: string, password: string, chunk: i32, cut: i32, mutant: Record[] | null) {
    this.log = [];
    this.cut = cut;
    this.types = [];
    this.walker = new PgArrayWalker();
    this.stamp = new Array<u8>(24);
    this.element = new Array<u8>(64);
    this.records = mutant === null ? load(name) : mutant;
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
    if (this.cut >= 0) {
      if (this.at < toI32(this.records.length) && this.records[this.at].write) {
        this.at += 1;
      }
      conn.sent(n);
      return;
    }
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
    if (this.cut >= 0) {
      this.cutAnswer();
      return;
    }
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

  /** Feeds the next recorded answer up to the cut, every event read and decoded; `log` is not compared. */
  private cutAnswer(): void {
    if (this.at >= toI32(this.records.length) || this.records[this.at].write) {
      return;
    }
    const bytes: u8[] = this.records[this.at].bytes;
    this.at += 1;
    const room: i32 = this.cut - this.fed;
    const n: i32 = toI32(bytes.length) < room ? toI32(bytes.length) : room;
    let fed: i32 = 0;
    while (fed < n) {
      fed += this.conn.receive(bytes, fed, n - fed);
      let event: i32 = this.conn.next();
      while (event !== PG_NEED_MORE && event !== PG_FAILED) {
        // Logged all the same, so that every row is decoded.
        this.event(event);
        event = this.conn.next();
      }
      if (event === PG_FAILED) {
        break;
      }
    }
    this.fed += n;
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
    const words: string[] = ["SELECT", "INSERT", "UPDATE", "DELETE", "CREATE TABLE", "CREATE"];
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
      } else if (type === OID_INT4 || type === OID_INT8) {
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
const trustQuery = (chunk: i32, cut: i32, mutant: Record[] | null): Replay => {
  const r = new Replay("trust-query", "trusty", "nish", "", chunk, cut, mutant);
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
  return r;
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
const scramOk = (chunk: i32, cut: i32, mutant: Record[] | null): Replay => {
  const r = new Replay("scram-ok", "scrammy", "nish", PASSWORD, chunk, cut, mutant);
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
  return r;
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
const scramWrongPassword = (chunk: i32, cut: i32, mutant: Record[] | null): Replay => {
  const r = new Replay("scram-wrong-password", "scrammy", "nish", "wrong password", chunk, cut, mutant);
  r.wrote();
  r.answer();
  r.wrote();
  r.answer();
  r.wrote();
  r.answer();
  return r;
};

const scramWrongPasswordLog = (): string[] => ["wrote 84", "wrote 55", "wrote 109", "failed 7 FATAL 28P01"];

const noDatabase = (chunk: i32, cut: i32, mutant: Record[] | null): Replay => {
  const r = new Replay("no-database", "trusty", "missing", "", chunk, cut, mutant);
  r.wrote();
  r.answer();
  return r;
};

const noDatabaseLog = (): string[] => ["wrote 86", "failed 7 FATAL 3D000"];

const cleartext = (chunk: i32, cut: i32, mutant: Record[] | null): Replay => {
  const r = new Replay("cleartext", "plain", "nish", "plain", chunk, cut, mutant);
  r.wrote();
  r.answer();
  return r;
};

const cleartextLog = (): string[] => ["wrote 82", "failed 4"];

/** Five groups in one write; the third breaks the primary key with 23505, and groups 4 and 5 still run. */
const pipelineUnique = (chunk: i32, cut: i32, mutant: Record[] | null): Replay => {
  const r = new Replay("pipeline-unique", "trusty", "nish", "", chunk, cut, mutant);
  const conn = r.conn;
  const none: i32[] = [];
  r.wrote();
  r.answer();
  conn.prepare("ddl", "create temp table u (id int4 primary key)", none);
  conn.bindStart("ddl");
  conn.bindEnd();
  conn.sync();
  r.wrote();
  r.answer();

  conn.prepare("ins", "insert into u values ($1::int4)", none);
  const ids: i32[] = [1, 2, 1, 3];
  for (const id of ids) {
    conn.bindStart("ins");
    conn.paramInt(toI64(id));
    conn.bindEnd();
    conn.sync();
  }
  conn.prepare("cnt", "select count(*)::int4 from u", none);
  conn.bindStart("cnt");
  conn.bindEnd();
  conn.sync();
  r.log.push(`in flight ${conn.inFlight}`);
  r.wrote();
  r.answer();

  conn.terminate();
  r.wrote();
  r.log.push(`closed ${conn.closed()} ${conn.failure}`);
  return r;
};

/** UPDATE n and DELETE n, read through tagRows, and an UPDATE that matches nothing. */
const rowCounts = (chunk: i32, cut: i32, mutant: Record[] | null): Replay => {
  const r = new Replay("row-counts", "trusty", "nish", "", chunk, cut, mutant);
  const conn = r.conn;
  const none: i32[] = [];
  r.wrote();
  r.answer();
  conn.prepare("ddl", "create temp table c (id int4, n int4)", none);
  conn.bindStart("ddl");
  conn.bindEnd();
  conn.sync();
  conn.prepare("ins", "insert into c select g, 0 from generate_series(1, 5) g", none);
  conn.bindStart("ins");
  conn.bindEnd();
  conn.sync();
  conn.prepare("upd", "update c set n = n + 1 where id <= $1::int4", none);
  conn.bindStart("upd");
  conn.paramInt(toI64(3));
  conn.bindEnd();
  conn.sync();
  conn.prepare("del", "delete from c where id > $1::int4", none);
  conn.bindStart("del");
  conn.paramInt(toI64(3));
  conn.bindEnd();
  conn.sync();
  conn.bindStart("upd");
  conn.paramInt(toI64(0));
  conn.bindEnd();
  conn.sync();
  r.wrote();
  r.answer();

  conn.terminate();
  r.wrote();
  r.log.push(`closed ${conn.closed()} ${conn.failure}`);
  return r;
};

/** A Conduit-shaped article row: int8 past 2^53, int4, text, timestamptz, bool, text[] and NULL. */
const typedRow = (chunk: i32, cut: i32, mutant: Record[] | null): Replay => {
  const r = new Replay("typed-row", "trusty", "nish", "", chunk, cut, mutant);
  const conn = r.conn;
  const none: i32[] = [];
  r.wrote();
  r.answer();
  conn.prepare(
    "art",
    "select $1::int8, 42::int4, 'How to train your dragon — 2'::text, " +
      "'2024-02-29 23:59:59.5+00'::timestamptz, false, array['dragons', 'training']::text[], null::text",
    none,
  );
  conn.bindStart("art");
  conn.paramInt(PAST_2_53);
  conn.bindEnd();
  conn.sync();
  r.wrote();
  r.answer();

  conn.terminate();
  r.wrote();
  r.log.push(`closed ${conn.closed()} ${conn.failure}`);
  return r;
};

const pipelineUniqueLog = (): string[] => [
  "wrote 83",
  `ready I pid true ${VERSION}`,
  "wrote 94",
  "described ",
  "complete CREATE TABLE -1",
  "done I failed false in flight 0",
  "in flight 5",
  "wrote 278",
  "described ",
  "complete INSERT 1",
  "done I failed false in flight 4",
  "complete INSERT 1",
  "done I failed false in flight 3",
  'error ERROR 23505 duplicate key value violates unique constraint "u_pkey"',
  "done I failed true in flight 2",
  "complete INSERT 1",
  "done I failed false in flight 1",
  "described 23",
  "row 3",
  "complete SELECT 1",
  "done I failed false in flight 0",
  "wrote 5",
  "closed 8 9",
];

const rowCountsLog = (): string[] => [
  "wrote 83",
  `ready I pid true ${VERSION}`,
  "wrote 425",
  "described ",
  "complete CREATE TABLE -1",
  "done I failed false in flight 4",
  "described ",
  "complete INSERT 5",
  "done I failed false in flight 3",
  "described ",
  "complete UPDATE 3",
  "done I failed false in flight 2",
  "described ",
  "complete DELETE 2",
  "done I failed false in flight 1",
  "complete UPDATE 0",
  "done I failed false in flight 0",
  "wrote 5",
  "closed 8 9",
];

const typedRowLog = (): string[] => [
  "wrote 83",
  `ready I pid true ${VERSION}`,
  "wrote 236",
  "described 20,23,25,1184,16,1009,25",
  "row 9007199254740993|42|How to train your dragon — 2|2024-02-29T23:59:59.500Z|false|[<dragons>,<training>]|NULL",
  "complete SELECT 1",
  "done I failed false in flight 0",
  "wrote 5",
  "closed 8 9",
];

/**
 * Plays `play` cut at every offset of the `total` bytes its server sent,
 * counting the PG_ERR_ code each cut ends with; a code outside the defined
 * ones, or a connection not failed after `closed()`, is counted as "bad".
 */
const cuts = (name: string, total: i32, play: (chunk: i32, cut: i32, mutant: Record[] | null) => Replay): string => {
  const counts: i32[] = [];
  for (let code: i32 = 0; code <= PG_ERR_SETTING; code++) {
    counts.push(0);
  }
  let bad: i32 = 0;
  for (let cut: i32 = 0; cut <= total; cut++) {
    const conn = play(0, cut, null).conn;
    const event: i32 = conn.closed();
    const code: i32 = conn.failure;
    if (event !== PG_FAILED || conn.next() !== PG_FAILED || code < 1 || code > PG_ERR_SETTING) {
      bad += 1;
    } else {
      counts[code] += 1;
    }
  }
  const parts: string[] = [];
  for (let code: i32 = 1; code <= PG_ERR_SETTING; code++) {
    if (counts[code] > 0) {
      parts.push(`${code}:${counts[code]}`);
    }
  }
  return `${name} ${total + 1} cuts ${parts.join(" ")} bad ${bad}`;
};

const cutLines = (): string[] => [
  cuts("trust-query", serverBytes(load("trust-query")), trustQuery),
  cuts("scram-ok", serverBytes(load("scram-ok")), scramOk),
  cuts("scram-wrong-password", serverBytes(load("scram-wrong-password")), scramWrongPassword),
  cuts("no-database", serverBytes(load("no-database")), noDatabase),
  cuts("cleartext", serverBytes(load("cleartext")), cleartext),
  cuts("pipeline-unique", serverBytes(load("pipeline-unique")), pipelineUnique),
  cuts("row-counts", serverBytes(load("row-counts")), rowCounts),
  cuts("typed-row", serverBytes(load("typed-row")), typedRow),
];

// A cut inside an answer the server sent before a FATAL or the refused
// cleartext request ends as PG_ERR_CLOSED (9); only the whole answer reaches
// PG_ERR_SERVER (7) or PG_ERR_AUTH_UNSUPPORTED (4).
const cutLog = (): string[] => [
  "trust-query 21434 cuts 9:21434 bad 0",
  "scram-ok 734 cuts 9:734 bad 0",
  "scram-wrong-password 222 cuts 7:1 9:221 bad 0",
  "no-database 104 cuts 7:1 9:103 bad 0",
  "cleartext 10 cuts 4:1 9:9 bad 0",
  "pipeline-unique 879 cuts 9:879 bad 0",
  "row-counts 675 cuts 9:675 bad 0",
  "typed-row 815 cuts 9:815 bad 0",
];

/** Beyond every recording: a cut that feeds all of it. */
const WHOLE: i32 = 1073741824;

/** Scenario `pick`, in the order of the fuzz's `names`, played whole over `mutant`. */
const playOne = (pick: i32, mutant: Record[]): Replay => {
  if (pick === 0) {
    return trustQuery(0, WHOLE, mutant);
  }
  if (pick === 1) {
    return scramOk(0, WHOLE, mutant);
  }
  if (pick === 2) {
    return scramWrongPassword(0, WHOLE, mutant);
  }
  if (pick === 3) {
    return noDatabase(0, WHOLE, mutant);
  }
  if (pick === 4) {
    return cleartext(0, WHOLE, mutant);
  }
  if (pick === 5) {
    return pipelineUnique(0, WHOLE, mutant);
  }
  if (pick === 6) {
    return rowCounts(0, WHOLE, mutant);
  }
  return typedRow(0, WHOLE, mutant);
};

/** How many mutants, and from what seed. */
const FUZZ_COUNT: i32 = 4000;
const FUZZ_SEED: i32 = 1145141919;

/**
 * Each mutant is one scenario with one of its server answers mutated, played
 * whole with every row decoded, then told the stream ended. The connection
 * has to end failed with a defined PG_ERR_ code; how many end each way, and a
 * checksum of every code and log length, are pinned.
 */
const fuzz = (t: Suite): void => {
  const names: string[] = [
    "trust-query",
    "scram-ok",
    "scram-wrong-password",
    "no-database",
    "cleartext",
    "pipeline-unique",
    "row-counts",
    "typed-row",
  ];
  const recordings: Record[][] = [];
  for (const name of names) {
    recordings.push(load(name));
  }
  const counts: i32[] = [];
  for (let code: i32 = 0; code <= PG_ERR_SETTING; code++) {
    counts.push(0);
  }
  let bad: i32 = 0;
  let checksum: i64 = 0;
  let state: i32 = FUZZ_SEED;
  let m: i32 = 0;
  while (m < FUZZ_COUNT) {
    state = pgXorshift(state);
    const pick: i32 = pgBelow(state, toI32(names.length));
    const records: Record[] = recordings[pick];
    const answers: i32[] = [];
    for (let i: i32 = 0; i < toI32(records.length); i++) {
      if (!records[i].write) {
        answers.push(i);
      }
    }
    state = pgXorshift(state);
    const which: i32 = answers[pgBelow(state, toI32(answers.length))];
    state = pgXorshift(state);
    const a: i32 = state;
    state = pgXorshift(state);
    const b: i32 = state;
    state = pgXorshift(state);
    const c: i32 = state;
    const mutant: Record[] = [];
    for (let i: i32 = 0; i < toI32(records.length); i++) {
      mutant.push(i === which ? new Record(false, pgMutate(records[i].bytes, a, b, c)) : records[i]);
    }
    const r = playOne(pick, mutant);
    const conn = r.conn;
    const event: i32 = conn.closed();
    const code: i32 = conn.failure;
    if (event !== PG_FAILED || conn.next() !== PG_FAILED || code < 1 || code > PG_ERR_SETTING) {
      bad += 1;
    } else {
      counts[code] += 1;
    }
    checksum = (checksum * toI64(31) + toI64(code * 100003 + toI32(r.log.length))) % toI64(1000000007);
    m += 1;
  }
  const parts: string[] = [];
  for (let code: i32 = 1; code <= PG_ERR_SETTING; code++) {
    if (counts[code] > 0) {
      parts.push(`${code}:${counts[code]}`);
    }
  }
  t.eqI32("fuzz: 4,000 mutants were played, none panicked", m, FUZZ_COUNT);
  t.eqI32("fuzz: every mutant ended failed with a defined code", bad, 0);
  t.eqStr("fuzz: the seed's mutants, by the code they ended with", parts.join(" "), "1:1390 2:302 3:88 4:274 5:237 6:16 7:176 8:1 9:1511 10:5");
  t.eqI64("fuzz: the checksum of every code and log length", checksum, toI64(229005403));
};

export const main = (): number => {
  const t = new Suite("postgres replay");
  const chunks: i32[] = [1, 7, 0];
  for (const chunk of chunks) {
    const by: string = chunk > 0 ? `in ${chunk}-byte pieces` : "whole";
    t.eqLines(`trust-query, ${by}`, trustQuery(chunk, -1, null).log, trustQueryLog());
    t.eqLines(`scram-ok, ${by}`, scramOk(chunk, -1, null).log, scramOkLog());
    t.eqLines(`scram-wrong-password, ${by}`, scramWrongPassword(chunk, -1, null).log, scramWrongPasswordLog());
    t.eqLines(`no-database, ${by}`, noDatabase(chunk, -1, null).log, noDatabaseLog());
    t.eqLines(`cleartext, ${by}`, cleartext(chunk, -1, null).log, cleartextLog());
    t.eqLines(`pipeline-unique, ${by}`, pipelineUnique(chunk, -1, null).log, pipelineUniqueLog());
    t.eqLines(`row-counts, ${by}`, rowCounts(chunk, -1, null).log, rowCountsLog());
    t.eqLines(`typed-row, ${by}`, typedRow(chunk, -1, null).log, typedRowLog());
  }
  t.eqLines("every recording cut at every offset", cutLines(), cutLog());
  fuzz(t);
  return t.done();
};
