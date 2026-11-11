// Typed JSON over a tagged union: `jsonDecodeUnion` picks the variant by its
// tag, wherever the tag sits in the object, reusing `prev` when the tag
// matches; `jsonEncode` writes the tag first. `Expr` is recursive, so its
// decoder and its encoder are one function each (`expected.ir`). `events.ts`
// renames the tag key and overrides a tag's value. Each line that ends in
// `true`/`false` after the encoding says whether it is the input again.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode, jsonDecodeUnion, jsonEncode } from "nish/json-typed";
import { Left, event, hand } from "./events.ts";

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

// A union as a `Map`'s value: each value goes through the union's one decoder.
class Scope {
  vars: Map<string, Expr>;
  constructor() {
    this.vars = new Map<string, Expr>();
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
  console.log(`${label} ${d.failed} ${d.errorAt} ${got === prev} ${w.text()} ${w.text() === text}`);
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

// Prints the bytes the decoding read twice, and that they are within
// `maxDepth` times the input (docs/security/json.md, JSON-17). A decoder that
// looked for each object's tag from the start of the input again would read
// quadratically many, and the exact counts in `expected.out` would move.
const reread = (label: string, d: JsonDecoder, text: string, depth: i32): void => {
  const bound = depth * toI32(text.length);
  console.log(`${label} reread ${d.unionReread} of ${text.length} ${d.unionReread <= bound}`);
};

const deep = (levels: i32, depth: i32): void => {
  const text = chain(levels);
  const d = decoder(text, depth);
  const got = jsonDecodeUnion(d, zero());
  let n: i32 = 0;
  let at: Expr = got;
  while (at.kind === Kind.Neg) {
    n += 1;
    at = at.arg;
  }
  console.log(`deep ${levels} ${d.failed} ${d.errorAt} ${n}`);
  reread("deep", d, text, depth);
};

// One `Add` of `count` numbers, every tag written last, so the `Add` reads
// ahead over all of them once and each number over its own value.
const wide = (count: i32): void => {
  const parts: string[] = [];
  for (let i: i32 = 0; i < count; i += 1) {
    parts.push(`{"value":${i},"kind":"Num"}`);
  }
  const text = `{"args":[${parts.join(",")}],"note":null,"kind":"Add"}`;
  const d = decoder(text, 128);
  const got = jsonDecodeUnion(d, zero());
  const size = got.kind === Kind.Add ? got.args.length : 0;
  console.log(`wide ${count} ${d.failed} ${size}`);
  reread("wide", d, text, 128);
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
  // A variant's own field missing, after the tag and before it: the union
  // path reports it as `jsonDecode` does, at the variant's closing `}`.
  run("absent", `{"kind":"Add","args":[]}`, n);
  run("absent last", `{"args":[],"kind":"Add"}`, n);
  run("absent num", `{"kind":"Num"}`, n);
  // A tree written tag first all the way down reads nothing twice.
  const tree = `{"kind":"negate","arg":{"kind":"Add","args":[{"kind":"Num","value":1},{"kind":"negate","arg":{"kind":"Num","value":2}}],"note":{"kind":"Num","value":3}}}`;
  const dt = decoder(tree, 128);
  const t = jsonDecodeUnion(dt, n);
  const wt = new JsonWriter(new Array<u8>(256), 0);
  jsonEncode(wt, t);
  console.log(`tree ${dt.failed} ${wt.text() === tree}`);
  reread("tree", dt, tree, 128);
  // An element whose old variant is not the input's is replaced in its array;
  // one whose variant matches is decoded into.
  const swap = run(
    "swap",
    `{"kind":"Add","args":[{"kind":"Num","value":1},{"kind":"negate","arg":{"kind":"Num","value":2}}],"note":null}`,
    n,
  );
  if (swap.kind === Kind.Add) {
    const first = swap.args[0];
    const second = swap.args[1];
    run("swapped", `{"kind":"Add","args":[{"kind":"negate","arg":{"kind":"Num","value":3}},{"kind":"negate","arg":{"kind":"Num","value":4}}],"note":null}`, swap);
    console.log(`kept ${swap.args[0] === first} ${swap.args[1] === second}`);
  }
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
  wide(20);

  const vars = `{"vars":{"x":{"kind":"Num","value":1},"y":{"kind":"negate","arg":{"kind":"Num","value":2}}}}`;
  const dv = decoder(vars, 128);
  const scope = new Scope();
  const vcode = jsonDecode(dv, scope);
  const wv = new JsonWriter(new Array<u8>(256), 0);
  jsonEncode(wv, scope);
  console.log(`map ${vcode} ${scope.vars.size} ${wv.text()} ${wv.text() === vars}`);
  const dbad = decoder(`{"vars":{"x":{"kind":"Nope"}}}`, 128);
  console.log(`map bad ${jsonDecode(dbad, new Scope())} ${dbad.errorAt}`);

  event(`{"path":"/a","type":"open"}`);
  event(`{"type":"Close"}`);
  event(`{"kind":"Close"}`);
  event(`{"type":"open","type":"open"}`);
  event(`{"type":"open","hand":"Left","path":"/b"}`);
  event(`{"type":"open","hand":"open"}`);
  hand(new Left());
  return 0;
};
