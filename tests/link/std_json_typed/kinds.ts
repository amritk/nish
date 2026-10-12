// The kinds typed JSON reads and writes after the first (#593): `u64`, numeric
// enums and `Map<string, V>`, each at both ends of what it accepts and at
// every error, with non-ASCII keys of two, three and four bytes; and the key
// dispatch by length, then by byte, over a class with many fields and over
// field names that are not ASCII.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import {
  JSON_DECODE_DUPLICATE,
  JSON_DECODE_MAP_LIMIT,
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
import { Kinds, Level, MapShapes, Names, Sign, Wide } from "./models.ts";
import { jtBytes, jtDecode, jtEncode } from "./support.ts";
import { Tag, tagDecode, tagEncode } from "./tag.ts";

const KINDS: string =
  `{"id":18446744073709551615,"ids":[0,9223372036854775807,9223372036854775808,10000000000000000000,18446744073709551615],` +
  `"more":null,"levels":[0,5,9,5],"ranks":[9,0],"counts":{"a":1,"b":-2},` +
  `"players":{"ann":{"name":"Ann","score":3,"rating":1.5,"tags":["x"]}},"notes":{"n":null,"s":"text"},` +
  `"lists":{"l":[1,2],"e":[]},"groups":{"g":{"x":0,"y":9},"e":{}},"odds":{"p":0.5},"level":9,"sign":-1}`;

/** `KINDS` with `field`'s value replaced by `value`: the fields are in declaration order, so the text stays decodable. */
const jtKindsWith = (field: string, value: string): string => {
  const values: string[] = ["1", "[]", "null", "[]", "null", "{}", "{}", "{}", "{}", "{}", "null", "0", "0"];
  const names: string[] = [
    "id",
    "ids",
    "more",
    "levels",
    "ranks",
    "counts",
    "players",
    "notes",
    "lists",
    "groups",
    "odds",
    "level",
    "sign",
  ];
  const parts: string[] = [];
  for (let i: i32 = 0; i < toI32(names.length) && i < toI32(values.length); i += 1) {
    const name = names[i];
    parts.push(`"${name}":${name === field ? value : values[i]}`);
  }
  return `{${parts.join(",")}}`;
};

/** The byte offset of `field`'s value in `jtKindsWith(field, value)`. */
const jtValueAt = (field: string, value: string): i32 =>
  toI32(jtKindsWith(field, value).indexOf(`"${field}":`)) + toI32(field.length) + 3;

/**
 * Decode `field: value` into a fresh `Kinds` and check the code, and the byte
 * the error is reported at: `at` bytes into `value`.
 */
const jtKindsError = (t: Suite, name: string, field: string, value: string, code: i32, at: i32): void => {
  const d = jtDecode(jtKindsWith(field, value), new Kinds(), new JsonLimits(), false);
  t.eqI32(`${name}: code`, d.failed, code);
  t.eqI32(`${name}: errorAt`, d.errorAt, jtValueAt(field, value) + at);
};

