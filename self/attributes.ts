// Function and parameter attribute analysis for stage1
// (`src/codegen/attributes.ts`, docs/wp14-selfhost.md milestone S4).
//
// Everything emitted here must be a *guarantee*, never a hope: a wrong
// attribute is undefined behaviour, not a missed optimisation. The proofs are
// the ones `src/codegen/attributes.ts` states at length and they are not
// repeated here; what follows is only what is different about this
// implementation, because the rules themselves must not drift.
//
//   nounwind    The language has no exceptions.
//   willreturn  Every loop is counted (`isCountedLoop`), the body has no
//               `throw`, it cannot reach a `noreturn` runtime call, and every
//               callee is itself willreturn (fixpoint over the call graph).
//   readnone / readonly
//               The body touches no memory it does not own, or only reads it,
//               and every callee agrees (the same fixpoint).
//   noundef     Every value is initialised.
//   Pointer parameters carry `nonnull align 8 dereferenceable(N)` from the
//               allocator's guarantees, and `readonly` / `nocapture` from the
//               `pointerParams` fixpoint.
//
// Three shape changes, all forced and none visible in the output:
//
//   - **The fact collectors live here**, not beside the lowerings. `src/`
//     registers them into a `factCollectors` array from each `emit/*.ts`,
//     which needs function values; D2 already took the central `switch` for
//     the same reason. The invariant that mattered — a collector says exactly
//     what its lowering does — is now kept by the IR oracle rather than by
//     locality, which is the test D2 said this would need.
//   - **`Set`/`Map` become `StringSet` and index scans.** `stackSites` is a
//     `boolean[]` indexed by `Node.id`, the same side-table shape the checker
//     uses; `stackLocals` and `pointerParams` are short lists scanned by
//     identity, because a function has a handful of parameters and a scan
//     beats a hash there.
//   - **Parent links come from a side table** (`self/parents.ts`), since the
//     tree has none. The walks are otherwise the same walks.

import { builtinCallees, identifierBuiltinCallees } from "./emit_builtins";
import { stringifyCallee, stringConstructCallees } from "./emit_strings";
import { analyzeEscapes, EscapeResult, FLOW_LEAKS, FLOW_LOCAL, FLOW_RETURNED } from "./escape";
import {
  arrayMethodName,
  dottedName,
  intrinsicType,
  isAssignmentOperator,
  isAssignmentTarget,
  isPushCall,
  isStringMethodCall,
  isTemplateExpression,
  receiverIsValue,
  methodReceiver,
  templateParts,
  unwrapParens,
} from "./emit_util";
import { StringMap, StringSet } from "./map";
import {
  N_ARRAY,
  N_BINARY,
  N_BLOCK,
  N_CALL,
  N_CONDITIONAL,
  N_CONSTRUCTOR,
  N_DO,
  N_EMPTY,
  N_EXPR_STMT,
  N_FOR,
  N_FOR_OF,
  N_IDENT,
  N_IF,
  N_INDEX,
  N_LIST,
  N_MEMBER,
  N_NEW,
  N_NUMBER,
  N_OBJECT,
  N_PAREN,
  N_SUPER,
  N_TEMPLATE,
  N_TEMPLATE_TEXT,
  N_THIS,
  N_THROW,
  N_UNARY,
  N_VAR,
  N_WHILE,
  Node,
} from "./nodes";
import { Options } from "./options";
import { ParentTable } from "./parents";
import { CheckedProgram, FieldInfo, FunctionSig, ROLE_CONSTRUCTOR, StructInfo } from "./program";
import { EFFECT_NONE, EFFECT_READ, EFFECT_WRITE, inlineAllocatorAttrs, maxEffect, RuntimeTable } from "./runtime";
import { Local, STORAGE_LOCAL, STORAGE_PARAM } from "./symbols";
import { isResultConstructorCall, resultMethodName } from "./emit_result";
import { resultLayout } from "./result";
import {
  isInteger,
  K_ARRAY,
  K_NULLABLE,
  K_RESULT,
  K_STRUCT,
  T_BOOL,
  T_I32,
  T_STRING,
  T_VOID,
  TypeTable,
} from "./types";

/** `sizeof(%struct.amrit_array)`: `{ i64 len, i64 cap, i8* data }` (WP4 layout). */
const ARRAY_HEADER_BYTES: i32 = 24;

/** One module and the parent links its analyses walk. */
export class AnalysisUnit {
  program: CheckedProgram;
  parents: ParentTable;

  constructor(program: CheckedProgram, parents: ParentTable) {
    this.program = program;
    this.parents = parents;
  }
}

/** What a function does with one pointer-typed parameter: a struct (`this` included) or an array. */
export class PointerParamFacts {
  name: string;
  /** `sizeof` of the pointee, for `dereferenceable`; 0 when it is not emitted (arrays). */
  size: i32;
  /** Stores through the pointer, directly or via a callee (fixpoint). */
  writesThrough: boolean;
  /** The pointer may outlive the call: returned, stored, aliased, or captured by a callee. */
  captured: boolean;
  /** Calls the pointer is passed to, by callee symbol and parameter index (0 is `this`). */
  passedToCallees: string[];
  passedToIndices: i32[];

  constructor(name: string, size: i32) {
    this.name = name;
    this.size = size;
    this.writesThrough = false;
    this.captured = false;
    this.passedToCallees = [];
    this.passedToIndices = [];
  }
}

/** A call to a pointer-returning user function, and where its result flows. */
export class CallSite {
  callee: string;
  flow: i32;

  constructor(callee: string, flow: i32) {
    this.callee = callee;
    this.flow = flow;
  }
}

export class FunctionFacts {
  hasLoops: boolean;
  /** The body loads from memory it does not own (a header read, a field or element read). */
  readsMemory: boolean;
  /** Every loop in the body is counted; vacuously true without loops. */
  loopsBounded: boolean;
  /** Contains `throw`, which lowers to `llvm.trap`: a side effect that never returns. */
  hasTrap: boolean;
  effect: i32;
  willReturn: boolean;
  /** Can reach a `noreturn` runtime call, directly or through a callee. */
  callsNoReturn: boolean;
  /** Parameter names that escape; decides `nocapture` for strings. */
  escaping: StringSet;
  /** User functions and runtime symbols called directly, by LLVM symbol. */
  callees: StringSet;
  /** Parameter names in signature order (`this` first for methods). */
  paramNames: string[];
  /** Per pointer-typed parameter, in signature order. */
  pointerParams: PointerParamFacts[];
  /** A constructor: `this` is a fresh allocation, so it is `noalias`. */
  freshThis: boolean;
  /** `sizeof` the returned struct, or 0 when the return type is not a struct. */
  returnDeref: i32;
  // ---- WP6 memory strategy (see escape.ts) ----
  /** Node id -> the allocation there is lowered to an entry-block alloca. */
  stackSites: boolean[];
  /** Locals that only ever hold a stack object: accesses through them are own memory. */
  stackLocals: Local[];
  /** WP17: by-value `Result` parameters whose unpacked object is an entry-block alloca. */
  stackParams: StringSet;
  /** Bracket the body with `amrit_arena_mark` / `amrit_arena_release`. Decided after the fixpoint. */
  arenaScope: boolean;
  /** Performs an arena allocation, directly or through a callee (fixpoint). */
  allocates: boolean;
  /** The body has an arena allocation of its own that flows `local`. */
  directArena: boolean;
  /** An allocation may survive the call other than through the return value. */
  allocLeaks: boolean;
  /** An allocation of this function is returned: the caller owns it, so no scope here. */
  returnsAllocation: boolean;
  /** Calls `Arena.reset` / `Arena.release`, directly or through a callee. */
  usesArenaControl: boolean;
  /** Calls to pointer-returning user functions and where each result flows. */
  callSites: CallSite[];

