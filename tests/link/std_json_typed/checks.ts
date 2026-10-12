// The suite: round trips, every decoding error and the byte it is reported at,
// the tokenizer's limits through the decoder, reuse with a flat arena, and
// the encodings that end in the writer's sticky code.
import {
  JSON_WRITE_FULL,
  JSON_WRITE_TOO_DEEP,
  JsonWriter,
} from "nish/json";
import {
  JSON_TOK_ERR_DEPTH,
  JSON_TOK_ERR_NUMBER_LIMIT,
  JSON_TOK_ERR_STRING_LIMIT,
  JSON_TOK_ERR_SYNTAX,
  JSON_TOK_ERR_TOTAL_LIMIT,
  JSON_TOK_ERR_TRAILING,
  JSON_TOK_ERR_TRUNCATED,
  JSON_TOK_ERR_UTF8,
  JsonLimits,
} from "nish/json-tokenizer";
import {
  JSON_DECODE_DUPLICATE,
  JSON_DECODE_MISSING,
  JSON_DECODE_OK,
  JSON_DECODE_RANGE,
  JSON_DECODE_TYPE,
  JSON_DECODE_UNKNOWN,
  JsonDecoder,
  jsonDecode,
  jsonEncode,
} from "nish/json-typed";
import { splitLines } from "nish/text";
import { Suite } from "nish/testing";
import { Chain, Lists, Match, Player, Scalars, Team } from "./models.ts";

/** The bytes of `s`, as the decoder reads them. */
const jtBytes = (s: string): u8[] => {
  const out = new Array<u8>(toI32(s.length));
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(s.length); i += 1) {
    out[i] = toU8(s.charCodeAt(i));
  }
  return out;
};

/** A decoder over `text`, after decoding it into `out`; its `failed` and `errorAt` are the answer. */
const jtDecode = <T>(text: string, out: T, limits: JsonLimits, ignoreUnknown: boolean): JsonDecoder => {
  const src = jtBytes(text);
  const d = new JsonDecoder(src, 0, toI32(src.length), limits);
  d.ignoreUnknown = ignoreUnknown;
  jsonDecode(d, out);
  return d;
};

/** `value` encoded, or `error <code>` when the writer failed. */
const jtEncode = <T>(value: T, size: i32): string => {
  const w = new JsonWriter(new Array<u8>(size), 0);
  jsonEncode(w, value);
  return w.failed === 0 ? w.text() : `error ${w.failed}`;
};

/** Decode `text` into a fresh `Team` and check the code. */
const jtNested = (t: Suite, name: string, text: string, code: i32): void => {
  const d = jtDecode(text, new Team(), new JsonLimits(), false);
  t.eqI32(`nested: ${name}`, d.failed, code);
};

/** Decode `text` into a fresh `Scalars` and check the code and the byte. */
const jtScalarError = (t: Suite, name: string, text: string, code: i32, at: i32): void => {
  const d = jtDecode(text, new Scalars(), new JsonLimits(), false);
  t.eqI32(`${name}: code`, d.failed, code);
  t.eqI32(`${name}: errorAt`, d.errorAt, at);
};

const FULL: string =
  `{"id":42,"live":true,"title":"Final","home":{"id":7,"players":[{"name":"Ann","score":3,"rating":1.5,"tags":["a","b"]},` +
  `{"name":"Bo","score":-1,"rating":0,"tags":[]}],"captain":{"name":"Ann","score":3,"rating":1.5,"tags":[]}},` +
  `"away":null,"scores":[1,2,3],"odds":[1.25,-0.5],"flags":[true,false],"ids":[0,4294967295],` +
  `"big":[-9223372036854775808,9223372036854775807],"notes":null}`;

const SCALARS: string = `{"a":1,"b":2,"c":3,"d":4,"e":true,"f":"x"}`;

