// An arrow passed to a function-typed parameter reads the `const` locals and
// the parameters of the function it is written in. Each capture is lowered to
// an extra parameter of the lifted arrow and of the callee's instantiation, so
// `template` calls `mapType$fn...` with `texts` appended: a direct call, no
// environment, no indirect call. `collect` pushes onto a captured `const`
// array, a write through the reference the arrow was handed.
const FLAG_UNION: i32 = 1;

class Type {
  flags: i32 = 0;
  text: string = "";
  types: Type[];
  constructor(text: string) {
    this.text = text;
    this.types = [];
  }
}

class IndexInfo {
  keyType: Type;
  valueType: Type;
  constructor(k: Type, v: Type) {
    this.keyType = k;
    this.valueType = v;
  }
}

const mapType = (t: Type, f: (t: Type) => Type): Type => {
  if ((t.flags & FLAG_UNION) === 0) return f(t);
  const u = new Type("union");
  u.flags = FLAG_UNION;
  for (const m of t.types) u.types.push(f(m));
  return u;
};

const forEachType = (t: Type, f: (t: Type) => void): void => {
  if ((t.flags & FLAG_UNION) !== 0) {
    for (const m of t.types) f(m);
  } else f(t);
};

const template = (texts: string[], types: Type[], unionIndex: i32): Type =>
  mapType(types[unionIndex], (t) => new Type(texts[0] + t.text + texts[1]));

const collect = (keys: Type, valueType: Type): IndexInfo[] => {
  const infos: IndexInfo[] = [];
  forEachType(keys, (k) => {
    if (k.text === "string" || k.text === "number") infos.push(new IndexInfo(k, valueType));
  });
  return infos;
};

export const main = (): i32 => {
  const ab = new Type("union");
  ab.flags = FLAG_UNION;
  ab.types.push(new Type("a"));
  ab.types.push(new Type("b"));
  for (const m of template(["<", ">"], [ab], 0).types) console.log(m.text);
  const keys = new Type("union");
  keys.flags = FLAG_UNION;
  keys.types.push(new Type("string"));
  keys.types.push(new Type("symbol"));
  keys.types.push(new Type("number"));
  console.log(`${collect(keys, new Type("boolean")).length}`);
  return 0;
};