  constructor(paramNames: string[], nodeCount: i32) {
    this.hasLoops = false;
    this.readsMemory = false;
    this.loopsBounded = true;
    this.hasTrap = false;
    this.effect = EFFECT_NONE;
    this.willReturn = true;
    this.callsNoReturn = false;
    this.escaping = new StringSet();
    this.callees = new StringSet();
    this.paramNames = paramNames;
    this.pointerParams = [];
    this.freshThis = false;
    this.returnDeref = 0;
    this.stackSites = new Array<boolean>(nodeCount);
    this.stackLocals = [];
    this.stackParams = new StringSet();
    this.arenaScope = false;
    this.allocates = false;
    this.directArena = false;
    this.allocLeaks = false;
    this.returnsAllocation = false;
    this.usesArenaControl = false;
    this.callSites = [];
  }

  /** The pointer facts of the parameter called `name`, or `null` when it is not one. */
  pointerParam(name: string): PointerParamFacts | null {
    for (const pp of this.pointerParams) {
      if (pp.name === name) {
        return pp;
      }
    }
    return null;
  }

  /** The pointer facts of parameter `index`, resolved through `paramNames`. */
  pointerParamAt(index: i32): PointerParamFacts | null {
    if (index < 0 || index >= this.paramNames.length) {
      return null;
    }
    return this.pointerParam(this.paramNames[index]);
  }

  /** WP6: the allocation at `node` was proved not to outlive the function. */
  isStackSite(node: Node): boolean {
    return this.stackSites[node.id];
  }

  /** WP17: the object the by-value `Result` parameter `name` unpacks into is an alloca. */
  isStackParam(name: string): boolean {
    return this.stackParams.has(name);
  }

  holdsStackObject(local: Local): boolean {
    for (const candidate of this.stackLocals) {
      if (candidate === local) {
        return true;
      }
    }
    return false;
  }
}

/** Facts for every function of a whole program, keyed by LLVM symbol. */
export class FactsTable {
  index: StringMap;
  list: FunctionFacts[];

  constructor() {
    this.index = new StringMap();
    this.list = [];
  }

  set(name: string, facts: FunctionFacts): void {
    const at = this.index.get(name, -1);
    if (at >= 0) {
      // A symbol is unique across a program (the driver rejects clashes), so
      // this only happens on the second collection round, which replaces the
      // first round's facts in place.
      this.list[at] = facts;
      return;
    }
    this.index.set(name, this.list.length);
    this.list.push(facts);
  }

  get(name: string): FunctionFacts | null {
    const at = this.index.get(name, -1);
    return at < 0 ? null : this.list[at];
  }
}

// ---- Escape classification --------------------------------------------------------------

/** How the enclosing construct consumes a parameter reference. */
export const USE_NONE: i32 = 0; // consumed on the spot
export const USE_ESCAPE: i32 = 1; // retained: returned, stored, aliased, or not modelled
export const USE_ARGUMENT: i32 = 2; // passed to a user function
export const USE_READ: i32 = 3; // receiver of a field, element, `.length` or `for...of` read
export const USE_WRITE: i32 = 4; // receiver of a field store, element store or `push`

export class ParamUse {
  kind: i32;
  /** For `USE_ARGUMENT`: the callee and the parameter index (`this` counts as 0). */
  callee: FunctionSig | null;
  index: i32;

  constructor(kind: i32) {
    this.kind = kind;
    this.callee = null;
    this.index = 0;
  }
}

function use(kind: i32): ParamUse {
  return new ParamUse(kind);
}

function argumentUse(callee: FunctionSig, index: i32): ParamUse {
  const result = new ParamUse(USE_ARGUMENT);
  result.callee = callee;
  result.index = index;
  return result;
}

/** The position of `node` in its `N_LIST` parent, which is the argument index. */
function indexInList(list: Node, node: Node): i32 {
  let i = 0;
  while (i < list.children.length) {
    if (list.children[i] === node) {
      return i;
    }
    i = i + 1;
  }
  return -1;
}

/**
 * Classify a reference to a parameter by walking up through the transparent
 * wrappers (parentheses, ternary arms, single-hole templates) to the construct
 * that consumes the value. Anything not explicitly harmless escapes.
 */
export function classifyUse(unit: AnalysisUnit, table: TypeTable, ref: Node): ParamUse {
  const program = unit.program;
  let node = ref;
  for (;;) {
    const parent = unit.parents.parentOf(node);
    if (parent === null) {
      return use(USE_ESCAPE);
    }
    if (parent.kind === N_PAREN) {
      node = parent;
      continue;
    }
    if (parent.kind === N_CONDITIONAL) {
      if (parent.children[0] === node) {
        return use(USE_NONE);
      }
      node = parent;
      continue;
    }
    if (parent.kind === N_TEMPLATE) {
      // A concatenating template copies its holes and the runtime keeps
      // nothing; only the single-hole passthrough hands the value on.
      if (!isStringPassthrough(program, parent)) {
        return use(USE_NONE);
      }
      node = parent;
      continue;
    }
    if (parent.kind === N_INDEX && parent.children[0] === node) {
      return classifyElementUse(unit, table, parent);
    }
    if (parent.kind === N_MEMBER) {
      return classifyMemberUse(unit, table, parent);
    }
    if (parent.kind === N_LIST) {
      return classifyArgumentUse(unit, table, parent, node);
    }
    if (parent.kind === N_CALL) {
      return use(USE_NONE); // the callee position of `p(...)`, which the checker refuses anyway
    }
    if (parent.kind === N_NEW) {
      return use(USE_ESCAPE); // the constructed name, not an argument
    }
    if (parent.kind === N_BINARY) {
      // Assignment retains the right-hand side; every other operator consumes both operands.
      if (isAssignmentOperator(parent.text)) {
        return use(parent.children[1] === node ? USE_ESCAPE : USE_NONE);
      }
      return use(USE_NONE);
    }
    if (parent.kind === N_FOR_OF) {
      return use(parent.children[1] === node ? USE_READ : USE_ESCAPE);
    }
    if (parent.kind === N_UNARY) {
      return use(USE_NONE);
    }
    if (parent.kind === N_EXPR_STMT || parent.kind === N_THROW) {
      return use(USE_NONE);
    }
    if (parent.kind === N_IF || parent.kind === N_WHILE || parent.kind === N_DO) {
      return use(USE_NONE);
    }
    if (parent.kind === N_FOR) {
      return use(USE_NONE);
    }
    return use(USE_ESCAPE); // return, variable initializer, array/object literal element, ...
  }
}

