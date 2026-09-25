// Inline fixed-length array fields: which class fields hold their array inside
// the object (docs/LANGUAGE.md, "Fixed-length array fields are stored inline").
//
// A field `f: T[]` is normally one pointer to an array header somewhere else in
// the arena, and `this.f[i]` loads that pointer, then the header's `data`, then
// the element. When nobody can tell where the array lives, the header and `K`
// element slots can sit inside the object instead, and `this.f[i]` becomes a
// load at a constant offset from `this`. This pass decides, once every body of
// every module is checked, which fields that is, and lays their classes out
// again (`computeLayout` in `self/structs.ts`). The emitter reads
// `FieldInfo.inlineCapacity` and `CheckedProgram.inlineAssignLength`; it
// never decides anything itself.
//
// **Why nobody can tell.** Reference semantics are about who else can reach an
// array. Two references to the field's array could see the move, and the rule
// admits neither:
//
//   - every assignment `x.f = e;` stores a *fresh* array, one no other
//     reference exists to: a literal, `new Array<T>(n)`, or a call to a
//     function this pass proves returns one (`freshReturnOf`). The pointer
//     layout would have kept that array; the inline one copies its elements
//     into the slot and forgets it, and with no second reference the two are
//     indistinguishable;
//   - `x.f` is only ever indexed or asked its `.length`, so the field's own
//     array is never a value anywhere: no local, argument, return value,
//     capture, `for ... of` or method call (so no `push` or `pop`) ever holds
//     it;
//   - one reference is left, and it is short: an element access evaluates
//     `x.f` before its index, and a store before the value it writes. If
//     either can assign the field, the access uses the array the field held
//     before, which the inline slots no longer are (`checkOrder`), so nothing
//     an access runs after `x.f` may reach an assignment to it.
//
// Each assignment's length is a literal the pass records beside the node, so
// the emitter can write the slot directly and the slot is sized for the
// largest, `K`. The header keeps `len`, so an assignment of a shorter literal
// (the `[]` a constructor starts with) leaves `.length` exactly what it was.
//
// **Who else could see the layout.** A class a host can reach
// (`hostVisible`: exported in any build that is not a closed-world `--link`)
// keeps its layout, and a build that describes or shares layouts at all — a
// header, a `.d.ts`, an N-API shim, wasm, a declared C function
// (`BuildMode.layoutsShared`) — inlines nothing.
//
// **What the pass does not try.** A generic class, a class that `implements`
// an interface (its prefix is another struct's layout), a record element type
// (an inline record would hand out interior pointers into the object), and a
// field named in an instantiation's body or inside an arrow, where the node
// tables are not this module's: each keeps the pointer layout.

import { CheckContext } from "./context";
import { intrinsicType, isAssignmentOperator } from "./emit_util";
import { StringMap } from "./map";
import {
  N_ARRAY,
  N_ARROW,
  N_BINARY,
  N_BLOCK,
  N_CALL,
  N_EMPTY,
  N_EXPR_STMT,
  N_IDENT,
  N_INDEX,
  N_MEMBER,
  N_NEW,
  N_NUMBER,
  N_OBJECT,
  N_PAREN,
  N_RETURN,
  N_UNARY,
  N_VAR_DECL,
  Node,
} from "./nodes";
import {
  CheckedProgram,
  FieldInfo,
  FunctionSig,
  inlineElementStruct,
  Instantiation,
  STRUCT_CLASS,
  StructInfo,
} from "./program";
import { computeLayout } from "./structs";
import { Local, STORAGE_PARAM } from "./symbols";
import { isFloat, TypeTable } from "./types";
import { BuildMode, hostVisible } from "./visibility";

/**
 * The most bytes of element slots one inline field may hold: a bound on how
 * much every object of the class grows, not on what reassigning costs.
 *
 * Measured with a field of `K` `i32`s reassigned once per pass of a loop and
 * read `R` times per pass (x86-64, `--profile speed`, median of six
 * alternating runs, against the pointer layout):
 *
 *   - `this.v = new Array<i32>(K)` writes the slots in place and allocates
 *     nothing: 16% to 62% faster at K = 8 and 64, R = 1 to 256;
 *   - `this.v = made(K, s)` still makes its array and then copies it: 63% to
 *     118% *slower* at R = 1 and 16, and 20% to 52% faster at R = 64 and 256,
 *     with K = 8 losing about as much as K = 64.
 *
 * So the copy is a roughly fixed cost per assignment (a `memcpy` whose loads
 * wait on the narrow stores that just filled the source), and no cap on `K`
 * removes it; a field assigned from a call pays off only when it is read a few
 * dozen times per assignment, as AWFY Queens' are.
 */
