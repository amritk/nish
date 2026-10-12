import os
R = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(R, "gen")
HEAD = '''import { scope } from "nish/threads";
import { getOrInsert, reserve } from "nish/map";
class Leaf { x: i32 = 0; }
class Inner { table: Map<string, Leaf>; constructor() { this.table = new Map<string, Leaf>(); this.table.set("x", new Leaf()); } }
class Holder {
  leaf: Leaf; table: Map<string, Leaf>; tset: Set<string>; tables: Map<string, Leaf>[]; inner: Inner;
  nums: Map<string, i32>; nest: Map<string, Map<string, Leaf>>;
  constructor() {
    this.leaf = new Leaf();
    this.table = new Map<string, Leaf>(); this.table.set("x", this.leaf);
    this.tset = new Set<string>(); this.tset.add("x");
    const t0 = new Map<string, Leaf>(); t0.set("x", new Leaf()); this.tables = [t0];
    this.inner = new Inner();
    this.nums = new Map<string, i32>(); this.nums.set("x", 1);
    const n0 = new Map<string, Leaf>(); n0.set("x", new Leaf());
    this.nest = new Map<string, Map<string, Leaf>>(); this.nest.set("x", n0);
  }
}
const read = (h: Holder): i32 => {
  let t = h.table.size + h.tset.size * 10 + h.tables[0].size * 100 + h.inner.table.size * 1000 + h.nums.size * 10000;
  return t;
};
const readNest = (h: Holder): i32 => h.nest.size;
const readInner = (m: Map<string, Leaf>): i32 => m.size;
const readLeaf = (l: Leaf): i32 => l.x;
const readMap = (m: Map<string, Leaf>): i32 => m.size;
'''
HELPERS = {
 "hDelete": 'const hDelete = (m: Map<string, Leaf>): void => { m.delete("x"); };',
 "hClear": 'const hClear = (m: Map<string, Leaf>): void => { m.clear(); };',
 "hSet": 'const hSet = (m: Map<string, Leaf>): void => { m.set("y", new Leaf()); };',
 "hSetX": 'const hSetX = (m: Map<string, Leaf>): void => { const l = new Leaf(); l.x = 7; m.set("x", l); };',
 "hGoi": 'const hGoi = (m: Map<string, Leaf>): void => { getOrInsert(m, "y", new Leaf()); };',
 "hReserve": 'const hReserve = (m: Map<string, Leaf>): void => { reserve(m, 1000); };',
 "hHasSet": 'const hHasSet = (m: Map<string, Leaf>): void => { if (!m.has("y")) { m.set("y", new Leaf()); } };',
 "hUpd": 'const hUpd = (m: Map<string, Leaf>): void => { const l = new Leaf(); m.set("y", m.get("y") ?? l); };',
 "hGetWrite": 'const hGetWrite = (m: Map<string, Leaf>): void => { const v = m.get("x"); if (v !== undefined) { v.x = 5; } };',
 "hWalk": 'const hWalk = (m: Map<string, Leaf>): void => { for (const k of m.keys()) { if (k === "z") { console.log("z"); } } };',
 "hValWrite": 'const hValWrite = (m: Map<string, Leaf>): void => { for (const v of m.values()) { v.x = 3; } };',
 "hAdd": 'const hAdd = (s: Set<string>): void => { s.add("y"); };',
 "hSDel": 'const hSDel = (s: Set<string>): void => { s.delete("x"); };',
 "hSClear": 'const hSClear = (s: Set<string>): void => { s.clear(); };',
 "hSHasAdd": 'const hSHasAdd = (s: Set<string>): void => { if (!s.has("y")) { s.add("y"); } };',
 "hHas": 'const hHas = (m: Map<string, Leaf>): boolean => m.has("x");',
 "hGet": 'const hGet = (m: Map<string, Leaf>): i32 => { const v = m.get("x"); return v !== undefined ? v.x : 0; };',
 "hSize": 'const hSize = (m: Map<string, Leaf>): i32 => { const n = m.size; return n > 5 ? 1 : 0; };',
 "hSHas": 'const hSHas = (s: Set<string>): boolean => s.has("x");',
 "gDelete": 'const gDelete = <K, V>(m: Map<K, V>, k: K): void => { m.delete(k); };',
 "gClear": 'const gClear = <K, V>(m: Map<K, V>): void => { m.clear(); };',
 "gSet": 'const gSet = <K, V>(m: Map<K, V>, k: K, v: V): void => { m.set(k, v); };',
 "gGoi": 'const gGoi = <K, V>(m: Map<K, V>, k: K, v: V): void => { getOrInsert(m, k, v); };',
 "gReserve": 'const gReserve = <K, V>(m: Map<K, V>): void => { reserve(m, 1000); };',
 "gHasSet": 'const gHasSet = <K, V>(m: Map<K, V>, k: K, v: V): void => { if (!m.has(k)) { m.set(k, v); } };',
 "gUpd": 'const gUpd = <K, V>(m: Map<K, V>, k: K, v: V): void => { m.set(k, m.get(k) ?? v); };',
 "gWalk": 'const gWalk = <K, V>(m: Map<K, V>): i32 => { let n = 0; for (const k of m.keys()) { n += 1; } return n; };',
 "gAdd": 'const gAdd = <T>(s: Set<T>, k: T): void => { s.add(k); };',
 "gSDel": 'const gSDel = <T>(s: Set<T>, k: T): void => { s.delete(k); };',
 "gSClear": 'const gSClear = <T>(s: Set<T>): void => { s.clear(); };',
 "gGetOr": 'const gGetOr = <K, V>(m: Map<K, V>, k: K, d: V): V => m.get(k) ?? d;',
 "gHas": 'const gHas = <K, V>(m: Map<K, V>, k: K): boolean => m.has(k);',
 "gGet": 'const gGet = <K, V>(m: Map<K, V>, k: K): boolean => m.get(k) !== undefined;',
 "gSize": 'const gSize = <K, V>(m: Map<K, V>): number => m.size;',
}
TASKS = {
 "T": "s.spawn(read, h, done, 0);",
 "L": "s.spawn(readLeaf, h.leaf, done, 0);",
 "M": "s.spawn(readMap, h.table, done, 0);",
 "N": "const n0 = h.nest.get(\"x\"); if (n0 !== undefined) { s.spawn(readInner, n0, done, 0); }",
}
POST = {"T": "read(h)", "L": "readLeaf(h.leaf)", "M": "readMap(h.table)", "N": "(h.nest.get(\"x\") ?? new Map<string, Leaf>()).size"}
names = []
def emit(name, body, helpers=(), task="T", form="fn"):
    """body uses P for the holder; form fn: in bump(p); form direct: in the region on h."""
    extra = "\n".join(HELPERS[x] for x in helpers)
    if form == "fn":
        fn = "const bump = (p: Holder, c: boolean): void => {\n  " + body.replace("P", "p") + "\n};\n"
        region = "bump(h, c);"
    else:
        fn = ""
        region = body.replace("P", "h")
    src = HEAD + extra + ("\n" if extra else "") + fn + '''export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0]; const c = h.leaf.x === 0;
  {
    using s = scope();
    %s
    %s
  }
  console.log(`${done[0]} ${%s}`);
  return 0;
};
''' % (TASKS[task], region, POST[task])
    n = "r11_" + name
    assert n not in names, n
    names.append(n)
    open(os.path.join(OUT, n + ".ts"), "w").write(src)

