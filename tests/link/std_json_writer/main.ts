// `JsonWriter` from `nish/json`: every value kind, every escape, the number
// edges `JSON.stringify` decides, every `JSON_WRITE_*` code, a full buffer at
// every length, the two portability edges, and an arena that stays flat over
// 10,000 writes into one reused buffer; and the two modes, indented and
// strict, with the same edges.
//
// The expected texts are the ones `JSON.stringify` answers for the same value.
// `node.ts` beside this file is the ASCII, i64-free half of them, which
// `tests/run.js` runs natively and under Node and holds to `JSON.stringify`
// itself, so the spellings here are not only this file's say-so.
import {
  JSON_WRITE_BAD_WINDOW,
  JSON_WRITE_DONE,
  JSON_WRITE_FULL,
  JSON_WRITE_KEY_EXPECTED,
  JSON_WRITE_NON_FINITE,
  JSON_WRITE_OK,
  JSON_WRITE_TOO_DEEP,
  JSON_WRITE_UNBALANCED,
  JSON_WRITE_VALUE_EXPECTED,
  JSON_WRITER_MAX_DEPTH,
  JsonWriter,
  jsonStringifyString,
} from "nish/json";
import { jsonEncode } from "nish/json-typed";
import { Suite } from "nish/testing";

/** A class `jsonEncode` writes, to show that the code it writes goes through the writer's modes. */
class Pair {
  name: string = "a";
  values: i32[];
  constructor() {
    this.values = [1, 2];
  }
}

/** A class with an `f64` field, for `jsonEncode` through a strict writer. */
class Reading {
  value: f64 = 0;
}

/** The arena's chunk, which `Arena.used()` counts within (runtime/runtime.c, `nish_arena_grow`). */
const LB_CHUNK: i64 = 65536;

/**
 * What the measured calls keep in the arena, summed over the calls measured:
 * `tests/link/net_loopback/common.ts`'s meter, copied. Plain, it adds how far
 * `Arena.used()` moved across each call. Fresh, it starts each call at the
 * head of a chunk of its own — a 70,000-byte filler takes a chunk to itself,
 * and a 4 KiB probe opens the next — and reads `Arena.mark()` as well, so a
 * call that spills into another chunk is counted too.
 */
class LbMeter {
  kept: i64 = 0;
  startMark: i64 = 0;
  startUsed: i64 = 0;
  /** The current call's filler and probe, held here so they live until `end`. */
  filler: u8[];
  probe: u8[];
  fresh: boolean = false;

  constructor(fresh: boolean) {
    this.fresh = fresh;
    this.filler = [];
    this.probe = [];
  }

  /** Before a measured call: when fresh, the filler and probe that start it at the head of a chunk of its own. */
  begin(): void {
    if (this.fresh) {
      this.filler = new Array<u8>(70000);
      this.probe = new Array<u8>(4096);
    }
    this.startMark = Arena.mark();
    this.startUsed = Arena.used();
  }

  /** After it: counts what the call kept. */
  end(): void {
    const used: i64 = Arena.used();
    const moved: i64 = Arena.mark() - this.startMark;
    if (!this.fresh || moved === used - this.startUsed) {
      this.kept = this.kept + (used - this.startUsed);
    } else {
      this.kept = this.kept + (LB_CHUNK - this.startUsed) + used;
    }
  }
}

/** The hello object, `{"message":"Hello, World!"}`, the TechEmpower `/json` body, with `message` its text. */
const writeHello = (w: JsonWriter, message: string): void => {
  w.beginObject();
  w.key("message");
  w.string(message);
  w.endObject();
};

/** One byte as a string, so an expected text can spell a byte that is not ASCII. */
const byte = (code: i32): string => String.fromCharCode(code);

/** `s` written alone into a fresh writer, as text. */
const stringText = (s: string): string => {
  const w = new JsonWriter(new Array<u8>(256), 0);
  w.string(s);
  return w.text();
};

/** `v` written alone into a fresh writer, as text. */
const f64Text = (v: f64): string => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  w.f64(v);
  return w.text();
};

/** `v` written alone into a fresh writer, as text. */
const i64Text = (v: i64): string => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  w.i64(v);
  return w.text();
};

/** `v` written alone into a fresh writer, as text. */
const i32Text = (v: i32): string => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  w.i32(v);
  return w.text();
};

/** `v` written alone into a fresh writer, as text. */
const u32Text = (v: u32): string => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  w.u32(v);
  return w.text();
};

/**
 * Whether a writer that failed holds still: another call of every kind leaves
 * `failed` and `end` as they were.
 */
const stuck = (w: JsonWriter): boolean => {
  const failed = w.failed;
  const end = w.end;
  const bytes: u8[] = [49];
  w.beginObject();
  w.endObject();
  w.beginArray();
  w.endArray();
  w.key("k");
  w.string("s");
  w.i32(1);
  w.u32(toU32(1));
  w.i64(toI64(1));
  w.f64(toF64(1));
  w.boolean(true);
  w.nullValue();
  w.raw(bytes, 0, 1);
  return w.failed === failed && w.end === end;
};

/** `{"a":[],"b":{},"c":[1,{"d":true}]}`: empty and full containers, nested both ways. */
const writeNested = (w: JsonWriter): void => {
  w.beginObject();
  w.key("a");
  w.beginArray();
  w.endArray();
  w.key("b");
  w.beginObject();
  w.endObject();
  w.key("c");
  w.beginArray();
  w.i32(1);
  w.beginObject();
  w.key("d");
  w.boolean(true);
  w.endObject();
  w.endArray();
  w.endObject();
};

/** The tab indent, which `prefixAtEveryLength` takes as an `indent` of -1. */
const TAB: i32 = -1;

/**
 * Every buffer length from 0 to one short of what the value needs — the
 * hello object, or `writeNested`'s when `nested` — written at `indent`
 * spaces, or a tab for `TAB`: the first length that fails some other way
 * than `JSON_WRITE_FULL`, that moves the cursor past the buffer, or that
 * leaves bytes that are not a prefix of `want`, as one line; `""` when every
 * length fails cleanly.
 */