export const INLINE_SLOT_BYTES: i32 = 256;

/** One array field that may be stored inline, and what the walk has found about it. */
class Candidate {
  info: StructInfo;
  field: FieldInfo;
  /** Cleared by the first use the rule does not admit. */
  ok: boolean;
  /** The largest length any assignment stores. */
  capacity: i32;
  /** Every `x.f = e` statement, its module, the length `e` has, and the function it is in. */
  sites: Node[];
  programs: CheckedProgram[];
  lengths: i32[];
  assigners: string[];
  /**
   * The functions an element access of the field calls *after* its array was
   * evaluated: in the index, or in the value an element store writes. One
   * that can assign the field breaks the rule (`checkOrder`).
   */
  later: string[];

  constructor(info: StructInfo, field: FieldInfo) {
    this.info = info;
    this.field = field;
    this.ok = true;
    this.capacity = 0;
    this.sites = [];
    this.programs = [];
    this.lengths = [];
    this.assigners = [];
    this.later = [];
  }
}

/**
 * What a function is proven to return: a fresh array whose length is the
 * constant `length`, or its parameter `param` when that is not -1.
 */
class FreshReturn {
  param: i32;
  length: i32;

  constructor(param: i32, length: i32) {
    this.param = param;
    this.length = length;
  }
}

class InlineWalk {
  contexts: CheckContext[];
  table: TypeTable;
  candidates: Candidate[];
  /** `Struct.field` -> index into `candidates`. */
  byKey: StringMap;
  /** Field name -> 1, for any candidate: the names a use nobody can type must spoil. */
  names: StringMap;
  /** Function symbol -> index into `returns`, or -1 once it is known to return nothing fresh. */
  memo: StringMap;
  returns: FreshReturn[];
  /** The symbol of the body being walked. */
  current: string;
  /** Callee symbol -> index into `callers`: who calls it, for `checkOrder`. */
  calleeIndex: StringMap;
  callers: string[][];

  constructor(contexts: CheckContext[]) {
    this.contexts = contexts;
    this.table = contexts[0].table;
    this.candidates = [];
    this.byKey = new StringMap();
    this.names = new StringMap();
    this.memo = new StringMap();
    this.returns = [];
    this.current = "";
    this.calleeIndex = new StringMap();
    this.callers = [];
  }

  /** Record that the body being walked calls `callee`. */
  call(callee: string): void {
    let at = this.calleeIndex.get(callee, -1);
    if (at < 0) {
      at = this.callers.length;
      this.calleeIndex.set(callee, at);
      const none: string[] = [];
      this.callers.push(none);
    }
    const list = this.callers[at];
    if (list.indexOf(this.current) < 0) {
      list.push(this.current);
    }
  }

  add(info: StructInfo, field: FieldInfo): void {
    this.byKey.set(`${info.name}.${field.name}`, this.candidates.length);
    this.names.set(field.name, 1);
    this.candidates.push(new Candidate(info, field));
  }

  /** Spoil every candidate called `name`: a use whose receiver has no type here. */
  spoilName(name: string): void {
    for (const c of this.candidates) {
      if (c.field.name === name) {
        c.ok = false;
      }
    }
  }
}

/** The expression inside any parentheses. */
const unwrap = (expr: Node): Node => {
  let e = expr;
  while (e.kind === N_PAREN) {
    e = e.children[0];
  }
  return e;
};

/** Whether `c` may be stored inline in a build of `mode`, before any body is read. */
const mayInline = (table: TypeTable, program: CheckedProgram, mode: BuildMode, info: StructInfo, field: FieldInfo): boolean => {
  if (info.kind !== STRUCT_CLASS || info.implementsNames.length > 0 || info.instance !== null || info.poisoned) {
    return false;
  }
  if (hostVisible(mode, info.exported, false) || !table.isArray(field.type)) {
    return false;
  }
  return inlineElementStruct(program, table, table.refOf(field.type)) === null;
};