const jtU64 = (t: Suite): void => {
  const k = new Kinds();
  t.eqI32("kinds: decodes", jtDecode(KINDS, k, new JsonLimits(), false).failed, JSON_DECODE_OK);
  t.eqStr("kinds: encodes back to the same text", jtEncode(k, 4096), KINDS);
  // 2^64 - 1 is every bit set: (2^32 - 1) * 2^32 + (2^32 - 1), its parts built from `i32`s.
  const low: u64 = (toU64(65536) * toU64(65536)) - toU64(1);
  t.ok("u64: 2^64 - 1 is read exactly", k.id === low * (low + toU64(1)) + low);
  t.eqI32("u64: an array of five", toI32(k.ids.length), 5);

  // The errors are an i32's: a range, a fraction or an exponent, and a type.
  jtKindsError(t, "u64: 2^64", "id", "18446744073709551616", JSON_DECODE_RANGE, 0);
  jtKindsError(t, "u64: 21 digits", "id", "100000000000000000000", JSON_DECODE_RANGE, 0);
  jtKindsError(t, "u64: -1", "id", "-1", JSON_DECODE_RANGE, 0);
  jtKindsError(t, "u64: -0", "id", "-0", JSON_DECODE_RANGE, 0);
  jtKindsError(t, "u64: a fraction", "id", "1.5", JSON_DECODE_RANGE, 0);
  jtKindsError(t, "u64: an exponent", "id", "1e2", JSON_DECODE_RANGE, 0);
  jtKindsError(t, "u64: a string", "id", `"1"`, JSON_DECODE_TYPE, 0);
  jtKindsError(t, "u64: null in an array of u64", "ids", "[1,null]", JSON_DECODE_TYPE, 3);
  jtKindsError(t, "u64: 2^64 in an array of u64", "ids", "[18446744073709551616]", JSON_DECODE_RANGE, 1);

  const small = new Kinds();
  const text = jtKindsWith("more", "[18446744073709551615,0]");
  t.eqI32("u64: a | null array decodes into its null", jtDecode(text, small, new JsonLimits(), false).failed, JSON_DECODE_OK);
  t.eqStr("u64: and encodes", jtEncode(small, 1024), text);

  // Past 2^63 the digits are written from an array of the encoding's own,
  // which nothing keeps.
  const w = new JsonWriter(new Array<u8>(4096), 0);
  jsonEncode(w, k);
  const before = Arena.used();
  let same: i32 = 0;
  for (let i: i32 = 0; i < 1000; i += 1) {
    w.reset(w.buf, 0);
    jsonEncode(w, k);
    if (w.written() === toI32(KINDS.length)) {
      same += 1;
    }
  }
  t.eqI32("u64: 1,000 encodes write the same length", same, 1000);
  t.eqI64("u64: Arena.used() is flat over 1,000 encodes past 2^63", Arena.used() - before, toI64(0));
};