const jtRoundTrips = (t: Suite): void => {
  const m = new Match();
  const d = jtDecode(FULL, m, new JsonLimits(), false);
  t.eqI32("full: decodes", d.failed, JSON_DECODE_OK);
  t.eqStr("full: encodes back to the same text", jtEncode(m, 4096), FULL);
  const home = m.home;
  t.eqI32("full: two players", toI32(home.players.length), 2);
  const captain = home.captain;
  t.ok("full: the captain is an object of its own", captain !== null);

  // Keys in any order; the encoding is in declaration order.
  const s = new Scalars();
  const e = jtDecode(`{"f":"y","e":false,"d":-0.25,"c":-3,"b":4294967295,"a":-2147483648}`, s, new JsonLimits(), false);
  t.eqI32("any order: decodes", e.failed, JSON_DECODE_OK);
  t.eqStr("any order: declaration order", jtEncode(s, 256), `{"a":-2147483648,"b":4294967295,"c":-3,"d":-0.25,"e":false,"f":"y"}`);

  // Escapes are decoded, UTF-8 passes through, and the writer escapes again.
  const p = new Player();
  const pe = jtDecode(
    `{"name":"\\u00e9\\n\\"q\\" \\ud83d\\ude00","score":0,"rating":-0,"tags":["\\/"]}`,
    p,
    new JsonLimits(),
    false
  );
  t.eqI32("escapes: decodes", pe.failed, JSON_DECODE_OK);
  t.eqI32("escapes: the name is its UTF-8 bytes", toI32(p.name.length), 11);
  t.eqStr("escapes: encoded as JSON.stringify writes it", jtEncode(p, 256), `{"name":"é\\n\\"q\\" 😀","score":0,"rating":0,"tags":["/"]}`);

  // A number past the double range is an infinity, which JSON writes as null.
  const big = new Scalars();
  jtDecode(`{"a":0,"b":0,"c":0,"d":1e400,"e":false,"f":""}`, big, new JsonLimits(), false);
  t.eqStr("1e400: Infinity, written as null", jtEncode(big, 256), `{"a":0,"b":0,"c":0,"d":null,"e":false,"f":""}`);
};

const jtReuse = (t: Suite): void => {
  const m = new Match();
  jtDecode(FULL, m, new JsonLimits(), false);
  const home = m.home;
  const first = home.players[0];
  const smaller =
    `{"id":1,"live":false,"title":null,"home":{"id":8,"players":[{"name":"Cy","score":9,"rating":2,"tags":["z"]}],"captain":null},` +
    `"away":{"id":9,"players":[],"captain":{"name":"D","score":0,"rating":0,"tags":[]}},"scores":[],"odds":null,` +
    `"flags":[],"ids":[],"big":[],"notes":["n"]}`;
  const d = jtDecode(smaller, m, new JsonLimits(), false);
  t.eqI32("reuse: decodes into the same object", d.failed, JSON_DECODE_OK);
  t.eqStr("reuse: what is left is the new text", jtEncode(m, 4096), smaller);
  t.eqI32("reuse: the array of players shrank", toI32(m.home.players.length), 1);
  t.ok("reuse: the first player is the same object", m.home.players[0] === first);
  t.ok("reuse: the home team is the same object", m.home === home);
  const back = jtDecode(FULL, m, new JsonLimits(), false);
  t.eqI32("reuse: and back", back.failed, JSON_DECODE_OK);
  t.eqStr("reuse: back to the first text", jtEncode(m, 4096), FULL);

  // Decoding the same text into the same object allocates nothing: every
  // string is equal to the one the field holds, and every array and object
  // is already there.
  const src = jtBytes(FULL);
  const dec = new JsonDecoder(src, 0, toI32(src.length), new JsonLimits());
  jsonDecode(dec, m);
  const before = Arena.used();
  let failed: i32 = 0;
  for (let i: i32 = 0; i < 1000; i += 1) {
    dec.reset(src, 0, toI32(src.length));
    failed = failed + jsonDecode(dec, m);
  }
  t.eqI32("reuse: 1,000 decodes all succeed", failed, 0);
  t.eqI64("reuse: Arena.used() is flat over 1,000 decodes into one object", Arena.used() - before, toI64(0));

  // A string that changes is a new string each time, and only that: the
  // bytes it was decoded through are given back at the call.
  const s = new Scalars();
  const texts: u8[][] = [];
  const pad: string[] = [];
  for (let i: i32 = 0; i < 200; i += 1) {
    pad.push("x");
  }
  for (let i: i32 = 0; i < 10; i += 1) {
    texts.push(jtBytes(`{"a":0,"b":0,"c":0,"d":0,"e":false,"f":"${i}${pad.join("")}"}`));
  }
  const first10 = texts[0];
  const sd = new JsonDecoder(first10, 0, toI32(first10.length), new JsonLimits());
  const start = Arena.used();
  for (let i: i32 = 0; i < 100; i += 1) {
    const text = texts[i % 10];
    sd.reset(text, 0, toI32(text.length));
    jsonDecode(sd, s);
  }
  const grown = Arena.used() - start;
  // 100 strings of 201 bytes with their 8-byte length and a terminator, rounded to 8.
  t.ok(`reuse: 100 changed strings keep only the strings (${grown} bytes)`, grown <= toI64(100) * toI64(216));
};

