import os
R = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(R, "genb")
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
    n = "r11b_" + name; assert n not in names; names.append(n)
    open(os.path.join(OUT, n + ".ts"), "w").write(src)
CASES = [
 ("arrval_push", 'const a = P.am.get("x"); if (a !== undefined) { a.push(5); }', "A"),
 ("arrval_store", 'const a = P.am.get("x"); if (a !== undefined) { a[0] = 5; }', "A"),
 ("arrval_walk_store", 'for (const a of P.am.values()) { a[0] = 5; }', "A"),
 ("arrval_goi_push", 'getOrInsert(P.am, "x", [0]).push(5);', "A"),
 ("arrval_nullish_push", 'const a = P.am.get("x") ?? [0]; a.push(5);', "A"),
 ("ok_arrval_read", 'const a = P.am.get("x"); if (a !== undefined && a[0] > 3) { console.log("big"); }', "A"),
 ("lset_walk_write", 'for (const l of P.lset) { l.x = 1; }', "L"),
 ("lset_keys_write", 'for (const l of P.lset.keys()) { l.x = 1; }', "L"),
 ("ok_lset_has", 'if (P.lset.has(P.leaf)) { console.log("has"); }', "L"),
 ("ok_lset_has_fresh", 'const l = new Leaf(); if (P.lset.has(l)) { console.log("has"); }', "T"),
 ("lset_add_fresh", 'P.lset.add(new Leaf());', "T"),
 ("lset_delete_param_key", 'P.lset.delete(P.leaf);', "T"),
 ("km_keys_write", 'for (const k of P.km.keys()) { k.x = 1; }', "L"),
 ("km_delete_param_key", 'P.km.delete(P.leaf);', "T"),
 ("ok_km_get_param_key", 'if ((P.km.get(P.leaf) ?? 0) > 3) { console.log("big"); }', "T"),
 ("km_set_param_key", 'P.km.set(P.leaf, 5); P.km.set(new Leaf(), 1);', "T"),
 ("nest_values_clear", 'for (const m of P.nest.values()) { m.clear(); }', "T"),
 ("nest_get_delete", 'const m = P.nest.get("x"); if (m !== undefined) { m.delete("x"); }', "T"),
 ("nest_goi_delete", 'getOrInsert(P.nest, "x", new Map<string, Leaf>()).delete("x");', "T"),
 ("nest_nullish_delete", 'const m = P.nest.get("x") ?? new Map<string, Leaf>(); m.delete("x");', "T"),
 ("ok_nest_get_has", 'const m = P.nest.get("x"); if (m !== undefined && m.has("x")) { console.log("has"); }', "T"),
 ("closure_delete", 'const f = (): void => { P.table.delete("x"); }; f();', "T"),
 ("closure_arg_delete", 'const f = (m: Map<string, Leaf>): void => { m.delete("x"); }; f(P.table);', "T"),
 ("ok_closure_has", 'const f = (): boolean => P.table.has("x"); if (f()) { console.log("has"); }', "T"),
 ("wrapper_del", 'new W(P.table).del();', "T"),
 ("wrapper_const_del", 'const w = new W(P.table); w.del();', "T"),
 ("ok_wrapper_has", 'const w = new W(P.table); if (w.has()) { console.log("has"); }', "T"),
 ("call_recv_delete", 'tableOf(P).delete("x");', "T"),
 ("ok_call_recv_has", 'if (tableOf(P).has("x")) { console.log("has"); }', "T"),
 ("forof_tables_delete", 'for (const t of P.tables) { t.delete("x"); }', "T"),
 ("idx_var_delete", 'const i = c ? 0 : 0; P.tables[i].delete("x");', "T"),
 ("local_arr_alias_delete", 'const ts = [P.table]; ts[0].delete("x");', "T"),
 ("local_map_alias_delete", 'const o = new Map<string, Map<string, Leaf>>(); o.set("t", P.table); const t = o.get("t"); if (t !== undefined) { t.delete("x"); }', "T"),
 ("let_alias_delete", 'let m = P.tables[0]; if (c) { m = P.table; } m.delete("x");', "T"),
 ("has_then_delete", 'if (P.table.has("x")) { P.table.delete("x"); }', "T"),
 ("get_then_delete", 'const v = P.table.get("x"); if (v !== undefined) { P.table.delete("x"); }', "T"),
 ("delete_in_has_arg", 'if (P.table.has(P.table.delete("x") ? "x" : "y")) { console.log("has"); }', "T"),
 ("set_in_get_key", 'const v = P.table.get(P.table.set("y", new Leaf()).size > 0 ? "x" : "z"); if (v !== undefined) { console.log("v"); }', "T"),
 ("own_map_set_param_table_value", 'const o = new Map<string, Map<string, Leaf>>(); o.set("t", P.table); for (const t of o.values()) { t.clear(); }', "T"),
]
for name, body, task in CASES:
    for form in ("fn", "direct"):
        emit(f"{name}_{form}", body, task=task, form=form)
print(len(names))
open(os.path.join(R, "listb.txt"), "w").write("\n".join(os.path.join(OUT, n + ".ts") for n in names) + "\n")
