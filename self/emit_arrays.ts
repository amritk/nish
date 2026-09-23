// Array lowering for stage1 (`src/codegen/emit/arrays.ts`,
// docs/wp14-selfhost.md milestone S4).
//
// Layout (ABI, shared with `runtime/runtime.c`'s `struct nish_array`): an array
// value is a `%struct.nish_array*` to an arena header
//
//   %struct.nish_array = type { i64 len, i64 cap, i8* data }
//
// `data` points at `cap` elements of `sizeof(T)` bytes, arena-allocated and
// 8-byte aligned.
//
// WP15 section 2a: when `T` is a record (an `interface`), the slot type is
// `%struct.T` rather than `%struct.T*` — the array holds the records
// themselves, `sizeof(T)` apart, exactly as a C array of that struct does.
// `a[i]` is then the `getelementptr` itself, with no load, and a write into a
// slot is an `llvm.memcpy` of the object. `inlineElementStruct` in
// `self/program.ts` carries the rule.
//
// The lowerings are `src/codegen/emit/arrays.ts`'s: literals
// and `new Array` allocate a header and a block (or two entry-block allocas
// when the escape analysis proved the array does not outlive the function),
// `a[i]` bounds-checks and indexes, and `indexOf` and `join` are emitted
// inline rather than added to `runtime.c`, which has a budget.
//
// The bounds check is `icmp ult i64 %idx, %len` and a branch to a cold block
// that calls `nish_panic_index` and never returns. Comparing *unsigned* makes a
// negative index fail too.

import { HoistedHeader, isResizeCall } from "./attributes";
import { NO_RECORD, recordReaches, recordStoreType } from "./bounds";
import { parseIntegerLiteral } from "./constants";
import { Emitter, LoopTarget } from "./emit";
import {
  compoundFloatOpcode,
  compoundIntegerOpcode,
  emitBitwiseCombine,
  emitIntBinary,
  isBitwiseAssignment,
} from "./emit_ops";
import { arrayMethodName, isAssignmentOperator, unwrapParens } from "./emit_util";
import { internalErrorFor } from "./ice";
import {
  N_BINARY,
  N_CALL,
  N_IDENT,
  N_INDEX,
  N_MEMBER,
  N_NEW,
  N_NUMBER,
  N_THIS,
  N_UNARY,
  N_VAR_DECL,
  Node,
} from "./nodes";
import { elementLLVMType, elementStride, inlineElementStruct, StructInfo } from "./program";
import { Local, STORAGE_PARAM } from "./symbols";
import { ARRAY_TYPE, EFFECT_WRITE } from "./runtime";
import { ARRAY_STRUCT, isFloat, isUnsigned, T_F64, T_I32, T_STRING } from "./types";

const HEADER: string = ARRAY_STRUCT;
const HEADER_PTR: string = "%struct.nish_array*";
const HEADER_BYTES: i32 = 24;
const MEMSET: string = "llvm.memset.p0i8.i64";
const MEMCPY: string = "llvm.memcpy.p0i8.p0i8.i64";

/**
 * WP15 section 2a: the record stored inline in this array's slots, or `null`
 * when a slot holds a value. `inlineElementStruct` in `self/program.ts`
 * carries the rule and the two exclusions.
 */
const inlineStruct = (emitter: Emitter, elem: i32): StructInfo | null => inlineElementStruct(emitter.program, emitter.table, elem);

/** Bytes from one element to the next: `sizeof` for an inline record, the value's size otherwise. */
const elementSize = (emitter: Emitter, elem: i32): i32 => elementStride(emitter.program, emitter.table, elem);

/** The LLVM type of one slot: `%struct.P` inline, the value type otherwise. */
const slotType = (emitter: Emitter, elem: i32): string => elementLLVMType(emitter.program, emitter.table, elem);

// ---- Alias domains ------------------------------------------------------------------

/**
 * An array's 24-byte header and the element buffer it points at never share a
 * byte, and telling LLVM so is what keeps the header out of the loop: without
 * it, `a[i] = v` might land on some array's `len` or `data`, so the header is
 * reloaded every iteration and neither LICM nor the vectoriser can run.
 * Measured at 1.6x on an element loop; the proof and the four allocation
 * shapes it covers are written out in `src/codegen/emit/arrays.ts`.
 */
const aliasScopeList = (emitter: Emitter, wantHeader: boolean): string => {
  const domain = emitter.metadata(`!{!"nish array"}`);
  const header = emitter.metadata(`!{!"header", ${domain}}`);
  const element = emitter.metadata(`!{!"elements", ${domain}}`);
  const headerList = emitter.metadata(`!{${header}}`);
  const elementList = emitter.metadata(`!{${element}}`);
  // All five are interned on every call, in stage0's order, so that the two
  // compilers number the nodes identically and the IR oracle stays byte for byte.
  if (wantHeader) {
    return headerList;
  }
  return elementList;
};

/**
 * `, !alias.scope ..., !noalias ...` for a load or store of an array header
 * field. Both halves are needed: `alias.scope` alone says only where the
 * access is, and the `noalias` on the other side is what makes it NoAlias.
 */
const headerAccess = (emitter: Emitter): string => {
  if (!emitter.opts.optimizeAttributes) {
    return "";
  }
  return `, !alias.scope ${aliasScopeList(emitter, true)}, !noalias ${aliasScopeList(emitter, false)}`;
};

/** The same, for a load or store of array element data. */
export const elementAccess = (emitter: Emitter): string => {
  if (!emitter.opts.optimizeAttributes) {
    return "";
  }
  return `, !alias.scope ${aliasScopeList(emitter, false)}, !noalias ${aliasScopeList(emitter, true)}`;
};

// ---- Loop header hoisting (WP15 section 2c) ------------------------------------------

/**
 * A stable array location: the binding a property path is rooted at, and the
 * chain below it. `root` is `null` when the expression is not a shape a
 * preheader can stand in for -- a call, an element access, a reassignable
 * local -- because re-evaluating one of those could panic, allocate, or simply
 * answer something else, and none of that is a hoist.
 */
class ArrayPath {
  root: Local | null;
  path: string;
  /**
   * The type the chain *declares*, carried rather than looked up at the use
   * site because the two differ exactly where it matters. The checker records
   * the *narrowed* type for an identifier inside `if (h !== null)`, and a hoist
   * lifts the load to the preheader, which is outside that guard: taking the
   * narrowed answer would dereference a null `h` in a loop whose body never
   * runs.
   */
  type: i32;

  constructor(root: Local | null, path: string, type: i32) {
    this.root = root;
    this.path = path;
    this.type = type;
  }
}