/**
 * The non-negative integer `expr` is, when it is a literal or a module
 * constant, or -1. Under `--number-mode f64` a `number` constant is a double,
 * and only an integral one counts.
 */
const constantLength = (program: CheckedProgram, expr: Node): i32 => {
  const e = unwrap(expr);
  if (e.kind === N_NUMBER) {
    const n: f64 = Number(e.text);
    if (n !== Math.floor(n) || n < 0.0 || n > 1048576.0) {
      return -1;
    }
    return toI32(n);
  }
  const constant = program.nodeConstants[e.id];
  if (constant === null) {
    return -1;
  }
  if (isFloat(constant.type)) {
    const v = constant.floatValue;
    return v === Math.floor(v) && v >= 0.0 && v <= 1048576.0 ? toI32(v) : -1;
  }
  const w = constant.intValue;
  return w >= toI64(0) && w <= toI64(1048576) ? toI32(w) : -1;
};

/** The module whose tables hold `sig`'s body, or `null`. */
const programOf = (walk: InlineWalk, sig: FunctionSig): CheckedProgram | null => {
  for (const ctx of walk.contexts) {
    if (sig.definedIn(ctx.program.source)) {
      return ctx.program;
    }
  }
  return null;
};

/** The parameter of `sig` that `expr` names, or -1. */
const paramIndex = (program: CheckedProgram, sig: FunctionSig, expr: Node): i32 => {
  const e = unwrap(expr);
  if (e.kind !== N_IDENT) {
    return -1;
  }
  const local = program.nodeLocals[e.id];
  if (local === null || local.storage !== STORAGE_PARAM) {
    return -1;
  }
  return sig.paramNames.indexOf(local.name);
};

/**
 * What an allocation in `sig`'s body denotes: a literal of `n` elements, or
 * `new Array<T>(n)` whose `n` is a literal or one of `sig`'s parameters. Any
 * other expression is `null`.
 */
const allocationOf = (program: CheckedProgram, table: TypeTable, sig: FunctionSig, expr: Node): FreshReturn | null => {
  const e = unwrap(expr);
  if (e.kind === N_ARRAY) {
    return new FreshReturn(-1, e.children.length);
  }
  if (e.kind !== N_NEW || !table.isArray(program.nodeTypes[e.id])) {
    return null;
  }
  const args = e.children[2].children;
  if (args.length !== 1) {
    return null;
  }
  const param = paramIndex(program, sig, args[0]);
  if (param >= 0) {
    return new FreshReturn(param, 0);
  }
  const n = constantLength(program, args[0]);
  return n < 0 ? null : new FreshReturn(-1, n);
};

/** The declaration of `local` inside `node`, or `null`. */
const declarationOf = (program: CheckedProgram, node: Node, local: Local): Node | null => {
  if (node.kind === N_VAR_DECL) {
    const declared = program.nodeLocals[node.id];
    if (declared !== null && declared === local) {
      return node;
    }
  }
  for (const child of node.children) {
    const found = declarationOf(program, child, local);
    if (found !== null) {
      return found;
    }
  }
  return null;
};

/**
 * Whether every use of `local` inside `node` indexes it, reads its `.length`
 * or returns it, and nothing assigns `.length`: the array it holds is never a
 * value anywhere else, so returning it hands back the only reference.
 */
const onlyIndexed = (program: CheckedProgram, node: Node, parent: Node | null, grand: Node | null, local: Local): boolean => {
  const named: Local | null = node.kind === N_IDENT ? program.nodeLocals[node.id] : null;
  if (named !== null && named === local) {
    if (parent === null) {
      return false;
    }
    if (parent.kind === N_INDEX && parent.children[0] === node) {
      return true;
    }
    if (parent.kind === N_MEMBER && parent.text === "length") {
      return !isWrite(grand, parent);
    }
    return parent.kind === N_RETURN;
  }
  for (const child of node.children) {
    if (!onlyIndexed(program, child, node, parent, local)) {
      return false;
    }
  }
  return true;
};

/** Whether `parent` writes `node`: an assignment to it, or `++` / `--`. */
const isWrite = (parent: Node | null, node: Node): boolean => {
  if (parent === null) {
    return false;
  }
  if (parent.kind === N_UNARY) {
    return parent.text === "++" || parent.text === "--";
  }
  return parent.kind === N_BINARY && parent.children[0] === node && isAssignmentOperator(parent.text);
};