/** `p.f`, `p.f = v`, `p.m(...)`, `p.length`: the member access is the consumer. */
function classifyMemberUse(unit: AnalysisUnit, table: TypeTable, access: Node): ParamUse {
  const program = unit.program;
  const above = unit.parents.parentOf(access);
  if (above !== null && above.kind === N_CALL && above.children[0] === access) {
    const callee = program.nodeCallees[above.id];
    if (callee !== null) {
      return argumentUse(callee, 0);
    }
    // `p.push(v)` and `p.pop()` store into the array header; `indexOf` and
    // `join` only read it, and so do the string byte methods, whose runtime
    // parameters are all `nocapture readonly` and whose `substring` copies
    // what it keeps. Anything else is treated as retaining the receiver.
    const method = arrayMethodName(program, table, above);
    if (method === "push" || method === "pop") {
      return use(USE_WRITE);
    }
    if (method.length > 0) {
      return use(USE_READ);
    }
    // WP16: `r.orReturn()`, `r.unwrapOr(d)` and `r.expect(m)` load out of the
    // receiver and never store the pointer itself anywhere.
    if (resultMethodName(program, table, above).length > 0) {
      return use(USE_READ);
    }
    return use(isStringMethodCall(program, above) ? USE_READ : USE_ESCAPE);
  }
  return use(isAssignmentTarget(above, access) ? USE_WRITE : USE_READ);
}

/** An argument of `f(...)` or `new C(...)`: the list is the parent, the call is above it. */
function classifyArgumentUse(unit: AnalysisUnit, table: TypeTable, list: Node, node: Node): ParamUse {
  const program = unit.program;
  const owner = unit.parents.parentOf(list);
  if (owner === null) {
    return use(USE_ESCAPE);
  }
  if (owner.kind === N_CALL) {
    const index = indexInList(list, node);
    if (index < 0) {
      return use(USE_ESCAPE);
    }
    const callee = program.nodeCallees[owner.id];
    if (callee !== null) {
      return argumentUse(callee, index + (callee.owner !== null ? 1 : 0));
    }
    // `xs.push(p)` stores `p` into the array, `Ok(p)` / `Err(p)` store it into
    // the `Result` they build (WP16), and `r.unwrapOr(p)` hands it back as the
    // expression's value; every other builtin lowers to runtime functions
    // whose pointer params are all declared `nocapture`.
    if (isPushCall(program, table, owner) || isResultConstructorCall(program, table, owner)) {
      return use(USE_ESCAPE);
    }
    return use(resultMethodName(program, table, owner) === "unwrapOr" ? USE_ESCAPE : USE_NONE);
  }
  if (owner.kind === N_NEW) {
    // `new C(...)` has two lists: type arguments and value arguments.
    if (owner.children[2] !== list) {
      return use(USE_ESCAPE);
    }
    const index = indexInList(list, node);
    const ctor = constructorOf(program, table, intrinsicType(program, owner));
    if (index < 0 || ctor === null) {
      return use(USE_ESCAPE);
    }
    return argumentUse(ctor, index + 1);
  }
  return use(USE_ESCAPE);
}

/**
 * The parameter is the indexing base of `access` (`p[i]`, `p[i][j]`, ...).
 * The value obtained is a loaded element, not the pointer, so the pointer can
 * never be captured this way; but a store through the element counts as a
 * write through `p`, conservatively, as docs/wp4-arrays.md specifies.
 */
function classifyElementUse(unit: AnalysisUnit, table: TypeTable, access: Node): ParamUse {
  const program = unit.program;
  let node = access;
  for (;;) {
    const parent = unit.parents.parentOf(node);
    if (parent === null) {
      return use(USE_READ);
    }
    if (parent.kind === N_PAREN || (parent.kind === N_INDEX && parent.children[0] === node)) {
      node = parent;
      continue;
    }
    if (parent.kind === N_CONDITIONAL) {
      if (parent.children[0] === node) {
        return use(USE_READ);
      }
      node = parent;
      continue;
    }
    if (isAssignmentTarget(parent, node)) {
      return use(USE_WRITE);
    }
    if (parent.kind === N_MEMBER) {
      const above = unit.parents.parentOf(parent);
      const called = above !== null && above.kind === N_CALL && above.children[0] === parent;
      return use(called || isAssignmentTarget(above, parent) ? USE_WRITE : USE_READ);
    }
    if (parent.kind === N_LIST) {
      const owner = unit.parents.parentOf(parent);
      if (owner !== null && owner.kind === N_CALL) {
        // The constructor or function may store through the element; builtins are nocapture.
        return use(program.nodeCallees[owner.id] !== null ? USE_WRITE : USE_READ);
      }
      if (owner !== null && owner.kind === N_NEW) {
        return use(USE_WRITE);
      }
      return use(USE_READ);
    }
    if (parent.kind === N_CALL || parent.kind === N_NEW) {
      return use(parent.kind === N_NEW ? USE_WRITE : USE_READ);
    }
    return use(USE_READ);
  }
}

/**
 * The constructor `new` runs for a struct type: the class's own, or the
 * nearest ancestor's. `null` when the type is not a struct or nothing
 * constructs it.
 */
export function constructorOf(program: CheckedProgram, table: TypeTable, type: i32): FunctionSig | null {
  if (type < 0 || !table.isStruct(type)) {
    return null;
  }
  const info = program.struct(table.nameOf(type));
  return info === null ? null : info.effectiveConstructor();
}

/** `` `${s}` ``: a template that lowers to its single string hole unchanged. */
function isStringPassthrough(program: CheckedProgram, template: Node): boolean {
  if (!isTemplateExpression(template)) {
    return false;
  }
  const parts = templateParts(template);
  if (parts.length !== 1 || parts[0].kind === N_TEMPLATE_TEXT) {
    return false;
  }
  return program.nodeTypes[parts[0].id] === T_STRING;
}

// ---- Per-function collection ------------------------------------------------------------

/**
 * `sizeof` the pointee, for `dereferenceable`; 0 where there is nothing fixed
 * to claim. A `Result` layout is derived from the type, not declared (WP16),
 * so it is computed rather than looked up.
 */
function structSize(program: CheckedProgram, table: TypeTable, type: i32): i32 {
  if (type < 0) {
    return 0;
  }
  if (table.isResult(type)) {
    return resultLayout(table, type).size;
  }
  if (!table.isStruct(type)) {
    return 0;
  }
  const info = program.struct(table.nameOf(type));
  return info === null ? 0 : info.size;
}