/**
 * The array an expression denotes: the header pointer, plus the hoisted fields
 * when an enclosing loop lifted them. Every read of `len` or `data` goes
 * through `baseLength` / `baseData`, so a hoisted loop and an ordinary one
 * differ in one place rather than at every access.
 */
class ArrayBase {
  arr: string;
  header: HoistedHeader | null;

  constructor(arr: string, header: HoistedHeader | null) {
    this.arr = arr;
    this.header = header;
  }
}

/** One array a loop reads, and which header fields the loop asks for. */
class ArrayUse {
  expr: Node;
  /** Narrowed here so that nothing downstream compares two nullable roots. */
  root: Local;
  path: string;
  len: boolean;
  data: boolean;

  constructor(expr: Node, root: Local, path: string, len: boolean, data: boolean) {
    this.expr = expr;
    this.root = root;
    this.path = path;
    this.len = len;
    this.data = data;
  }
}

const NO_PATH = (): ArrayPath => new ArrayPath(null, "", -1);

/**
 * The location `expr` reads, or a path with a `null` root when `expr` is not
 * one this can stand in for.
 *
 * What qualifies is an identifier (or `this`) bound to a parameter or a
 * non-mutable local, optionally followed by property accesses: `src`, `h.xs`,
 * `this.state.atMostIndex`. Every link has to be a plain struct, because the
 * preheader load happens whether or not the body runs and a `T | null` narrowed
 * *inside* the loop would be dereferenced before its guard.
 */
const pathOf = (emitter: Emitter, expr: Node): ArrayPath => {
  const inner = unwrapParens(expr);
  if (inner.kind === N_IDENT || inner.kind === N_THIS) {
    const local = emitter.program.nodeLocals[inner.id];
    if (local === null || (local.storage !== STORAGE_PARAM && local.mutable)) {
      return NO_PATH();
    }
    // `local.type` is what it was declared as, which is the answer a preheader
    // needs.
    return new ArrayPath(local, "", local.type);
  }
  if (inner.kind !== N_MEMBER) {
    return NO_PATH();
  }
  const below = pathOf(emitter, inner.children[0]);
  // A plain struct, declared: `T | null` is refused here whatever a guard
  // inside the loop narrowed it to. Anything with no struct to look the field
  // up in -- an imported module's name, a class named in a `new`, an enum --
  // falls out of the same test rather than needing a case of its own.
  if (below.root === null || !emitter.table.isStruct(below.type)) {
    return NO_PATH();
  }
  const info = emitter.program.struct(emitter.table.nameOf(below.type));
  if (info === null) {
    return NO_PATH();
  }
  const field = info.field(inner.text);
  if (field === null) {
    return NO_PATH();
  }
  return new ArrayPath(below.root, `${below.path}.${inner.text}`, field.type);
};

/** The hoisted header for `expr`, when an enclosing loop's preheader loaded one. */
const hoistedFor = (emitter: Emitter, expr: Node): HoistedHeader | null => {
  const headers = emitter.current.hoistedHeaders;
  if (headers.length === 0) {
    return null;
  }
  const path = pathOf(emitter, expr);
  const root = path.root;
  if (root === null) {
    return null;
  }
  let i = headers.length - 1;
  while (i >= 0) {
    const found = headers[i];
    if (found.root === root && found.path === path.path) {
      return found;
    }
    i = i - 1;
  }
  return null;
};

/** Lower the receiver of an element access or a `.length`, reusing a hoisted header where there is one. */
const emitArrayBase = (emitter: Emitter, expr: Node): ArrayBase => {
  const header = hoistedFor(emitter, expr);
  if (header !== null) {
    return new ArrayBase(header.arr, header);
  }
  return new ArrayBase(emitter.emitExpression(expr), null);
};

/** The array's `len`: the preheader's value inside a hoisted loop, a fresh load outside one. */
const baseLength = (emitter: Emitter, base: ArrayBase): string => {
  const header = base.header;
  if (header !== null) {
    return header.len;
  }
  return loadHeaderField(emitter, base.arr, 0, "i64");
};

/** The array's `data`, on the same terms as `baseLength`. */
const baseData = (emitter: Emitter, base: ArrayBase): string => {
  const header = base.header;
  if (header !== null) {
    return header.data;
  }
  return loadHeaderField(emitter, base.arr, 2, "i8*");
};

/**
 * Whether anything `loop` does can move an array header, which is the whole of
 * what a hoisted `len` and `data` depend on.
 *
 * Two things can: a `push` or a `pop` written in the loop, and a call to a user
 * function the fixpoint says grows an array (`FunctionFacts.resizesArray`). A
 * builtin cannot -- `push` and `pop` are the only builtins that reach a user
 * array's header and both are caught in the first place -- and an element store
 * cannot either, which is the reason the fact is not `writesThrough`: a loop
 * that writes `dst[i]` is exactly the loop this is for.
 *
 * A callee with no facts is treated as growing one, so an unanalysed program
 * hoists nothing rather than hoisting wrongly.
 */
const loopMayResize = (emitter: Emitter, node: Node): boolean => {
  if (isResizeCall(emitter.program, emitter.table, node)) {
    return true;
  }
  if (node.kind === N_CALL) {
    const callee = emitter.program.nodeCallees[node.id];
    if (callee !== null) {
      const facts = emitter.facts.get(callee.name);
      if (facts === null || facts.resizesArray) {
        return true;
      }
    }
  }
  for (const child of node.children) {
    if (loopMayResize(emitter, child)) {
      return true;
    }
  }
  return false;
};

/**
 * Collect the field names `loop` stores to into `names` and the records it
 * stores whole into `records`, and answer whether it can store to a field it
 * can neither name nor place -- a `new`, or a call to a user function that
 * writes memory.
 *
 * An element store into an array of inline records rewrites a record in place
 * and every field of it with no name written, but only a record of that type
 * (`recordStoreType` in `self/bounds.ts`, the rule the bounds proof drops its
 * path facts by), so it is collected rather than folded into the answer: a
 * path read entirely off classes keeps its hoist (`pathHoldsRecord`).
 *
 * A hoisted `h.xs` is a field load lifted into the preheader, so it stands only
 * while nothing in the loop puts a different array in that field. A store to a
 * field of *another* name cannot, whatever it aliases, which is why the names
 * are collected rather than a single flag: a loop that advances `this.pos` may
 * still hoist `this.source`.
 *
 * `effect === EFFECT_WRITE` is a blunt instrument for the calls -- it is also
 * true of a callee that only allocates -- and a narrower "writes a field" fact
 * would let more loops through. It is the fact that exists today, and being too
 * careful here costs a hoist rather than an answer.
 */