/** Every `return` in `node`, which holds no arrow (`freshReturnOf` checked). */
const collectReturns = (node: Node, out: Node[]): void => {
  if (node.kind === N_RETURN) {
    out.push(node);
  }
  for (const child of node.children) {
    collectReturns(child, out);
  }
};

/** Whether an arrow is written anywhere in `node`. */
const holdsArrow = (node: Node): boolean => {
  if (node.kind === N_ARROW) {
    return true;
  }
  for (const child of node.children) {
    if (holdsArrow(child)) {
      return true;
    }
  }
  return false;
};

/**
 * What one return of `sig` hands back, or `null` when it is not a fresh array
 * this pass can size: an allocation (`allocationOf`), or a `const` local
 * initialised with one that the body only indexes (`onlyIndexed`).
 */
const returnedOf = (program: CheckedProgram, table: TypeTable, sig: FunctionSig, body: Node, value: Node): FreshReturn | null => {
  const e = unwrap(value);
  if (e.kind !== N_IDENT) {
    return allocationOf(program, table, sig, e);
  }
  const local = program.nodeLocals[e.id];
  if (local === null || local.mutable || local.storage === STORAGE_PARAM) {
    return null;
  }
  const decl = declarationOf(program, body, local);
  if (decl === null || decl.children[2].kind === N_EMPTY) {
    return null;
  }
  const made = allocationOf(program, table, sig, decl.children[2]);
  if (made === null || !onlyIndexed(program, body, null, null, local)) {
    return null;
  }
  return made;
};

/**
 * What `sig` is proven to return every time it returns (`FreshReturn`), or
 * `null`. Only a plain top-level function qualifies: its body is the one that
 * runs, checked into its own module's tables, and every return agrees.
 */
const freshReturnOf = (walk: InlineWalk, sig: FunctionSig): FreshReturn | null => {
  const known = walk.memo.get(sig.name, -2);
  if (known >= 0) {
    return walk.returns[known];
  }
  if (known === -1) {
    return null;
  }
  walk.memo.set(sig.name, -1);
  const body = sig.body();
  const program = programOf(walk, sig);
  if (body === null || program === null || sig.owner !== null || sig.instance !== null || sig.lifted) {
    return null;
  }
  if (sig.foreign() || sig.compileTime.length > 0 || !walk.table.isArray(sig.returnType) || holdsArrow(body)) {
    return null;
  }
  const values: Node[] = [];
  if (body.kind === N_BLOCK) {
    const returns: Node[] = [];
    collectReturns(body, returns);
    for (const r of returns) {
      if (r.children.length === 0 || r.children[0].kind === N_EMPTY) {
        return null;
      }
      values.push(r.children[0]);
    }
  } else {
    values.push(body); // a concise arrow body is the value it returns
  }
  let found: FreshReturn | null = null;
  for (const value of values) {
    const one = returnedOf(program, walk.table, sig, body, value);
    if (one === null) {
      return null;
    }
    if (found !== null && (found.param !== one.param || found.length !== one.length)) {
      return null;
    }
    found = one;
  }
  if (found !== null) {
    walk.memo.set(sig.name, walk.returns.length);
    walk.returns.push(found);
  }
  return found;
};

/** The length the fresh array `expr` has, or -1 when it is not one this pass can size. */
const inlineAssignedLength = (walk: InlineWalk, program: CheckedProgram, expr: Node): i32 => {
  const e = unwrap(expr);
  if (e.kind === N_ARRAY) {
    return e.children.length;
  }
  if (e.kind === N_NEW) {
    if (!walk.table.isArray(program.nodeTypes[e.id])) {
      return -1;
    }
    const args = e.children[2].children;
    return args.length === 1 ? constantLength(program, args[0]) : -1;
  }
  if (e.kind !== N_CALL) {
    return -1;
  }
  const callee = program.nodeCallees[e.id];
  if (callee === null) {
    return -1;
  }
  const fresh = freshReturnOf(walk, callee);
  if (fresh === null) {
    return -1;
  }
  if (fresh.param < 0) {
    return fresh.length;
  }
  const args = e.children[1].children;
  return fresh.param < args.length ? constantLength(program, args[fresh.param]) : -1;
};