/** Struct, array and `Result` params, plain or `T | null`, get pointer facts. */
/**
 * Struct, array and `Result` params get pointer facts — except a `Result` the
 * ABI packs into a register (WP17), which is not a pointer at all, so there is
 * nothing for the fixpoint to say about it.
 */
function isPointerParam(table: TypeTable, type: i32): boolean {
  const inner = table.stripNull(type);
  if (table.isResult(inner)) {
    return !table.resultByValue(inner);
  }
  return table.isStruct(inner) || table.isArray(inner);
}

/** The fields `info` declares itself: everything after the inherited prefix. */
export function ownFields(info: StructInfo): FieldInfo[] {
  const base = info.base;
  const start = base === null ? 0 : base.fields.length;
  const out: FieldInfo[] = [];
  let i = start;
  while (i < info.fields.length) {
    out.push(info.fields[i]);
    i = i + 1;
  }
  return out;
}

/**
 * How the base part of a derived object is built: walking up from `cls.base`,
 * every ancestor without a constructor has its own initializers stored
 * directly, until the nearest ancestor constructor, which takes the
 * `super(...)` arguments and finishes the job.
 */
export class BaseConstruction {
  ctor: FunctionSig | null;
  stores: boolean;

  constructor() {
    this.ctor = null;
    this.stores = false;
  }
}

export function baseConstruction(cls: StructInfo): BaseConstruction {
  const result = new BaseConstruction();
  let c = cls.base;
  while (c !== null) {
    const ctor = c.ctor;
    if (ctor !== null) {
      result.ctor = ctor;
      return result;
    }
    for (const field of ownFields(c)) {
      if (field.initializer !== null) {
        result.stores = true;
      }
    }
    c = c.base;
  }
  return result;
}

class FactCollector {
  unit: AnalysisUnit;
  table: TypeTable;
  opts: Options;
  sig: FunctionSig;
  facts: FunctionFacts;

  constructor(unit: AnalysisUnit, table: TypeTable, opts: Options, sig: FunctionSig, facts: FunctionFacts) {
    this.unit = unit;
    this.table = table;
    this.opts = opts;
    this.sig = sig;
    this.facts = facts;
  }

  /** A reference to one of this function's parameters (`this` and `super` included), by name. */
  paramRef(node: Node): string {
    if (node.kind !== N_IDENT && node.kind !== N_THIS && node.kind !== N_SUPER) {
      return "";
    }
    const local = this.unit.program.nodeLocals[node.id];
    if (local === null || local.storage !== STORAGE_PARAM) {
      return "";
    }
    for (const name of this.facts.paramNames) {
      if (name === local.name) {
        return name;
      }
    }
    return "";
  }

  noteUse(name: string, ref: Node): void {
    const found = classifyUse(this.unit, this.table, ref);
    const pointer = this.facts.pointerParam(name);
    if (found.kind === USE_ESCAPE) {
      this.facts.escaping.add(name);
      if (pointer !== null) {
        pointer.captured = true;
        pointer.writesThrough = true; // an alias may be written through later
      }
      return;
    }
    if (found.kind === USE_ARGUMENT) {
      // Strings escape conservatively when handed to any user function;
      // structs and arrays are resolved by the fixpoint against the callee.
      const callee = found.callee;
      if (pointer !== null && callee !== null) {
        pointer.passedToCallees.push(callee.name);
        pointer.passedToIndices.push(found.index);
      } else {
        this.facts.escaping.add(name);
      }
      return;
    }
    if (found.kind === USE_WRITE && pointer !== null) {
      pointer.writesThrough = true;
    }
  }

  /** `expr` denotes a stack object: a stack allocation itself, or a local that only holds one. */
  isStackOwned(expr: Node): boolean {
    const e = unwrapParens(expr);
    if (this.facts.isStackSite(e)) {
      return true;
    }
    if (e.kind !== N_IDENT) {
      return false;
    }
    const local = this.unit.program.nodeLocals[e.id];
    return local !== null && this.facts.holdsStackObject(local);
  }

  visit(node: Node): void {
    const program = this.unit.program;
    if (node.kind === N_FOR || node.kind === N_WHILE || node.kind === N_DO || node.kind === N_FOR_OF) {
      this.facts.hasLoops = true;
      if (!isCountedLoop(this.unit, this.table, node)) {
        this.facts.loopsBounded = false;
      }
    }
    if (node.kind === N_THROW) {
      this.facts.hasTrap = true;
    }
    if (node.kind === N_CALL) {
      const callee = program.nodeCallees[node.id];
      if (callee !== null) {
        this.facts.callees.add(callee.name);
      }
    }
    const param = this.paramRef(node);
    if (param.length > 0) {
      this.noteUse(param, node);
    }
    this.collectStringFacts(node);
    this.collectClassFacts(node);
    this.collectResultFacts(node);
    this.collectArrayFacts(node);
    this.collectDivisionFacts(node);
    this.collectArgvFacts(node);
    this.collectIdentifierBuiltinFacts(node);
    for (const child of node.children) {
      this.visit(child);
    }
  }

  addCallees(names: string[]): void {
    for (const name of names) {
      this.facts.callees.add(name);
    }
  }

  /**
   * What a string construct does to memory: the runtime symbols it calls and
   * the header reads `.length` and the byte methods perform. Mirrors
   * `self/emit_strings.ts` exactly; an omission here is a wrong attribute.
   */
  collectStringFacts(node: Node): void {
    const program = this.unit.program;
    const table = this.table;
    if (node.kind === N_CALL && node.children[0].kind === N_MEMBER && !receiverIsValue(program, node.children[0].children[0])) {
      this.addCallees(builtinCallees(program, table, node));
      return;
    }
    if (node.kind === N_BINARY && program.nodeTypes[node.children[0].id] === T_STRING) {
      const op = node.text;
      if (op === "+") {
        this.facts.callees.add("amrit_str_concat");
      } else if (op === "===" || op === "!==") {
        this.facts.callees.add("amrit_str_eq");
      }
      return;
    }
    if (node.kind === N_CALL && isStringMethodCall(program, node)) {
      // The byte methods all read the string's bytes; `substring` also allocates.
      this.facts.readsMemory = true;
      this.addCallees(stringConstructCallees(node.children[0].text));
      return;
    }
    if (node.kind === N_MEMBER && program.nodeTypes[node.children[0].id] === T_STRING) {
      this.facts.readsMemory = true; // `.length` loads the header through the string pointer
      return;
    }
    if (isTemplateExpression(node)) {
      const parts = templateParts(node);
      if (parts.length > 1) {
        this.facts.callees.add("amrit_str_concat");
      }
      for (const part of parts) {
        if (part.kind !== N_TEMPLATE_TEXT) {
          const callee = stringifyCallee(program.nodeTypes[part.id]);
          if (callee.length > 0) {
            this.facts.callees.add(callee);
          }
        }
      }
    }
  }