# --- receivers: how the region reaches a Map<string, Leaf> of p
RECV = {
 "tbl": ("", "P.table", ""),
 "arr": ("", "P.tables[0]", ""),
 "nst": ("", "P.inner.table", ""),
 "als": ("const m = P.table; ", "m", ""),
 "ngt": ('const nn = P.nest.get("x"); if (nn !== undefined) { ', "nn", " }"),
 "ter": ("", "(c ? P.table : P.tables[0])", ""),
}
# --- map ops: (name, code(X), helper, generic call(X))
OPS = [
 ("del", lambda X: f'{X}.delete("x");', "hDelete", lambda X: f'gDelete({X}, "x");', ["gDelete"]),
 ("clr", lambda X: f'{X}.clear();', "hClear", lambda X: f'gClear({X});', ["gClear"]),
 ("setnew", lambda X: f'{X}.set("y", new Leaf());', "hSet", lambda X: f'gSet({X}, "y", new Leaf());', ["gSet"]),
 ("setx", lambda X: f'const l7 = new Leaf(); l7.x = 7; {X}.set("x", l7);', "hSetX", lambda X: f'const l7 = new Leaf(); l7.x = 7; gSet({X}, "x", l7);', ["gSet"]),
 ("goi", lambda X: f'getOrInsert({X}, "y", new Leaf());', "hGoi", lambda X: f'gGoi({X}, "y", new Leaf());', ["gGoi"]),
 ("rsv", lambda X: f'reserve({X}, 1000);', "hReserve", lambda X: f'gReserve({X});', ["gReserve"]),
 ("hasset", lambda X: f'if (!{X}.has("y")) {{ {X}.set("y", new Leaf()); }}', "hHasSet", lambda X: f'gHasSet({X}, "y", new Leaf());', ["gHasSet"]),
 ("hasfound", lambda X: f'const l7 = new Leaf(); l7.x = 7; if ({X}.has("x")) {{ {X}.set("x", l7); }}', None, None, []),
 ("upd", lambda X: f'const l = new Leaf(); {X}.set("y", {X}.get("y") ?? l);', "hUpd", lambda X: f'gUpd({X}, "y", new Leaf());', ["gUpd"]),
 ("getw", lambda X: f'const v = {X}.get("x"); if (v !== undefined) {{ v.x = 5; }}', "hGetWrite", None, []),
 ("getnw", lambda X: f'const v = {X}.get("x") ?? new Leaf(); v.x = 5;', None, None, []),
 ("valw", lambda X: f'for (const v of {X}.values()) {{ v.x = 3; }}', "hValWrite", None, []),
 ("walkdel", lambda X: f'for (const k of {X}.keys()) {{ {X}.delete(k); }}', None, None, []),
 ("chain", lambda X: f'{X}.set("y", new Leaf()).set("z", new Leaf());', None, None, []),
]
CTL = [
 ("ok_has", lambda X: f'if ({X}.has("x")) {{ console.log("has"); }}', "hHas", lambda X: f'if (gHas({X}, "x")) {{ console.log("has"); }}', ["gHas"]),
 ("ok_get", lambda X: f'const v = {X}.get("x"); if (v !== undefined && v.x > 3) {{ console.log("big"); }}', "hGet", lambda X: f'if (gGet({X}, "x")) {{ console.log("get"); }}', ["gGet"]),
 ("ok_size", lambda X: f'if ({X}.size > 5) {{ console.log("big"); }}', "hSize", lambda X: f'if (gSize({X}) > 5) {{ console.log("big"); }}', ["gSize"]),
 ("ok_hasget", lambda X: f'if ({X}.has("x")) {{ const v = {X}.get("x"); if (v !== undefined && v.x > 3) {{ console.log("big"); }} }}', None, None, []),
 ("ok_getown", lambda X: f'const o = new Map<string, Leaf>(); const v = {X}.get("x"); if (v !== undefined) {{ o.set("k", v); }} if (o.size > 3) {{ console.log("big"); }}', None, None, []),
 ("walk", lambda X: f'for (const k of {X}.keys()) {{ if (k === "z") {{ console.log("z"); }} }}', "hWalk", lambda X: f'if (gWalk({X}) > 5) {{ console.log("big"); }}', ["gWalk"]),
 ("walkv", lambda X: f'for (const v of {X}.values()) {{ if (v.x > 3) {{ console.log("big"); }} }}', None, None, []),
]
def helper_call(h, X):
    if h in ("hHas",): return f'if (hHas({X})) {{ console.log("has"); }}'
    if h in ("hGet", "hSize"): return f'if ({h}({X}) > 3) {{ console.log("big"); }}'
    return f'{h}({X});'