const jtEnums = (t: Suite): void => {
  const k = new Kinds();
  jtDecode(KINDS, k, new JsonLimits(), false);
  t.ok("enum: 9 is High", k.level === Level.High);
  t.ok("enum: -1 is Minus", k.sign === Sign.Minus);
  t.ok("enum: an array of members", k.levels.length === 4 && k.levels[1] === Level.Mid);
  const one = new Kinds();
  t.eqI32("enum: two members of one value both read 1", jtDecode(jtKindsWith("sign", "1"), one, new JsonLimits(), false).failed, JSON_DECODE_OK);
  t.ok("enum: 1 is Plus, which is Positive", one.sign === Sign.Plus && one.sign === Sign.Positive);

  // A number that names no member is a type error at the number, and the
  // field keeps the member it held. One that is not an `i32` is an i32's error.
  const held = new Kinds();
  held.level = Level.Mid;
  const d = jtDecode(jtKindsWith("level", "1"), held, new JsonLimits(), false);
  t.eqI32("enum: 1 names no member: code", d.failed, JSON_DECODE_TYPE);
  t.eqI32("enum: 1 names no member: errorAt", d.errorAt, jtValueAt("level", "1"));
  t.ok("enum: and the field keeps the member it held", held.level === Level.Mid);
  jtKindsError(t, "enum: a member's name is not its value", "level", `"High"`, JSON_DECODE_TYPE, 0);
  jtKindsError(t, "enum: 2^31", "level", "2147483648", JSON_DECODE_RANGE, 0);
  jtKindsError(t, "enum: a fraction", "level", "5.5", JSON_DECODE_RANGE, 0);
  jtKindsError(t, "enum: null", "level", "null", JSON_DECODE_TYPE, 0);
  jtKindsError(t, "enum: -2 names no member of Sign", "sign", "-2", JSON_DECODE_TYPE, 0);

  // A read that fails stores nothing, though its `0` is a member's value
  // (`Level.Low`): the field keeps the member it held, and an array pushes
  // nothing for the element.
  for (const bad of ["5.5", "2147483648", `"x"`]) {
    const keep = new Kinds();
    keep.level = Level.High;
    const r = jtDecode(jtKindsWith("level", bad), keep, new JsonLimits(), false);
    t.ok(`enum: a failed read of ${bad} fails`, r.failed === JSON_DECODE_RANGE || r.failed === JSON_DECODE_TYPE);
    t.ok(`enum: and the field keeps High, not Low, after ${bad}`, keep.level === Level.High);
    const list = new Kinds();
    jtDecode(jtKindsWith("levels", `[9,${bad}]`), list, new JsonLimits(), false);
    t.ok(`enum array: nothing is pushed for ${bad}`, list.levels.length === 1 && list.levels[0] === Level.High);
  }

  // An array of enums: a non-member element is a type error, and nothing is
  // kept for it, so every element the array holds is a member.
  const arr = new Kinds();
  const e = jtDecode(jtKindsWith("levels", "[5,9,4,0]"), arr, new JsonLimits(), false);
  t.eqI32("enum array: 4 names no member: code", e.failed, JSON_DECODE_TYPE);
  t.eqI32("enum array: 4 names no member: errorAt", e.errorAt, jtValueAt("levels", "[5,9,4,0]") + 5);
  t.ok("enum array: the members before it are kept", arr.levels.length === 2 && arr.levels[1] === Level.High);
  const ranked = new Kinds();
  const ranks = jtKindsWith("ranks", "[5,0]");
  t.eqI32("enum array: a | null array decodes into its null", jtDecode(ranks, ranked, new JsonLimits(), false).failed, JSON_DECODE_OK);
  t.eqStr("enum array: and encodes", jtEncode(ranked, 1024), ranks);
  jtKindsError(t, "enum array: a non-member in a | null array", "ranks", "[5,7]", JSON_DECODE_TYPE, 3);
  jtDecode(jtKindsWith("ranks", "null"), ranked, new JsonLimits(), false);
  t.ok("enum array: and back to null", ranked.ranks === null);
  const reused = new Kinds();
  jtDecode(jtKindsWith("levels", "[5,9,0]"), reused, new JsonLimits(), false);
  const levels = reused.levels;
  jtDecode(jtKindsWith("levels", "[9]"), reused, new JsonLimits(), false);
  t.ok("enum array: a shorter array decodes into the array the field holds", reused.levels === levels && levels.length === 1);
};

/** Decode `text` as the `counts` of a fresh `Kinds` and answer the decoder. */
const jtCounts = (text: string, k: Kinds): JsonDecoder => jtDecode(jtKindsWith("counts", text), k, new JsonLimits(), false);