  /**
   * Class constructs: a field read is a read, a field store a write, and a
   * `new` or object literal an allocator call plus whatever the constructor
   * does. A stack object is the function's own alloca and is none of those.
   */
  collectClassFacts(node: Node): void {
    const program = this.unit.program;
    const table = this.table;
    if (node.kind === N_MEMBER) {
      const receiver = node.children[0];
      const type = program.nodeTypes[receiver.id];
      if (type < 0 || !table.isStruct(type)) {
        return;
      }
      const above = this.unit.parents.parentOf(node);
      if (above !== null && above.kind === N_CALL && above.children[0] === node) {
        return; // the call itself is reported through `nodeCallees`
      }
      if (this.isStackOwned(receiver)) {
        return; // own alloca (WP6)
      }
      if (isAssignmentTarget(above, node) && above !== null) {
        this.facts.effect = EFFECT_WRITE;
        if (above.text !== "=") {
          this.facts.readsMemory = true;
        }
      } else {
        this.facts.readsMemory = true;
      }
      return;
    }
    if (node.kind === N_NEW) {
      const type = program.nodeTypes[node.id];
      if (type < 0 || !table.isStruct(type)) {
        return;
      }
      if (!this.facts.isStackSite(node)) {
        this.facts.effect = EFFECT_WRITE;
        this.facts.callees.add("amrit_alloc_struct");
      }
      const ctor = constructorOf(program, table, intrinsicType(program, node));
      if (ctor !== null) {
        this.facts.callees.add(ctor.name);
      }
      return;
    }
    if (node.kind === N_OBJECT && !this.facts.isStackSite(node)) {
      this.facts.effect = EFFECT_WRITE;
      this.facts.callees.add("amrit_alloc_struct");
    }
  }

  /**
   * `Result` constructs (WP16), mirroring `self/emit_result.ts`:
   *   a call answering a packed `Result`   the caller's own object (WP17)
   *   Ok / Err                write, calls the allocator unless it is a stack site
   *   r.ok / .value / .error  read
   *   orReturn                read plus the allocation of the propagated Result
   *   unwrapOr / expect       read; `expect` also calls the two runtime symbols
   */
  collectResultFacts(node: Node): void {
    const program = this.unit.program;
    const table = this.table;
    if (node.kind === N_CALL) {
      // WP17: a call that answers a `Result` in a register hands back no
      // memory, so the *caller* builds the object the rest of the lowering
      // reads. That is an allocation of this function — an own alloca when the
      // escape analysis says so, an arena bump otherwise — and the allocator
      // call has to be reported here, because the callee no longer makes it.
      const callee = program.nodeCallees[node.id];
      if (callee !== null) {
        if (table.resultByValue(callee.returnType)) {
          if (!this.facts.isStackSite(node)) {
            this.facts.callees.add("amrit_alloc_struct");
          }
          this.facts.effect = EFFECT_WRITE;
        }
        return;
      }
      const method = resultMethodName(program, table, node);
      if (method.length > 0) {
        if (this.isStackOwned(node.children[0].children[0])) {
          return; // own alloca (WP6)
        }
        this.facts.readsMemory = true;
        if (method === "orReturn") {
          this.facts.effect = EFFECT_WRITE;
          this.facts.callees.add("amrit_alloc_struct");
        } else if (method === "expect") {
          this.facts.callees.add("amrit_write");
          this.facts.callees.add("amrit_exit");
        }
        return;
      }
      // `Ok(...)` / `Err(...)`: a user function of that name is in `nodeCallees`
      // and is reported through the call graph instead.
      if (!isResultConstructorCall(program, table, node)) {
        return;
      }
      if (!this.facts.isStackSite(node)) {
        this.facts.callees.add("amrit_alloc_struct");
      }
      this.facts.effect = EFFECT_WRITE;
      return;
    }
    if (node.kind === N_MEMBER) {
      const receiver = node.children[0];
      if (!table.isResult(program.nodeTypes[receiver.id])) {
        return;
      }
      const above = this.unit.parents.parentOf(node);
      if (above !== null && above.kind === N_CALL && above.children[0] === node) {
        return; // the method call above
      }
      if (this.isStackOwned(receiver)) {
        return; // own alloca (WP6)
      }
      this.facts.readsMemory = true;
    }
  }

  /** Array constructs, mirroring `self/emit_arrays.ts`. */
  collectArrayFacts(node: Node): void {
    const program = this.unit.program;
    const table = this.table;
    if (node.kind === N_INDEX && this.isArrayValued(node.children[0])) {
      this.facts.readsMemory = true;
      if (!this.opts.uncheckedIndexing) {
        this.facts.callees.add("amrit_panic_index");
      }
      return;
    }
    if (node.kind === N_MEMBER && this.isArrayValued(node.children[0])) {
      this.facts.readsMemory = true; // `.length`
      return;
    }
    if (node.kind === N_FOR_OF) {
      this.facts.readsMemory = true;
      return;
    }
    if (node.kind === N_ARRAY || (node.kind === N_NEW && this.isArrayValued(node))) {
      if (!this.facts.isStackSite(node)) {
        this.facts.effect = EFFECT_WRITE;
      }
      return;
    }
    const method = arrayMethodName(program, table, node);
    if (method.length > 0) {
      this.collectMethodFacts(node, method);
      return;
    }
    if (node.kind === N_BINARY && isAssignmentOperator(node.text) && node.children[0].kind === N_INDEX) {
      this.facts.effect = EFFECT_WRITE;
    }
  }

  isArrayValued(expr: Node): boolean {
    const type = this.unit.program.nodeTypes[expr.id];
    return type >= 0 && this.table.isArray(type);
  }

  /** What each array method does to memory; mirrors the lowerings exactly. */
  collectMethodFacts(call: Node, method: string): void {
    if (method === "push") {
      this.facts.effect = EFFECT_WRITE;
      this.facts.callees.add("amrit_array_grow");
      return;
    }
    if (method === "pop") {
      // Stores the shortened length back, and panics on an empty array.
      this.facts.effect = EFFECT_WRITE;
      if (!this.opts.uncheckedIndexing) {
        this.facts.callees.add("amrit_panic_index");
      }
      return;
    }
    if (method === "join") {
      this.facts.effect = EFFECT_WRITE; // one arena allocation
      this.facts.callees.add("amrit_alloc_struct");
      return;
    }
    this.facts.readsMemory = true; // `indexOf` scans the elements
    const receiver = methodReceiver(call);
    if (receiver === null) {
      return;
    }
    const type = this.unit.program.nodeTypes[receiver.id];
    if (type >= 0 && this.table.isArray(type) && this.table.refOf(type) === T_STRING) {
      this.facts.callees.add("amrit_str_eq");
    }
  }

  /** Every integer division may call the noreturn panic. */
  collectDivisionFacts(node: Node): void {
    if (node.kind !== N_BINARY) {
      return;
    }
    const op = node.text;
    if (op !== "/" && op !== "%" && op !== "/=" && op !== "%=") {
      return;
    }
    const left = this.unit.program.nodeTypes[node.children[0].id];
    if (left >= 0 && isInteger(left)) {
      this.facts.callees.add("amrit_panic_div");
    }
  }