for (op, code, helper, gen, gh) in OPS + CTL:
    for rk, (pre, X, post) in RECV.items():
        for form in ("fn", "direct"):
            if rk == "ter" and form == "direct" and op not in ("del", "ok_has"): continue
            tk = "N" if rk == "ngt" else "T"
            emit(f"{op}_{rk}_{form}", pre + code(X) + post, form=form, task=tk)
            if helper:
                emit(f"{op}_{rk}_{form}_helper", pre + helper_call(helper, X) + post, helpers=[helper], form=form, task=tk)
            if gen:
                emit(f"{op}_{rk}_{form}_generic", pre + gen(X) + post, helpers=gh, form=form, task=tk)

# set ops on P.tset
SOPS = [
 ("sadd", 'P.tset.add("y");', "hAdd", 'gAdd(P.tset, "y");', ["gAdd"]),
 ("sdel", 'P.tset.delete("x");', "hSDel", 'gSDel(P.tset, "x");', ["gSDel"]),
 ("sclr", 'P.tset.clear();', "hSClear", 'gSClear(P.tset);', ["gSClear"]),
 ("shasadd", 'if (!P.tset.has("y")) { P.tset.add("y"); }', "hSHasAdd", None, []),
 ("schain", 'P.tset.add("y").add("z");', None, None, []),
 ("sforadd", 'for (const k of P.tset) { if (k === "q") { P.tset.add("y"); } } P.tset.add("y");', None, None, []),
 ("ok_shas", 'if (P.tset.has("x")) { console.log("has"); }', "hSHas", None, []),
 ("ok_swalk", 'for (const k of P.tset) { if (k === "z") { console.log("z"); } }', None, None, []),
]
for (op, code, helper, gen, gh) in SOPS:
    for form in ("fn", "direct"):
        emit(f"{op}_{form}", code, form=form)
        if helper:
            hc = f'if (hSHas(P.tset)) {{ console.log("has"); }}' if helper == "hSHas" else f"{helper}(P.tset);"
            emit(f"{op}_{form}_helper", hc, helpers=[helper], form=form)
        if gen:
            emit(f"{op}_{form}_generic", gen, helpers=gh, form=form)