const jtMaps = (t: Suite): void => {
  const k = new Kinds();
  jtDecode(KINDS, k, new JsonLimits(), false);
  t.eqI32("map: counts holds two", k.counts.size, 2);
  const ann = k.players.get("ann");
  t.ok("map: a class value is an object of its own", ann !== undefined && ann.name === "Ann");
  const note = k.notes.get("n");
  t.ok("map: a | null value holds null", note !== undefined && note === null);

  // Zero, one and many keys, in the input's order.
  const empty = new Kinds();
  t.eqI32("map: no keys", jtCounts("{}", empty).failed, JSON_DECODE_OK);
  t.eqI32("map: no keys: empty", empty.counts.size, 0);
  const single = new Kinds();
  jtCounts(`{"only":7}`, single);
  t.ok("map: one key", single.counts.size === 1 && (single.counts.get("only") ?? 0) === 7);
  const parts: string[] = [];
  for (let i: i32 = 0; i < 200; i += 1) {
    parts.push(`"k${(i * 37) % 200}":${i}`);
  }
  const many = `{${parts.join(",")}}`;
  const big = new Kinds();
  t.eqI32("map: 200 keys decode", jtCounts(many, big).failed, JSON_DECODE_OK);
  t.eqStr("map: 200 keys encode in the input's order", jtEncode(big, 65536), jtKindsWith("counts", many));

  // A key that looks like an array index keeps its place: JavaScript's objects
  // put those first, so here `JSON.stringify(JSON.parse(x))` would not.
  const index = new Kinds();
  jtCounts(`{"b":1,"1":2}`, index);
  t.eqStr("map: a key like an index keeps the input's order", jtEncode(index, 1024), jtKindsWith("counts", `{"b":1,"1":2}`));

  // A key the object gave already is refused before its value is read,
  // spelled the same way or through an escape.
  jtKindsError(t, "map: a duplicate key", "counts", `{"a":1,"a":2}`, JSON_DECODE_DUPLICATE, 7);
  jtKindsError(t, "map: a duplicate key through an escape", "counts", `{"a":1,"\\u0061":2}`, JSON_DECODE_DUPLICATE, 7);

  // Keys of two, three and four UTF-8 bytes, raw and as escapes, are one key
  // each way and are written back as their bytes.
  const raw = new Kinds();
  t.eqI32("map: non-ASCII keys decode", jtCounts(`{"é":2,"€":3,"😀":4}`, raw).failed, JSON_DECODE_OK);
  t.eqStr("map: non-ASCII keys encode as their bytes", jtEncode(raw, 1024), jtKindsWith("counts", `{"é":2,"€":3,"😀":4}`));
  const esc = new Kinds();
  t.eqI32("map: escaped non-ASCII keys decode", jtCounts(`{"\\u00e9":2,"\\u20ac":3,"\\ud83d\\ude00":4}`, esc).failed, JSON_DECODE_OK);
  t.eqStr("map: and are the same keys", jtEncode(esc, 1024), jtEncode(raw, 1024));
  t.ok(
    "map: é, €, 😀 are 2, 3 and 4 bytes",
    (esc.counts.get("é") ?? 0) === 2 && (esc.counts.get("€") ?? 0) === 3 && (esc.counts.get("😀") ?? 0) === 4
  );
  const twice = jtCounts(`{"é":1,"\\u00e9":2}`, new Kinds());
  t.eqI32("map: é and \\u00e9 are one key", twice.failed, JSON_DECODE_DUPLICATE);

  // The type errors, at the value.
  jtKindsError(t, "map: an array for a map", "counts", "[]", JSON_DECODE_TYPE, 0);
  jtKindsError(t, "map: null for a map that is not | null", "counts", "null", JSON_DECODE_TYPE, 0);
  jtKindsError(t, "map: a string for an i32 value", "counts", `{"a":"1"}`, JSON_DECODE_TYPE, 5);
  jtKindsError(t, "map: a fraction for an i32 value", "counts", `{"a":1.5}`, JSON_DECODE_RANGE, 5);
  jtKindsError(t, "map: a missing field in a class value", "players", `{"p":{"name":"a"}}`, JSON_DECODE_MISSING, 16);
  jtKindsError(t, "map: a number that names no member in a map of maps", "groups", `{"g":{"x":3}}`, JSON_DECODE_TYPE, 10);

  // A map is emptied and filled again on each decode, so what it holds is the
  // last input's entries, in that input's order.
  const again = new Kinds();
  jtCounts(`{"a":1,"b":2,"c":3}`, again);
  jtCounts(`{"c":9,"z":0}`, again);
  t.eqStr("map: a second decode leaves only its own entries", jtEncode(again, 1024), jtKindsWith("counts", `{"c":9,"z":0}`));
  const nullable = new Kinds();
  const withOdds = jtKindsWith("odds", `{"x":1.25,"y":-0.5}`);
  jtDecode(withOdds, nullable, new JsonLimits(), false);
  t.eqStr("map: a | null map decodes into its null", jtEncode(nullable, 1024), withOdds);
  jtDecode(jtKindsWith("odds", "null"), nullable, new JsonLimits(), false);
  t.ok("map: and back to null", nullable.odds === null);

  // The values `Kinds` leaves out. A number that names no member, in a map of
  // enums, is a type error, and the entry keeps the enum's first member.
  const shapes =
    `{"levels":{"k":[0,9],"z":[]},"players":{"n":null,"p":{"name":"P","score":1,"rating":0,"tags":[]}},` +
    `"lists":{"n":null,"u":[18446744073709551615]},"signs":{"m":-1},"maybe":{"q":{"name":"Q","score":2,"rating":0.5,"tags":["t"]}}}`;
  const s = new MapShapes();
  t.eqI32("map: arrays of enums, | null objects and arrays, a | null map", jtDecode(shapes, s, new JsonLimits(), false).failed, JSON_DECODE_OK);
  t.eqStr("map: and encode", jtEncode(s, 1024), shapes);
  const bare = `{"levels":{},"players":{},"lists":{},"signs":{"m":2},"maybe":null}`;
  const b = new MapShapes();
  t.eqI32("map: a number that names no member of a map's enum", jtDecode(bare, b, new JsonLimits(), false).failed, JSON_DECODE_TYPE);
  t.ok("map: the entry holds a member", (b.signs.get("m") ?? Sign.Zero) === Sign.Minus);

  // A map's keys are bounded by the decoder's `maxMapKeys`, 4,096 unless set,
  // each map on its own: the key past the limit is refused before it is
  // read, with its own code at its own byte.
  const limited = jtBytes(jtKindsWith("counts", `{"a":1,"b":2,"c":3}`));
  const ld = new JsonDecoder(limited, 0, toI32(limited.length), new JsonLimits());
  ld.maxMapKeys = 3;
  t.eqI32("map limit: as many keys as the limit", jsonDecode(ld, new Kinds()), JSON_DECODE_OK);
  const over = jtKindsWith("counts", `{"a":1,"b":2,"c":3,"d":4}`);
  const overBytes = jtBytes(over);
  const od = new JsonDecoder(overBytes, 0, toI32(overBytes.length), new JsonLimits());
  od.maxMapKeys = 3;
  t.eqI32("map limit: one key past it: code", jsonDecode(od, new Kinds()), JSON_DECODE_MAP_LIMIT);
  t.eqI32("map limit: one key past it: errorAt", od.errorAt, jtValueAt("counts", `{"a":1,"b":2,"c":3,"d":4}`) + 19);
  const nested = jtBytes(jtKindsWith("groups", `{"a":{"x":0,"y":5,"z":9},"b":{"x":0},"c":{}}`));
  const nd = new JsonDecoder(nested, 0, toI32(nested.length), new JsonLimits());
  nd.maxMapKeys = 3;
  t.eqI32("map limit: each map of a map of maps has its own", jsonDecode(nd, new Kinds()), JSON_DECODE_OK);
  const keys: string[] = [];
  for (let i: i32 = 0; i < 4096; i += 1) {
    keys.push(`"k${i}":${i % 7}`);
  }
  const atLimit = jtKindsWith("counts", `{${keys.join(",")}}`);
  t.eqI32("map limit: 4,096 keys by default", jtDecode(atLimit, new Kinds(), new JsonLimits(), false).failed, JSON_DECODE_OK);
  keys.push(`"k4096":0`);
  const pastLimit = jtKindsWith("counts", `{${keys.join(",")}}`);
  t.eqI32("map limit: and not 4,097", jtDecode(pastLimit, new Kinds(), new JsonLimits(), false).failed, JSON_DECODE_MAP_LIMIT);

  // The whole object in a window that ends on its closing brace, with bytes
  // the window leaves out on both sides.
  const framed = jtBytes(`xx${KINDS}yy`);
  const f = new JsonDecoder(framed, 2, toI32(KINDS.length), new JsonLimits());
  const inWindow = new Kinds();
  t.eqI32("map: a window ending on the closing brace", jsonDecode(f, inWindow), JSON_DECODE_OK);
  t.eqStr("map: and what it decoded", jtEncode(inWindow, 4096), KINDS);
};