  /** The load of `@amrit_argv` reads memory the function does not own: at most `readonly`. */
  collectArgvFacts(node: Node): void {
    if (node.kind !== N_MEMBER || dottedName(node) !== "process.argv") {
      return;
    }
    if (!receiverIsValue(this.unit.program, node.children[0])) {
      this.facts.readsMemory = true;
    }
  }

  /** WP7: `toI32`, `parseInt`, `readFileSync` and the rest, called by plain identifier. */
  collectIdentifierBuiltinFacts(node: Node): void {
    if (node.kind !== N_CALL || node.children[0].kind !== N_IDENT) {
      return;
    }
    if (this.unit.program.nodeCallees[node.id] !== null) {
      return; // a user function of that name wins
    }
    this.addCallees(identifierBuiltinCallees(this.unit.program, this.table, node));
  }
}

/**
 * Per-function facts from one walk of the body. `memory` (round 2, see
 * `analyzeFunctions`) tells the collectors which allocations are allocas and
 * which locals hold them, and carries the allocation facts into the result.
 */
export function collectFacts(
  unit: AnalysisUnit,
  table: TypeTable,
  opts: Options,
  sig: FunctionSig,
  memory: EscapeResult | null,
  nodeCount: i32
): FunctionFacts {
  const program = unit.program;
  const facts = new FunctionFacts(sig.paramNames, nodeCount);
  facts.freshThis = sig.role === ROLE_CONSTRUCTOR;
  facts.returnDeref = structSize(program, table, sig.returnType);
  if (memory !== null) {
    facts.stackSites = memory.stackSites;
    facts.stackLocals = memory.stackLocals;
    facts.stackParams = memory.stackParams;
    facts.directArena = memory.directArena;
    facts.allocates = memory.directArena;
    facts.allocLeaks = memory.allocLeaks;
    facts.returnsAllocation = memory.returnsAllocation;
    facts.usesArenaControl = memory.usesArenaControl;
    facts.callSites = memory.callSites;
  }
  // A `returned` or `leaked` allocation is still an allocation.
  if (facts.returnsAllocation || facts.allocLeaks) {
    facts.allocates = true;
  }
  let i = 0;
  while (i < sig.paramNames.length) {
    const type = sig.paramTypes[i];
    if (isPointerParam(table, type)) {
      facts.pointerParams.push(
        new PointerParamFacts(sig.paramNames[i], structSize(program, table, table.stripNull(type)))
      );
    }
    i = i + 1;
  }

  const collector = new FactCollector(unit, table, opts, sig, facts);
  const body = sig.body();
  if (body !== null) {
    collector.visit(body);
  }

  // WP2b: a derived constructor builds its base part (`super(...)`, written or
  // implicit): `this` is handed to the nearest ancestor constructor, and the
  // initializers of constructor-less ancestors are stored through it. Recorded
  // from the class, not from the statement, so an implicit call is not missed.
  const owner = sig.owner;
  if (sig.role === ROLE_CONSTRUCTOR && owner !== null && owner.base !== null) {
    const base = baseConstruction(owner);
    const self = facts.pointerParam("this");
    const baseCtor = base.ctor;
    if (baseCtor !== null && self !== null) {
      facts.callees.add(baseCtor.name);
      self.passedToCallees.push(baseCtor.name);
      self.passedToIndices.push(0);
    }
    if (base.stores && self !== null) {
      self.writesThrough = true;
      facts.effect = EFFECT_WRITE;
    }
  }

  if (facts.readsMemory) {
    facts.effect = maxEffect(facts.effect, EFFECT_READ);
  }
  if (facts.hasTrap) {
    facts.effect = EFFECT_WRITE;
  }
  facts.willReturn = facts.loopsBounded && !facts.hasTrap && !facts.callsNoReturn;
  return facts;
}

// ---- The fixpoint ------------------------------------------------------------------------

/**
 * Gather per-function facts for a whole program, then propagate over the
 * (cross-module) call graph to a fixpoint: a function is as impure as the most
 * impure thing it calls, it is willreturn only if everything it calls is, and
 * a pointer parameter is written or captured if any callee it is passed to
 * writes or captures the matching parameter. The result is keyed by LLVM
 * symbol, so a caller in one module sees exactly what the exporter proved.
 */
export function analyzeFunctions(
  units: AnalysisUnit[],
  table: TypeTable,
  opts: Options,
  runtime: RuntimeTable
): FactsTable {
  // Round 1: plain facts and the capture fixpoint, which the escape analysis needs.
  const first = collectRound(units, table, opts, null);
  propagate(first, runtime);
  const escapes = new EscapeSet();
  for (const unit of units) {
    for (const sig of unit.program.functions) {
      if (sig.definedIn(unit.program.source)) {
        escapes.set(sig.name, analyzeEscapes(unit, table, sig, first, opts));
      }
    }
  }
  // Round 2: the same facts with stack allocations applied, then the scope decision.
  const facts = collectRound(units, table, opts, escapes);
  propagate(facts, runtime);
  for (const f of facts.list) {
    f.arenaScope = f.directArena && !f.allocLeaks && !f.returnsAllocation && !f.usesArenaControl;
    if (f.arenaScope) {
      // Both are `willreturn` and the function already writes (it allocates), so nothing else moves.
      f.callees.add("amrit_arena_mark");
      f.callees.add("amrit_arena_release");
    }
  }
  return facts;
}

/** Escape results by symbol, the second round's input. */
export class EscapeSet {
  index: StringMap;
  list: EscapeResult[];

  constructor() {
    this.index = new StringMap();
    this.list = [];
  }

  set(name: string, result: EscapeResult): void {
    this.index.set(name, this.list.length);
    this.list.push(result);
  }

  get(name: string): EscapeResult | null {
    const at = this.index.get(name, -1);
    return at < 0 ? null : this.list[at];
  }
}

function collectRound(
  units: AnalysisUnit[],
  table: TypeTable,
  opts: Options,
  escapes: EscapeSet | null
): FactsTable {
  const facts = new FactsTable();
  for (const unit of units) {
    for (const sig of unit.program.functions) {
      if (!sig.definedIn(unit.program.source)) {
        continue; // an imported signature belongs to the module that defines it
      }
      let memory: EscapeResult | null = null;
      if (escapes !== null) {
        memory = escapes.get(sig.name);
      }
      facts.set(sig.name, collectFacts(unit, table, opts, sig, memory, unit.program.nodeTypes.length));
    }
  }
  return facts;
}