# nums: Map<string, i32>
NOPS = [
 ("nset", 'P.nums.set("x", 5);'),
 ("nupd", 'P.nums.set("x", (P.nums.get("x") ?? 0) + 4);'),
 ("nhasupd", 'if (P.nums.has("x")) { P.nums.set("x", 5); }'),
 ("ndel", 'P.nums.delete("x");'),
 ("ngoi", 'getOrInsert(P.nums, "y", 3);'),
 ("ok_nget", 'if ((P.nums.get("x") ?? 0) > 3) { console.log("big"); }'),
 ("ok_nhas", 'if (P.nums.has("x")) { console.log("has"); }'),
]
for (op, code) in NOPS:
    for form in ("fn", "direct"):
        emit(f"{op}_{form}", code, form=form)
# task holds an aliased Leaf, parent writes through a lookup
for form in ("fn", "direct"):
    emit(f"L_getw_{form}", 'const v = P.table.get("x"); if (v !== undefined) { v.x = 5; }', task="L", form=form)
    emit(f"L_getw_{form}_helper", 'hGetWrite(P.table);', helpers=["hGetWrite"], task="L", form=form)
    emit(f"L_valw_{form}", 'for (const v of P.table.values()) { v.x = 3; }', task="L", form=form)
    emit(f"L_setx_{form}", 'const l7 = new Leaf(); l7.x = 7; P.table.set("x", l7);', task="L", form=form)
    emit(f"L_hasfound_{form}", 'const l7 = new Leaf(); l7.x = 7; if (P.table.has("x")) { P.table.set("x", l7); }', task="L", form=form)
    emit(f"L_getnw_{form}", 'const v = P.table.get("x") ?? new Leaf(); v.x = 5;', task="L", form=form)
    emit(f"L_getw_{form}_generic", 'const v = gGetOr(P.table, "x", new Leaf()); v.x = 5;', helpers=["gGetOr"], task="L", form=form)
    emit(f"L_getw_arr_{form}", 'const ts = [P.table]; const v = ts[0].get("x"); if (v !== undefined) { v.x = 5; }', task="L", form=form)
    emit(f"L_ok_get_{form}", 'const v = P.table.get("x"); if (v !== undefined && v.x > 3) { console.log("big"); }', task="L", form=form)
    # task holds the table itself
    emit(f"M_del_{form}", 'P.table.delete("x");', task="M", form=form)
    emit(f"M_setnew_{form}", 'P.table.set("y", new Leaf());', task="M", form=form)
    emit(f"M_goi_{form}", 'getOrInsert(P.table, "y", new Leaf());', task="M", form=form)
    emit(f"M_hasset_{form}", 'if (!P.table.has("y")) { P.table.set("y", new Leaf()); }', task="M", form=form)
    emit(f"M_ok_has_{form}", 'if (P.table.has("x")) { console.log("has"); }', task="M", form=form)
    emit(f"M_ok_get_{form}", 'const v = P.table.get("x"); if (v !== undefined && v.x > 3) { console.log("big"); }', task="M", form=form)
print(len(names))
open(os.path.join(R, "list.txt"), "w").write("\n".join(os.path.join(OUT, n + ".ts") for n in names) + "\n")