const storedFields = (emitter: Emitter, node: Node, names: string[], records: i32[]): boolean => {
  let opaque = false;
  if (node.kind === N_BINARY && isAssignmentOperator(node.text)) {
    const target = unwrapParens(node.children[0]);
    if (target.kind === N_MEMBER && names.indexOf(target.text) < 0) {
      names.push(target.text);
    }
    if (target.kind === N_INDEX) {
      // A record rewritten in place, every field of it unnamed (#180).
      const stored = recordStoreType(emitter.program, emitter.table, target);
      if (stored !== NO_RECORD && records.indexOf(stored) < 0) {
        records.push(stored);
      }
    }
  } else if (node.kind === N_UNARY) {
    const target = unwrapParens(node.children[0]);
    if (target.kind === N_MEMBER && names.indexOf(target.text) < 0) {
      names.push(target.text);
    }
  } else if (node.kind === N_NEW) {
    opaque = true; // the constructor stores fields, and not only its own
  } else if (node.kind === N_CALL) {
    const callee = emitter.program.nodeCallees[node.id];
    if (callee !== null) {
      const facts = emitter.facts.get(callee.name);
      if (facts === null || facts.effect === EFFECT_WRITE) {
        opaque = true;
      }
    }
  }
  for (const child of node.children) {
    if (storedFields(emitter, child, names, records)) {
      opaque = true;
    }
  }
  return opaque;
};

/** Every local `loop` declares: a path rooted at one of them cannot be lifted above its declaration. */
const localsDeclaredIn = (emitter: Emitter, node: Node, out: Local[]): void => {
  if (node.kind === N_VAR_DECL) {
    const local = emitter.program.nodeLocals[node.id];
    if (local !== null) {
      out.push(local);
    }
  }
  for (const child of node.children) {
    localsDeclaredIn(emitter, child, out);
  }
};

/** Record one array receiver, merging with an earlier use of the same location. */
const noteArrayUse = (emitter: Emitter, expr: Node, len: boolean, data: boolean, out: ArrayUse[]): void => {
  const path = pathOf(emitter, expr);
  const root = path.root;
  // Again the declared type: an `i32[] | null` narrowed inside the loop is
  // still nullable where the preheader would read its header.
  if (root === null || !emitter.table.isArray(path.type)) {
    return;
  }
  for (const found of out) {
    if (found.root === root && found.path === path.path) {
      found.len = found.len || len;
      found.data = found.data || data;
      return;
    }
  }
  out.push(new ArrayUse(expr, root, path.path, len, data));
};

/**
 * Collect the array receivers `loop` reads through, one entry per distinct
 * location, with whether the loop needs that array's `len` (a `.length` read or
 * a bounds check) and its `data` (any element access).
 *
 * Nested loops are walked too: their preheaders sit inside this one, so an
 * array both of them read is better hoisted here, and an array only the inner
 * loop reads is hoisted by the inner loop's own scope.
 */
const arrayUses = (emitter: Emitter, node: Node, out: ArrayUse[]): void => {
  if (node.kind === N_INDEX) {
    // A proven index reads no length (`emitBoundsCheck` skips the check), so
    // asking for one here would put a load in the preheader the loop never
    // uses. The proof is read in both places or in neither.
    const needsLen = !emitter.opts.uncheckedIndexing && !emitter.program.nodeProvenIndex[node.id];
    noteArrayUse(emitter, node.children[0], needsLen, true, out);
  } else if (node.kind === N_MEMBER && node.text === "length") {
    noteArrayUse(emitter, node.children[0], true, false, out);
  }
  for (const child of node.children) {
    arrayUses(emitter, child, out);
  }
};

/**
 * Whether a whole-record store the loop makes can rewrite a link of a path:
 * some field of it is read off a holder declared as a record type the loop
 * stores whole (`recordReaches`, shared with the bounds proof). The root's own
 * type counts, since `const r = rs[0]` is a view into `rs`; a class never does.
 */
const pathHoldsRecord = (emitter: Emitter, expr: Node, records: i32[]): boolean => {
  if (records.length === 0) {
    return false;
  }
  let link = unwrapParens(expr);
  while (link.kind === N_MEMBER) {
    const holder = pathOf(emitter, link.children[0]).type;
    for (const stored of records) {
      if (recordReaches(stored, holder)) {
        return true;
      }
    }
    link = unwrapParens(link.children[0]);
  }
  return false;
};

/** Whether any link of a path names a field the loop stores to. */
const pathIsShadowed = (expr: Node, names: string[]): boolean => {
  let link = unwrapParens(expr);
  while (link.kind === N_MEMBER) {
    if (names.indexOf(link.text) >= 0) {
      return true;
    }
    link = unwrapParens(link.children[0]);
  }
  return false;
};

/**
 * Lift every array header `loop` reads into the block being emitted, which is
 * the loop's preheader, and open a scope so the loop body reads them back.
 *
 * `emit_control.ts` calls this with the branch into the loop head not yet
 * written, so what this emits lands in the block that dominates the whole loop
 * and runs once. `closeHeaderScope` closes it.
 *
 * The point of lifting `len` rather than only the header pointer is the whole
 * of section 2c's criterion: a loop over an array in a class field reads the
 * length *twice*, once for the `while` condition and once for the bounds check,
 * and those are two loads of one address that GVN is not obliged to merge. One
 * `len` here is one value in both places by construction.
 */
export const openHeaderScope = (emitter: Emitter, loop: Node): void => {
  const facts = emitter.current;
  facts.hoistedScopeStarts.push(facts.hoistedHeaders.length);
  if (!emitter.opts.optimizeAttributes || loopMayResize(emitter, loop)) {
    return;
  }
  const uses: ArrayUse[] = [];
  arrayUses(emitter, loop, uses);
  if (uses.length === 0) {
    return;
  }
  const names: string[] = [];
  const records: i32[] = [];
  const opaque = storedFields(emitter, loop, names, records);
  const declared: Local[] = [];
  localsDeclaredIn(emitter, loop, declared);
  for (const use of uses) {
    const root = use.root;
    let skip = false;
    for (const local of declared) {
      if (local === root) {
        skip = true; // declared inside the loop: no value to lift
      }
    }
    if (use.path.length > 0) {
      // A property path, so the field loads move too and have to be stable.
      if (opaque || pathIsShadowed(use.expr, names) || pathHoldsRecord(emitter, use.expr, records)) {
        skip = true;
      }
    }
    if (skip) {
      continue;
    }
    emitter.declareType(ARRAY_TYPE);
    const arr = emitter.emitExpression(use.expr);
    // An array's header is `dereferenceable(24)` wherever one is reachable, so
    // both loads are safe in a preheader the body may never leave. The unused
    // one is not emitted: a loop that only reads `.length` should not grow a
    // `data` load it never asks for.
    let len = "";
    if (use.len) {
      len = loadHeaderField(emitter, arr, 0, "i64");
    }
    let data = "";
    if (use.data) {
      data = loadHeaderField(emitter, arr, 2, "i8*");
    }
    facts.hoistedHeaders.push(new HoistedHeader(root, use.path, arr, len, data));
  }
};

