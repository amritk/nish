// Typed JSON's options (`static readonly json`) and `JsonNumber`: a field
// read and written under another key, ASCII and of two, three and four bytes
// of UTF-8 and through an escape; a missing optional key setting its field to
// the initializer, on a fresh object and on one decoded into again; and a
// number kept as its text, wider than a `u64` and longer than an `f64`, as a
// field, `| null`, in an array and as a map's value.
import { JsonLimits } from "nish/json-tokenizer";
import {
  JSON_DECODE_DUPLICATE,
  JSON_DECODE_MISSING,
  JSON_DECODE_OK,
  JSON_DECODE_TYPE,
  JSON_DECODE_UNKNOWN,
  JsonDecoder,
  JsonNumber,
  jsonDecode,
} from "nish/json-typed";
import { splitLines } from "nish/text";
import { Suite } from "nish/testing";
import { JsonWriter } from "nish/json";
import { Renamed, renamedDecode, renamedEncode } from "./renamed.ts";
import { jtBytes, jtDecode, jtEncode } from "./support.ts";

export class Account {
  static readonly json = {
    rename: { userId: "user_id", accent: "é", euro: "€", face: "😀", quote: 'a"b' },
    optional: ["nickname", "score", "active", "note", "tags"],
  };
  nickname: string = "anon";
  score: f64 = 1.5;
  note: string | null = null;
  tags: string[] | null = null;
  userId: i32 = 0;
  accent: i32 = 0;
  euro: i32 = 0;
  face: i32 = 0;
  quote: i32 = 0;
  active: boolean = true;
}

/** Two fields swap keys: each name is the other's key, and neither is its own. */
export class Swapped {
  static readonly json = { rename: { a: "b", b: "a" } };
  a: i32 = 0;
  b: string = "";
}

export class Reading {
  static readonly json = { optional: ["backup"] };
  value: JsonNumber;
  backup: JsonNumber | null = null;
  series: JsonNumber[];
  named: Map<string, JsonNumber>;

  constructor() {
    this.value = new JsonNumber();
    this.series = [];
    this.named = new Map<string, JsonNumber>();
  }
}

const FULL: string =
  `{"nickname":"Bo","score":2.25,"note":"n","tags":["x","y"],"user_id":7,` + `"é":2,"€":3,"😀":4,"a\\"b":5,"active":false}`;

const BARE: string = `{"user_id":7,"é":2,"€":3,"😀":4,"a\\"b":5}`;

const jtRenames = (t: Suite): void => {
  const a = new Account();
  t.eqI32("rename: decodes under the wire names", jtDecode(FULL, a, new JsonLimits(), false).failed, JSON_DECODE_OK);
  t.eqStr("rename: and encodes under them, in declaration order", jtEncode(a, 1024), FULL);
  t.eqStr(
    "rename: each field holds its own key's value",
    `${a.userId} ${a.nickname} ${a.score} ${a.active} ${a.accent} ${a.euro} ${a.face} ${a.quote}`,
    "7 Bo 2.25 false 2 3 4 5"
  );
  // Every key written through an escape reaches the same fields.
  const escaped =
    `{"\\u0075ser_id":8,"\\u00e9":12,"\\u20ac":13,"\\ud83d\\ude00":14,"a\\u0022b":15}`;
  const e = new Account();
  t.eqI32("rename: escaped wire names decode", jtDecode(escaped, e, new JsonLimits(), false).failed, JSON_DECODE_OK);
  t.eqStr("rename: to the same fields", `${e.userId} ${e.accent} ${e.euro} ${e.face} ${e.quote}`, "8 12 13 14 15");

  // The field's own name is a key no field has.
  const own = jtDecode(`{"userId":7}`, new Account(), new JsonLimits(), false);
  t.eqI32("rename: the field's own name is unknown: code", own.failed, JSON_DECODE_UNKNOWN);
  t.eqI32("rename: the field's own name is unknown: errorAt", own.errorAt, 1);
  const twice = jtDecode(`{"user_id":1,"\\u0075ser_id":2}`, new Account(), new JsonLimits(), false);
  t.eqI32("rename: a wire name twice, once escaped: code", twice.failed, JSON_DECODE_DUPLICATE);
  t.eqI32("rename: a wire name twice, once escaped: errorAt", twice.errorAt, 13);
  // A required renamed field is still required, under its wire name.
  const missing = jtDecode(`{"é":2,"€":3,"😀":4,"a\\"b":5}`, new Account(), new JsonLimits(), false);
  t.eqI32("rename: a missing required wire name: code", missing.failed, JSON_DECODE_MISSING);

  const s = new Swapped();
  t.eqI32("rename: swapped keys decode", jtDecode(`{"b":1,"a":"x"}`, s, new JsonLimits(), false).failed, 0);
  t.eqStr("rename: swapped keys reach the other field", `${s.a} ${s.b}`, "1 x");
  t.eqStr("rename: and encode back swapped", jtEncode(s, 64), `{"b":1,"a":"x"}`);
};

