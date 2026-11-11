// Typed JSON over a tagged union: `jsonDecodeUnion` picks the variant by its
// tag, wherever the tag sits in the object, reusing `prev` when the tag
// matches; `jsonEncode` writes the tag first. `Expr` is recursive, so its
// decoder and its encoder are one function each (`expected.ir`). `events.ts`
// renames the tag key and overrides a tag's value.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode, jsonDecodeUnion, jsonEncode } from "nish/json-typed";
import { event } from "./events.ts";

enum Kind {
  Num,
  Neg,
  Add,
}

class Num {
  readonly kind: Kind.Num = Kind.Num;
  value: f64 = 0;
}

class Neg {
  static readonly json = { tag: "negate" };
  readonly kind: Kind.Neg = Kind.Neg;
  arg: Expr;
  constructor() {
    this.arg = zero();
  }
}

class Add {
  readonly kind: Kind.Add = Kind.Add;
  args: Expr[];
  note: Expr | null = null;
  constructor() {
    const none: Expr[] = [];
    this.args = none;
  }
}

type Expr = Num | Neg | Add;

class Env {
  list: Expr[];
  maybe: Expr | null = null;
  constructor() {
    const none: Expr[] = [];
    this.list = none;
  }
}

const zero = (): Expr => new Num();

const bytes = (text: string): u8[] => {
  const src = new Array<u8>(toI32(text.length));
  for (let i: i32 = 0; i < toI32(src.length) && i < toI32(text.length); i += 1) {
    src[i] = toU8(text.charCodeAt(i));
  }
  return src;
};

const decoder = (text: string, depth: i32): JsonDecoder => {
  const src = bytes(text);
  const limits = new JsonLimits();
  limits.maxDepth = depth;
  return new JsonDecoder(src, 0, toI32(src.length), limits);
};

const run = (label: string, text: string, prev: Expr): Expr => {
  const d = decoder(text, 128);
  const got = jsonDecodeUnion(d, prev);
  const w = new JsonWriter(new Array<u8>(512), 0);
  jsonEncode(w, got);
  console.log(`${label} ${d.failed} ${d.errorAt} ${got === prev} ${w.text()}`);
  return got;
};

// A variant decoded alone reads its tag and checks it is its own.
const alone = (text: string): void => {
  const d = decoder(text, 128);
  const n = new Num();
  const code = jsonDecode(d, n);
  const w = new JsonWriter(new Array<u8>(128), 0);
  jsonEncode(w, n);
  console.log(`alone ${code} ${d.errorAt} ${w.text()}`);
};

// `levels` negations of 1, every tag written last, so each level looks ahead
// past the rest of its object for the tag before it rewinds.
const chain = (levels: i32): string => {
  const parts: string[] = [];
  for (let i: i32 = 0; i < levels; i += 1) {
    parts.push(`{"arg":`);
  }
  parts.push(`{"value":1,"kind":"Num"}`);
  for (let i: i32 = 0; i < levels; i += 1) {
    parts.push(`,"kind":"negate"}`);
  }
  return parts.join("");
};

const deep = (levels: i32, depth: i32): void => {
  const d = decoder(chain(levels), depth);
  const got = jsonDecodeUnion(d, zero());
  let n: i32 = 0;
  let at: Expr = got;
  while (at.kind === Kind.Neg) {
    n += 1;
    at = at.arg;
  }
  console.log(`deep ${levels} ${d.failed} ${d.errorAt} ${n}`);
};

export const main = (): i32 => {
  const n = zero();
  run("first", `{"kind":"Num","value":3}`, n);
  run("last", `{"value":4,"kind":"Num"}`, n);
  const a = run(
    "add",
    `{"kind":"Add","args":[{"kind":"Num","value":1},{"arg":{"kind":"Num","value":2},"kind":"negate"}],"note":null}`,
    n,
  );
  run("reuse", `{"kind":"Add","args":[{"kind":"Num","value":5}],"note":{"kind":"Num","value":6}}`, a);
  run("unknown", `{"kind":"Nope"}`, n);
  run("missing", `{"value":1}`, n);
  run("number", `{"kind":1}`, n);
  run("array", `[1]`, n);
  run("member", `{"kind":"Add","args":[{"kind":"Neg"}]}`, n);
  alone(`{"kind":"Num","value":7}`);
  alone(`{"value":7}`);
  alone(`{"kind":"Add","value":7}`);

  const e = new Env();
  const d = decoder(`{"list":[{"kind":"Num","value":9}],"maybe":{"value":3,"kind":"Num"}}`, 128);
  const code = jsonDecode(d, e);
  const w = new JsonWriter(new Array<u8>(256), 0);
  jsonEncode(w, e);
  console.log(`env ${code} ${d.errorAt} ${w.text()}`);

  const none: Expr | null = null;
  const d2 = decoder(`{"kind":"Num","value":8}`, 128);
  const got = jsonDecodeUnion(d2, none);
  console.log(`null ${d2.failed} ${got === null}`);

  deep(15, 16);
  deep(16, 16);

  event(`{"path":"/a","type":"open"}`);
  event(`{"type":"Close"}`);
  event(`{"kind":"Close"}`);
  event(`{"type":"open","type":"open"}`);
  return 0;
};