const jtErrors = (t: Suite): void => {
  // The byte is the start of the token the error was found at.
  jtScalarError(t, "a string for an i32", `{"a":"1","b":2,"c":3,"d":4,"e":true,"f":"x"}`, JSON_DECODE_TYPE, 5);
  jtScalarError(t, "a fraction for an i32", `{"a":1.5,"b":2,"c":3,"d":4,"e":true,"f":"x"}`, JSON_DECODE_RANGE, 5);
  jtScalarError(t, "an exponent for an i32", `{"a":1e2,"b":2,"c":3,"d":4,"e":true,"f":"x"}`, JSON_DECODE_RANGE, 5);
  jtScalarError(t, "2^31 for an i32", `{"a":2147483648,"b":2,"c":3,"d":4,"e":true,"f":"x"}`, JSON_DECODE_RANGE, 5);
  jtScalarError(t, "-2^31 - 1 for an i32", `{"a":-2147483649,"b":2,"c":3,"d":4,"e":true,"f":"x"}`, JSON_DECODE_RANGE, 5);
  jtScalarError(t, "-2^63 - 1 for an i64", `{"a":1,"b":2,"c":-9223372036854775809,"d":4,"e":true,"f":"x"}`, JSON_DECODE_RANGE, 17);
  jtScalarError(t, "-1 for a u32", `{"a":1,"b":-1,"c":3,"d":4,"e":true,"f":"x"}`, JSON_DECODE_RANGE, 11);
  jtScalarError(t, "2^32 for a u32", `{"a":1,"b":4294967296,"c":3,"d":4,"e":true,"f":"x"}`, JSON_DECODE_RANGE, 11);
  jtScalarError(t, "2^63 for an i64", `{"a":1,"b":2,"c":9223372036854775808,"d":4,"e":true,"f":"x"}`, JSON_DECODE_RANGE, 17);
  jtScalarError(t, "true for an f64", `{"a":1,"b":2,"c":3,"d":true,"e":true,"f":"x"}`, JSON_DECODE_TYPE, 23);
  jtScalarError(t, "1 for a boolean", `{"a":1,"b":2,"c":3,"d":4,"e":1,"f":"x"}`, JSON_DECODE_TYPE, 29);
  jtScalarError(t, "a number for a string", `{"a":1,"b":2,"c":3,"d":4,"e":true,"f":7}`, JSON_DECODE_TYPE, 38);
  jtScalarError(t, "null for a string that is not | null", `{"a":1,"b":2,"c":3,"d":4,"e":true,"f":null}`, JSON_DECODE_TYPE, 38);
  jtScalarError(t, "an array for an i32", `{"a":[1],"b":2,"c":3,"d":4,"e":true,"f":"x"}`, JSON_DECODE_TYPE, 5);
  jtScalarError(t, "an unknown key", `{"a":1,"zz":0,"b":2,"c":3,"d":4,"e":true,"f":"x"}`, JSON_DECODE_UNKNOWN, 7);
  jtScalarError(t, "a duplicate key", `{"a":1,"b":2,"a":1,"c":3,"d":4,"e":true,"f":"x"}`, JSON_DECODE_DUPLICATE, 13);
  jtScalarError(t, "a missing key", `{"a":1,"b":2,"c":3,"d":4,"e":true}`, JSON_DECODE_MISSING, 33);
  jtScalarError(t, "an empty object", `{}`, JSON_DECODE_MISSING, 1);
  jtScalarError(t, "an array at the top", `[]`, JSON_DECODE_TYPE, 0);
  jtScalarError(t, "null at the top", `null`, JSON_DECODE_TYPE, 0);
  jtScalarError(t, "a syntax error", `{"a" 1}`, JSON_TOK_ERR_SYNTAX, 5);
  jtScalarError(t, "a truncated object", `{"a":1,`, JSON_TOK_ERR_TRUNCATED, 7);
  jtScalarError(t, "a second value after the object", `${SCALARS} 1`, JSON_TOK_ERR_TRAILING, 43);
  jtScalarError(t, "an empty input", "", JSON_TOK_ERR_TRUNCATED, 0);

  // The same rules at every depth: in a nested object, in an array's
  // element, and in a `| null` field's object.
  jtNested(t, "an unknown key in an element", `{"id":1,"players":[{"name":"a","score":1,"rating":1,"tags":[],"x":1}],"captain":null}`, JSON_DECODE_UNKNOWN);
  jtNested(t, "a duplicate key in an element", `{"id":1,"players":[{"name":"a","name":"b","score":1,"rating":1,"tags":[]}],"captain":null}`, JSON_DECODE_DUPLICATE);
  jtNested(t, "a missing key in an element", `{"id":1,"players":[{"name":"a","score":1,"tags":[]}],"captain":null}`, JSON_DECODE_MISSING);
  jtNested(t, "a wrong type in an element", `{"id":1,"players":[{"name":"a","score":"1","rating":1,"tags":[]}],"captain":null}`, JSON_DECODE_TYPE);
  jtNested(t, "a missing key in a | null object", `{"id":1,"players":[],"captain":{"name":"a","score":1,"rating":1}}`, JSON_DECODE_MISSING);
  jtNested(t, "an element that is not an object", `{"id":1,"players":[1],"captain":null}`, JSON_DECODE_TYPE);
  jtNested(t, "an object where the array is", `{"id":1,"players":{},"captain":null}`, JSON_DECODE_TYPE);
  jtNested(t, "a string in an array of strings that is a number", `{"id":1,"players":[{"name":"a","score":1,"rating":1,"tags":[1]}],"captain":null}`, JSON_DECODE_TYPE);
  jtNested(t, "null for an array that is not | null", `{"id":1,"players":null,"captain":null}`, JSON_DECODE_TYPE);

  // An error is sticky: the decoder answers it again, from the same byte, until `reset`.
  const src = jtBytes(`{"a":"1"}`);
  const d = new JsonDecoder(src, 0, toI32(src.length), new JsonLimits());
  const s = new Scalars();
  t.eqI32("sticky: the first decode fails", jsonDecode(d, s), JSON_DECODE_TYPE);
  t.eqI32("sticky: a second decode answers the same code", jsonDecode(d, s), JSON_DECODE_TYPE);
  t.eqI32("sticky: at the same byte", d.errorAt, 5);
  const ok = jtBytes(SCALARS);
  d.reset(ok, 0, toI32(ok.length));
  t.eqI32("sticky: reset clears it", jsonDecode(d, s), JSON_DECODE_OK);

  // `ignoreUnknown` steps over a key and all of its value, whatever it holds,
  // and still refuses a duplicate of a field.
  const skip = jtDecode(
    `{"zz":{"a":[1,{"b":[]}],"c":null},"a":1,"b":2,"zz":[],"c":3,"d":4,"e":true,"f":"x","yy":"tail"}`,
    new Scalars(),
    new JsonLimits(),
    true
  );
  t.eqI32("ignoreUnknown: unknown keys and their values are stepped over", skip.failed, JSON_DECODE_OK);
  const dup = jtDecode(`{"a":1,"zz":0,"a":2}`, new Scalars(), new JsonLimits(), true);
  t.eqI32("ignoreUnknown: a duplicate field is still refused", dup.failed, JSON_DECODE_DUPLICATE);
  const bad = jtDecode(`{"zz":[1,}`, new Scalars(), new JsonLimits(), true);
  t.eqI32("ignoreUnknown: what is stepped over is still checked", bad.failed, JSON_TOK_ERR_SYNTAX);
};