/** Close the innermost scope `openHeaderScope` opened. */
export const closeHeaderScope = (emitter: Emitter): void => {
  const facts = emitter.current;
  const starts = facts.hoistedScopeStarts;
  if (starts.length === 0) {
    return;
  }
  const start = starts[starts.length - 1];
  starts.pop();
  while (facts.hoistedHeaders.length > start) {
    facts.hoistedHeaders.pop();
  }
};

// ---- Header access ------------------------------------------------------------------

/** Address of header field `index` (0 len, 1 cap, 2 data). */
const headerFieldPointer = (emitter: Emitter, arr: string, index: i32): string => emitter.fn.emitValue(
    `getelementptr inbounds ${HEADER}, ${HEADER_PTR} ${arr}, i64 0, i32 ${index}`
  );

/** Load header field `index`, in the header alias domain. */
const loadHeaderField = (emitter: Emitter, arr: string, index: i32, type: string): string => {
  const ptr = headerFieldPointer(emitter, arr, index);
  return emitter.fn.emitValue(`load ${type}, ${type}* ${ptr}${emitter.align8()}${headerAccess(emitter)}`);
};

/** Store `value` into header field `index`, in the header alias domain. */
const storeHeaderField = (emitter: Emitter, arr: string, index: i32, value: string, type: string): void => {
  const ptr = headerFieldPointer(emitter, arr, index);
  emitter.fn.emit(`store ${type} ${value}, ${type}* ${ptr}${emitter.align8()}${headerAccess(emitter)}`);
};

const loadLength = (emitter: Emitter, arr: string): string => loadHeaderField(emitter, arr, 0, "i64");

/**
 * Address of element `idx` (an i64 value) of `arr`, as a `<slot type>*`. For
 * an inline record the slot type is the struct itself, so this *is* the
 * element's value: the GEP strides by `sizeof` and lands on the object.
 */
const elementPointer = (emitter: Emitter, base: ArrayBase, elem: i32, idx: string): string => {
  const ty = slotType(emitter, elem);
  const data = baseData(emitter, base);
  const typed = emitter.fn.emitValue(`bitcast i8* ${data} to ${ty}*`);
  return emitter.fn.emitValue(`getelementptr inbounds ${ty}, ${ty}* ${typed}, i64 ${idx}`);
};

/**
 * Read element `idx`: the slot's value, or — for an inline record — the slot's
 * *address*, which is what a struct value is everywhere else in the emitter.
 */
const loadElement = (emitter: Emitter, base: ArrayBase, elem: i32, idx: string): string => {
  const slot = elementPointer(emitter, base, elem, idx);
  if (inlineStruct(emitter, elem) !== null) {
    return slot;
  }
  const ty = emitter.llvm(elem);
  return emitter.fn.emitValue(
    `load ${ty}, ${ty}* ${slot}${emitter.alignSuffix(elem)}${elementAccess(emitter)}`
  );
};

/**
 * Write `value` into the slot at `ptr`. For an inline record that is a copy of
 * the object's bytes: the array owns its storage, so a struct entering it is
 * duplicated into the slot rather than referenced from it. `llvm.memcpy` wants
 * the ranges equal or disjoint, and two whole objects of one class always are.
 */
const storeElement = (emitter: Emitter, ptr: string, elem: i32, value: string): void => {
  const info = inlineStruct(emitter, elem);
  if (info === null) {
    const ty = emitter.llvm(elem);
    emitter.fn.emit(
      `store ${ty} ${value}, ${ty}* ${ptr}${emitter.alignSuffix(elem)}${elementAccess(emitter)}`
    );
    return;
  }
  const ty = `%struct.${info.name}`;
  emitter.declare(
    `declare void @${MEMCPY}(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)`
  );
  const dst = emitter.fn.emitValue(`bitcast ${ty}* ${ptr} to i8*`);
  const src = emitter.fn.emitValue(`bitcast ${ty}* ${value} to i8*`);
  const a = emitter.opts.optimizeAttributes ? `align ${info.align} ` : "";
  emitter.fn.emit(
    `call void @${MEMCPY}(i8* ${a}${dst}, i8* ${a}${src}, i64 ${info.size}, i1 false)${elementAccess(emitter)}`
  );
};

/**
 * Lower a numeric expression and widen it to i64: `sext` from a signed
 * integer, `zext` from an unsigned one (which is what keeps a `u32` index
 * above `INT_MAX` from becoming a negative i64 and failing the unsigned bounds
 * compare), `fptosi` from double (truncates).
 */
export const emitIndex = (emitter: Emitter, expr: Node): string => {
  const type = emitter.typeOf(expr);
  const literal = unwrapParens(expr);
  // Fold the widening of a constant index. The `i32` truncation is the one the
  // checker already allows for; an i64 or unsigned literal is exact as written.
  if (literal.kind === N_NUMBER && !isFloat(type)) {
    const value = parseIntegerLiteral(literal.text);
    return type === T_I32 ? `${toI32(value)}` : `${value}`;
  }
  const value = emitter.emitExpression(expr);
  const ty = emitter.llvm(type);
  if (ty === "i64") {
    return value;
  }
  if (isFloat(type)) {
    return emitter.fn.emitValue(`fptosi ${ty} ${value} to i64`);
  }
  return emitter.fn.emitValue(`${isUnsigned(type) ? "zext" : "sext"} ${ty} ${value} to i64`);
};

/** Convert an i64 length back to the `number` type the checker recorded for `expr`. */
export const emitNumberFromI64 = (emitter: Emitter, value: string, expr: Node): string => {
  if (emitter.typeOf(expr) === T_F64) {
    return emitter.fn.emitValue(`sitofp i64 ${value} to double`);
  }
  return emitter.fn.emitValue(`trunc i64 ${value} to i32`);
};

/**
 * `idx < len` (unsigned) or a branch to a cold block that panics and never
 * returns. `len` is a value rather than an array, so `s.charCodeAt(i)` shares
 * this one check, this one panic and this one message.
 */