/** Decode `text` into a fresh `Names` and check the code and the byte. */
const jtNamesError = (t: Suite, name: string, text: string, code: i32, at: i32): void => {
  const d = jtDecode(text, new Names(), new JsonLimits(), false);
  t.eqI32(`${name}: code`, d.failed, code);
  t.eqI32(`${name}: errorAt`, d.errorAt, at);
};

const jtDispatch = (t: Suite): void => {
  // Field names of 2-, 3- and 4-byte UTF-8, as raw bytes and as escapes.
  const names = `{"prénom":1,"prenoms":2,"名前":3,"𝑥":4}`;
  const n = new Names();
  t.eqI32("names: non-ASCII field names decode", jtDecode(names, n, new JsonLimits(), false).failed, JSON_DECODE_OK);
  t.eqStr("names: and encode", jtEncode(n, 256), names);
  const e = new Names();
  const escaped = `{"pr\\u00e9nom":1,"\\u0070renoms":2,"\\u540d\\u524d":3,"\\ud835\\udc65":4}`;
  t.eqI32("names: escaped field names decode", jtDecode(escaped, e, new JsonLimits(), false).failed, JSON_DECODE_OK);
  t.eqStr("names: to the same fields", jtEncode(e, 256), names);
  jtNamesError(t, "names: a key of a name's length and first bytes", `{"prénoX":1}`, JSON_DECODE_UNKNOWN, 1);
  jtNamesError(t, "names: a key of a name's length and another third byte", `{"prXnoms":1}`, JSON_DECODE_UNKNOWN, 1);
  jtNamesError(t, "names: a duplicate through an escape", `{"名前":1,"\\u540d\\u524d":2}`, JSON_DECODE_DUPLICATE, 12);

  // Twenty-four fields, in reverse order and every one escaped in full, then
  // the keys that share a length or a first byte with a field.
  const w = new Wide();
  t.eqI32("wide: decodes in any order", jtDecode(WIDE_REVERSED, w, new JsonLimits(), false).failed, JSON_DECODE_OK);
  t.eqStr("wide: encodes in declaration order", jtEncode(w, 1024), WIDE);
  const escapedAll = new Wide();
  t.eqI32("wide: every key escaped", jtDecode(jtEscapeKeys(WIDE), escapedAll, new JsonLimits(), false).failed, JSON_DECODE_OK);
  t.eqStr("wide: to the same fields", jtEncode(escapedAll, 1024), WIDE);
  t.eqI32("wide: a key of a field's length and first byte", jtDecode(`{"cods":1}`, new Wide(), new JsonLimits(), false).failed, JSON_DECODE_UNKNOWN);
  t.eqI32("wide: a key of a length no field has", jtDecode(`{"identifier":1}`, new Wide(), new JsonLimits(), false).failed, JSON_DECODE_UNKNOWN);
  t.eqI32("wide: an empty key", jtDecode(`{"":1}`, new Wide(), new JsonLimits(), false).failed, JSON_DECODE_UNKNOWN);
  t.eqI32("wide: a duplicate", jtDecode(`{"code":1,"code":2}`, new Wide(), new JsonLimits(), false).failed, JSON_DECODE_DUPLICATE);
  t.eqI32("wide: a missing field", jtDecode(`{"code":1}`, new Wide(), new JsonLimits(), false).failed, JSON_DECODE_MISSING);
};