/** Judge one `x.f` of candidate `c` by what it is written inside. */
const judgeUse = (walk: InlineWalk, program: CheckedProgram, c: Candidate, node: Node, parent: Node | null, grand: Node | null): void => {
  if (parent === null) {
    c.ok = false;
    return;
  }
  if (parent.kind === N_INDEX && parent.children[0] === node) {
    // An element read or write. What runs after `x.f` was evaluated -- the
    // index, and the value a store writes -- must not assign the field.
    laterCalls(walk, program, parent.children[1], c.later);
    if (grand !== null && grand.kind === N_BINARY && grand.children[0] === parent && isAssignmentOperator(grand.text)) {
      laterCalls(walk, program, grand.children[1], c.later);
    }
    return;
  }
  if (parent.kind === N_MEMBER && parent.text === "length") {
    if (isWrite(grand, parent)) {
      c.ok = false;
    }
    return;
  }
  const statement = grand !== null && grand.kind === N_EXPR_STMT;
  if (parent.kind === N_BINARY && parent.text === "=" && parent.children[0] === node && statement) {
    const n = inlineAssignedLength(walk, program, parent.children[1]);
    if (n < 0) {
      c.ok = false;
      return;
    }
    c.sites.push(parent);
    c.programs.push(program);
    c.lengths.push(n);
    c.assigners.push(walk.current);
    if (n > c.capacity) {
      c.capacity = n;
    }
    return;
  }
  c.ok = false;
};

/**
 * The symbol `node` calls: a user function or method, or the constructor a
 * `new` runs; `""` for anything else, builtins included, which assign no
 * field of a class.
 */
const calleeOf = (walk: InlineWalk, program: CheckedProgram, node: Node): string => {
  if (node.kind === N_CALL) {
    const callee = program.nodeCallees[node.id];
    return callee === null ? "" : callee.name;
  }
  if (node.kind !== N_NEW) {
    return "";
  }
  // The class named, not an interface it converts to, as `emitNew` asks.
  const type = intrinsicType(program, node);
  if (type < 0 || !walk.table.isStruct(type)) {
    return "";
  }
  const info = program.struct(walk.table.nameOf(type));
  if (info === null) {
    return "";
  }
  const ctor = info.ctor;
  return ctor === null ? "" : ctor.name;
};

/** Every function `node` calls, into `out`. */
const laterCalls = (walk: InlineWalk, program: CheckedProgram, node: Node, out: string[]): void => {
  const callee = calleeOf(walk, program, node);
  if (callee.length > 0 && out.indexOf(callee) < 0) {
    out.push(callee);
  }
  for (const child of node.children) {
    laterCalls(walk, program, child, out);
  }
};

/**
 * Spoil a candidate whose element access runs something that can assign the
 * field between evaluating `x.f` and using it. `this.v[i] = this.replace()`
 * evaluates `this.v` first, so when `replace` rebinds the field the store
 * lands in the *old* array and a later `this.v[i]` reads the new one. The
 * inline slots are one storage for both, so the two layouts would differ.
 *
 * "Can assign" is the call graph's reach: a function with an assignment to
 * the field, and everything that calls one, transitively. An assignment
 * anywhere the walk has no types -- an instantiation, an arrow -- has spoiled
 * the field already, so the assignments this starts from are all of them.
 */
const checkOrder = (walk: InlineWalk, c: Candidate): void => {
  if (c.later.length === 0) {
    return;
  }
  const reach: string[] = [];
  for (const name of c.assigners) {
    if (reach.indexOf(name) < 0) {
      reach.push(name);
    }
  }
  let i = 0;
  while (i < reach.length) {
    const at = walk.calleeIndex.get(reach[i], -1);
    if (at >= 0) {
      for (const caller of walk.callers[at]) {
        if (reach.indexOf(caller) < 0) {
          reach.push(caller);
        }
      }
    }
    i = i + 1;
  }
  for (const name of c.later) {
    if (reach.indexOf(name) >= 0) {
      c.ok = false;
      return;
    }
  }
};

/**
 * An object literal of a class sets every field of it with a value the rule
 * does not look at, so each array field it names keeps the pointer layout.
 */
const spoilLiteral = (walk: InlineWalk, program: CheckedProgram, node: Node, typed: boolean): void => {
  const type = program.nodeTypes[node.id];
  const t = type < 0 ? -1 : walk.table.stripNull(type);
  for (const prop of node.children) {
    if (!walk.names.has(prop.text)) {
      continue;
    }
    if (!typed || t < 0 || !walk.table.isStruct(t)) {
      walk.spoilName(prop.text);
      continue;
    }
    const at = walk.byKey.get(`${walk.table.nameOf(t)}.${prop.text}`, -1);
    if (at >= 0) {
      walk.candidates[at].ok = false;
    }
  }
};