const jtLimits = (t: Suite): void => {
  const depth = new JsonLimits();
  depth.maxDepth = 3;
  // Match, home, players and a player are four containers deep.
  t.eqI32("limits: depth", jtDecode(FULL, new Match(), depth, false).failed, JSON_TOK_ERR_DEPTH);
  const text = new JsonLimits();
  text.maxStringBytes = 4;
  t.eqI32("limits: a string's bytes", jtDecode(FULL, new Match(), text, false).failed, JSON_TOK_ERR_STRING_LIMIT);
  const number = new JsonLimits();
  number.maxNumberBytes = 10;
  t.eqI32("limits: a number's bytes", jtDecode(FULL, new Match(), number, false).failed, JSON_TOK_ERR_NUMBER_LIMIT);
  const total = new JsonLimits();
  total.maxTotalBytes = 100;
  t.eqI32("limits: the whole input", jtDecode(FULL, new Match(), total, false).failed, JSON_TOK_ERR_TOTAL_LIMIT);
  // A thousand nested objects, refused at the default depth with no recursion past it.
  const parts: string[] = [];
  for (let i: i32 = 0; i < 1000; i += 1) {
    parts.push(`{"id":1,"links":[],"next":`);
  }
  t.eqI32("limits: a depth bomb", jtDecode(parts.join(""), new Chain(), new JsonLimits(), false).failed, JSON_TOK_ERR_DEPTH);
  // Bytes that are not UTF-8 are the tokenizer's to refuse.
  const raw = jtBytes(`{"a":1,"b":2,"c":3,"d":4,"e":true,"f":"?"}`);
  raw[39] = toU8(255);
  const d = new JsonDecoder(raw, 0, toI32(raw.length), new JsonLimits());
  t.eqI32("limits: invalid UTF-8", jsonDecode(d, new Scalars()), JSON_TOK_ERR_UTF8);
};