/** Propagate effects, termination, pointer facts and allocation facts to a fixpoint. */
function propagate(facts: FactsTable, runtime: RuntimeTable): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of facts.list) {
      let c = 0;
      while (c < f.callees.size()) {
        if (propagateCallee(facts, runtime, f, f.callees.at(c))) {
          changed = true;
        }
        c = c + 1;
      }
      // A pointer-returning callee that allocates makes its result an allocation of this function.
      for (const site of f.callSites) {
        const callee = facts.get(site.callee);
        if (callee === null || !callee.allocates) {
          continue;
        }
        if (site.flow === FLOW_LOCAL && !f.directArena) {
          f.directArena = true;
          changed = true;
        } else if (site.flow === FLOW_RETURNED && !f.returnsAllocation) {
          f.returnsAllocation = true;
          changed = true;
        } else if (site.flow === FLOW_LEAKS && !f.allocLeaks) {
          f.allocLeaks = true;
          changed = true;
        }
      }
      // A pointer inherits what every callee it is passed to does with the
      // corresponding parameter. An unknown callee is assumed to do both.
      for (const pp of f.pointerParams) {
        let i = 0;
        while (i < pp.passedToCallees.length) {
          const g = facts.get(pp.passedToCallees[i]);
          let writes = true;
          let captures = true;
          if (g !== null) {
            const target = g.pointerParamAt(pp.passedToIndices[i]);
            if (target !== null) {
              writes = target.writesThrough;
              captures = target.captured;
            }
          }
          if (writes && !pp.writesThrough) {
            pp.writesThrough = true;
            changed = true;
          }
          if (captures && !pp.captured) {
            pp.captured = true;
            changed = true;
          }
          i = i + 1;
        }
      }
    }
  }
}

/** One caller/callee edge; answers whether anything about the caller moved. */
function propagateCallee(facts: FactsTable, runtime: RuntimeTable, f: FunctionFacts, callee: string): boolean {
  let changed = false;
  const calleeFacts = facts.get(callee);
  const rt = runtime.lookup(callee);
  // The inline arena allocator is not in the runtime table (it is emitted as
  // an IR definition), but callers must still see it as a writing, willreturn
  // callee.
  const isAllocator = callee === "amrit_alloc_struct";
  let calleeEffect = EFFECT_WRITE;
  let calleeReturns = false;
  let calleeNoReturn = false;
  if (calleeFacts !== null) {
    calleeEffect = calleeFacts.effect;
    calleeReturns = calleeFacts.willReturn;
    calleeNoReturn = calleeFacts.callsNoReturn;
  } else if (isAllocator) {
    calleeEffect = EFFECT_WRITE;
    calleeReturns = hasAttr(inlineAllocatorAttrs(), "willreturn");
  } else if (rt !== null) {
    calleeEffect = rt.effect;
    calleeReturns = hasAttr(rt.attrs, "willreturn");
    calleeNoReturn = rt.noreturn;
  }
  const merged = maxEffect(f.effect, calleeEffect);
  if (merged !== f.effect) {
    f.effect = merged;
    changed = true;
  }
  if (f.willReturn && !calleeReturns) {
    f.willReturn = false;
    changed = true;
  }
  if (calleeNoReturn && !f.callsNoReturn) {
    f.callsNoReturn = true;
    f.willReturn = false;
    changed = true;
  }
  if (calleeFacts !== null) {
    // WP6: allocation facts flow up the call graph (see escape.ts).
    if (calleeFacts.allocates && !f.allocates) {
      f.allocates = true;
      changed = true;
    }
    if (calleeFacts.allocLeaks && !f.allocLeaks) {
      f.allocLeaks = true;
      changed = true;
    }
    if (calleeFacts.usesArenaControl && !f.usesArenaControl) {
      f.usesArenaControl = true;
      changed = true;
    }
  }
  return changed;
}

function hasAttr(attrs: string[], name: string): boolean {
  return attrs.indexOf(name) >= 0;
}

// ---- Counted loops ------------------------------------------------------------------------

const INT32_MAX: f64 = 2147483647.0;

/**
 * True for `for (let i = <init>; i CMP bound; STEP) body` over i32 when the
 * trip count is finite by construction, which is what lets the enclosing
 * function keep `willreturn`. The rules, and the reasoning behind each, are in
 * `src/codegen/attributes.ts`; this is the same predicate over this tree.
 *
 * A `for...of` over an array is counted unless its body may extend the array.
 * Every other loop (`while`, `do`, other `for` shapes) is unbounded.
 */
export function isCountedLoop(unit: AnalysisUnit, table: TypeTable, loop: Node): boolean {
  const program = unit.program;
  if (loop.kind === N_FOR_OF) {
    return !bodyMayExtend(unit, table, loop.children[2]);
  }
  if (loop.kind !== N_FOR) {
    return false;
  }
  const init = loop.children[0];
  const condition = loop.children[1];
  const step = loop.children[2];
  if (init.kind !== N_VAR || condition.kind === N_EMPTY || step.kind === N_EMPTY) {
    return false;
  }
  const declarations = init.children[0];
  if (declarations.children.length !== 1) {
    return false;
  }
  const iv = program.nodeLocals[declarations.children[0].id];
  if (iv === null || iv.type !== T_I32) {
    return false;
  }

  const cond = unwrapParens(condition);
  if (cond.kind !== N_BINARY || !isName(cond.children[0], iv.name)) {
    return false;
  }
  const cmp = cond.text;
  const upward = cmp === "<" || cmp === "<=";
  const downward = cmp === ">" || cmp === ">=";
  const inclusive = cmp === "<=" || cmp === ">=";
  const bound = unwrapParens(cond.children[1]);
  if (bound.kind !== N_IDENT && bound.kind !== N_NUMBER) {
    return false;
  }

  const delta = stepOf(unwrapParens(step), iv.name);
  if (delta === 0) {
    return false;
  }
  if (!((upward && delta > 0) || (downward && delta < 0))) {
    return false;
  }

  if (bound.kind === N_IDENT) {
    if (absOf(delta) !== 1 || inclusive) {
      return false;
    }
  } else if (upward) {
    // In `f64`, as `src/` computes it: a bound past the i32 range must still
    // compare as out of range rather than wrapping into it.
    const written: f64 = Number(bound.text);
    const last: f64 = inclusive ? written : written - 1.0;
    if (last + toF64(delta) > INT32_MAX) {
      return false;
    }
  }
  // Downward from a non-negative literal bound: `bound - |step| >= -INT32_MAX`, so no wrap.

  const guarded: string[] = [iv.name];
  if (bound.kind === N_IDENT) {
    guarded.push(bound.text);
  }
  return !bodyDisturbs(loop.children[3], guarded);
}

function absOf(value: i32): i32 {
  return value < 0 ? -value : value;
}

function isName(expr: Node, name: string): boolean {
  const e = unwrapParens(expr);
  return e.kind === N_IDENT && e.text === name;
}

/** Signed step of `i++`, `++i`, `i--`, `--i`, `i += c`, `i -= c`; 0 for anything else. */
function stepOf(expr: Node, name: string): i32 {
  if (expr.kind === N_UNARY && isName(expr.children[0], name)) {
    if (expr.text === "++") {
      return 1;
    }
    if (expr.text === "--") {
      return -1;
    }
    return 0;
  }
  if (expr.kind === N_BINARY && isName(expr.children[0], name)) {
    const rhs = unwrapParens(expr.children[1]);
    if (rhs.kind !== N_NUMBER) {
      return 0;
    }
    if (expr.text === "+=") {
      return toI32(Number(rhs.text));
    }
    if (expr.text === "-=") {
      return -toI32(Number(rhs.text));
    }
  }
  return 0;
}

