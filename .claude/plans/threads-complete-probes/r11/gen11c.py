import os
R = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(R, "genc")
HEAD = '''import { scope } from "nish/threads";
import { getOrInsert, reserve } from "nish/map";
class Leaf { x: i32 = 0; }
class Holder {
  leaf: Leaf; arr: i32[]; table: Map<string, Leaf>; tables: Map<string, Leaf>[]; am: Map<string, i32[]>;
  lset: Set<Leaf>; km: Map<Leaf, i32>; nest: Map<string, Map<string, Leaf>>; inner: Map<string, Leaf>;
  constructor() {
    this.leaf = new Leaf(); this.arr = [1];
    this.table = new Map<string, Leaf>(); this.table.set("x", this.leaf);
    const t0 = new Map<string, Leaf>(); t0.set("x", new Leaf()); this.tables = [t0];
    this.am = new Map<string, i32[]>(); this.am.set("x", this.arr);
    this.lset = new Set<Leaf>(); this.lset.add(this.leaf);
    this.km = new Map<Leaf, i32>(); this.km.set(this.leaf, 1);
    this.inner = new Map<string, Leaf>(); this.inner.set("x", new Leaf());
    this.nest = new Map<string, Map<string, Leaf>>(); this.nest.set("x", this.inner);
  }
}
class W {
  m: Map<string, Leaf>;
  constructor(m: Map<string, Leaf>) { this.m = m; }
  del(): void { this.m.delete("x"); }
  has(): boolean { return this.m.has("x"); }
}
const tableOf = (h: Holder): Map<string, Leaf> => h.table;
const read = (h: Holder): i32 => h.table.size + h.tables[0].size * 10 + h.inner.size * 100 + h.lset.size * 1000 + h.km.size * 10000;
const touch = (l: Leaf): string => { l.x = 5; return "x"; };
const name = (l: Leaf): string => l.x > 3 ? "y" : "x";
const readLeaf = (l: Leaf): i32 => l.x;
const readArr = (a: i32[]): i32 => a.length * 10 + a[0];
'''
TASKS = {"T": ("s.spawn(read, h, done, 0);", "read(h)"), "L": ("s.spawn(readLeaf, h.leaf, done, 0);", "readLeaf(h.leaf)"),
         "A": ("s.spawn(readArr, h.arr, done, 0);", "readArr(h.arr)")}
names = []
def emit(name, body, task="T", form="fn"):
    if form == "fn":
        fn = "const bump = (p: Holder, c: boolean): void => {\n  " + body.replace("P", "p") + "\n};\n"
        region = "bump(h, c);"
    else:
        fn = ""; region = body.replace("P", "h")
    t, post = TASKS[task]
    src = HEAD + fn + '''export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0]; const c = h.leaf.x === 0;
  {
    using s = scope();
    %s
    %s
  }
  console.log(`${done[0]} ${%s}`);
  return 0;
};
''' % (t, region, post)
    n = "r11c_" + name; assert n not in names; names.append(n)
    open(os.path.join(OUT, n + ".ts"), "w").write(src)
CASES = [
 ("own_map_val_get_write", 'const o = new Map<string, Leaf>(); o.set("k", P.leaf); const v = o.get("k"); if (v !== undefined) { v.x = 5; }', "L"),
 ("own_map_val_walk_write", 'const o = new Map<string, Leaf>(); o.set("k", P.leaf); for (const v of o.values()) { v.x = 5; }', "L"),
 ("own_map_key_walk_write", 'const o = new Map<Leaf, i32>(); o.set(P.leaf, 1); for (const k of o.keys()) { k.x = 5; }', "L"),
 ("own_set_key_walk_write", 'const o = new Set<Leaf>(); o.add(P.leaf); for (const k of o) { k.x = 5; }', "L"),
 ("own_map_goi_key_walk_write", 'const o = new Map<Leaf, i32>(); getOrInsert(o, P.leaf, 1); for (const k of o.keys()) { k.x = 5; }', "L"),
 ("own_map_goi_val_write", 'const o = new Map<string, Leaf>(); getOrInsert(o, "k", P.leaf).x = 5;', "L"),
 ("own_map_upd_val_write", 'const o = new Map<string, Leaf>(); o.set("k", o.get("k") ?? P.leaf); const v = o.get("k"); if (v !== undefined) { v.x = 5; }', "L"),
 ("own_map_hasset_val_write", 'const o = new Map<string, Leaf>(); if (!o.has("k")) { o.set("k", P.leaf); } const v = o.get("k"); if (v !== undefined) { v.x = 5; }', "L"),
 ("param_map_val_into_own_then_write", 'const o = new Map<string, Leaf>(); const v = P.table.get("x"); if (v !== undefined) { o.set("k", v); } for (const w of o.values()) { w.x = 5; }', "L"),
 ("param_key_has_then_write_key", 'if (P.km.has(P.leaf)) { P.leaf.x = 5; }', "L"),
 ("own_key_has_then_write", 'const l = new Leaf(); if (P.km.has(l)) { console.log("has"); } l.x = 5; if (l.x > 9) { console.log("x"); }', "T"),
 ("own_key_delete_then_write", 'const l = new Leaf(); P.km.delete(l); l.x = 5;', "T"),
 ("own_key_get_then_store", 'const l = new Leaf(); const n = P.km.get(l) ?? 0; P.tables[0].set("q", l); l.x = n;', "T"),
 ("size_assign", 'P.table.size = 0;', "T"),
 ("has_key_arg_writes", 'if (P.table.has(touch(P.leaf))) { console.log("has"); }', "L"),
 ("get_key_arg_writes", 'const v = P.table.get(touch(P.leaf)); if (v !== undefined) { console.log("v"); }', "L"),
 ("ok_has_key_arg_pure", 'if (P.table.has(name(P.leaf))) { console.log("has"); }', "L"),
]
for name, body, task in CASES:
    for form in ("fn", "direct"):
        emit(f"{name}_{form}", body, task=task, form=form)
print(len(names))
open(os.path.join(R, "listc.txt"), "w").write("\n".join(os.path.join(OUT, n + ".ts") for n in names) + "\n")