const jtEncodings = (t: Suite): void => {
  const c = new Chain();
  t.eqStr("encode: a chain", jtEncode(c, 64), `{"id":0,"next":null,"links":[]}`);
  t.eqStr("encode: a buffer too small is the writer's code", jtEncode(c, 10), `error ${JSON_WRITE_FULL}`);
  c.next = c;
  t.eqStr("encode: an object that holds itself ends at the writer's depth", jtEncode(c, 100000), `error ${JSON_WRITE_TOO_DEEP}`);
  const l = new Chain();
  l.links.push(l);
  t.eqStr("encode: and through an array", jtEncode(l, 100000), `error ${JSON_WRITE_TOO_DEEP}`);
  const m = new Match();
  const notes: string[] = ["a\tb", ""];
  m.notes = notes;
  m.title = "t";
  t.eqStr(
    "encode: a new Match",
    jtEncode(m, 1024),
    `{"id":0,"live":false,"title":"t","home":{"id":0,"players":[],"captain":null},"away":null,"scores":[],` +
      `"odds":null,"flags":[],"ids":[],"big":[],"notes":["a\\tb",""]}`
  );
};

/**
 * An encoding only reads the object and keeps nothing it allocates, so it may
 * run inside a `using a = arena()` block, which releases what the writer's
 * calls allocated at the end of each pass. A decoding there is refused
 * (`tests/cases/json_reject_arena_block`).
 */
const jtEncodeInArena = (t: Suite): void => {
  const m = new Match();
  jtDecode(FULL, m, new JsonLimits(), false);
  const w = new JsonWriter(new Array<u8>(4096), 0);
  let same: i32 = 0;
  for (let i: i32 = 0; i < 3; i += 1) {
    using a = arena();
    w.reset(w.buf, 0);
    jsonEncode(w, m);
    if (w.text() === FULL) {
      same += 1;
    }
  }
  t.eqI32("encode: inside a using arena() block, every pass writes the same text", same, 3);
};

/** Decode `text` into a fresh `Lists` and check the code and the byte. */
const jtListsError = (t: Suite, name: string, text: string, code: i32, at: i32): void => {
  const d = jtDecode(text, new Lists(), new JsonLimits(), false);
  t.eqI32(`${name}: code`, d.failed, code);
  t.eqI32(`${name}: errorAt`, d.errorAt, at);
};

/**
 * The paths a flat class does not reach: an array of objects that may be
 * `null`, `null` inside an array, and keys `ignoreUnknown` steps over inside
 * an array's element and inside a `| null` field's object, with the values
 * after each one held.
 */