const prefixAtEveryLength = (want: string, indent: i32, nested: boolean): string => {
  const n: i32 = toI32(want.length);
  for (let len: i32 = 0; len < n; len += 1) {
    const buf = new Array<u8>(len);
    const w = new JsonWriter(buf, 0);
    if (indent === TAB) {
      w.setIndentTab();
    } else {
      w.setIndent(indent);
    }
    if (nested) {
      writeNested(w);
    } else {
      writeHello(w, "Hello, World!");
    }
    if (w.failed !== JSON_WRITE_FULL) {
      return `length ${len}: failed is ${w.failed}`;
    }
    if (w.end < 0 || w.end > len) {
      return `length ${len}: the cursor is at ${w.end}`;
    }
    const got = w.text();
    if (got !== want.substring(0, toI32(got.length))) {
      return `length ${len}: wrote ${got}`;
    }
  }
  return "";
};

/**
 * The kind of the container opened at depth `d` (from 0) by `openMixed`: an
 * array when `d % 3 === 1`, an object otherwise. The kinds then differ on
 * either side of the 32nd level, where the kind stack moves from one word
 * to the next, and at every level something other than a neighbour's kind
 * has to come back off it.
 */
const objectAt = (d: i32): boolean => d % 3 !== 1;

/** Opens `n` containers of `objectAt`'s kinds, each object with the key `k` before its child. */
const openMixed = (w: JsonWriter, n: i32): void => {
  for (let d: i32 = 0; d < n; d += 1) {
    if (objectAt(d)) {
      w.beginObject();
      w.key("k");
    } else {
      w.beginArray();
    }
  }
};

/** Closes the containers `openMixed` opened, from depth `from` back to depth `to`, each with its own closer. */
const closeMixed = (w: JsonWriter, from: i32, to: i32): void => {
  for (let d: i32 = from - 1; d >= to; d -= 1) {
    if (objectAt(d)) {
      w.endObject();
    } else {
      w.endArray();
    }
  }
};

/** `openMixed(n)`, the value `1`, then `closeMixed(n, 0)`: the text `JSON.stringify` writes for that value. */
const writeMixed = (w: JsonWriter, n: i32): void => {
  openMixed(w, n);
  w.i32(1);
  closeMixed(w, n, 0);
};

/**
 * For each depth `t` from 1 to `JSON_WRITER_MAX_DEPTH`: the writer opens the
 * full 64 levels, writes a value, closes back to depth `t` with the right
 * closer each time, and is then given the wrong closer for depth `t`, which
 * must be `JSON_WRITE_UNBALANCED` and write nothing. That reads the innermost
 * kind after every number of pops, across the words' boundary both ways.
 * Answers the first depth that went wrong, or 0.
 */
const mixedKindsAtEveryDepth = (w: JsonWriter, buf: u8[]): i32 => {
  for (let t: i32 = 1; t <= JSON_WRITER_MAX_DEPTH; t += 1) {
    w.reset(buf, 0);
    openMixed(w, JSON_WRITER_MAX_DEPTH);
    w.i32(1);
    closeMixed(w, JSON_WRITER_MAX_DEPTH, t);
    if (w.failed !== 0 || w.depth !== t) {
      return t;
    }
    const before: i32 = w.written();
    if (objectAt(t - 1)) {
      w.endArray();
    } else {
      w.endObject();
    }
    if (w.failed !== -3 || w.written() !== before) {
      return t;
    }
  }
  return 0;
};

/** `JSON_WRITER_MAX_DEPTH` empty arrays, each inside the last, opened and closed. */
const nestArrays = (w: JsonWriter): void => {
  for (let d: i32 = 0; d < JSON_WRITER_MAX_DEPTH; d += 1) {
    w.beginArray();
  }
  for (let d: i32 = 0; d < JSON_WRITER_MAX_DEPTH; d += 1) {
    w.endArray();
  }
};

/**
 * A value of `kind` written as the first element of an array, in a buffer of
 * `room` bytes, too short for it: whether the write is `JSON_WRITE_FULL` and
 * left the cursor just past the `[`.
 */
const fullAt = (kind: i32, room: i32): boolean => {
  const buf = new Array<u8>(room);
  const w = new JsonWriter(buf, 0);
  w.beginArray();
  const before = w.end;
  const bytes: u8[] = [49, 50, 51];
  const big: f64 = 1e21;
  if (kind === 0) {
    w.string("a\u0001");
  } else if (kind === 1) {
    w.i32(-123);
  } else if (kind === 2) {
    w.u32(toU32(0) - toU32(1));
  } else if (kind === 3) {
    w.i64(toI64(-12345));
  } else if (kind === 4) {
    w.f64(big);
  } else if (kind === 5) {
    w.boolean(false);
  } else if (kind === 6) {
    w.nullValue();
  } else if (kind === 7) {
    w.raw(bytes, 0, 3);
  } else if (kind === 8) {
    w.beginObject();
  } else {
    w.string("a\n");
  }
  return w.failed === JSON_WRITE_FULL && w.end === before;
};