/**
 * `for (const x of a)` re-reads `a.length` every iteration, so it is bounded
 * unless the body can grow an array: any `push` (on any array, since `a` may
 * be aliased), any call to a user function (which could push through an alias
 * it receives), or a `throw`.
 */
function bodyMayExtend(unit: AnalysisUnit, table: TypeTable, body: Node): boolean {
  if (body.kind === N_THROW || isPushCall(unit.program, table, body)) {
    return true;
  }
  if (body.kind === N_CALL && unit.program.nodeCallees[body.id] !== null) {
    return true;
  }
  for (const child of body.children) {
    if (bodyMayExtend(unit, table, child)) {
      return true;
    }
  }
  return false;
}

/** True when `body` may assign one of `names` (by any assignment form) or may throw. */
function bodyDisturbs(body: Node, names: string[]): boolean {
  if (body.kind === N_THROW) {
    return true;
  }
  if (
    body.kind === N_BINARY &&
    isAssignmentOperator(body.text) &&
    body.children[0].kind === N_IDENT &&
    names.indexOf(body.children[0].text) >= 0
  ) {
    return true;
  }
  if (
    body.kind === N_UNARY &&
    (body.text === "++" || body.text === "--") &&
    body.children[0].kind === N_IDENT &&
    names.indexOf(body.children[0].text) >= 0
  ) {
    return true;
  }
  for (const child of body.children) {
    if (bodyDisturbs(child, names)) {
      return true;
    }
  }
  return false;
}

// ---- Attribute rendering --------------------------------------------------------------------

export function functionAttributes(f: FunctionFacts): string[] {
  const attrs: string[] = [];
  attrs.push("nounwind");
  if (f.willReturn) {
    attrs.push("willreturn");
  }
  if (f.effect === EFFECT_NONE) {
    attrs.push("readnone");
  } else if (f.effect === EFFECT_READ) {
    attrs.push("readonly");
  }
  return attrs;
}

export function paramAttributes(table: TypeTable, name: string, type: i32, f: FunctionFacts): string[] {
  const attrs: string[] = [];
  attrs.push("noundef");
  // See the header comment: every pointer fact here is proved by `collectFacts`
  // plus the `pointerParams` fixpoint in `analyzeFunctions`.
  const pointer = f.pointerParam(name);
  const kind = table.kindOf(type);
  if (type === T_BOOL) {
    attrs.push("zeroext"); // `boolean` is i1; the C ABI wants it zero-extended
    return attrs;
  }
  if (type === T_STRING) {
    attrs.push("nonnull");
    attrs.push("noalias");
    attrs.push("readonly");
    attrs.push("align 8");
    if (!f.escaping.has(name)) {
      attrs.push("nocapture");
    }
    return attrs;
  }
  if (kind === K_ARRAY) {
    // dereferenceable(24): every array value points at a full header (len,
    // cap, data), allocated by the arena or built by a literal; there is no
    // null and no partial header.
    attrs.push("nonnull");
    attrs.push("align 8");
    attrs.push(`dereferenceable(${ARRAY_HEADER_BYTES})`);
    if (pointer !== null && !pointer.writesThrough && !pointer.captured) {
      attrs.push("readonly");
    }
    if (pointer !== null && !pointer.captured) {
      attrs.push("nocapture");
    }
    return attrs;
  }
  if (kind === K_STRUCT) {
    attrs.push("nonnull");
    if (name === "this" && f.freshThis) {
      attrs.push("noalias");
    }
    if (pointer !== null && !pointer.writesThrough && !pointer.captured) {
      attrs.push("readonly");
    }
    attrs.push("align 8");
    if (pointer !== null && pointer.size > 0) {
      attrs.push(`dereferenceable(${pointer.size})`);
    }
    if (pointer !== null && !pointer.captured) {
      attrs.push("nocapture");
    }
    return attrs;
  }
  if (kind === K_RESULT && table.resultByValue(type)) {
    // WP17: a small `Result` arrives packed in an `i64`, so none of the
    // pointer facts are about it; `noundef` alone, as for any scalar.
    return attrs;
  }
  if (kind === K_RESULT) {
    // WP16: every `Result` comes from `Ok(...)` / `Err(...)`, so the object is
    // whole and never null, and nothing in the language can store through one.
    attrs.push("nonnull");
    attrs.push("align 8");
    if (pointer !== null && pointer.size > 0) {
      attrs.push(`dereferenceable(${pointer.size})`);
    }
    if (pointer !== null && !pointer.writesThrough && !pointer.captured) {
      attrs.push("readonly");
    }
    if (pointer !== null && !pointer.captured) {
      attrs.push("nocapture");
    }
    return attrs;
  }
  if (kind === K_NULLABLE) {
    // WP6: no `nonnull` / `dereferenceable`; the rest as for the pointee kind.
    if (table.refOf(type) === T_STRING) {
      attrs.push("noalias");
      attrs.push("readonly");
    } else if (pointer !== null && !pointer.writesThrough && !pointer.captured) {
      attrs.push("readonly");
    }
    attrs.push("align 8");
    const uncaptured = pointer !== null ? !pointer.captured : !f.escaping.has(name);
    if (uncaptured) {
      attrs.push("nocapture");
    }
  }
  return attrs;
}

/** `deref` is the struct size for struct-returning functions, 0 otherwise. */
export function returnAttributes(table: TypeTable, type: i32, deref: i32): string[] {
  const attrs: string[] = [];
  const kind = table.kindOf(type);
  if (type === T_VOID) {
    return attrs;
  }
  attrs.push("noundef");
  if (type === T_BOOL) {
    attrs.push("zeroext");
    return attrs;
  }
  if (type === T_STRING) {
    attrs.push("nonnull");
    attrs.push("align 8");
    return attrs;
  }
  if (kind === K_ARRAY) {
    attrs.push("nonnull");
    attrs.push("align 8");
    attrs.push(`dereferenceable(${ARRAY_HEADER_BYTES})`);
    return attrs;
  }
  if (kind === K_RESULT && table.resultByValue(type)) {
    // WP17: a small `Result` comes back packed in an `i64`, so none of the
    // pointer facts are about it; the word is always fully defined, because
    // the dead arm is discarded by a `select` before it is shifted in.
    return attrs;
  }
  if (kind === K_STRUCT || kind === K_RESULT) {
    // WP16: a `Result` is a whole, never-null object, exactly like a struct.
    attrs.push("nonnull");
    attrs.push("align 8");
    if (deref > 0) {
      attrs.push(`dereferenceable(${deref})`);
    }
    return attrs;
  }
  if (kind === K_NULLABLE) {
    attrs.push("align 8"); // WP6: may be null
  }
  return attrs;
}