export const emitRangeCheck = (emitter: Emitter, idx: string, len: string): void => {
  if (emitter.opts.uncheckedIndexing) {
    return;
  }
  const fn = emitter.fn;
  const inRange = fn.emitValue(`icmp ult i64 ${idx}, ${len}`);
  const failBlock = fn.newBlock("bounds.fail");
  const okBlock = fn.newBlock("bounds.ok");
  fn.emit(`br i1 ${inRange}, label %${okBlock.label}, label %${failBlock.label}`);
  fn.placeBlock(failBlock);
  fn.emit(`call void ${emitter.useRuntime("nish_panic_index")}(i64 ${idx}, i64 ${len})`);
  fn.emit("unreachable");
  fn.placeBlock(okBlock);
};

/**
 * The bounds check of `a[i]`: the array's length, then the shared range check.
 * `site` is the access node, which is how the checker's proof is looked up —
 * a proven access loads no length at all, so the header read goes with the
 * compare rather than being left behind for LICM to hoist.
 *
 * A proof is not the same thing as `--unchecked-indexing`: the flag removes
 * every check and trusts the program, while a proof removes one check and the
 * safety is unchanged (WP15 §2.1/§2.2, `self/bounds.ts`).
 */
const emitBoundsCheck = (emitter: Emitter, base: ArrayBase, idx: string, site: Node): void => {
  if (emitter.opts.uncheckedIndexing || emitter.program.nodeProvenIndex[site.id]) {
    return;
  }
  emitRangeCheck(emitter, idx, baseLength(emitter, base));
};

/**
 * Allocate a header with `len = cap = n`; `data` is stored by `storeData`.
 * Answers the `%struct.nish_array*`: an alloca when `site` is on the stack.
 */
const emitHeader = (emitter: Emitter, n: string, site: Node): string => {
  emitter.declareType(ARRAY_TYPE);
  let arr = "";
  if (emitter.isStackSite(site)) {
    arr = emitter.fn.emitAlloca("arr.hdr", HEADER, 8);
  } else {
    const raw = emitter.fn.emitValue(
      `call i8* ${emitter.useRuntime("nish_alloc_struct")}(i64 ${HEADER_BYTES})`
    );
    arr = emitter.fn.emitValue(`bitcast i8* ${raw} to ${HEADER_PTR}`);
  }
  storeHeaderField(emitter, arr, 0, n, "i64");
  storeHeaderField(emitter, arr, 1, n, "i64");
  return arr;
};

/**
 * The non-negative integer a literal length denotes, or -1 for anything else.
 * It lives here rather than in `escape.ts`, which is the phase that *asks* it
 * whether a `new Array` site can be a stack slot, so that the module graph
 * reads the way stage0's does (`src/codegen/emit/arrays.ts`, where the reverse
 * import would close an ESM cycle). Both callers have to agree: the analysis
 * decides the site is stackable from the literal and the emitter types the
 * slot `[n x T]` from it.
 */
export const literalLength = (expr: Node): i32 => {
  const e = unwrapParens(expr);
  if (e.kind !== N_NUMBER) {
    return -1;
  }
  const n: f64 = Number(e.text);
  if (n !== Math.floor(n) || n < 0.0) {
    return -1;
  }
  return toI32(n);
};

/**
 * Element storage as an `i8*`: `[count x T]` on the stack when `site` is a
 * stack allocation (the count is then a literal), else `bytes` from the arena.
 * A `count` of -1 means the length is not a literal.
 */
const emitData = (emitter: Emitter, site: Node, elem: i32, count: i32, bytes: string): string => {
  if (count >= 0 && emitter.isStackSite(site)) {
    const ty = `[${count} x ${slotType(emitter, elem)}]`;
    const slot = emitter.fn.emitAlloca("arr.data", ty, 8);
    return emitter.fn.emitValue(`bitcast ${ty}* ${slot} to i8*`);
  }
  return emitter.fn.emitValue(`call i8* ${emitter.useRuntime("nish_alloc_struct")}(i64 ${bytes})`);
};

const storeData = (emitter: Emitter, arr: string, data: string): void => {
  storeHeaderField(emitter, arr, 2, data, "i8*");
};

// ---- Construction -------------------------------------------------------------------

/** `[a, b, c]`: elements are evaluated first (left to right), then stored into fresh storage. */
export const emitArrayLiteral = (emitter: Emitter, expr: Node): string => {
  const elem = emitter.table.refOf(emitter.typeOf(expr));
  const ty = slotType(emitter, elem);
  const values: string[] = [];
  for (const element of expr.children) {
    values.push(emitter.emitExpression(element));
  }
  const n = values.length;
  const arr = emitHeader(emitter, `${n}`, expr);
  const data = n === 0 ? "null" : emitData(emitter, expr, elem, n, `${n * elementSize(emitter, elem)}`);
  storeData(emitter, arr, data);
  if (n > 0) {
    const typed = emitter.fn.emitValue(`bitcast i8* ${data} to ${ty}*`);
    let i = 0;
    while (i < n) {
      const slot = emitter.fn.emitValue(`getelementptr inbounds ${ty}, ${ty}* ${typed}, i64 ${i}`);
      storeElement(emitter, slot, elem, values[i]);
      i = i + 1;
    }
  }
  return arr;
};

/**
 * `new Array<T>(n)`: `n` zeroed elements. A negative `n` becomes a huge
 * allocation and aborts in the arena. `new Int32Array(n)` and friends are the
 * same lowering with `T` fixed by the checker.
 */
export const emitNewArray = (emitter: Emitter, expr: Node): string => {
  const elem = emitter.table.refOf(emitter.typeOf(expr));
  const size = elementSize(emitter, elem);
  const n = emitIndex(emitter, expr.children[2].children[0]);
  const arr = emitHeader(emitter, n, expr);
  const bytes = size === 1 ? n : emitter.fn.emitValue(`mul i64 ${n}, ${size}`);
  // The slot's type spells the length out, so it has to come from the literal
  // and not from `n`, which is an IR operand: under `--number-mode f64` the
  // literal reaches here as a register (it has been through a conversion) and
  // parsing it back gave `[0 x T]`, a zero-element stack slot that then takes
  // the stores of a full-length array. `escape.ts` decided this was a stack
  // site from the same literal, so ask it the same question.
  const count = emitter.isStackSite(expr) ? literalLength(expr.children[2].children[0]) : -1;
  if (count < 0 && emitter.isStackSite(expr)) {
    process.exit(internalErrorFor("emitter: a stack array whose length is not a literal", emitter.opts.json));
  }
  const data = emitData(emitter, expr, elem, count, bytes);
  emitter.declare(`declare void @${MEMSET}(i8* nocapture writeonly, i8, i64, i1 immarg)`);
  const dataArg = emitter.opts.optimizeAttributes ? `i8* align 8 ${data}` : `i8* ${data}`;
  // The zero fill is element traffic like any other store, and saying so keeps
  // it from being read as a clobber of the `len`/`cap` written just above.
  emitter.fn.emit(`call void @${MEMSET}(${dataArg}, i8 0, i64 ${bytes}, i1 false)${elementAccess(emitter)}`);
  storeData(emitter, arr, data);
  return arr;
};