/**
 * Visit every node of a body. `typed` is false inside an instantiation's body
 * or an arrow, where a receiver's type is not in `program`'s own tables: any
 * candidate's name there spoils it.
 */
const visitInline = (walk: InlineWalk, program: CheckedProgram, node: Node, parent: Node | null, grand: Node | null, typed: boolean): void => {
  const inside = typed && node.kind !== N_ARROW;
  const callee = calleeOf(walk, program, node);
  if (callee.length > 0) {
    walk.call(callee);
  }
  if (node.kind === N_OBJECT) {
    spoilLiteral(walk, program, node, inside);
  }
  if (node.kind === N_MEMBER && walk.names.has(node.text)) {
    const receiver = program.nodeTypes[node.children[0].id];
    if (!inside || receiver < 0) {
      walk.spoilName(node.text);
    } else {
      const t = walk.table.stripNull(receiver);
      if (walk.table.isStruct(t)) {
        const at = walk.byKey.get(`${walk.table.nameOf(t)}.${node.text}`, -1);
        if (at >= 0) {
          judgeUse(walk, program, walk.candidates[at], node, parent, grand);
        }
      }
    }
  }
  for (const child of node.children) {
    visitInline(walk, program, child, node, parent, inside);
  }
};

/**
 * Walk an instantiation's body in its own tables. It calls the functions it
 * was handed for its function parameters (WP29) as well as the ones it names.
 */
const visitInstance = (walk: InlineWalk, program: CheckedProgram, instance: Instantiation, body: Node): void => {
  for (const fn of instance.functionArgs) {
    walk.call(fn.name);
  }
  program.enterInstance(instance);
  visitInline(walk, program, body, null, null, false);
  program.leaveInstance();
};

/**
 * Decide which array fields of the program are stored inline, and lay their
 * classes out again. Runs once every body of every module is checked,
 * instantiations included, and before the call-site ranges and the attribute
 * analysis, which read the layout.
 */
export const layoutInlineArrays = (contexts: CheckContext[], mode: BuildMode): void => {
  if (contexts.length === 0 || mode.layoutsShared) {
    return;
  }
  const walk = new InlineWalk(contexts);
  for (const ctx of contexts) {
    const program = ctx.program;
    if (program.activeInstance !== null) {
      return;
    }
    for (const info of program.structList) {
      if (info.origin !== program.source) {
        continue;
      }
      for (const field of info.fields) {
        if (mayInline(walk.table, program, mode, info, field)) {
          walk.add(info, field);
        }
      }
    }
  }
  if (walk.candidates.length === 0) {
    return;
  }
  for (const ctx of contexts) {
    const program = ctx.program;
    for (const sig of program.functions) {
      const body = sig.body();
      if (body === null || !sig.definedIn(program.source) || sig.lifted) {
        continue;
      }
      walk.current = sig.name;
      const instance = sig.instance;
      if (instance !== null) {
        visitInstance(walk, program, instance, body);
      } else {
        visitInline(walk, program, body, null, null, true);
      }
    }
    for (const info of program.instantiationList) {
      const body = info.sig.body();
      if (body !== null) {
        walk.current = info.sig.name;
        visitInstance(walk, program, info, body);
      }
    }
  }
  for (const c of walk.candidates) {
    checkOrder(walk, c);
  }
  const changed: StructInfo[] = [];
  for (const c of walk.candidates) {
    const stride = walk.table.alignOf(walk.table.refOf(c.field.type));
    if (!c.ok || c.sites.length === 0 || c.capacity < 1 || c.capacity * stride > INLINE_SLOT_BYTES) {
      continue;
    }
    c.field.inlineCapacity = c.capacity;
    if (changed.indexOf(c.info) < 0) {
      changed.push(c.info);
    }
    let i = 0;
    while (i < c.sites.length) {
      c.programs[i].inlineAssignNodes.push(c.sites[i]);
      c.programs[i].inlineAssignLengths.push(c.lengths[i]);
      i = i + 1;
    }
  }
  for (const info of changed) {
    computeLayout(contexts[0], info);
  }
};