export const main = (): number => {
  const t = new Suite("json-writer");

  // ---- The hello object, byte for byte ----------------------------------------
  const hello = '{"message":"Hello, World!"}';
  const out = new Array<u8>(64);
  const w = new JsonWriter(out, 0);
  writeHello(w, "Hello, World!");
  t.eqStr("the hello object is the TechEmpower /json body", w.text(), hello);
  t.eqI32("and written() counts its 27 bytes", w.written(), 27);
  t.ok("and it is complete", w.complete());
  let same = true;
  for (let k: i32 = 0; k < 27 && k < toI32(out.length) && k < toI32(hello.length); k += 1) {
    if (toI32(out[k]) !== toI32(hello.charCodeAt(k))) {
      same = false;
    }
  }
  t.ok("and the buffer holds exactly those bytes", same);

  // ---- Every value kind, in one array -----------------------------------------
  const one: f64 = 1.5;
  const lo: i64 = -9007199254740992;
  const raw: u8[] = [123, 34, 120, 34, 58, 49, 125];
  w.reset(out, 0);
  t.eqI32("reset starts the text over", w.written(), 0);
  w.beginArray();
  w.string("s");
  w.i32(-7);
  w.u32(toU32(7));
  w.i64(lo);
  w.f64(one);
  w.boolean(true);
  w.boolean(false);
  w.nullValue();
  w.raw(raw, 0, 7);
  w.endArray();
  t.eqStr("every value kind", w.text(), '["s",-7,7,-9007199254740992,1.5,true,false,null,{"x":1}]');
  t.ok("and the array is complete", w.complete());

  // ---- Containers ---------------------------------------------------------------
  w.reset(out, 0);
  w.beginObject();
  w.endObject();
  t.eqStr("an empty object", w.text(), "{}");
  t.ok("is complete", w.complete());
  w.reset(out, 0);
  w.beginArray();
  w.endArray();
  t.eqStr("an empty array", w.text(), "[]");
  w.reset(out, 0);
  w.beginArray();
  w.beginArray();
  w.endArray();
  w.beginObject();
  w.endObject();
  w.beginObject();
  w.key("a");
  w.beginArray();
  w.beginObject();
  w.endObject();
  w.i32(1);
  w.endArray();
  w.key("b");
  w.beginObject();
  w.key("c");
  w.nullValue();
  w.endObject();
  w.endObject();
  w.endArray();
  t.eqStr("nested empty and full containers", w.text(), '[[],{},{"a":[{},1],"b":{"c":null}}]');
  t.ok("close back to complete", w.complete());
  t.ok("a writer that has not written its value is not complete", !new JsonWriter(out, 0).complete());

  // A raw fragment stands where a value does: as a member's value, and as an
  // element after another.
  w.reset(out, 0);
  w.beginObject();
  w.key("r");
  w.raw(raw, 1, 3);
  w.key("s");
  w.beginArray();
  w.i32(0);
  w.raw(raw, 5, 1);
  w.raw(raw, 0, 0);
  w.endArray();
  w.endObject();
  t.eqStr("raw takes the window it is given, and a comma before it", w.text(), '{"r":"x","s":[0,1,]}');

  // ---- Strings -----------------------------------------------------------------
  t.eqStr(
    "the seven short escapes",
    stringText(`"\\${byte(8)}${byte(12)}\n\r\t`),
    '"\\"\\\\\\b\\f\\n\\r\\t"'
  );
  t.eqStr("a byte below 0x20 with no short form is \\u00xx", stringText(`a${byte(1)}b`), '"a\\u0001b"');
  t.eqStr("and 0x1f is \\u001f, in lower case", stringText(byte(31)), '"\\u001f"');
  t.eqStr("and 0x00 is \\u0000", stringText(byte(0)), '"\\u0000"');
  t.eqStr("0x7f goes through as itself", stringText(`a${byte(127)}`), `"a${byte(127)}"`);
  t.eqStr("and / is not escaped", stringText("a/b"), '"a/b"');
  t.eqStr("the empty string", stringText(""), '""');
  w.reset(out, 0);
  w.beginObject();
  w.key('k"\n');
  w.i32(1);
  w.endObject();
  t.eqStr("a key is escaped as a string is", w.text(), '{"k\\"\\n":1}');

  // WP33 class C: a string is UTF-8 bytes here and UTF-16 units under Node. A
  // non-ASCII string's bytes go through, which is the UTF-8 `JSON.stringify`
  // makes once Node encodes it; a lone 0xFF, which no Node string can hold,
  // goes through raw.
  const accented = `caf${byte(195)}${byte(169)}`;
  t.eqStr("UTF-8 goes through byte for byte", stringText(accented), `"${accented}"`);
  w.reset(out, 0);
  w.string(byte(255));
  t.eqI32("a string that is not UTF-8 is three bytes", w.written(), 3);
  t.eqI32("and its 0xFF byte is written raw", toI32(out[1]), 255);

  t.eqStr("jsonStringifyString quotes and escapes", jsonStringifyString(`a\t"${byte(1)}`), '"a\\t\\"\\u0001"');
  t.eqStr("jsonStringifyString of the empty string", jsonStringifyString(""), '""');
  t.eqStr("jsonStringifyString of a string with nothing to escape", jsonStringifyString("a/b c"), '"a/b c"');

  // ---- Numbers -----------------------------------------------------------------
  const negZero: f64 = -0.0;
  const big: f64 = 1e21;
  const small: f64 = 1e-7;
  const tenth: f64 = 0.1;
  const nan: f64 = toF64(0) / toF64(0);
  const inf: f64 = toF64(1) / toF64(0);
  const tiny: f64 = 5e-324;
  const huge: f64 = 1.7976931348623157e308;
  t.eqStr("f64 -0 is 0", f64Text(negZero), "0");
  t.eqStr("f64 1e21 is 1e+21", f64Text(big), "1e+21");
  t.eqStr("f64 1e-7 is 1e-7", f64Text(small), "1e-7");
  t.eqStr("f64 0.1 is 0.1", f64Text(tenth), "0.1");
  t.eqStr("f64 123 is 123", f64Text(toF64(123)), "123");
  t.eqStr("f64 the least subnormal", f64Text(tiny), "5e-324");
  t.eqStr("f64 the greatest finite", f64Text(huge), "1.7976931348623157e+308");
  t.eqStr("f64 NaN is null", f64Text(nan), "null");
  t.eqStr("f64 Infinity is null", f64Text(inf), "null");
  t.eqStr("f64 -Infinity is null", f64Text(-inf), "null");
  t.eqStr("i64 minimum", i64Text(lo << 10), "-9223372036854775808");
  t.eqStr("i64 maximum", i64Text(-((lo << 10) + toI64(1))), "9223372036854775807");
  t.eqStr("i64 zero", i64Text(toI64(0)), "0");
  t.eqStr("i64 -10", i64Text(toI64(-10)), "-10");
  t.eqStr("i32 minimum", i32Text(-2147483647 - 1), "-2147483648");
  t.eqStr("i32 maximum", i32Text(2147483647), "2147483647");
  t.eqStr("i32 zero", i32Text(0), "0");
  t.eqStr("i32 -9", i32Text(-9), "-9");
  t.eqStr("i32 1000000", i32Text(1000000), "1000000");
  t.eqStr("u32 maximum", u32Text(toU32(0) - toU32(1)), "4294967295");
  t.eqStr("u32 one past the i32 maximum", u32Text(toU32(2147483647) + toU32(1)), "2147483648");
  t.eqStr("u32 the i32 maximum", u32Text(toU32(2147483647)), "2147483647");
  t.eqStr("u32 2^32 - 10, whose last digit is 6", u32Text(toU32(0) - toU32(10)), "4294967286");
  t.eqStr("u32 zero", u32Text(toU32(0)), "0");

  // ---- Every error code ----------------------------------------------------------
  w.reset(out, 0);
  w.beginObject();
  w.i32(1);
  t.eqI32("a value where a key is due is JSON_WRITE_KEY_EXPECTED", w.failed, JSON_WRITE_KEY_EXPECTED);
  t.ok("and the writer holds still after it", stuck(w));
  t.ok("and it is not complete", !w.complete());
  w.reset(out, 0);
  t.eqI32("reset clears it", w.failed, JSON_WRITE_OK);
  w.beginObject();
  w.key("a");
  w.i32(1);
  w.beginArray();
  t.eqI32("an opener where the second key is due is JSON_WRITE_KEY_EXPECTED", w.failed, JSON_WRITE_KEY_EXPECTED);
  w.reset(out, 0);
  w.beginObject();
  w.raw(raw, 0, 1);
  t.eqI32("raw where a key is due is JSON_WRITE_KEY_EXPECTED", w.failed, JSON_WRITE_KEY_EXPECTED);

  w.reset(out, 0);
  w.key("a");
  t.eqI32("a key at the top level is JSON_WRITE_VALUE_EXPECTED", w.failed, JSON_WRITE_VALUE_EXPECTED);
  t.ok("and the writer holds still after it", stuck(w));
  w.reset(out, 0);
  w.beginArray();
  w.key("a");
  t.eqI32("a key in an array is JSON_WRITE_VALUE_EXPECTED", w.failed, JSON_WRITE_VALUE_EXPECTED);
  w.reset(out, 0);
  w.beginObject();
  w.key("a");
  w.key("b");
  t.eqI32("a key straight after a key is JSON_WRITE_VALUE_EXPECTED", w.failed, JSON_WRITE_VALUE_EXPECTED);
  w.reset(out, 0);
  w.beginObject();
  w.key("a");
  w.endObject();
  t.eqI32("endObject straight after a key is JSON_WRITE_VALUE_EXPECTED", w.failed, JSON_WRITE_VALUE_EXPECTED);

  w.reset(out, 0);
  w.endObject();
  t.eqI32("endObject with nothing open is JSON_WRITE_UNBALANCED", w.failed, JSON_WRITE_UNBALANCED);
  t.ok("and the writer holds still after it", stuck(w));
  w.reset(out, 0);
  w.endArray();
  t.eqI32("endArray with nothing open is JSON_WRITE_UNBALANCED", w.failed, JSON_WRITE_UNBALANCED);
  w.reset(out, 0);
  w.beginObject();
  w.endArray();
  t.eqI32("endArray closing an object is JSON_WRITE_UNBALANCED", w.failed, JSON_WRITE_UNBALANCED);
  w.reset(out, 0);
  w.beginArray();
  w.endObject();
  t.eqI32("endObject closing an array is JSON_WRITE_UNBALANCED", w.failed, JSON_WRITE_UNBALANCED);
  w.reset(out, 0);
  w.beginArray();
  w.endArray();
  w.endArray();
  t.eqI32("a closer after the value is whole is JSON_WRITE_UNBALANCED", w.failed, JSON_WRITE_UNBALANCED);

  // Room to spare past the 256 bytes 64 levels take at most, so a write that
  // ran out of room could not pass for one that wrote nothing.
  const deep = new Array<u8>(260);
  w.reset(deep, 0);
  for (let d: i32 = 0; d < JSON_WRITER_MAX_DEPTH; d += 1) {
    w.beginArray();
  }
  t.eqI32("JSON_WRITER_MAX_DEPTH arrays nest", w.failed, JSON_WRITE_OK);
  for (let d: i32 = 0; d < JSON_WRITER_MAX_DEPTH; d += 1) {
    w.endArray();
  }
  t.ok("and close back to complete", w.complete());
  t.eqI32("in twice as many bytes", w.written(), 2 * JSON_WRITER_MAX_DEPTH);
  w.reset(deep, 0);
  for (let d: i32 = 0; d < JSON_WRITER_MAX_DEPTH; d += 1) {
    w.beginObject();
    w.key("");
  }
  t.eqI32("JSON_WRITER_MAX_DEPTH objects nest", w.failed, JSON_WRITE_OK);
  const atDepth = w.end;
  w.beginArray();
  t.eqI32("and one more opener is JSON_WRITE_TOO_DEEP", w.failed, JSON_WRITE_TOO_DEEP);
  t.eqI32("which writes nothing", w.end, atDepth);
  t.ok("and the writer holds still after it", stuck(w));

  // Alternating kinds, so each depth's bit is set by one opener and cleared
  // by the next one that reuses it, across both words of the stack.
  w.reset(deep, 0);
  for (let d: i32 = 0; d < JSON_WRITER_MAX_DEPTH; d += 1) {
    if (d % 2 === 0) {
      w.beginObject();
      w.key("");
    } else {
      w.beginArray();
    }
  }
  for (let d: i32 = JSON_WRITER_MAX_DEPTH - 1; d >= 0; d -= 1) {
    if (d % 2 === 0) {
      w.endObject();
    } else {
      w.endArray();
    }
  }
  t.ok("alternating objects and arrays nest JSON_WRITER_MAX_DEPTH deep and close", w.complete());
  w.reset(deep, 0);
  for (let d: i32 = 0; d < 40; d += 1) {
    w.beginArray();
  }
  w.beginObject();
  w.endArray();
  t.eqI32("endArray closing an object at depth 41 is JSON_WRITE_UNBALANCED", w.failed, JSON_WRITE_UNBALANCED);
  w.reset(deep, 0);
  for (let d: i32 = 0; d < 40; d += 1) {
    w.beginObject();
    w.key("");
  }
  w.beginArray();
  w.endArray();
  w.key("x");
  w.i32(1);
  t.eqI32("an object at depth 40 still takes keys after an array inside it closes", w.failed, JSON_WRITE_OK);
  t.ok("and writes the key after the array with its comma", w.text().endsWith(':[],"x":1'));

  t.eqStr("a buffer too short at every length is JSON_WRITE_FULL and a clean prefix", prefixAtEveryLength(hello, 0, false), "");
  const short = new Array<u8>(4);
  w.reset(short, 0);
  writeHello(w, "Hello, World!");
  t.eqI32("a short buffer is JSON_WRITE_FULL", w.failed, JSON_WRITE_FULL);
  t.ok("and the writer holds still after it", stuck(w));
  // Room for `[` and less than the value: `["a\u0001"` is ten bytes and
  // `["a\n"` six, so each string case is one byte short of the piece it names.
  t.ok("a \\u0001 escape one byte short of room is JSON_WRITE_FULL", fullAt(0, 8));
  t.ok("a string whose \\u0001 fits but whose closing quote does not is JSON_WRITE_FULL", fullAt(0, 9));
  t.ok("a \\n escape one byte short of room is JSON_WRITE_FULL", fullAt(9, 4));
  t.ok("a string one byte short of its closing quote is JSON_WRITE_FULL", fullAt(9, 5));
  t.ok("an i32 one byte short is JSON_WRITE_FULL", fullAt(1, 4));
  t.ok("a u32 one byte short is JSON_WRITE_FULL", fullAt(2, 10));
  t.ok("an i64 one byte short is JSON_WRITE_FULL", fullAt(3, 6));
  t.ok("an f64 one byte short is JSON_WRITE_FULL", fullAt(4, 5));
  t.ok("a boolean one byte short is JSON_WRITE_FULL", fullAt(5, 5));
  t.ok("a null one byte short is JSON_WRITE_FULL", fullAt(6, 4));
  t.ok("a raw window one byte short is JSON_WRITE_FULL", fullAt(7, 3));
  t.ok("an opener with no room is JSON_WRITE_FULL", fullAt(8, 1));
  const tight = new Array<u8>(2);
  w.reset(tight, 0);
  w.beginObject();
  w.key("");
  t.eqI32("a key with no room for its closing quote is JSON_WRITE_FULL", w.failed, JSON_WRITE_FULL);
  const three = new Array<u8>(3);
  w.reset(three, 0);
  w.beginObject();
  w.key("");
  t.eqI32("a key with no room for its colon is JSON_WRITE_FULL", w.failed, JSON_WRITE_FULL);
  t.eqI32("after the key's three bytes", w.written(), 3);
  const six = new Array<u8>(6);
  w.reset(six, 0);
  w.beginObject();
  w.key("a");
  w.i32(1);
  w.key("b");
  t.eqI32("a second key with no room for its comma is JSON_WRITE_FULL", w.failed, JSON_WRITE_FULL);
  t.eqI32("after the six bytes that fit", w.written(), 6);
  w.reset(tight, 0);
  w.beginArray();
  w.i32(1);
  w.i32(2);
  t.eqI32("an element with no room for its comma is JSON_WRITE_FULL", w.failed, JSON_WRITE_FULL);
  w.reset(tight, 0);
  w.beginArray();
  w.beginArray();
  w.endArray();
  t.eqI32("a closer with no room is JSON_WRITE_FULL", w.failed, JSON_WRITE_FULL);
  w.reset(tight, 0);
  w.beginObject();
  w.endObject();
  t.ok("a value that fills the buffer exactly is complete", w.complete());

  w.reset(out, 0);
  w.i32(1);
  w.i32(2);
  t.eqI32("a second top-level value is JSON_WRITE_DONE", w.failed, JSON_WRITE_DONE);
  t.eqStr("and the first is all that was written", w.text(), "1");
  t.ok("and the writer holds still after it", stuck(w));
  w.reset(out, 0);
  w.beginObject();
  w.endObject();
  w.key("a");
  t.eqI32("a key after the value is whole is JSON_WRITE_DONE", w.failed, JSON_WRITE_DONE);

  w.reset(out, 0);
  w.raw(raw, -1, 1);
  t.eqI32("a raw window before the array is JSON_WRITE_BAD_WINDOW", w.failed, JSON_WRITE_BAD_WINDOW);
  t.ok("and the writer holds still after it", stuck(w));
  w.reset(out, 0);
  w.raw(raw, 0, -1);
  t.eqI32("a negative raw length is JSON_WRITE_BAD_WINDOW", w.failed, JSON_WRITE_BAD_WINDOW);
  w.reset(out, 0);
  w.raw(raw, 1, 7);
  t.eqI32("a raw window past the end is JSON_WRITE_BAD_WINDOW", w.failed, JSON_WRITE_BAD_WINDOW);
  w.reset(out, 0);
  w.raw(raw, 7, 0);
  t.eqI32("an empty raw window at the end is not", w.failed, JSON_WRITE_OK);
  w.reset(out, -1);
  t.eqI32("a start before the buffer is JSON_WRITE_BAD_WINDOW", w.failed, JSON_WRITE_BAD_WINDOW);
  t.ok("and the writer holds still after it", stuck(w));
  w.reset(out, 65);
  t.eqI32("a start past the buffer is JSON_WRITE_BAD_WINDOW", w.failed, JSON_WRITE_BAD_WINDOW);
  w.reset(out, 64);
  t.eqI32("a start at the end of the buffer is not", w.failed, JSON_WRITE_OK);
  w.nullValue();
  t.eqI32("but it has no room", w.failed, JSON_WRITE_FULL);

  // A text written after a prefix the caller put there itself, as a server
  // does after its response head.
  w.reset(out, 5);
  writeHello(w, "hi");
  t.eqI32("a text from start 5 counts only its own bytes", w.written(), 16);
  t.eqStr("and is read from start", w.text(), '{"message":"hi"}');

  // ---- Indented ------------------------------------------------------------------
  // The spellings are JSON.stringify(v, null, indent)'s; `node.ts` holds a
  // larger value to JSON.stringify itself under Node and natively.
  const big4 = new Array<u8>(256);
  const pw = new JsonWriter(big4, 0);
  pw.setIndent(2);
  writeHello(pw, "Hello, World!");
  const prettyHello = '{\n  "message": "Hello, World!"\n}';
  t.eqStr("the hello object at two spaces", pw.text(), prettyHello);
  t.ok("is complete", pw.complete());
  pw.reset(big4, 0);
  t.eqI32("reset keeps the indent", pw.indentWidth, 2);
  pw.beginArray();
  pw.beginObject();
  pw.endObject();
  pw.beginArray();
  pw.endArray();
  pw.string(accented);
  pw.endArray();
  t.eqStr("empty containers stay on one line, and UTF-8 goes through", pw.text(), `[\n  {},\n  [],\n  "${accented}"\n]`);
  pw.reset(big4, 0);
  pw.i32(5);
  t.eqStr("a top-level number is not indented", pw.text(), "5");
  pw.setIndentTab();
  pw.reset(big4, 0);
  pw.beginObject();
  pw.key("a");
  pw.beginArray();
  pw.i32(1);
  pw.endArray();
  pw.endObject();
  t.eqStr("a tab a level", pw.text(), '{\n\t"a": [\n\t\t1\n\t]\n}');
  pw.setIndent(11);
  t.eqI32("an indent past 10 is clamped to 10", pw.indentWidth, 10);
  pw.setIndent(-1);
  t.eqI32("and one below 0 is the minified text", pw.indentWidth, 0);
  pw.reset(big4, 0);
  writeHello(pw, "Hello, World!");
  t.eqStr("which writes what it wrote before", pw.text(), hello);
  t.eqStr(
    "an indented text too short at every length is JSON_WRITE_FULL and a clean prefix",
    prefixAtEveryLength(prettyHello, 2, false),
    ""
  );
  const nestedTab = '{\n\t"a": [],\n\t"b": {},\n\t"c": [\n\t\t1,\n\t\t{\n\t\t\t"d": true\n\t\t}\n\t]\n}';
  const nestedThree =
    '{\n   "a": [],\n   "b": {},\n   "c": [\n      1,\n      {\n         "d": true\n      }\n   ]\n}';
  pw.setIndentTab();
  pw.reset(big4, 0);
  writeNested(pw);
  t.eqStr("nested containers with a tab are JSON.stringify(v, null, \"\\t\")", pw.text(), nestedTab);
  pw.setIndent(3);
  pw.reset(big4, 0);
  writeNested(pw);
  t.eqStr("and at three spaces JSON.stringify(v, null, 3)", pw.text(), nestedThree);
  t.eqStr(
    "nested containers with a tab, too short at every length, are JSON_WRITE_FULL and a clean prefix",
    prefixAtEveryLength(nestedTab, TAB, true),
    ""
  );
  t.eqStr(
    "and at three spaces",
    prefixAtEveryLength(nestedThree, 3, true),
    ""
  );

  // A raw fragment goes where a value would, after its line break and
  // indent, and is copied as it is: not re-indented.
  const fragment: u8[] = [123, 34, 120, 34, 58, 49, 125];
  pw.setIndent(2);
  pw.reset(big4, 0);
  pw.beginArray();
  pw.raw(fragment, 0, 7);
  pw.endArray();
  t.eqStr("an indented raw element is on its own line and not re-indented", pw.text(), '[\n  {"x":1}\n]');
  pw.reset(big4, 0);
  pw.beginObject();
  pw.key("r");
  pw.raw(fragment, 0, 7);
  pw.endObject();
  t.eqStr("an indented raw member value follows its key's colon and space", pw.text(), '{\n  "r": {"x":1}\n}');
  pw.reset(big4, 0);
  pw.raw(fragment, 0, 7);
  t.eqStr("an indented raw top-level value is the fragment alone", pw.text(), '{"x":1}');
  pw.reset(big4, 0);
  pw.beginArray();
  pw.i32(1);
  pw.raw(fragment, 0, 7);
  pw.endArray();
  t.eqStr(
    "an indented raw element after a sibling takes the comma, line break and indent first",
    pw.text(),
    '[\n  1,\n  {"x":1}\n]'
  );
  pw.reset(big4, 0);
  pw.beginArray();
  pw.i32(1);
  pw.raw(fragment, 7, 0);
  pw.endArray();
  t.eqStr(
    "an empty raw window in indent mode still takes its comma, line break and indent, and nothing else",
    pw.text(),
    "[\n  1,\n  \n]"
  );
  // A closer's line break with no room: `[\n  1` fits in 5 bytes, and the
  // `\n` before `]` does not.
  const five = new Array<u8>(5);
  pw.setIndent(2);
  pw.reset(five, 0);
  pw.beginArray();
  pw.i32(1);
  t.eqI32("an element and its indent fill the buffer", pw.failed, JSON_WRITE_OK);
  pw.endArray();
  t.eqI32("a closer whose line break has no room is JSON_WRITE_FULL", pw.failed, JSON_WRITE_FULL);
  t.eqI32("and writes none of it", pw.written(), 5);
  t.ok("and the writer holds still after it", stuck(pw));
  // The deepest line at the widest indent: 64 nested arrays at 10 spaces,
  // JSON.stringify's 39,944 bytes. Every opener but the outermost and every
  // closer but the innermost's starts a line indented 10 a level, and the
  // buffer is exactly that long, so the last `]` fills it.
  const deepest: i32 = 39944;
  const widest = new Array<u8>(deepest);
  pw.setIndent(10);
  pw.reset(widest, 0);
  nestArrays(pw);
  t.ok("JSON_WRITER_MAX_DEPTH empty arrays at 10 spaces close back to complete", pw.complete());
  t.eqI32("in JSON.stringify's 39,944 bytes", pw.written(), deepest);
  pw.reset(widest, 1);
  nestArrays(pw);
  t.eqI32("and one byte less is JSON_WRITE_FULL", pw.failed, JSON_WRITE_FULL);
  t.eqI32("at the last closer, whose line break fits and whose ] does not", pw.written(), deepest - 1);

  // jsonEncode is calls of the writer's methods, so it writes in the writer's mode.
  pw.setIndent(2);
  pw.reset(big4, 0);
  jsonEncode(pw, new Pair());
  t.eqStr(
    "jsonEncode through an indented writer is JSON.stringify(v, null, 2)",
    pw.text(),
    '{\n  "name": "a",\n  "values": [\n    1,\n    2\n  ]\n}'
  );

  // Switching the indent in the middle of a text applies from the next
  // byte: on, the next element takes its comma and a line break and every
  // closer after it a line of its own; off, the rest is minified.
  pw.setIndent(0);
  pw.reset(big4, 0);
  pw.beginArray();
  pw.i32(1);
  pw.setIndent(2);
  pw.i32(2);
  pw.beginObject();
  pw.key("a");
  pw.i32(3);
  pw.endObject();
  pw.endArray();
  t.eqStr("indenting from the middle of a text", pw.text(), '[1,\n  2,\n  {\n    "a": 3\n  }\n]');
  pw.reset(big4, 0);
  pw.beginArray();
  pw.i32(1);
  pw.setIndent(0);
  pw.i32(2);
  pw.beginObject();
  pw.key("a");
  pw.i32(3);
  pw.endObject();
  pw.endArray();
  t.eqStr("and minifying from the middle of one", pw.text(), '[\n  1,2,{"a":3}]');

  // Every misuse has the code it has in the minified text, with an indent
  // set, and writes nothing: not its line break, not its indent.
  pw.setIndent(2);
  pw.reset(big4, 0);
  pw.beginArray();
  pw.i32(1);
  let before: i32 = pw.written();
  pw.endObject();
  t.eqI32("indented, endObject closing an array is JSON_WRITE_UNBALANCED", pw.failed, JSON_WRITE_UNBALANCED);
  t.eqI32("and writes nothing", pw.written(), before);
  pw.reset(big4, 0);
  pw.beginObject();
  pw.key("a");
  before = pw.written();
  pw.endArray();
  t.eqI32("indented, endArray straight after the first key is JSON_WRITE_UNBALANCED", pw.failed, JSON_WRITE_UNBALANCED);
  t.eqI32("and writes nothing", pw.written(), before);
  pw.reset(big4, 0);
  pw.beginObject();
  pw.key("a");
  pw.i32(1);
  pw.key("b");
  before = pw.written();
  pw.endArray();
  t.eqI32("and straight after a later key", pw.failed, JSON_WRITE_UNBALANCED);
  t.eqI32("writing nothing", pw.written(), before);
  pw.reset(big4, 0);
  pw.beginObject();
  pw.key("a");
  pw.i32(1);
  pw.key("b");
  before = pw.written();
  pw.endObject();
  t.eqI32("indented, endObject straight after a later key is JSON_WRITE_VALUE_EXPECTED", pw.failed, JSON_WRITE_VALUE_EXPECTED);
  t.eqI32("and writes nothing", pw.written(), before);
  pw.reset(big4, 0);
  pw.endArray();
  t.eqI32("indented, endArray with nothing open is JSON_WRITE_UNBALANCED", pw.failed, JSON_WRITE_UNBALANCED);
  t.eqI32("and writes nothing", pw.written(), 0);
  pw.reset(big4, 0);
  pw.beginArray();
  pw.i32(1);
  pw.endArray();
  before = pw.written();
  pw.endObject();
  t.eqI32("and endObject after the value is whole is JSON_WRITE_UNBALANCED", pw.failed, JSON_WRITE_UNBALANCED);
  t.eqI32("writing nothing", pw.written(), before);
  pw.reset(widest, 0);
  for (let d: i32 = 0; d < JSON_WRITER_MAX_DEPTH; d += 1) {
    pw.beginArray();
  }
  before = pw.written();
  pw.beginObject();
  t.eqI32("indented, one opener past JSON_WRITER_MAX_DEPTH is JSON_WRITE_TOO_DEEP", pw.failed, JSON_WRITE_TOO_DEEP);
  t.eqI32("and writes no line break for it", pw.written(), before);
  pw.reset(big4, 0);
  pw.beginObject();
  pw.key("a");
  pw.i32(1);
  before = pw.written();
  pw.i32(2);
  t.eqI32("indented, a value where a key is due is JSON_WRITE_KEY_EXPECTED", pw.failed, JSON_WRITE_KEY_EXPECTED);
  t.eqI32("and writes no comma or line break for it", pw.written(), before);
  pw.reset(big4, 0);
  pw.i32(1);
  pw.i32(2);
  t.eqI32("indented, a second top-level value is JSON_WRITE_DONE", pw.failed, JSON_WRITE_DONE);
  t.eqStr("and the first is all that was written", pw.text(), "1");
  pw.reset(big4, 0);
  pw.beginObject();
  pw.endObject();
  pw.key("a");
  t.eqI32("and so is a key after the value is whole", pw.failed, JSON_WRITE_DONE);
  t.eqStr("leaving the empty object", pw.text(), "{}");

  // ---- The kind stack ---------------------------------------------------------------
  // The kinds of the open containers are a stack that shifts across two
  // words: mixed kinds at every level, the boundary at 32 crossed both ways,
  // the limit at 64, and a reset after a deep text that left it full.
  const stackBuf = new Array<u8>(1024);
  const kw = new JsonWriter(stackBuf, 0);
  const depths: i32[] = [31, 32, 33, 63, 64];
  for (const n of depths) {
    kw.reset(stackBuf, 0);
    writeMixed(kw, n);
    const parts: string[] = [];
    for (let d: i32 = 0; d < n; d += 1) {
      parts.push(objectAt(d) ? '{"k":' : "[");
    }
    parts.push("1");
    for (let d: i32 = n - 1; d >= 0; d -= 1) {
      parts.push(objectAt(d) ? "}" : "]");
    }
    t.eqStr(`${n} levels of mixed kinds open and close in order`, kw.text(), parts.join(""));
    t.ok(`and are complete at ${n}`, kw.complete());
  }
  t.eqI32(
    "after every number of closes from 64 levels, the wrong closer is JSON_WRITE_UNBALANCED and writes nothing",
    mixedKindsAtEveryDepth(kw, stackBuf),
    0
  );
  kw.reset(stackBuf, 0);
  openMixed(kw, JSON_WRITER_MAX_DEPTH - 1);
  kw.beginArray();
  t.eqI32("an opener reaching exactly JSON_WRITER_MAX_DEPTH is accepted", kw.failed, JSON_WRITE_OK);
  const atLimit: i32 = kw.written();
  kw.beginObject();
  t.eqI32("and one past it is JSON_WRITE_TOO_DEEP", kw.failed, JSON_WRITE_TOO_DEEP);
  t.eqI32("writing nothing", kw.written(), atLimit);
  kw.reset(stackBuf, 0);
  openMixed(kw, JSON_WRITER_MAX_DEPTH);
  kw.reset(stackBuf, 0);
  kw.key("a");
  t.eqI32(
    "a reset after 64 open levels clears the stack: a key at the top level is JSON_WRITE_VALUE_EXPECTED",
    kw.failed,
    JSON_WRITE_VALUE_EXPECTED
  );
  kw.reset(stackBuf, 0);
  kw.beginObject();
  kw.key("a");
  kw.beginArray();
  kw.i32(1);
  kw.endArray();
  kw.endObject();
  t.eqStr("and a text after it is written as from new", kw.text(), '{"a":[1]}');
  t.ok("and is complete", kw.complete());
  kw.reset(stackBuf, 0);
  kw.beginArray();
  kw.endArray();
  kw.endArray();
  kw.reset(stackBuf, 0);
  kw.i32(1);
  t.ok("a reset after a failed text writes a whole value too", kw.complete());

  // ---- Strict --------------------------------------------------------------------
  const sw = new JsonWriter(out, 0);
  sw.setStrict(true);
  sw.beginArray();
  sw.f64(one);
  sw.f64(negZero);
  sw.f64(huge);
  sw.endArray();
  t.eqStr("a strict writer writes a finite f64 as ever", sw.text(), "[1.5,0,1.7976931348623157e+308]");
  t.ok("and completes", sw.complete());
  sw.reset(out, 0);
  t.ok("reset keeps strict mode", sw.strict);
  sw.beginArray();
  sw.i32(1);
  const beforeNan = sw.end;
  sw.f64(nan);
  t.eqI32("NaN in strict mode is JSON_WRITE_NON_FINITE", sw.failed, JSON_WRITE_NON_FINITE);
  t.eqI32("and writes nothing, not even its comma", sw.end, beforeNan);
  t.ok("and the writer holds still after it", stuck(sw));
  t.ok("and is not complete", !sw.complete());
  sw.reset(out, 0);
  sw.f64(inf);
  t.eqI32("Infinity in strict mode is JSON_WRITE_NON_FINITE", sw.failed, JSON_WRITE_NON_FINITE);
  t.eqI32("with nothing written", sw.written(), 0);
  sw.reset(out, 0);
  sw.f64(-inf);
  t.eqI32("-Infinity in strict mode is JSON_WRITE_NON_FINITE", sw.failed, JSON_WRITE_NON_FINITE);
  sw.reset(out, 0);
  sw.beginObject();
  sw.i32(1);
  sw.f64(nan);
  t.eqI32("an earlier error is kept over a later non-finite f64", sw.failed, JSON_WRITE_KEY_EXPECTED);
  sw.reset(out, 0);
  sw.beginObject();
  sw.f64(nan);
  t.eqI32(
    "a non-finite f64 where a key is due is JSON_WRITE_KEY_EXPECTED, as a finite one is",
    sw.failed,
    JSON_WRITE_KEY_EXPECTED
  );
  sw.reset(out, 0);
  sw.i32(1);
  sw.f64(inf);
  t.eqI32("and after the top-level value it is JSON_WRITE_DONE", sw.failed, JSON_WRITE_DONE);
  t.eqStr("with the first value all that was written", sw.text(), "1");
  sw.reset(out, 0);
  sw.beginObject();
  sw.key("v");
  sw.f64(nan);
  t.eqI32("but after a key it is JSON_WRITE_NON_FINITE", sw.failed, JSON_WRITE_NON_FINITE);
  // Strict and indented together: the check comes before the line break, so
  // a failing value writes neither its comma nor its indent.
  sw.setIndent(2);
  sw.reset(out, 0);
  sw.beginArray();
  sw.i32(1);
  const beforeIndented = sw.written();
  sw.f64(nan);
  t.eqI32("an indented strict writer fails NaN with JSON_WRITE_NON_FINITE", sw.failed, JSON_WRITE_NON_FINITE);
  t.eqI32("and writes no comma, line break or indent for it", sw.written(), beforeIndented);
  t.eqI32("after the five bytes of [, a line break, its indent and 1", beforeIndented, 5);
  sw.setIndent(0);
  const reading = new Reading();
  reading.value = inf;
  sw.reset(out, 0);
  jsonEncode(sw, reading);
  t.eqI32("jsonEncode through a strict writer fails an infinite field with JSON_WRITE_NON_FINITE", sw.failed, JSON_WRITE_NON_FINITE);
  t.eqStr("after the bytes before the value", sw.text(), '{"value":');
  sw.setStrict(false);
  sw.reset(out, 0);
  sw.f64(nan);
  t.eqStr("off again, NaN is null", sw.text(), "null");
  t.ok("a writer is not strict until it is asked to be", !new JsonWriter(out, 0).strict);
  t.eqI32("nor indented", new JsonWriter(out, 0).indentWidth, 0);

  // ---- The arena -----------------------------------------------------------------
  // Every write into the one buffer, reset each round, with a message, an i32
  // and an f64 that change each round so no two neighbouring rounds write the
  // same: what the calls keep, which must be nothing. The messages are built
  // before the loop, so the meter sees only the writer. An f64 is in the round
  // because its digits are the one string the writer builds.
  const messages: string[] = [];
  for (let k: i32 = 0; k < 64; k += 1) {
    messages.push(`Hello, World! ${k}`);
  }
  const meter = new LbMeter(false);
  let finished: i32 = 0;
  for (let round: i32 = 0; round < 10000; round += 1) {
    meter.begin();
    w.reset(out, 0);
    const pick: i32 = round % 64;
    w.beginArray();
    writeHello(w, pick < toI32(messages.length) ? messages[pick] : "");
    w.i32(round);
    w.f64(toF64(round) / toF64(8));
    w.i64(lo);
    w.endArray();
    meter.end();
    if (w.complete()) {
      finished += 1;
    }
  }
  t.eqI32("10,000 writes into a reused buffer all complete", finished, 10000);
  t.eqI64("and keep nothing in the arena", meter.kept, toI64(0));
  const fresh = new LbMeter(true);
  for (let round: i32 = 0; round < 100; round += 1) {
    fresh.begin();
    w.reset(out, 0);
    w.f64(toF64(round) / toF64(3));
    fresh.end();
  }
  t.eqI64("an f64 write started at the head of a chunk keeps nothing either", fresh.kept, toI64(0));

  // The same rounds indented, at 4 spaces and with a tab, so every line break
  // is measured too: an indent is stored, never built.
  const prettyOut = new Array<u8>(256);
  const pretty = new LbMeter(false);
  let prettyFinished: i32 = 0;
  for (let round: i32 = 0; round < 10000; round += 1) {
    if (round % 2 === 0) {
      pw.setIndent(4);
    } else {
      pw.setIndentTab();
    }
    pretty.begin();
    pw.reset(prettyOut, 0);
    const pick: i32 = round % 64;
    pw.beginArray();
    writeHello(pw, pick < toI32(messages.length) ? messages[pick] : "");
    pw.beginArray();
    pw.endArray();
    pw.i32(round);
    pw.f64(toF64(round) / toF64(8));
    pw.i64(lo);
    pw.endArray();
    pretty.end();
    if (pw.complete()) {
      prettyFinished += 1;
    }
  }
  t.eqI32("10,000 indented writes into a reused buffer all complete", prettyFinished, 10000);
  t.eqI64("and keep nothing in the arena", pretty.kept, toI64(0));

  return t.done();
};