// ---- Element access -------------------------------------------------------------------

export const emitElementAccess = (emitter: Emitter, expr: Node): string => {
  const elem = emitter.typeOf(expr);
  emitter.declareType(ARRAY_TYPE);
  const base = emitArrayBase(emitter, expr.children[0]);
  const idx = emitIndex(emitter, expr.children[1]);
  emitBoundsCheck(emitter, base, idx, expr);
  return loadElement(emitter, base, elem, idx);
};

/**
 * `a[i] = v`: array, index, value, then the check and the store (the value is
 * the expression's result). `a[i] op= v`: array, index, check, load, value,
 * op, store, matching JavaScript's read-before-right-operand order.
 */
export const emitElementAssignment = (emitter: Emitter, expr: Node): string => {
  const target = expr.children[0];
  const elem = emitter.typeOf(target);
  const ty = emitter.llvm(elem);
  emitter.declareType(ARRAY_TYPE);
  const base = emitArrayBase(emitter, target.children[0]);
  const idx = emitIndex(emitter, target.children[1]);
  if (expr.text === "=") {
    const value = emitter.emitExpression(expr.children[1]);
    emitBoundsCheck(emitter, base, idx, target);
    storeElement(emitter, elementPointer(emitter, base, elem, idx), elem, value);
    return value;
  }
  // The array and the index were evaluated once, above; the check and the GEP
  // happen once here, and the load and the store share the address. That is
  // what keeps `xs[next()] |= 1` to one call and one bounds check.
  emitBoundsCheck(emitter, base, idx, target);
  const slot = elementPointer(emitter, base, elem, idx);
  const old = emitter.fn.emitValue(`load ${ty}, ${ty}* ${slot}${emitter.alignSuffix(elem)}${elementAccess(emitter)}`);
  let value = "";
  if (isBitwiseAssignment(expr.text)) {
    value = emitBitwiseCombine(emitter, expr.text, elem, old, expr.children[1]);
  } else {
    const rhs = emitter.emitExpression(expr.children[1]);
    value = isFloat(elem)
      ? emitter.fn.emitValue(`${compoundFloatOpcode(expr.text, emitter.opts.json)} ${ty} ${old}, ${rhs}`)
      : emitIntBinary(emitter, compoundIntegerOpcode(expr.text, emitter.opts.json), elem, old, rhs);
  }
  emitter.fn.emit(`store ${ty} ${value}, ${ty}* ${slot}${emitter.alignSuffix(elem)}${elementAccess(emitter)}`);
  return value;
};

// ---- Members ----------------------------------------------------------------------------

/** `a.length`, in the `number` width the checker recorded. */
export const emitArrayLength = (emitter: Emitter, expr: Node): string => {
  emitter.declareType(ARRAY_TYPE);
  const base = emitArrayBase(emitter, expr.children[0]);
  return emitNumberFromI64(emitter, baseLength(emitter, base), expr);
};

/** The byte length of a runtime string, shared by `join`. */
const stringLength = (emitter: Emitter, str: string): string => {
  const header = emitter.fn.emitValue(`bitcast i8* ${str} to i64*`);
  return emitter.fn.emitValue(`load i64, i64* ${header}${emitter.align8()}`);
};

/**
 * `===` for an element type: strings compare by content, floats with
 * `fcmp oeq` (so a `NaN` element is never found, as in JavaScript), and
 * everything else — integers, booleans, and the pointers of classes,
 * interfaces and arrays — with `icmp eq`.
 */
const emitElementEquals = (emitter: Emitter, elem: i32, a: string, b: string): string => {
  if (elem === T_STRING) {
    return emitter.fn.emitValue(
      `call zeroext i1 ${emitter.useRuntime("nish_str_eq")}(i8* ${a}, i8* ${b})`
    );
  }
  const opcode = isFloat(elem) ? "fcmp oeq" : "icmp eq";
  return emitter.fn.emitValue(`${opcode} ${emitter.llvm(elem)} ${a}, ${b}`);
};

/** `a.push(v)`: grow when full, store at `len`, and answer the new length. */
const emitPush = (emitter: Emitter, expr: Node, arr: string, elem: i32): string => {
  const fn = emitter.fn;
  const value = emitter.emitExpression(expr.children[1].children[0]);
  const lenPtr = headerFieldPointer(emitter, arr, 0);
  const len = fn.emitValue(`load i64, i64* ${lenPtr}${emitter.align8()}${headerAccess(emitter)}`);
  const cap = loadHeaderField(emitter, arr, 1, "i64");
  const full = fn.emitValue(`icmp eq i64 ${len}, ${cap}`);
  const growBlock = fn.newBlock("push.grow");
  const storeBlock = fn.newBlock("push.store");
  fn.emit(`br i1 ${full}, label %${growBlock.label}, label %${storeBlock.label}`);
  fn.placeBlock(growBlock);
  fn.emit(
    `call void ${emitter.useRuntime("nish_array_grow")}(${HEADER_PTR} ${arr}, i64 ${elementSize(emitter, elem)})`
  );
  fn.emit(`br label %${storeBlock.label}`);
  fn.placeBlock(storeBlock);
  storeElement(emitter, elementPointer(emitter, new ArrayBase(arr, null), elem, len), elem, value);
  const newLen = fn.emitValue(`add i64 ${len}, 1`);
  fn.emit(`store i64 ${newLen}, i64* ${lenPtr}${emitter.align8()}${headerAccess(emitter)}`);
  return emitNumberFromI64(emitter, newLen, expr);
};

/**
 * `a.pop()`: the last element, with the length decremented. An empty array
 * panics through the same `nish_panic_index` an index does — reported as
 * `0 >= 0`, which is the access being attempted — because there is no
 * `undefined` to return and no second return type to widen to.
 */
