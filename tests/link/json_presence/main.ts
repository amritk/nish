// Typed JSON's `presence` option: a `boolean` field set, once the object
// closes, to whether the input gave another field's key. Every field kind is
// read present, absent and as `null`; a nested class records its own; a
// second decoding into one object answers for that input alone; and an
// encoding writes no presence field.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JSON_DECODE_OK, JSON_DECODE_TYPE, JsonDecoder, JsonNumber, jsonDecode, jsonEncode } from "nish/json-typed";
import { Suite } from "nish/testing";

export enum Tone {
  Low = 0,
  High = 7,
}

export class Inner {
  static readonly json = { optional: ["v"], presence: { v: "hasV" } };
  v: i32 = 0;
  hasV: boolean = false;
}

/** Each field kind once, optional, its presence recorded. */
export class Patch {
  static readonly json = {
    optional: ["a", "b", "c", "d", "e", "f", "s", "t", "inner", "num", "xs", "ins", "tones", "map", "ns"],
    presence: {
      a: "hasA",
      b: "hasB",
      c: "hasC",
      d: "hasD",
      e: "hasE",
      f: "hasF",
      s: "hasS",
      t: "hasT",
      inner: "hasInner",
      num: "hasNum",
      xs: "hasXs",
      ins: "hasIns",
      tones: "hasTones",
      map: "hasMap",
      ns: "hasNs",
    },
  };
  c: i64 = 3;
  d: u64 = 4;
  e: f64 = 5.5;
  s: string = "s";
  inner: Inner | null = null;
  num: JsonNumber | null = null;
  xs: i32[] | null = null;
  ins: Inner[] | null = null;
  tones: Tone[] | null = null;
  map: Map<string, i32> | null = null;
  ns: string | null = "kept";
  a: i32 = 1;
  b: u32 = 2;
  t: Tone = Tone.Low;
  f: boolean = true;
  hasA: boolean = false;
  hasB: boolean = false;
  hasC: boolean = false;
  hasD: boolean = false;
  hasE: boolean = false;
  hasF: boolean = false;
  hasS: boolean = false;
  hasT: boolean = false;
  hasInner: boolean = false;
  hasNum: boolean = false;
  hasXs: boolean = false;
  hasIns: boolean = false;
  hasTones: boolean = false;
  hasMap: boolean = false;
  hasNs: boolean = false;
}

/** A required field recorded too, beside one that is not. */
export class Required {
  static readonly json = { rename: { id: "ID" }, presence: { id: "gotId" } };
  gotId: boolean = false;
  id: i32 = 0;
  name: string = "";
}

const bytes = (s: string): u8[] => {
  const out = new Array<u8>(toI32(s.length));
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(s.length); i += 1) {
    out[i] = toU8(s.charCodeAt(i));
  }
  return out;
};

const decode = <T>(text: string, out: T): i32 => {
  const src = bytes(text);
  const d = new JsonDecoder(src, 0, toI32(src.length), new JsonLimits());
  jsonDecode(d, out);
  return d.failed;
};

const encode = <T>(value: T): string => {
  const w = new JsonWriter(new Array<u8>(1024), 0);
  jsonEncode(w, value);
  return w.text();
};

const flags = (p: Patch): string => {
  const all = [
    p.hasA, p.hasB, p.hasC, p.hasD, p.hasE, p.hasF, p.hasS, p.hasT,
    p.hasInner, p.hasNum, p.hasXs, p.hasIns, p.hasTones, p.hasMap, p.hasNs,
  ];
  const out: string[] = [];
  for (const b of all) {
    out.push(b ? "1" : "0");
  }
  return out.join("");
};

const FULL: string =
  `{"a":-1,"b":4000000000,"c":-9000000000,"d":18000000000000000000,"e":0.25,"f":false,"s":"x","t":7,` +
  `"inner":{"v":3},"num":12345678901234567890123,"xs":[1,2],"ins":[{"v":1},{}],"tones":[0,7],` +
  `"map":{"k":1},"ns":"y"}`;

const NULLS: string = `{"inner":null,"num":null,"xs":null,"ins":null,"tones":null,"map":null,"ns":null}`;

export const main = (): i32 => {
  const t = new Suite("json_presence");

  const full = new Patch();
  t.eqI32("present: decodes", decode(FULL, full), JSON_DECODE_OK);
  t.eqStr("present: every field is recorded as given", flags(full), "111111111111111");
  t.eqStr("present: and holds the input's value", `${full.a} ${full.b} ${full.c} ${full.d} ${full.e} ${full.f} ${full.s}`,
    "-1 4000000000 -9000000000 18000000000000000000 0.25 false x");
  t.ok("present: the enum holds its member", full.t === Tone.High);
  const inner = full.inner;
  t.ok("present: the nested class records its own field", inner !== null && inner.hasV && inner.v === 3);
  const ins = full.ins;
  t.ok("present: each element records its own", ins !== null && ins.length === 2 && ins[0].hasV && !ins[1].hasV);

  const empty = new Patch();
  t.eqI32("absent: decodes", decode(`{}`, empty), JSON_DECODE_OK);
  t.eqStr("absent: no field is recorded as given", flags(empty), "000000000000000");
  t.eqStr("absent: each holds its initializer", `${empty.a} ${empty.b} ${empty.s}`, "1 2 s");
  const ns = empty.ns;
  t.ok("absent: a `| null` field holds its initializer", ns !== null && ns === "kept");

  const nulls = new Patch();
  t.eqI32("null: decodes", decode(NULLS, nulls), JSON_DECODE_OK);
  t.eqStr("null: a key given as null is recorded as given", flags(nulls), "000000001111111");
  t.ok("null: and its field holds null", nulls.ns === null && nulls.inner === null && nulls.map === null);

  // Null on a field that is not `| null` is the type error it always was.
  t.eqI32("null: on a field that is not `| null` is a type error", decode(`{"a":null}`, new Patch()), JSON_DECODE_TYPE);

  // A second decoding into the same object answers for its own input.
  t.eqI32("again: decodes", decode(`{"s":"z"}`, full), JSON_DECODE_OK);
  t.eqStr("again: only the second input's key is recorded", flags(full), "000000100000000");

  t.eqStr("encode: writes no presence field", encode(empty),
    `{"c":3,"d":4,"e":5.5,"s":"s","inner":null,"num":null,"xs":null,"ins":null,"tones":null,"map":null,` +
    `"ns":"kept","a":1,"b":2,"t":0,"f":true}`);

  const r = new Required();
  t.eqI32("required: decodes", decode(`{"name":"n","ID":5}`, r), JSON_DECODE_OK);
  t.ok("required: a renamed field is recorded under its own name", r.gotId && r.id === 5);
  t.eqStr("required: encode leaves the presence field out", encode(r), `{"ID":5,"name":"n"}`);

  return t.done();
};