const WIDE: string =
  `{"name":"n","city":"c","color":"red","state":"s","title":"t","street":"st","country":"co","created":13,` +
  `"updated":14,"latitude":1.5,"longitude":-2.5,"age":2,"zip":3,"code":4,"kind":5,"rank":6,"size":7,"count":8,` +
  `"score":9,"width":10,"height":11,"weight":12,"id":1,"active":true}`;

const WIDE_REVERSED: string =
  `{"active":true,"weight":12,"height":11,"width":10,"score":9,"count":8,"size":7,"rank":6,"kind":5,"code":4,` +
  `"zip":3,"age":2,"longitude":-2.5,"latitude":1.5,"updated":14,"created":13,"country":"co","street":"st",` +
  `"title":"t","state":"s","color":"red","city":"c","name":"n","id":1}`;

/** `text` with every byte of every key written as a `\u00XX` escape. */
const jtEscapeKeys = (text: string): string => {
  const hex = "0123456789abcdef";
  const out: string[] = [];
  let inKey = false;
  let inString = false;
  for (let i: i32 = 0; i < toI32(text.length); i += 1) {
    const c = toI32(text.charCodeAt(i));
    const ch = text.substring(i, i + 1);
    if (c === 34) {
      if (!inString) {
        // A string that opens after `{` or `,` is a key.
        const prev = i > 0 ? toI32(text.charCodeAt(i - 1)) : 0;
        inKey = prev === 123 || prev === 44;
      }
      inString = !inString;
      out.push(ch);
    } else if (inString && inKey) {
      out.push(`\\u00${hex.substring(c >> 4, (c >> 4) + 1)}${hex.substring(c & 15, (c & 15) + 1)}`);
    } else {
      out.push(ch);
    }
  }
  return out.join("");
};