const emitPop = (emitter: Emitter, arr: string, elem: i32): string => {
  const fn = emitter.fn;
  const lenPtr = headerFieldPointer(emitter, arr, 0);
  const len = fn.emitValue(`load i64, i64* ${lenPtr}${emitter.align8()}${headerAccess(emitter)}`);
  if (!emitter.opts.uncheckedIndexing) {
    const empty = fn.emitValue(`icmp eq i64 ${len}, 0`);
    const failBlock = fn.newBlock("pop.empty");
    const okBlock = fn.newBlock("pop.ok");
    fn.emit(`br i1 ${empty}, label %${failBlock.label}, label %${okBlock.label}`);
    fn.placeBlock(failBlock);
    fn.emit(`call void ${emitter.useRuntime("nish_panic_index")}(i64 0, i64 0)`);
    fn.emit("unreachable");
    fn.placeBlock(okBlock);
  }
  const last = fn.emitValue(`sub i64 ${len}, 1`);
  fn.emit(`store i64 ${last}, i64* ${lenPtr}${emitter.align8()}${headerAccess(emitter)}`);
  // An inline record comes back as the address of the slot that was just
  // dropped. The bytes are still there; the next `push` reuses them, which is
  // why the checker counts `pop` as a mutation.
  return loadElement(emitter, new ArrayBase(arr, null), elem, last);
};

/**
 * `a.indexOf(v)`: the first index whose element is `=== v`, or -1. The scan is
 * emitted here rather than in `runtime.c`, which has a budget and would need
 * one search per element type anyway. The loop counts up to `len` and
 * terminates on its own, which is what keeps `willreturn` sound.
 */
const emitArrayIndexOf = (emitter: Emitter, expr: Node, arr: string, elem: i32): string => {
  const fn = emitter.fn;
  const value = emitter.emitExpression(expr.children[1].children[0]);
  const len = loadLength(emitter, arr);
  const slot = fn.emitAlloca("idx.at", "i64", 8);
  fn.emit(`store i64 0, i64* ${slot}, align 8`);
  const scanBlock = fn.newBlock("idx.scan");
  const testBlock = fn.newBlock("idx.test");
  const nextBlock = fn.newBlock("idx.next");
  const missBlock = fn.newBlock("idx.miss");
  const endBlock = fn.newBlock("idx.found");

  fn.emit(`br label %${scanBlock.label}`);
  fn.placeBlock(scanBlock);
  const at = fn.emitValue(`load i64, i64* ${slot}, align 8`);
  const more = fn.emitValue(`icmp ult i64 ${at}, ${len}`);
  fn.emit(`br i1 ${more}, label %${testBlock.label}, label %${missBlock.label}`);

  fn.placeBlock(testBlock);
  // For an inline record the element *is* the slot address, so the `icmp eq`
  // still asks what it always asked: is this the same object? Identity is now
  // "the same slot", which is the only identity a contiguous array has.
  const element = loadElement(emitter, new ArrayBase(arr, null), elem, at);
  const hit = emitElementEquals(emitter, elem, element, value);
  fn.emit(`br i1 ${hit}, label %${endBlock.label}, label %${nextBlock.label}`);

  fn.placeBlock(nextBlock);
  const next = fn.emitValue(`add i64 ${at}, 1`);
  fn.emit(`store i64 ${next}, i64* ${slot}, align 8`);
  fn.emit(`br label %${scanBlock.label}`);

  fn.placeBlock(missBlock);
  fn.emit(`br label %${endBlock.label}`);

  fn.placeBlock(endBlock);
  const found = fn.emitValue(`phi i64 [ ${at}, %${testBlock.label} ], [ -1, %${missBlock.label} ]`);
  return emitNumberFromI64(emitter, found, expr);
};

/**
 * `parts.join(sep)` on a `string[]`: one pass over the lengths, one
 * allocation, one `memcpy` per part. Building the same text with `+` in a loop
 * copies everything again per part and never reclaims, which measured 180 MB
 * of peak arena for 88 KB of output (docs/wp14-selfhost.md §3); this is the
 * shape that replaces it.
 *
 * The separator is copied before every part but the first, with the *length*
 * selected rather than the branch taken, so the copy loop stays one block.
 */
const emitJoin = (emitter: Emitter, expr: Node, arr: string): string => {
  const fn = emitter.fn;
  const args = expr.children[1];
  const sep = args.children.length > 0 ? emitter.emitExpression(args.children[0]) : emitter.stringConstant(",");
  const len = loadLength(emitter, arr);
  const sepLen = stringLength(emitter, sep);
  emitter.declare(
    `declare void @${MEMCPY}(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)`
  );

  // The separators: `len - 1` of them, and none at all for an empty array.
  const gaps = fn.emitValue(`sub i64 ${len}, 1`);
  const sepBytes = fn.emitValue(`mul i64 ${sepLen}, ${gaps}`);
  const empty = fn.emitValue(`icmp eq i64 ${len}, 0`);
  const totalSlot = fn.emitAlloca("join.total", "i64", 8);
  const indexSlot = fn.emitAlloca("join.at", "i64", 8);
  const cursorSlot = fn.emitAlloca("join.p", "i8*", 8);
  const base = fn.emitValue(`select i1 ${empty}, i64 0, i64 ${sepBytes}`);
  fn.emit(`store i64 ${base}, i64* ${totalSlot}, align 8`);
  fn.emit(`store i64 0, i64* ${indexSlot}, align 8`);

  const sumBlock = fn.newBlock("join.sum");
  const sumBodyBlock = fn.newBlock("join.sum.body");
  const copyBlock = fn.newBlock("join.copy");
  const copyBodyBlock = fn.newBlock("join.copy.body");
  const endBlock = fn.newBlock("join.end");

  fn.emit(`br label %${sumBlock.label}`);
  fn.placeBlock(sumBlock);
  const sumAt = fn.emitValue(`load i64, i64* ${indexSlot}, align 8`);
  const sumMore = fn.emitValue(`icmp ult i64 ${sumAt}, ${len}`);
  fn.emit(`br i1 ${sumMore}, label %${sumBodyBlock.label}, label %${copyBlock.label}`);

  fn.placeBlock(sumBodyBlock);
  const partPtr = elementPointer(emitter, new ArrayBase(arr, null), T_STRING, sumAt);
  const part = fn.emitValue(`load i8*, i8** ${partPtr}${emitter.align8()}${elementAccess(emitter)}`);
  const total = fn.emitValue(`load i64, i64* ${totalSlot}, align 8`);
  const grown = fn.emitValue(`add i64 ${total}, ${stringLength(emitter, part)}`);
  fn.emit(`store i64 ${grown}, i64* ${totalSlot}, align 8`);
  const sumNext = fn.emitValue(`add i64 ${sumAt}, 1`);
  fn.emit(`store i64 ${sumNext}, i64* ${indexSlot}, align 8`);
  fn.emit(`br label %${sumBlock.label}`);

  // One string of exactly that length: the 8-byte header, the bytes, the NUL.
  fn.placeBlock(copyBlock);
  const size = fn.emitValue(`load i64, i64* ${totalSlot}, align 8`);
  const bytes = fn.emitValue(`add i64 ${size}, 9`);
  const out = fn.emitValue(`call i8* ${emitter.useRuntime("nish_alloc_struct")}(i64 ${bytes})`);
  const outHeader = fn.emitValue(`bitcast i8* ${out} to i64*`);
  fn.emit(`store i64 ${size}, i64* ${outHeader}${emitter.align8()}`);
  const outData = fn.emitValue(`getelementptr inbounds i8, i8* ${out}, i64 8`);
  fn.emit(`store i8* ${outData}, i8** ${cursorSlot}, align 8`);
  fn.emit(`store i64 0, i64* ${indexSlot}, align 8`);
  fn.emit(`br label %${copyBodyBlock.label}`);

  fn.placeBlock(copyBodyBlock);
  const copyAt = fn.emitValue(`load i64, i64* ${indexSlot}, align 8`);
  const copyMore = fn.emitValue(`icmp ult i64 ${copyAt}, ${len}`);
  const copyPartBlock = fn.newBlock("join.part");
  fn.emit(`br i1 ${copyMore}, label %${copyPartBlock.label}, label %${endBlock.label}`);

  fn.placeBlock(copyPartBlock);
  const cursor = fn.emitValue(`load i8*, i8** ${cursorSlot}, align 8`);
  const first = fn.emitValue(`icmp eq i64 ${copyAt}, 0`);
  const gapLen = fn.emitValue(`select i1 ${first}, i64 0, i64 ${sepLen}`);
  const sepData = fn.emitValue(`getelementptr inbounds i8, i8* ${sep}, i64 8`);
  fn.emit(`call void @${MEMCPY}(i8* ${cursor}, i8* ${sepData}, i64 ${gapLen}, i1 false)`);
  const afterGap = fn.emitValue(`getelementptr inbounds i8, i8* ${cursor}, i64 ${gapLen}`);
  const itemPtr = elementPointer(emitter, new ArrayBase(arr, null), T_STRING, copyAt);
  const item = fn.emitValue(`load i8*, i8** ${itemPtr}${emitter.align8()}${elementAccess(emitter)}`);
  const itemLen = stringLength(emitter, item);
  const itemData = fn.emitValue(`getelementptr inbounds i8, i8* ${item}, i64 8`);
  fn.emit(`call void @${MEMCPY}(i8* ${afterGap}, i8* ${itemData}, i64 ${itemLen}, i1 false)`);
  const afterItem = fn.emitValue(`getelementptr inbounds i8, i8* ${afterGap}, i64 ${itemLen}`);
  fn.emit(`store i8* ${afterItem}, i8** ${cursorSlot}, align 8`);
  const copyNext = fn.emitValue(`add i64 ${copyAt}, 1`);
  fn.emit(`store i64 ${copyNext}, i64* ${indexSlot}, align 8`);
  fn.emit(`br label %${copyBodyBlock.label}`);

  fn.placeBlock(endBlock);
  const tail = fn.emitValue(`load i8*, i8** ${cursorSlot}, align 8`);
  fn.emit(`store i8 0, i8* ${tail}, align 1`);
  return out;
};