const jtOptional = (t: Suite): void => {
  const a = new Account();
  t.eqI32("optional: missing keys are no error", jtDecode(BARE, a, new JsonLimits(), false).failed, JSON_DECODE_OK);
  t.eqStr(
    "optional: a fresh object keeps every initializer",
    jtEncode(a, 1024),
    `{"nickname":"anon","score":1.5,"note":null,"tags":null,"user_id":7,"é":2,"€":3,"😀":4,"a\\"b":5,"active":true}`
  );
  // Decoded into again, the fields the second input leaves out are set back
  // to their initializers, not left as the first input made them.
  const d = jtDecode(FULL, a, new JsonLimits(), false);
  t.eqI32("optional: the full input into the same object", d.failed, JSON_DECODE_OK);
  const src = jtBytes(BARE);
  d.reset(src, 0, toI32(src.length));
  t.eqI32("optional: then the bare input", jsonDecode(d, a), JSON_DECODE_OK);
  t.eqStr(
    "optional: sets the missing fields back to their initializers",
    `${a.nickname} ${a.score} ${a.active} ${a.note === null} ${a.tags === null}`,
    "anon 1.5 true true true"
  );
  // Given as null, an optional `| null` field is null, as a required one is.
  const n = new Account();
  t.eqI32("optional: given as null", jtDecode(`{"user_id":1,"note":null,"é":2,"€":3,"😀":4,"a\\"b":5}`, n, new JsonLimits(), false).failed, 0);
  t.ok("optional: is null", n.note === null);
  // An optional key is still read once.
  const twice = jtDecode(`{"user_id":1,"score":1,"score":2}`, new Account(), new JsonLimits(), false);
  t.eqI32("optional: given twice: code", twice.failed, JSON_DECODE_DUPLICATE);
  t.eqI32("optional: given twice: errorAt", twice.errorAt, 23);
  // Of a wrong type, it is the type's error, not skipped.
  const wrong = jtDecode(`{"user_id":1,"score":"1"}`, new Account(), new JsonLimits(), false);
  t.eqI32("optional: of the wrong type: code", wrong.failed, JSON_DECODE_TYPE);
  t.eqI32("optional: of the wrong type: errorAt", wrong.errorAt, 21);
  // The required ones are still refused, at the closing brace.
  const bare = jtDecode(`{"user_id":1}`, new Account(), new JsonLimits(), false);
  t.eqI32("optional: a required field missing: code", bare.failed, JSON_DECODE_MISSING);
  t.eqI32("optional: a required field missing: errorAt", bare.errorAt, 12);
  // Reused over 1,000 inputs that alternate, the optional defaults allocate nothing.
  const full = jtBytes(FULL);
  const reused = new Account();
  const dec = new JsonDecoder(full, 0, toI32(full.length), new JsonLimits());
  jsonDecode(dec, reused);
  dec.reset(src, 0, toI32(src.length));
  jsonDecode(dec, reused);
  const before = Arena.used();
  let failed: i32 = 0;
  for (let i: i32 = 0; i < 1000; i += 1) {
    dec.reset(src, 0, toI32(src.length));
    failed = failed + jsonDecode(dec, reused);
  }
  t.eqI32("optional: 1,000 bare decodes succeed", failed, 0);
  t.eqI64("optional: Arena.used() is flat over them", Arena.used() - before, toI64(0));
};

const WIDE: string =
  `{"value":123456789012345678901234567890,"backup":-0.1000000000000000000000000000000000000001,` +
  `"series":[18446744073709551616,1E+400,-0,2.5e-3,0],"named":{"pi":3.14159265358979323846264338327950288,"e":-1e-400}}`;