/** The module whose IR is the golden, decoded and encoded once. */
const jtTag = (t: Suite): void => {
  const text = `{"id":18446744073709551615,"scores":[1,9223372036854775808],"levels":[9,0],"level":5}`;
  const src = jtBytes(text);
  const tag = new Tag();
  t.eqI32("tag: decodes", tagDecode(new JsonDecoder(src, 0, toI32(src.length), new JsonLimits()), tag), JSON_DECODE_OK);
  const w = new JsonWriter(new Array<u8>(256), 0);
  tagEncode(w, tag);
  t.eqStr("tag: encodes back to the same text", w.text(), text);
};

/** The suite's section for the kinds and the dispatch. */
export const jtKindsChecks = (t: Suite): void => {
  jtTag(t);
  jtU64(t);
  jtEnums(t);
  jtMaps(t);
  jtDispatch(t);
};

/**
 * `--round-trip-kinds <file>`: each line of the file decoded into a `Kinds`
 * and encoded back, one line apiece, or `error <code>`. `tests/run.js` holds
 * the lines to `JSON.stringify(JSON.parse(line))`, with an integer past 2^53
 * kept as its digits.
 */
export const jtKindsRoundTripFile = (path: string): i32 => {
  for (const line of splitLines(readFileSync(path))) {
    if (line.length === 0) {
      continue;
    }
    const k = new Kinds();
    const d = jtDecode(line, k, new JsonLimits(), false);
    console.log(d.failed === 0 ? jtEncode(k, 65536) : `error ${d.failed}`);
  }
  return 0;
};

/**
 * `--bench-wide <n>`: decode `WIDE` `n` times into one reused object, the
 * digits of its `id` the iteration's, and print a checksum of what was
 * decoded and the nanoseconds per decode, as `--bench` does for one field.
 * The keys are in reverse declaration order, so a key compared with the
 * names in declaration order meets its own last.
 */
export const jtBenchWide = (n: i32): i32 => {
  // `"id":1}` ends the text; its digits become `1` and the iteration's six.
  const text = `${WIDE_REVERSED.substring(0, WIDE_REVERSED.length - 1)}000000}`;
  const src = jtBytes(text);
  const last = toI32(src.length) - 2;
  const d = new JsonDecoder(src, 0, toI32(src.length), new JsonLimits());
  const w = new Wide();
  let sum: i32 = 0;
  const start = monotonicNanos();
  for (let i: i32 = 0; i < n; i += 1) {
    let v: i32 = i;
    for (let k: i32 = last; k >= last - 5 && k >= 0 && k < toI32(src.length); k -= 1) {
      src[k] = toU8(48 + (v % 10));
      v = toI32(v / 10);
    }
    d.reset(src, 0, toI32(src.length));
    sum = (sum * 31 + jsonDecode(d, w) + w.id + w.weight + toI32(w.country.length)) % 1000003;
  }
  const took = monotonicNanos() - start;
  console.log(`checksum ${sum} ns/op ${toF64(took) / toF64(n)}`);
  return 0;
};