const jtNestedPaths = (t: Suite): void => {
  const l = new Lists();
  const absent = `{"xs":[1],"members":null}`;
  t.eqI32("| null array of objects: null decodes", jtDecode(absent, l, new JsonLimits(), false).failed, JSON_DECODE_OK);
  t.eqStr("| null array of objects: null encodes", jtEncode(l, 256), absent);
  const present = `{"xs":[],"members":[{"name":"a","score":1,"rating":0.5,"tags":["t"]},{"name":"b","score":2,"rating":0,"tags":[]}]}`;
  t.eqI32("| null array of objects: an array decodes into the null field", jtDecode(present, l, new JsonLimits(), false).failed, JSON_DECODE_OK);
  t.eqStr("| null array of objects: and encodes", jtEncode(l, 512), present);
  const one = `{"xs":[3],"members":[{"name":"c","score":3,"rating":1,"tags":[]}]}`;
  t.eqI32("| null array of objects: a shorter array decodes into the array it holds", jtDecode(one, l, new JsonLimits(), false).failed, JSON_DECODE_OK);
  t.eqStr("| null array of objects: what is left is the shorter one", jtEncode(l, 512), one);
  t.eqI32("| null array of objects: and back to null", jtDecode(absent, l, new JsonLimits(), false).failed, JSON_DECODE_OK);
  t.eqStr("| null array of objects: null again", jtEncode(l, 256), absent);

  jtListsError(t, "null in an array of i32", `{"xs":[1,null],"members":null}`, JSON_DECODE_TYPE, 9);
  jtListsError(t, "null in an array of objects", `{"xs":[],"members":[null]}`, JSON_DECODE_TYPE, 20);
  jtListsError(
    t,
    "null in an array of strings",
    `{"xs":[],"members":[{"name":"a","score":1,"rating":0,"tags":[null]}]}`,
    JSON_DECODE_TYPE,
    61
  );

  const team = new Team();
  const d = jtDecode(
    `{"id":5,"players":[{"zz":[1,{"q":2}],"name":"p","score":7,"yy":null,"rating":2,"tags":["k"]}],` +
      `"captain":{"name":"c","xx":{},"score":8,"rating":3,"tags":[],"ww":"tail"}}`,
    team,
    new JsonLimits(),
    true
  );
  t.eqI32("ignoreUnknown: keys stepped over in an element and in a | null object", d.failed, JSON_DECODE_OK);
  t.eqStr(
    "ignoreUnknown: every key after a skipped one is still read",
    jtEncode(team, 512),
    `{"id":5,"players":[{"name":"p","score":7,"rating":2,"tags":["k"]}],"captain":{"name":"c","score":8,"rating":3,"tags":[]}}`
  );
};

/** The suite. */
export const jtChecks = (): i32 => {
  const t = new Suite("std_json_typed");
  jtRoundTrips(t);
  jtReuse(t);
  jtErrors(t);
  jtLimits(t);
  jtEncodings(t);
  jtEncodeInArena(t);
  jtNestedPaths(t);
  return t.done();
};

/**
 * `--round-trip <file>`: each line of the file decoded into a `Match` and
 * encoded back, one line apiece, or `error <code>`. `tests/run.js` holds the
 * lines to `JSON.stringify(JSON.parse(line))`.
 */
export const jtRoundTripFile = (path: string): i32 => {
  for (const line of splitLines(readFileSync(path))) {
    if (line.length === 0) {
      continue;
    }
    const m = new Match();
    const d = jtDecode(line, m, new JsonLimits(), false);
    console.log(d.failed === 0 ? jtEncode(m, 65536) : `error ${d.failed}`);
  }
  return 0;
};

class BenchHello {
  message: string = "";
}

/**
 * `--bench <n>`: decode `{"message":"Hello, World! 000000"}` `n` times, its
 * six digits the iteration's, into one reused object, and print a checksum of
 * what was decoded and the nanoseconds per decode. The digits change every
 * time, so the decode cannot be hoisted, and every decoded string is folded
 * into the checksum, so it cannot be dropped.
 */
export const jtBench = (n: i32): i32 => {
  const src = jtBytes(`{"message":"Hello, World! 000000"}`);
  const d = new JsonDecoder(src, 0, toI32(src.length), new JsonLimits());
  const h = new BenchHello();
  let sum: i32 = 0;
  const start = monotonicNanos();
  for (let i: i32 = 0; i < n; i += 1) {
    let v: i32 = i;
    for (let k: i32 = 31; k >= 26 && k < toI32(src.length); k -= 1) {
      src[k] = toU8(48 + (v % 10));
      v = toI32(v / 10);
    }
    d.reset(src, 0, toI32(src.length));
    sum = (sum * 31 + jsonDecode(d, h) + toI32(h.message.length) + toI32(h.message.charCodeAt(19))) % 1000003;
  }
  const took = monotonicNanos() - start;
  console.log(`checksum ${sum} ns/op ${toF64(took) / toF64(n)}`);
  return 0;
};