const jtNumbers = (t: Suite): void => {
  const r = new Reading();
  t.eqI32("number: decodes", jtDecode(WIDE, r, new JsonLimits(), false).failed, JSON_DECODE_OK);
  t.eqStr("number: encodes every number byte for byte", jtEncode(r, 1024), WIDE);
  t.eqStr("number: text", r.value.text(), "123456789012345678901234567890");
  t.ok("number: wider than u64 is not an i64", !r.value.isI64());
  t.ok("number: nor a u64", !r.value.isU64());
  t.ok("number: but an f64", r.value.f64() === 1.2345678901234568e29);
  const backup = r.backup;
  t.ok("number: | null holds the number", backup !== null && backup.text() === "-0.1000000000000000000000000000000000000001");
  t.eqI32("number: an array of five", toI32(r.series.length), 5);
  if (r.series.length === 5) {
    t.ok("number: 2^64 is not a u64", !r.series[0].isU64());
    t.eqStr("number: an exponent is kept as written", r.series[1].text(), "1E+400");
    t.eqStr("number: -0 is kept", r.series[2].text(), "-0");
    t.ok("number: -0 is an i64", r.series[2].isI64() && r.series[2].i64() === toI64(0));
    t.ok("number: 0 is a u64", r.series[4].isU64() && r.series[4].u64() === toU64(0));
  }
  const pi = r.named.get("pi");
  t.ok("number: a map's value", pi !== undefined && pi.text() === "3.14159265358979323846264338327950288");

  // Absent, the optional `| null` number is `null` again; present as `null`, too.
  const bare = jtDecode(`{"value":1,"series":[],"named":{}}`, r, new JsonLimits(), false);
  t.eqI32("number: decoded again without backup", bare.failed, JSON_DECODE_OK);
  t.ok("number: backup is its initializer", r.backup === null);
  t.eqStr("number: and encodes as null", jtEncode(r, 256), `{"value":1,"backup":null,"series":[],"named":{}}`);

  // A number is the only JSON value a JsonNumber takes.
  const quoted = jtDecode(`{"value":"1","series":[],"named":{}}`, new Reading(), new JsonLimits(), false);
  t.eqI32("number: a string: code", quoted.failed, JSON_DECODE_TYPE);
  t.eqI32("number: a string: errorAt", quoted.errorAt, 9);
  const nul = jtDecode(`{"value":null,"series":[],"named":{}}`, new Reading(), new JsonLimits(), false);
  t.eqI32("number: null for a JsonNumber that is not | null", nul.failed, JSON_DECODE_TYPE);
  const obj = jtDecode(`{"value":{},"series":[],"named":{}}`, new Reading(), new JsonLimits(), false);
  t.eqI32("number: an object", obj.failed, JSON_DECODE_TYPE);
  // Its text is bounded by the tokenizer's number limit, as every number is.
  const limits = new JsonLimits();
  limits.maxNumberBytes = 4;
  const long = jtDecode(`{"value":12345,"series":[],"named":{}}`, new Reading(), limits, false);
  t.ok("number: past maxNumberBytes is the tokenizer's error", long.failed < 0 && long.failed !== JSON_DECODE_TYPE);

  // Decoded again into the same numbers, nothing grows. A map's values are
  // new for each key, so this input's map is empty.
  const src = jtBytes(`{"value":123456789012345678901234567890,"backup":1.5,"series":[18446744073709551616,1E+400],"named":{}}`);
  const dec = new JsonDecoder(src, 0, toI32(src.length), new JsonLimits());
  const kept = new Reading();
  jsonDecode(dec, kept);
  const before = Arena.used();
  let failed: i32 = 0;
  for (let i: i32 = 0; i < 1000; i += 1) {
    dec.reset(src, 0, toI32(src.length));
    failed = failed + jsonDecode(dec, kept);
  }
  t.eqI32("number: 1,000 decodes into one Reading succeed", failed, 0);
  t.eqI64("number: Arena.used() is flat over them", Arena.used() - before, toI64(0));
};

/** The module `renamed.ll` pins, run: what its golden says it does, it does. */
const jtRenamed = (t: Suite): void => {
  const src = jtBytes(`{"amount":1e999,"user_id":-4}`);
  const r = new Renamed();
  t.eqI32("renamed: decodes", renamedDecode(new JsonDecoder(src, 0, toI32(src.length), new JsonLimits()), r), 0);
  const w = new JsonWriter(new Array<u8>(64), 0);
  renamedEncode(w, r);
  t.eqStr("renamed: encodes, tries at its initializer", w.text(), `{"amount":1e999,"user_id":-4,"tries":3}`);
};

export const jtOptionsChecks = (t: Suite): void => {
  jtRenames(t);
  jtOptional(t);
  jtNumbers(t);
  jtRenamed(t);
};

/**
 * `--round-trip-options <file>`: each line decoded into a `Reading` and
 * encoded back, or `error <code>`. `tests/run.js` holds each line to
 * `JSON.stringify(JSON.parse(line))` with every number kept as its source.
 */
export const jtOptionsRoundTripFile = (path: string): i32 => {
  for (const line of splitLines(readFileSync(path))) {
    if (line.length === 0) {
      continue;
    }
    const r = new Reading();
    const d = jtDecode(line, r, new JsonLimits(), false);
    console.log(d.failed === 0 ? jtEncode(r, 65536) : `error ${d.failed}`);
  }
  return 0;
};