export const emitArrayMethodCall = (emitter: Emitter, expr: Node, receiver: i32): string => {
  const elem = emitter.table.refOf(receiver);
  emitter.declareType(ARRAY_TYPE);
  const arr = emitter.emitExpression(expr.children[0].children[0]);
  const name = expr.children[0].text;
  if (name === "push") {
    return emitPush(emitter, expr, arr, elem);
  }
  if (name === "pop") {
    return emitPop(emitter, arr, elem);
  }
  if (name === "indexOf") {
    return emitArrayIndexOf(emitter, expr, arr, elem);
  }
  return emitJoin(emitter, expr, arr);
};

// ---- `for (const x of a)` ------------------------------------------------------------------

/**
 * The index lives in an i64 alloca (`%forof.idx`, which mem2reg promotes) and
 * the element is copied into the loop variable's slot at the top of the body,
 * so the body reads and writes it like any local. `break` leaves to
 * `forof.end`, `continue` goes to `forof.inc`.
 */
export const emitForOf = (emitter: Emitter, stmt: Node): void => {
  const decl = stmt.children[0].children[0].children[0];
  const local = emitter.program.nodeLocals[decl.id];
  if (local === null) {
    process.exit(internalErrorFor("emitter: a `for...of` variable with no local recorded", emitter.opts.json));
  }
  const elem = local.type;
  const ty = emitter.llvm(elem);
  const fn = emitter.fn;
  emitter.declareType(ARRAY_TYPE);

  const condBlock = fn.newBlock("forof.cond");
  const bodyBlock = fn.newBlock("forof.body");
  const incBlock = fn.newBlock("forof.inc");
  const endBlock = fn.newBlock("forof.end");
  const slot = fn.emitAlloca(`${local.name}.addr`, ty, emitter.align(elem));
  emitter.setSlot(local, slot);
  const debug = emitter.debug;
  if (debug !== null) {
    debug.declareLocal(fn, local, slot, decl); // `-g`
  }
  const idxSlot = fn.emitAlloca("forof.idx", "i64", emitter.opts.optimizeAttributes ? 8 : 0);

  const arr = emitter.emitExpression(stmt.children[1]);
  fn.emit(`store i64 0, i64* ${idxSlot}${emitter.align8()}`);
  fn.emit(`br label %${condBlock.label}`);

  fn.placeBlock(condBlock);
  const idx = fn.emitValue(`load i64, i64* ${idxSlot}${emitter.align8()}`);
  const more = fn.emitValue(`icmp ult i64 ${idx}, ${loadLength(emitter, arr)}`);
  fn.emit(`br i1 ${more}, label %${bodyBlock.label}, label %${endBlock.label}`);

  fn.placeBlock(bodyBlock);
  // The loop variable holds what `a[i]` holds: for an inline record that is the
  // slot's address, so the body reads and writes the element in place.
  const value = loadElement(emitter, new ArrayBase(arr, null), elem, idx);
  fn.emit(`store ${ty} ${value}, ${ty}* ${slot}${emitter.alignSuffix(elem)}`);
  emitter.loops.push(new LoopTarget(endBlock, incBlock));
  emitter.emitStatement(stmt.children[2]);
  emitter.loops.pop();
  if (!fn.currentBlock().terminated()) {
    fn.emit(`br label %${incBlock.label}`);
  }

  fn.placeBlock(incBlock);
  const current = fn.emitValue(`load i64, i64* ${idxSlot}${emitter.align8()}`);
  const next = fn.emitValue(`add i64 ${current}, 1`);
  fn.emit(`store i64 ${next}, i64* ${idxSlot}${emitter.align8()}`);
  fn.emit(`br label %${condBlock.label}`);

  fn.placeBlock(endBlock);
};
