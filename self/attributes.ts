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

import {
  builtinCallees,
  builtinCalleesNamed,
  identifierBuiltinCallees,
  identifierBuiltinCalleesNamed,
  isSpawnCall,
} from "./emit_builtins";
import { stringifyCallee, stringConstructCallees } from "./emit_strings";
import {
  analyzeEscapes,
  decideLoopScopes,
  EscapeResult,
  FLOW_LEAKS,
  FLOW_LOCAL,
  FLOW_RETURNED,
  isScalarArgument,
  rootsHoldNoPointer,
} from "./escape";
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
  storesInlineElements,
  templateParts,
  unwrapParens,
} from "./emit_util";
import { StringMap, StringSet } from "./map";
import {
  N_ARRAY,
  N_BINARY,
  N_BLOCK,
  N_ARROW,
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
  N_VAR_DECL,
  N_WHILE,
  Node,
} from "./nodes";
import { Options } from "./options";
import { isParallelEntry, parallelBodyOf, recyclesPerElement } from "./parallel";
import { ParentTable } from "./parents";
import {
  CheckedProgram,
  FieldInfo,
  FunctionSig,
  inlineElementStruct,
  ROLE_CONSTRUCTOR,
  StructInfo,
} from "./program";
import {
  EFFECT_NONE,
  EFFECT_READ,
  EFFECT_WRITE,
  inlineAllocatorAttrs,
  maxEffect,
  RuntimeFunction,
  RuntimeTable,
} from "./runtime";
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

/** `sizeof(%struct.nish_array)`: `{ i64 len, i64 cap, i8* data }` (WP4 layout). */
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
  /** The alignment the pointer is guaranteed to have; see `pointerAlign`. */
  align: i32;
  /** Stores through the pointer, directly or via a callee (fixpoint). */
  writesThrough: boolean;
  /** The pointer may outlive the call: returned, stored, aliased, or captured by a callee. */
  captured: boolean;
  /** Calls the pointer is passed to, by callee symbol and parameter index (0 is `this`). */
  passedToCallees: string[];
  passedToIndices: i32[];

  constructor(name: string, size: i32, align: i32) {
    this.name = name;
    this.size = size;
    this.align = align;
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
  /** WP9: the result is reachable after this function returns, other than through its return value. */
  escapes: boolean;
  /** The call, which the arena-loop diagnostic reports at and names the line of. */
  node: Node;

  constructor(callee: string, flow: i32, escapes: boolean, node: Node) {
    this.callee = callee;
    this.flow = flow;
    this.escapes = escapes;
    this.node = node;
  }
}

/**
 * One loop of a function, and whether each pass of its body is bracketed with
 * `nish_arena_mark` / `nish_arena_release` (`decideLoopScopes`, escape.ts).
 * When it is not, `why`, `at` and `name` say what refused it, which is what the
 * arena-loop diagnostic names.
 */
export class LoopScope {
  loop: Node;
  /** The statement each pass runs: what the scope brackets. */
  body: Node;
  /** The node whose line the reason names, or null. */
  at: Node | null;
  /** The local or the callee the reason names, or `""`. */
  name: string;
  /** A `LOOP_*` reason from escape.ts; `LOOP_NOTHING` when nothing refused the scope. */
  why: i32;
  scoped: boolean;
  /**
   * A pass can `return` what it allocated, whatever else refused it: no
   * bracket, automatic or written, could release that pass, so the
   * arena-loop diagnostic has no rewrite to offer and says nothing.
   */
  handsBack: boolean;

  constructor(loop: Node, body: Node) {
    this.loop = loop;
    this.body = body;
    this.scoped = false;
    this.why = 0;
    this.at = null;
    this.name = "";
    this.handsBack = false;
  }
}

/**
 * One array's header, read once in the preheader of the loop that reads the
 * array: the header pointer, its `len` and its `data`, and the path they were
 * read through.
 *
 * It lives here rather than in `emit_arrays.ts` because `FunctionFacts` is the
 * per-function record the emitter already carries (`Emitter.current`), and the
 * language has no module-level mutable state for a scope stack to live in --
 * which is how `src/codegen/emit/arrays.ts` holds the same thing.
 */
export class HoistedHeader {
  /** The binding the path is rooted at; identity, not name, is what matches. */
  root: Local;
  /** The property chain below the root: `".xs"`, `".state.atMostIndex"`, or `""`. */
  path: string;
  arr: string;
  /** `""` when the loop never asks for it, so nothing is loaded for it either. */
  len: string;
  data: string;

  constructor(root: Local, path: string, arr: string, len: string, data: string) {
    this.root = root;
    this.path = path;
    this.arr = arr;
    this.len = len;
    this.data = data;
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
  /**
   * WP15 section 2c: the function may move an array's `len` -- `a.push(v)`,
   * which also moves `cap` and `data` when it grows, or `a.pop()`, which moves
   * `len` alone -- directly or through a callee (fixpoint over the call graph).
   *
   * This is the whole-program "does not grow an array" fact, and the point of
   * it is what it leaves out. `PointerParamFacts.writesThrough` lumps a `push`
   * in with every other store, so a function that only writes elements is
   * indistinguishable from one that reallocates the buffer. An element write
   * leaves the header alone -- that is exactly what the section 2b alias
   * domains encode -- so a header fact built on `writesThrough` would refuse
   * every loop that writes an element, which is the loop a header hoist exists
   * for. Separating the two is the whole change: this is about the 24 bytes of
   * `{ len, cap, data }` and nothing else.
   *
   * It is deliberately not per parameter. A `push` anywhere a loop can reach
   * may be a push to the array that loop is reading, because two names can
   * hold one array and nothing here proves they do not.
   */
  resizesArray: boolean;
  /**
   * WP29 P1: the function writes memory its caller could observe, directly or
   * through a callee (fixpoint over the call graph). `effect` is the wrong
   * question for that, because it is about what LLVM may reorder: a panic, a
   * `throw` and an arena allocation are all `EFFECT_WRITE` there, and a data
   * parallel body with a bounds check or an integer division would be refused
   * for them. This leaves those three out, and is what a caller asks when it
   * needs to know whether two calls can run at once.
   *
   * Why each is safe to leave out:
   *   - A panic (`nish_panic_index`, `_slice`, `_div`) prints to fd 2 and
   *     `_exit`s (runtime/runtime.c): no user memory is written, and no caller
   *     runs again to observe any.
   *   - A `throw` lowers to `llvm.trap`, which writes nothing and never returns.
   *   - An arena allocation writes the arena's bump state and the fresh block.
   *     The block is unreachable until the function hands it out, and the bump
   *     state is per thread under `--threads` (`ARENA_GLOBAL_TLS`).
   *
   * A store into the function's own stack object (`stackLocals`), or into the
   * `this` a constructor initialises, is to memory nobody else holds yet, and
   * does not count either. `writesThrough` per pointer parameter is the finer
   * fact; this one is whole-function and deliberately coarse.
   */
  sharedWrite: boolean;
  /** The first node in the body that writes shared memory; `null` when a callee is the reason. */
  writeSite: Node | null;
  /**
   * The first callee, by symbol and in the order the body reaches them, that
   * carries `sharedWrite`; `""` when `writeSite` is set.
   */
  writeVia: string;
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
  /** The alignment a returned pointer is guaranteed to have; see `pointerAlign`. */
  returnAlign: i32;
  // ---- WP6 memory strategy (see escape.ts) ----
  /** Node id -> the allocation there is lowered to an entry-block alloca. */
  stackSites: boolean[];
  /** Locals that only ever hold a stack object: accesses through them are own memory. */
  stackLocals: Local[];
  /** WP17: by-value `Result` parameters whose unpacked object is an entry-block alloca. */
  stackParams: StringSet;
  /** Bracket the body with `nish_arena_mark` / `nish_arena_release`. Decided after the fixpoint. */
  arenaScope: boolean;
  /** Performs an arena allocation, directly or through a callee (fixpoint). */
  allocates: boolean;
  /** The body has an arena allocation of its own that flows `local`. */
  directArena: boolean;
  /** An allocation may survive the call other than through the return value. */
  allocLeaks: boolean;
  /**
   * WP9: an allocation is reachable *by the caller* after the call, other than
   * through the return value (fixpoint over callees). Refines `allocLeaks`,
   * which also counts a value assigned to a local of the frame; see the header
   * of escape.ts. `allocEscapes` implies `allocLeaks`, never the reverse.
   */
  allocEscapes: boolean;
  /** An allocation of this function is returned: the caller owns it, so no scope here. */
  returnsAllocation: boolean;
  /** Calls `Arena.reset` / `Arena.release`, directly or through a callee. */
  usesArenaControl: boolean;
  /**
   * Reads the arena's bump position — `Arena.mark`, `Arena.used` — directly or
   * through a callee (fixpoint). Such a function answers a number that depends
   * on *when* the arena was last reclaimed, which is what stops
   * `marksTailCall` (escape.ts) from moving a scope release across a call to
   * it. It is deliberately not folded into `usesArenaControl`: reading
   * the position invalidates nothing, so it must not cost a function its scope.
   */
  readsArenaState: boolean;
  /** Calls to pointer-returning user functions and where each result flows. */
  callSites: CallSite[];
  /** `EscapeResult.escapingNodes`: the sites whose value escapes. */
  escapingNodes: Node[];
  /** `EscapeResult.arenaNodes`: the sites that bump the arena themselves. */
  arenaNodes: Node[];
  /** Every loop of the body, and whether its passes are scoped. Decided after the scopes are settled. */
  loopScopes: LoopScope[];
  /**
   * Every arena allocation made while this function runs, by itself or by
   * anything it calls, is unreachable once it returns except through its
   * return value. Decided after the fixpoint, from two proofs of it:
   *
   *  - `!allocEscapes`, WP9's fact, already propagated over every callee. The
   *    escape analysis follows values, not memory, so it counts *any* store of
   *    an allocation into memory as an escape, a store into another fresh
   *    object included; that is what makes it sound here, because it means
   *    no pointer read back out of memory can be one allocated during the call.
   *  - `rootsHoldNoPointer` (escape.ts), which needs nothing from the callees:
   *    nothing older than the call has a slot a pointer fits in.
   *
   * It is deliberately not a fixpoint of its own, falling from "contained" to
   * "not" over the callees the way `allocEscapes` rises. That version is
   * unsound: a callee whose parameters hold no pointers is contained however
   * it nests allocations inside the object it returns, and its caller can
   * read one back out of that object (`o.x`) and store it through its own
   * parameter. The read is not an allocation site, so nothing sees it, and
   * `tests/cases/mem_callee_scope_nested` is that program.
   */
  contained: boolean;
  /** The first allocation of this function's own that escapes, or null; see `EscapeResult.escapeSite`. */
  escapeSite: Node | null;
  /** The return type is a number, a `boolean`, an `enum` or `void`: nothing a release could free. */
  returnsScalar: boolean;
  /** The function as a diagnostic names it: `Owner.method` for a member. */
  sourceName: string;
  /** Allocates from the arena in its own body, before any callee is counted. */
  allocatesItself: boolean;
  /** Calls `Arena.mark`, `Arena.release` or `Arena.reset` in its own body: the program is managing this memory. */
  managesArena: boolean;
  /**
   * Leaves arena memory behind when it returns: it allocates, itself or
   * through a callee that does, and has no scope to take it back. Settled with
   * the scopes; what the callee rule and the arena-loop diagnostic ask.
   */
  netAllocates: boolean;
  /**
   * WP15 section 2c: the array headers the enclosing loops lifted into their
   * preheaders, innermost scope last, with `hoistedScopeStarts` marking where
   * each open scope begins. Emission scratch rather than an analysis result:
   * `emit_arrays.ts` fills it when a loop opens and truncates it when the loop
   * closes, and it is empty outside one.
   */
  hoistedHeaders: HoistedHeader[];
  hoistedScopeStarts: i32[];

  constructor(paramNames: string[], nodeCount: i32) {
    this.hasLoops = false;
    this.readsMemory = false;
    this.loopsBounded = true;
    this.hasTrap = false;
    this.resizesArray = false;
    this.sharedWrite = false;
    this.writeSite = null;
    this.writeVia = "";
    this.effect = EFFECT_NONE;
    this.willReturn = true;
    this.callsNoReturn = false;
    this.escaping = new StringSet();
    this.callees = new StringSet();
    this.paramNames = paramNames;
    this.pointerParams = [];
    this.freshThis = false;
    this.returnDeref = 0;
    this.returnAlign = 8;
    this.hoistedHeaders = [];
    this.hoistedScopeStarts = [];
    this.stackSites = new Array<boolean>(nodeCount);
    this.stackLocals = [];
    this.stackParams = new StringSet();
    this.arenaScope = false;
    this.allocates = false;
    this.directArena = false;
    this.allocLeaks = false;
    this.allocEscapes = false;
    this.returnsAllocation = false;
    this.usesArenaControl = false;
    this.readsArenaState = false;
    this.callSites = [];
    this.escapingNodes = [];
    this.arenaNodes = [];
    this.loopScopes = [];
    this.contained = false;
    this.escapeSite = null;
    this.returnsScalar = false;
    this.sourceName = "";
    this.allocatesItself = false;
    this.managesArena = false;
    this.netAllocates = false;
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

  /** Each pass of `body` is bracketed with its own arena scope: it is the body of a scoped loop. */
  scopesPass(body: Node): boolean {
    for (const scope of this.loopScopes) {
      if (scope.body === body) {
        return scope.scoped;
      }
    }
    return false;
  }

  scopesAnyPass(): boolean {
    for (const scope of this.loopScopes) {
      if (scope.scoped) {
        return true;
      }
    }
    return false;
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

/**
 * Facts for every function of a whole program, keyed by LLVM symbol.
 *
 * A symbol and no longer a bare name, since WP21 S1: every symbol carries its
 * module's package prefix (`self/packages.ts`), so two dependencies that each
 * keep a private `helper()` get two entries here instead of one. Sharing an
 * entry would emit each of them with the other's purity, escape and pointer
 * facts, which is a miscompile rather than a missed optimisation. Nothing here
 * changed for it: the root package's prefix is empty, so a single-package
 * program is analysed under exactly the keys it always was.
 */
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

  /** The position of `name`'s facts in `list`, or -1 for a symbol with none (a runtime function). */
  indexOf(name: string): i32 {
    return this.index.get(name, -1);
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

const use = (kind: i32): ParamUse => new ParamUse(kind);

const argumentUse = (callee: FunctionSig, index: i32): ParamUse => {
  const result = new ParamUse(USE_ARGUMENT);
  result.callee = callee;
  result.index = index;
  return result;
};

/** The position of `node` in its `N_LIST` parent, which is the argument index. */
const indexInList = (list: Node, node: Node): i32 => {
  let i = 0;
  while (i < list.children.length) {
    if (list.children[i] === node) {
      return i;
    }
    i = i + 1;
  }
  return -1;
};

/**
 * Classify a reference to a parameter by walking up through the transparent
 * wrappers (parentheses, ternary arms, single-hole templates) to the construct
 * that consumes the value. Anything not explicitly harmless escapes.
 */
export const classifyUse = (unit: AnalysisUnit, table: TypeTable, ref: Node): ParamUse => {
  const program = unit.program;
  let node = ref;
  // Set once the value is an inline element: the address of a slot in the array.
  let interior = false;
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
      if (yieldsInteriorPointer(unit, table, parent)) {
        node = parent;
        interior = true;
        continue;
      }
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
      // WP32: `a ?? d` hands on whichever operand it answers, as a ternary does.
      if (parent.text === "??") {
        node = parent;
        continue;
      }
      // Assignment retains the right-hand side; every other operator consumes both operands.
      if (isAssignmentOperator(parent.text)) {
        if (parent.children[1] !== node) {
          return use(USE_NONE);
        }
        // WP15 §2a: `xs[i] = p` into an inline-element array copies `p`'s bytes
        // into the slot, exactly as `push` does; nothing keeps the pointer.
        const target = unwrapParens(parent.children[0]);
        if (target.kind === N_INDEX && storesInlineElements(program, table, target.children[0])) {
          return use(USE_READ);
        }
        return use(USE_ESCAPE);
      }
      return use(USE_NONE);
    }
    // An element of an array literal whose elements are inline is copied into
    // the fresh block the literal allocates, so the value is read, not kept.
    if (parent.kind === N_ARRAY && storesInlineElements(program, table, parent)) {
      return use(USE_READ);
    }
    if (parent.kind === N_FOR_OF) {
      // The loop variable of an inline-element array is each slot's address,
      // so the array itself is what the body holds (`yieldsInteriorPointer`).
      if (parent.children[1] !== node) {
        return use(USE_ESCAPE);
      }
      if (!storesInlineElements(program, table, node)) {
        return use(USE_READ);
      }
      return classifyElementHolder(unit, table, program.nodeLocals[parent.children[0].children[0].children[0].id], parent);
    }
    // `const p = xs[i]`: the local holds the slot, and is what uses it.
    if (interior && parent.kind === N_VAR_DECL && parent.children[2] === node) {
      return classifyElementHolder(unit, table, program.nodeLocals[parent.id], enclosingBlock(unit, parent));
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
};

/** `p.f`, `p.f = v`, `p.m(...)`, `p.length`: the member access is the consumer. */
const classifyMemberUse = (unit: AnalysisUnit, table: TypeTable, access: Node): ParamUse => {
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
};

/** An argument of `f(...)` or `new C(...)`: the list is the parent, the call is above it. */
const classifyArgumentUse = (unit: AnalysisUnit, table: TypeTable, list: Node, node: Node): ParamUse => {
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
    // the `Result` they build (WP16), `r.unwrapOr(p)` hands it back as the
    // expression's value, and `spawnSync(p)` leaves the runtime holding an
    // arena vector of pointers into `p`'s strings (WP14 D4); every other
    // builtin lowers to runtime functions whose pointer params are all
    // declared `nocapture`.
    // WP15 §2a: a push into an array that holds its elements inline *copies*
    // the object into the slot, so the pointer is read and then forgotten —
    // the one shape where a push does not retain what it was given.
    if (isPushCall(program, table, owner)) {
      const receiver = methodReceiver(owner);
      const inline = receiver !== null && storesInlineElements(program, table, receiver);
      return use(inline ? USE_READ : USE_ESCAPE);
    }
    if (isResultConstructorCall(program, table, owner) || isSpawnCall(program, owner)) {
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
};

/**
 * `xs[i]` whose value is the address of a slot inside `xs`'s data block
 * rather than a pointer loaded out of it: `xs` holds its elements inline
 * (WP15 §2a), and the element is used as a value — kept in a local, passed,
 * returned, stored — rather than read from or written through on the spot.
 *
 * Whoever holds that value holds `xs`'s memory, so a use of it is a use of
 * `xs`, and the classifiers see through the index to it. Reading a field of
 * the element (`xs[i].x`) or writing the slot (`xs[i] = p`, which copies)
 * keeps nothing, and neither is this. Before this was seen through, a
 * function could store `xs[i]` into its parameter's object, be told nothing
 * escaped, and release the arena it pointed into
 * (`tests/cases/mem_loop_scope_interior`).
 */
export const yieldsInteriorPointer = (unit: AnalysisUnit, table: TypeTable, access: Node): boolean => {
  if (!storesInlineElements(unit.program, table, access.children[0])) {
    return false;
  }
  let node = access;
  let parent = unit.parents.parentOf(node);
  while (parent !== null && parent.kind === N_PAREN) {
    node = parent;
    parent = unit.parents.parentOf(node);
  }
  return parent !== null && parent.kind !== N_MEMBER && !isAssignmentTarget(parent, node);
};

/**
 * A local that holds an inline element (`const p = xs[i]`, or the variable of
 * a `for...of` over such an array), classified as a use of the array: every
 * reference to it reads or writes one of the slot's fields on the spot, which
 * is `USE_READ` or `USE_WRITE` exactly as `xs[i].x` is, or anything else, which
 * keeps the slot's address and escapes. `within` is where the local is
 * visible: its block, or the `for...of`.
 */
const classifyElementHolder = (unit: AnalysisUnit, table: TypeTable, holder: Local | null, within: Node | null): ParamUse => {
  if (holder === null || within === null) {
    return use(USE_ESCAPE);
  }
  const refs: Node[] = [];
  collectRefs(unit.program, within, holder, refs);
  let kind = USE_READ;
  for (const ref of refs) {
    let node = ref;
    let parent = unit.parents.parentOf(node);
    while (parent !== null && parent.kind === N_PAREN) {
      node = parent;
      parent = unit.parents.parentOf(node);
    }
    if (parent === null || parent.kind !== N_MEMBER) {
      return use(USE_ESCAPE);
    }
    const found = classifyMemberUse(unit, table, parent);
    if (found.kind === USE_WRITE) {
      kind = USE_WRITE;
    } else if (found.kind !== USE_READ) {
      return use(USE_ESCAPE);
    }
  }
  return use(kind);
};

/** Every identifier under `node` that names `local`, skipping lifted arrow bodies. */
const collectRefs = (program: CheckedProgram, node: Node, local: Local, out: Node[]): void => {
  if (node.kind === N_ARROW) {
    return;
  }
  if (node.kind === N_IDENT) {
    const named = program.nodeLocals[node.id];
    if (named !== null && named === local) {
      out.push(node);
    }
  }
  for (const child of node.children) {
    collectRefs(program, child, local, out);
  }
};

/** The block a declaration's scope ends with, or null when it is not in one. */
const enclosingBlock = (unit: AnalysisUnit, decl: Node): Node | null => {
  let node: Node | null = unit.parents.parentOf(decl);
  while (node !== null && node.kind !== N_BLOCK) {
    node = unit.parents.parentOf(node);
  }
  return node;
};

/**
 * The parameter is the indexing base of `access` (`p[i]`, `p[i][j]`, ...).
 * The value obtained is a loaded element, not the pointer, so the pointer can
 * never be captured this way; but a store through the element counts as a
 * write through `p`, conservatively, as docs/wp4-arrays.md specifies.
 */
const classifyElementUse = (unit: AnalysisUnit, table: TypeTable, access: Node): ParamUse => {
  const program = unit.program;
  let node = access;
  for (;;) {
    const parent = unit.parents.parentOf(node);
    if (parent === null) {
      return use(USE_READ);
    }
    if (
      parent.kind === N_PAREN ||
      (parent.kind === N_INDEX && parent.children[0] === node) ||
      (parent.kind === N_BINARY && parent.text === "??") // WP32: as a ternary's arm
    ) {
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
};

/**
 * The constructor `new` runs for a struct type. `null` when the type is not
 * a struct or nothing constructs it.
 */
export const constructorOf = (program: CheckedProgram, table: TypeTable, type: i32): FunctionSig | null => {
  if (type < 0 || !table.isStruct(type)) {
    return null;
  }
  const info = program.struct(table.nameOf(type));
  return info === null ? null : info.ctor;
};

/** `` `${s}` ``: a template that lowers to its single string hole unchanged. */
const isStringPassthrough = (program: CheckedProgram, template: Node): boolean => {
  if (!isTemplateExpression(template)) {
    return false;
  }
  const parts = templateParts(template);
  if (parts.length !== 1 || parts[0].kind === N_TEMPLATE_TEXT) {
    return false;
  }
  return program.nodeTypes[parts[0].id] === T_STRING;
};

// ---- Per-function collection ------------------------------------------------------------

/**
 * `sizeof` the pointee, for `dereferenceable`; 0 where there is nothing fixed
 * to claim. A `Result` layout is derived from the type, not declared (WP16),
 * so it is computed rather than looked up.
 */
const structSize = (program: CheckedProgram, table: TypeTable, type: i32): i32 => {
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
};

/**
 * The alignment a pointer of this type is *guaranteed* to have, which is 8 for
 * everything the allocator hands out and less for exactly one shape.
 *
 * WP15 section 2a: an array of records is contiguous storage, so `ps[i]` is an
 * interior pointer at `i * sizeof(P)` into an 8-aligned block. When `sizeof(P)`
 * is not a multiple of 8 — `interface Q { a: i32; b: i32 }` is eight bytes
 * aligned to four — element 1 is 4-aligned and `align 8` would be a lie. The
 * record's own alignment is the true bound: the block is 8-aligned and the
 * stride is a multiple of `align`, so every slot is `align`-aligned and no more
 * can be promised. Every other pointer keeps `align 8`, because it comes from
 * `nish_alloc_struct` (which rounds to 8) or an entry-block alloca the emitter
 * gives `align 8`.
 */
const pointerAlign = (program: CheckedProgram, table: TypeTable, type: i32): i32 => {
  if (type < 0) {
    return 8;
  }
  const record = inlineElementStruct(program, table, table.stripNull(type));
  if (record === null || record.align >= 8) {
    return 8;
  }
  return record.align;
};

/** Struct, array and `Result` params, plain or `T | null`, get pointer facts. */
/**
 * Struct, array and `Result` params get pointer facts — except a `Result` the
 * ABI packs into a register (WP17), which is not a pointer at all, so there is
 * nothing for the fixpoint to say about it.
 */
const isPointerParam = (table: TypeTable, type: i32): boolean => {
  // An **allow-list**, and WP27 S2 is why that matters rather than being a
  // stylistic preference. Every fact this predicate opens the door to —
  // `dereferenceable`, `nonnull`, `align`, `nocapture`, `readonly` — is a claim
  // about memory *this compiler laid out*: it knows the struct's size because
  // it chose it, and the alignment because it emitted it. A `CPtr` is an
  // address a C function owns, of unknown size, alignment and lifetime, and not
  // one of those attributes could be justified for it. Because the answer below
  // names what is allowed rather than what is not, `T_CPTR` falls out of it by
  // construction; if it named exclusions instead, the next pointer-shaped type
  // would be admitted by a case nobody remembered to write, and a wrong
  // attribute is undefined behaviour rather than a missed optimisation.
  const inner = table.stripNull(type);
  if (table.isResult(inner)) {
    return !table.resultByValue(inner);
  }
  return table.isStruct(inner) || table.isArray(inner);
};

class FactCollector {
  unit: AnalysisUnit;
  table: TypeTable;
  opts: Options;
  sig: FunctionSig;
  facts: FunctionFacts;
  /** Round 1's fixpoint, or `null` in round 1 itself; see `bodyMayExtend`. */
  known: FactsTable | null;

  constructor(
    unit: AnalysisUnit,
    table: TypeTable,
    opts: Options,
    sig: FunctionSig,
    facts: FunctionFacts,
    known: FactsTable | null
  ) {
    this.unit = unit;
    this.table = table;
    this.opts = opts;
    this.sig = sig;
    this.facts = facts;
    this.known = known;
  }

  /** A reference to one of this function's parameters (`this` and `super` included), by name. */
  paramRef(node: Node): string {
    if (node.kind !== N_IDENT && node.kind !== N_THIS) {
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

  /** WP29 P1: `node` writes memory a caller could observe. The first one in the walk is the one named. */
  noteSharedWrite(node: Node): void {
    if (!this.facts.sharedWrite) {
      this.facts.sharedWrite = true;
      this.facts.writeSite = node;
    }
  }

  /**
   * `this.f = v` in a constructor: `this` is the fresh object the `new` that
   * called it allocated, so the store initialises an allocation rather than
   * writing anything a caller already holds. Only `this` itself qualifies; a
   * store through `this.inner` may reach an object that came from outside.
   */
  initialisesThis(receiver: Node): boolean {
    return this.facts.freshThis && unwrapParens(receiver).kind === N_THIS;
  }

  /** A store into `receiver`'s array: shared unless the array is this function's own stack object. */
  noteArrayWrite(node: Node, receiver: Node | null): void {
    if (this.facts.sharedWrite) {
      return; // already named; no need to ask whose array it is
    }
    if (receiver === null || !this.isStackOwned(receiver)) {
      this.noteSharedWrite(node);
    }
  }

  visit(node: Node): void {
    const program = this.unit.program;
    // WP29: an arrow argument is lifted into a function of its own, which has
    // facts of its own; its body is not this function's, and neither it nor a
    // function named as an argument is a value this function holds.
    if (node.kind === N_ARROW) {
      return;
    }
    if (node.kind === N_FOR || node.kind === N_WHILE || node.kind === N_DO || node.kind === N_FOR_OF) {
      this.facts.hasLoops = true;
      if (!isCountedLoop(this.unit, this.table, node, this.known)) {
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
      // WP32: `m.get(k)` is a `probe` and, when it finds the key, a `valueAt`,
      // which the checker records on the callee member (`checkMapGet`); its
      // type, a maybe, is what says the call is one.
      const reads = program.nodeCallees[node.children[0].id];
      if (reads !== null && this.table.isMaybe(program.nodeTypes[node.id])) {
        this.facts.callees.add(reads.name);
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
    this.collectNamespacePropertyFacts(node);
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
        this.facts.callees.add("nish_str_concat");
      } else if (op === "===" || op === "!==") {
        this.facts.callees.add("nish_str_eq");
      }
      return;
    }
    if (node.kind === N_CALL && isStringMethodCall(program, node)) {
      // The byte methods all read the string's bytes; `substring` and `slice`
      // also allocate, and `slice` and an unproven `charCodeAt` can reach a panic.
      this.facts.readsMemory = true;
      this.addCallees(
        stringConstructCallees(node.children[0].text, this.opts.uncheckedIndexing, program.nodeProvenIndex[node.id])
      );
      return;
    }
    if (node.kind === N_MEMBER && program.nodeTypes[node.children[0].id] === T_STRING) {
      this.facts.readsMemory = true; // `.length` loads the header through the string pointer
      return;
    }
    if (isTemplateExpression(node)) {
      const parts = templateParts(node);
      if (parts.length > 1) {
        this.facts.callees.add("nish_str_concat");
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
        if (!this.initialisesThis(receiver)) {
          this.noteSharedWrite(above);
        }
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
        this.facts.callees.add("nish_alloc_struct");
      }
      const ctor = constructorOf(program, table, intrinsicType(program, node));
      if (ctor !== null) {
        this.facts.callees.add(ctor.name);
      }
      return;
    }
    if (node.kind === N_OBJECT && !this.facts.isStackSite(node)) {
      this.facts.effect = EFFECT_WRITE;
      this.facts.callees.add("nish_alloc_struct");
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
            this.facts.callees.add("nish_alloc_struct");
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
          this.facts.callees.add("nish_alloc_struct");
        } else if (method === "expect") {
          this.facts.callees.add("nish_write");
          this.facts.callees.add("nish_exit");
        }
        return;
      }
      // `Ok(...)` / `Err(...)`: a user function of that name is in `nodeCallees`
      // and is reported through the call graph instead.
      if (!isResultConstructorCall(program, table, node)) {
        return;
      }
      if (!this.facts.isStackSite(node)) {
        this.facts.callees.add("nish_alloc_struct");
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
      // Mirrors `emitBoundsCheck` exactly, proof and all: an access the checker
      // proved in range emits no call, so listing `nish_panic_index` here would
      // cost the function `willreturn` for a `noreturn` callee that is not in
      // its IR.
      if (!this.opts.uncheckedIndexing && !program.nodeProvenIndex[node.id]) {
        this.facts.callees.add("nish_panic_index");
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
      this.noteArrayWrite(node, node.children[0].children[0]);
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
      this.noteArrayWrite(call, methodReceiver(call));
      this.facts.resizesArray = true;
      this.facts.callees.add("nish_array_grow");
      return;
    }
    if (method === "pop") {
      // Stores the shortened length back, and panics on an empty array.
      this.facts.effect = EFFECT_WRITE;
      this.noteArrayWrite(call, methodReceiver(call));
      this.facts.resizesArray = true;
      if (!this.opts.uncheckedIndexing) {
        this.facts.callees.add("nish_panic_index");
      }
      return;
    }
    if (method === "join") {
      this.facts.effect = EFFECT_WRITE; // one arena allocation
      this.facts.callees.add("nish_alloc_struct");
      return;
    }
    this.facts.readsMemory = true; // `indexOf` scans the elements
    const receiver = methodReceiver(call);
    if (receiver === null) {
      return;
    }
    const type = this.unit.program.nodeTypes[receiver.id];
    if (type >= 0 && this.table.isArray(type) && this.table.refOf(type) === T_STRING) {
      this.facts.callees.add("nish_str_eq");
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
      this.facts.callees.add("nish_panic_div");
    }
  }

  /**
   * The namespace properties that are not constants. The load of `@nish_argv`
   * reads memory the function does not own, so the caller is at most
   * `readonly`; `process.platform` and `process.arch` are one `readnone`
   * runtime call each (WP14 §7a), which changes no attribute today. The call
   * is named anyway, because the rule is that what a construct emits and what
   * the analysis is told it emits never drift apart.
   */
  collectNamespacePropertyFacts(node: Node): void {
    let name = "";
    if (node.kind === N_MEMBER) {
      if (receiverIsValue(this.unit.program, node.children[0])) {
        return;
      }
      name = dottedName(node);
    } else if (node.kind === N_IDENT) {
      // The same property, reached through `import { argv } from
      // "nish:process"`. An attribute that depended on which spelling a
      // program used would be a miscompile waiting for the other one.
      name = this.unit.program.nodeBuiltins[node.id];
    } else {
      return;
    }
    if (name === "process.argv") {
      this.facts.readsMemory = true;
    } else if (name === "process.platform") {
      this.facts.callees.add("nish_platform");
    } else if (name === "process.arch") {
      this.facts.callees.add("nish_arch");
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
    // Under a `nish:` import the identifier is the local name, so the checker
    // recorded which builtin it is; a dotted one is what the other helper
    // answers for. Reading the text here instead would leave a call to `exit`
    // looking like no call at all, and the function would keep a `willreturn`
    // it has not earned.
    const imported = this.unit.program.nodeBuiltins[node.id];
    if (imported.length > 0) {
      this.addCallees(
        imported.indexOf(".") < 0
          ? identifierBuiltinCalleesNamed(this.unit.program, this.table, node, imported)
          : builtinCalleesNamed(this.unit.program, this.table, node, imported)
      );
      return;
    }
    this.addCallees(identifierBuiltinCallees(this.unit.program, this.table, node));
  }
}

/**
 * Per-function facts from one walk of the body. `memory` (round 2, see
 * `analyzeFunctions`) tells the collectors which allocations are allocas and
 * which locals hold them, and carries the allocation facts into the result.
 */
export const collectFacts = (
  unit: AnalysisUnit,
  table: TypeTable,
  opts: Options,
  sig: FunctionSig,
  memory: EscapeResult | null,
  nodeCount: i32,
  known: FactsTable | null
): FunctionFacts => {
  const program = unit.program;
  const facts = new FunctionFacts(sig.paramNames, nodeCount);
  facts.freshThis = sig.role === ROLE_CONSTRUCTOR;
  facts.returnDeref = structSize(program, table, sig.returnType);
  facts.returnAlign = pointerAlign(program, table, sig.returnType);
  if (memory !== null) {
    facts.stackSites = memory.stackSites;
    facts.stackLocals = memory.stackLocals;
    facts.stackParams = memory.stackParams;
    facts.directArena = memory.directArena;
    facts.allocates = memory.directArena;
    facts.allocLeaks = memory.allocLeaks;
    facts.allocEscapes = memory.allocEscapes;
    facts.returnsAllocation = memory.returnsAllocation;
    facts.usesArenaControl = memory.usesArenaControl;
    facts.callSites = memory.callSites;
    facts.escapingNodes = memory.escapingNodes;
    facts.arenaNodes = memory.arenaNodes;
    facts.escapeSite = memory.escapeSite;
    // The half of `contained` that needs no fixpoint; the other is added after it.
    facts.contained = rootsHoldNoPointer(program, table, sig);
  }
  // A `returned` or `leaked` allocation is still an allocation.
  if (facts.returnsAllocation || facts.allocLeaks) {
    facts.allocates = true;
  }
  facts.allocatesItself = facts.allocates;
  facts.sourceName = sig.sourceName;
  facts.returnsScalar = sig.returnType === T_VOID || isScalarArgument(table, sig.returnType);
  let i = 0;
  while (i < sig.paramNames.length) {
    const type = sig.paramTypes[i];
    if (isPointerParam(table, type)) {
      facts.pointerParams.push(
        new PointerParamFacts(
          sig.paramNames[i],
          structSize(program, table, table.stripNull(type)),
          pointerAlign(program, table, type)
        )
      );
    }
    i = i + 1;
  }

  // WP27 S1: a `declare function` has no body, and `FunctionFacts` starts from
  // the *pure* defaults because purity here is discovered by walking a body and
  // finding nothing impure in it. An absent body is not an empty one: leaving
  // the defaults would mark every caller of a C function `readnone willreturn`,
  // which miscompiles rather than pessimises. So a foreign function asserts the
  // worst of everything it cannot be seen to avoid, and the fixpoint carries
  // that outward exactly as it carries any other impurity. `escaping` and the
  // pointer facts stay empty because S1's boundary is scalars only, so a
  // foreign callee has no pointer to capture (`docs/wp27-ffi.md` §3).
  if (sig.foreign()) {
    facts.effect = EFFECT_WRITE;
    facts.sharedWrite = true; // no site and no callee to name: the body is C
    facts.willReturn = false;
    facts.readsMemory = true;
    // S1's boundary is scalars only, so a C body cannot reach an array header
    // at all; this says otherwise for the same reason the three lines above
    // do. S2 widening the type check must revisit the block rather than
    // inherit a `false` nobody re-derived.
    facts.resizesArray = true;
    return facts;
  }

  const collector = new FactCollector(unit, table, opts, sig, facts, known);
  const body = sig.body();
  if (body !== null) {
    collector.visit(body);
  }

  // The two arena builtins that report the bump position. Read here rather
  // than in escape.ts because the walk has already put every runtime symbol a
  // call lowers to in `callees`, and because this has to hold in round 1:
  // `analyzeFunctions` adds the scope's own `nish_arena_mark` to `callees`
  // after the fixpoint, and that one is the compiler's, not the program's.
  if (isParallelEntry(sig)) {
    markParallelEntry(facts);
  }

  facts.readsArenaState = facts.callees.has("nish_arena_mark") || facts.callees.has("nish_arena_used");
  facts.managesArena = facts.usesArenaControl || facts.callees.has("nish_arena_mark");

  if (facts.readsMemory) {
    facts.effect = maxEffect(facts.effect, EFFECT_READ);
  }
  if (facts.hasTrap) {
    facts.effect = EFFECT_WRITE;
  }
  facts.willReturn = facts.loopsBounded && !facts.hasTrap && !facts.callsNoReturn;
  return facts;
};

/**
 * WP29 P1: the facts of a `parallelMapInto` or `parallelReduce` instance are
 * its source walk's, plus what the region the emitter builds in place of one
 * call does (`self/emit_parallel.ts`). The walk sees a direct call to the
 * chunk loop with the parameters as arguments; the IR stores them into a
 * context block and hands its address to `nish_parallel_range`, which passes
 * it to other threads. So the runtime entry is a callee — it is a shared
 * write and not `willreturn`, and the fixpoint carries both — and every
 * parameter is treated as escaping, written through and captured:
 *
 *   - no `nocapture`, because the address is stored in memory another thread
 *     reads, and whether that copy outlives the call is the partitioner's
 *     join rather than anything this analysis can see;
 *   - no `readonly`, because `dst` is written by those threads through the
 *     copy, not through the parameter this function was handed.
 *
 * Both are claims LLVM would act on, and what each would buy is nothing: the
 * instance is called once per region, and the loop inside it is the chunk
 * function, whose own facts are unaffected.
 */
const markParallelEntry = (facts: FunctionFacts): void => {
  facts.callees.add("nish_parallel_range");
  for (const name of facts.paramNames) {
    facts.escaping.add(name);
  }
  for (const pp of facts.pointerParams) {
    pp.captured = true;
    pp.writesThrough = true;
  }
};

// ---- The fixpoint ------------------------------------------------------------------------

/**
 * Gather per-function facts for a whole program, then propagate over the
 * (cross-module) call graph to a fixpoint: a function is as impure as the most
 * impure thing it calls, it is willreturn only if everything it calls is, and
 * a pointer parameter is written or captured if any callee it is passed to
 * writes or captures the matching parameter. The result is keyed by LLVM
 * symbol, so a caller in one module sees exactly what the exporter proved.
 */
export const analyzeFunctions = (
  units: AnalysisUnit[],
  table: TypeTable,
  opts: Options,
  runtime: RuntimeTable
): FactsTable => {
  // Round 1: plain facts and the capture fixpoint, which the escape analysis needs.
  const first = collectRound(units, table, opts, null, null);
  propagate(first, runtime);
  const escapes = new EscapeSet();
  for (const unit of units) {
    for (const sig of unit.program.functions) {
      if (sig.definedIn(unit.program.source)) {
        // WP18: over the instantiation's own side tables, so `Box<i32>` being
        // stack-allocated in one instantiation and arena-allocated in another
        // is two answers rather than one.
        const instance = sig.instance;
        if (instance !== null) {
          unit.program.enterInstance(instance);
        }
        escapes.set(sig.name, analyzeEscapes(unit, table, sig, first, opts));
        if (instance !== null) {
          unit.program.leaveInstance();
        }
      }
    }
  }
  // Round 2: the same facts with stack allocations applied, then the scope
  // decision. `first` carries round 1's fixpoint, which is what lets a
  // `for...of` ask whether its calls actually grow an array (WP15 section 2c)
  // rather than assuming every one of them does. `resizesArray` is settled by
  // then: it is syntax plus the call graph, and neither moves between rounds.
  const facts = collectRound(units, table, opts, escapes, first);
  propagate(facts, runtime);
  for (const f of facts.list) {
    f.arenaScope = f.directArena && !f.allocLeaks && !f.returnsAllocation && !f.usesArenaControl;
    f.contained = f.contained || !f.allocEscapes;
  }
  scopeParallelBodies(units, facts);
  settleCalleeScopes(facts);
  // The per-pass scopes read the settled answers: which callees still leave
  // memory behind, and which let an allocation escape.
  for (const unit of units) {
    for (const sig of unit.program.functions) {
      const f = facts.get(sig.name);
      if (f === null || !f.hasLoops || !sig.definedIn(unit.program.source)) {
        continue;
      }
      const instance = sig.instance;
      if (instance !== null) {
        unit.program.enterInstance(instance);
      }
      decideLoopScopes(unit, table, sig, f, facts);
      if (instance !== null) {
        unit.program.leaveInstance();
      }
    }
  }
  for (const f of facts.list) {
    // Both are `willreturn` and the function already writes (it allocates),
    // so nothing else moves. A scoped pass reads its mark inline and calls
    // only the release.
    if (f.arenaScope) {
      f.callees.add("nish_arena_mark");
    }
    if (f.arenaScope || f.scopesAnyPass()) {
      f.callees.add("nish_arena_release");
    }
  }
  return facts;
};

/**
 * WP29: a data-parallel body that allocates gets an arena scope of its own, so
 * every element gives back what it allocated before the next one starts. The
 * WP6 rule above asks the function's own allocations to stay out of every
 * local that is assigned, and the callee rule below asks for a callee that
 * allocates; a body can fail both and still be one whose memory is garbage
 * the moment it answers, and for a body that runs a million times on one
 * thread's arena that difference is the peak resident size (wp20 §8a).
 *
 * **Why it is sound.** `recyclesPerElement` (`self/parallel.ts`) is the callee
 * rule's own condition — contained, a scalar result, no arena control — plus
 * not reading the bump position, and `Compilation.checkParallel` refuses any
 * body that allocates without it, so a scope added here never frees what
 * outlives the element. The arena is thread-local under `--threads`
 * (`ARENA_GLOBAL_TLS`), and importing `nish/threads` implies `--threads`, so
 * the mark and the release run in whichever thread the element runs in and
 * name that thread's arena: a worker rewinds only what it bumped itself, and
 * the calling thread, which runs chunk 0, rewinds its own arena to where the
 * element found it. No other thread's allocation can sit between the two.
 *
 * It is set before the callee scopes are settled, so a caller that only calls
 * the body — the chunk loop — sees a callee that no longer net-allocates and
 * does not get a scope of its own around a whole chunk.
 */
const scopeParallelBodies = (units: AnalysisUnit[], facts: FactsTable): void => {
  for (const unit of units) {
    for (const call of unit.program.parallelCalls) {
      const body = parallelBodyOf(call.sig);
      const f: FunctionFacts | null = body === null ? null : facts.get(body.name);
      if (f !== null && f.allocates && !f.arenaScope && recyclesPerElement(f)) {
        f.arenaScope = true;
      }
    }
  }
};

/**
 * The automatic arena scope for a function whose callees are what allocate.
 *
 * The rule of WP6 (`arenaScope` above) asks for an allocation of the
 * function's *own* that flows `local`, so a function that only calls
 * allocating functions and throws their results away never reclaimed
 * anything: `List.benchmark` in the Are We Fast Yet suite builds three lists
 * through `makeList` and keeps one `i32`, and every list lived until the
 * harness released its own mark. This adds a second way to earn the bracket:
 *
 *     contained && returnsScalar && !usesArenaControl && some callee net-allocates
 *
 * **Why it is sound.** The release rewinds the arena to where it stood on
 * entry, freeing exactly what was allocated while the function ran, by it or
 * by anything it called. After the `ret` the only things that leave the frame
 * are the return value and whatever the body and its callees wrote into
 * memory that existed before the call. The return value is a number, a
 * `boolean`, an `enum` or nothing, so it names no memory. `contained` says no
 * allocation made during the call is reachable any other way, which covers the
 * writes. And `usesArenaControl` being false means nothing in the call reset or
 * released the arena under the mark, so the mark still names the entry
 * position when the release runs. Reading the position (`Arena.mark`,
 * `Arena.used`) is allowed, exactly as the WP6 rule allows it: it answers a
 * smaller number after a scope reclaimed memory, which is the point, and
 * `readsArenaState` keeps a release from moving ahead of a tail call to one.
 *
 * **Why "net-allocates".** That clause is profit rather than proof. A callee
 * with a scope of its own gives its memory back before it returns, so a scope
 * around the caller would bracket nothing but two runtime calls. Whether a
 * function net-allocates depends on whether it got a scope, which depends on
 * whether its callees net-allocate, so the functions are settled callees
 * first, depth-first over the call graph. A recursion back to a function still
 * being settled reads the answer computed with the WP6 scopes alone, which can
 * only say "allocates" where the settled one would not: the cost of that is a
 * scope nobody needed, never a missing one.
 */
const settleCalleeScopes = (facts: FactsTable): void => {
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of facts.list) {
      if (!f.netAllocates && !f.arenaScope && (f.allocatesItself || someCalleeNetAllocates(facts, f))) {
        f.netAllocates = true;
        changed = true;
      }
    }
  }
  const before: boolean[] = [];
  const state: i32[] = [];
  for (const f of facts.list) {
    before.push(f.netAllocates);
    state.push(0);
  }
  let i = 0;
  while (i < state.length) {
    if (state[i] === 0) {
      settleScope(facts, i, state, before);
    }
    i = i + 1;
  }
};

const someCalleeNetAllocates = (facts: FactsTable, f: FunctionFacts): boolean => {
  let c = 0;
  while (c < f.callees.size()) {
    const g = facts.get(f.callees.at(c));
    if (g !== null && g.netAllocates) {
      return true;
    }
    c = c + 1;
  }
  return false;
};

/** `state`: 0 not yet visited, 1 being settled (on the walk), 2 settled. */
const settleScope = (facts: FactsTable, i: i32, state: i32[], before: boolean[]): void => {
  state[i] = 1;
  const f = facts.list[i];
  let calleeAllocates = false;
  let c = 0;
  while (c < f.callees.size()) {
    const j = facts.indexOf(f.callees.at(c));
    // `state` and `before` hold one entry per function, so a symbol with facts
    // is always inside both; the tests are what let the bounds prover see it,
    // and the second is repeated because the recursive call drops the first.
    if (j >= 0 && j < state.length && state[j] === 0) {
      settleScope(facts, j, state, before);
    }
    if (j >= 0 && j < state.length && j < before.length) {
      if (state[j] === 2 ? facts.list[j].netAllocates : before[j]) {
        calleeAllocates = true;
      }
    }
    c = c + 1;
  }
  if (!f.arenaScope && calleeAllocates && f.contained && f.returnsScalar && !f.usesArenaControl) {
    f.arenaScope = true;
  }
  f.netAllocates = !f.arenaScope && (f.allocatesItself || calleeAllocates);
  state[i] = 2;
};

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

const collectRound = (
  units: AnalysisUnit[],
  table: TypeTable,
  opts: Options,
  escapes: EscapeSet | null,
  known: FactsTable | null
): FactsTable => {
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
      // WP18: per instantiation, over that instantiation's side tables. The
      // facts are keyed by symbol already, so `eq$i32` being `readnone` and
      // `eq$str` `readonly` needs nothing but the right tables here.
      const instance = sig.instance;
      if (instance !== null) {
        unit.program.enterInstance(instance);
      }
      facts.set(
        sig.name,
        collectFacts(unit, table, opts, sig, memory, unit.program.nodeTypes.length, known)
      );
      if (instance !== null) {
        unit.program.leaveInstance();
      }
    }
  }
  return facts;
};

/** Propagate effects, termination, pointer facts and allocation facts to a fixpoint. */
const propagate = (facts: FactsTable, runtime: RuntimeTable): void => {
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
        if (site.escapes && !f.allocEscapes) {
          // WP9: this function stored the callee's result where its own caller can reach it.
          f.allocEscapes = true;
          changed = true;
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
  nameWriteVia(facts, runtime);
};

/** One caller/callee edge; answers whether anything about the caller moved. */
const propagateCallee = (facts: FactsTable, runtime: RuntimeTable, f: FunctionFacts, callee: string): boolean => {
  let changed = false;
  const calleeFacts = facts.get(callee);
  const rt = runtime.lookup(callee);
  // The inline arena allocator is not in the runtime table (it is emitted as
  // an IR definition), but callers must still see it as a writing, willreturn
  // callee.
  const isAllocator = callee === "nish_alloc_struct";
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
  if (!f.sharedWrite && writesShared(calleeFacts, rt, callee)) {
    f.sharedWrite = true;
    changed = true;
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
    // WP9: whatever a callee lets out of its own frame is out of this one too.
    if (calleeFacts.allocEscapes && !f.allocEscapes) {
      f.allocEscapes = true;
      changed = true;
    }
    // WP15 section 2c: growing an array is a property of the whole closure,
    // the same way allocation is -- a caller that pushes nothing still moves a
    // header when the callee it invokes does.
    if (calleeFacts.resizesArray && !f.resizesArray) {
      f.resizesArray = true;
      changed = true;
    }
    if (calleeFacts.usesArenaControl && !f.usesArenaControl) {
      f.usesArenaControl = true;
      changed = true;
    }
    if (calleeFacts.readsArenaState && !f.readsArenaState) {
      f.readsArenaState = true;
      changed = true;
    }
  }
  return changed;
};

const hasAttr = (attrs: string[], name: string): boolean => attrs.indexOf(name) >= 0;

/**
 * WP29 P1: calling `callee`, whose facts and runtime entry the caller has
 * already looked up, writes shared memory. An unknown callee is assumed to, as
 * it is assumed to write at all.
 */
const writesShared = (
  calleeFacts: FunctionFacts | null,
  rt: RuntimeFunction | null,
  callee: string
): boolean => {
  if (calleeFacts !== null) {
    return calleeFacts.sharedWrite;
  }
  if (callee === "nish_alloc_struct") {
    return false; // the inline arena allocator; see `FunctionFacts.sharedWrite`
  }
  return rt === null || rt.sharedWrite();
};

/**
 * WP29 P1: `writeVia` for every function whose shared write is a callee's,
 * named once the fixpoint has settled. Naming it inside the loop would name
 * whichever callee the loop happened to reach first, and that order is the
 * whole program's function order, so one module would name different callees
 * depending on which entry point loaded it. Here it is the first callee in the
 * function's own call order: the order its body reaches them.
 */
const nameWriteVia = (facts: FactsTable, runtime: RuntimeTable): void => {
  for (const f of facts.list) {
    if (!f.sharedWrite || f.writeSite !== null) {
      continue;
    }
    let c = 0;
    while (c < f.callees.size() && f.writeVia.length === 0) {
      const callee = f.callees.at(c);
      if (writesShared(facts.get(callee), runtime.lookup(callee), callee)) {
        f.writeVia = callee;
      }
      c = c + 1;
    }
  }
};

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
export const isCountedLoop = (
  unit: AnalysisUnit,
  table: TypeTable,
  loop: Node,
  known: FactsTable | null
): boolean => {
  const program = unit.program;
  if (loop.kind === N_FOR_OF) {
    return !bodyMayExtend(unit, table, loop.children[2], known);
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
};

const absOf = (value: i32): i32 => value < 0 ? -value : value;

const isName = (expr: Node, name: string): boolean => {
  const e = unwrapParens(expr);
  return e.kind === N_IDENT && e.text === name;
};

/** Signed step of `i++`, `++i`, `i--`, `--i`, `i += c`, `i -= c`; 0 for anything else. */
export const stepOf = (expr: Node, name: string): i32 => {
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
};

/**
 * `for (const x of a)` re-reads `a.length` every iteration, so it is bounded
 * unless the body can grow an array: any `push` or `pop`, a call that can grow
 * one, or a `throw`.
 *
 * `known` is the call-graph fixpoint's answer for the callees, or `null` when
 * there is not one yet. Without it every user call has to count as growing the
 * array, because a callee handed the same array may push through it -- which
 * is what this asked before `resizesArray` existed, and is still what round 1
 * asks, since the fixpoint has not run. With it the question is the one that
 * was always meant: does anything this body reaches actually move a `len`?
 */
const bodyMayExtend = (unit: AnalysisUnit, table: TypeTable, body: Node, known: FactsTable | null): boolean => {
  if (body.kind === N_THROW || isResizeCall(unit.program, table, body)) {
    return true;
  }
  if (body.kind === N_CALL) {
    const callee = unit.program.nodeCallees[body.id];
    // An unresolved callee is a builtin, and no builtin but `push`/`pop`
    // reaches a user array's header; those two are above.
    if (callee !== null) {
      if (known === null) {
        return true;
      }
      const calleeFacts = known.get(callee.name);
      if (calleeFacts === null || calleeFacts.resizesArray) {
        return true;
      }
    }
  }
  for (const child of body.children) {
    if (bodyMayExtend(unit, table, child, known)) {
      return true;
    }
  }
  return false;
};

/**
 * `a.push(v)` or `a.pop()`: the two calls that move an array's `len`, and so
 * the two a hoisted header has to be safe from. Every other array method reads
 * (`indexOf`, `join`) or builds something new.
 */
export const isResizeCall = (program: CheckedProgram, table: TypeTable, node: Node): boolean => {
  const method = arrayMethodName(program, table, node);
  return method === "push" || method === "pop";
};

/** True when `body` may assign one of `names` (by any assignment form) or may throw. */
const bodyDisturbs = (body: Node, names: string[]): boolean => {
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
};

// ---- Attribute rendering --------------------------------------------------------------------

export const functionAttributes = (f: FunctionFacts): string[] => {
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
};

export const paramAttributes = (
  table: TypeTable,
  name: string,
  type: i32,
  f: FunctionFacts,
  privateAbi: boolean
): string[] => {
  const attrs: string[] = [];
  // `noundef` on everything except a by-value `Result` under the private ABI
  // (WP15 §7b), whose dead arm's slot is deliberately `undef` — and `noundef`
  // on an aggregate is about every element of it, not just the live one.
  if (!privateAbi || !table.resultByValue(type)) {
    attrs.push("noundef");
  }
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
    // Not always 8: a record that is an array element sits at `i * sizeof(P)`
    // into the block, so its own alignment is all that can be promised.
    attrs.push(`align ${pointer === null ? 8 : pointer.align}`);
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
    // pointer facts are about it; `noundef` alone, as for any scalar — or
    // nothing at all under the private ABI, as above.
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
    attrs.push(`align ${pointer === null ? 8 : pointer.align}`);
    const uncaptured = pointer !== null ? !pointer.captured : !f.escaping.has(name);
    if (uncaptured) {
      attrs.push("nocapture");
    }
  }
  return attrs;
};

/**
 * `deref` is the struct size for struct-returning functions, 0 otherwise;
 * `privateAbi` is whether this function answers a by-value `Result` as the
 * arms rather than the word (WP15 §7b).
 */
export const returnAttributes = (
  table: TypeTable,
  type: i32,
  deref: i32,
  privateAbi: boolean,
  align: i32
): string[] => {
  const attrs: string[] = [];
  const kind = table.kindOf(type);
  if (type === T_VOID) {
    return attrs;
  }
  // The private ABI's arms are the one shape in the language that is not
  // fully defined: the arm that is not live is `undef` by construction, so
  // they carry no `noundef` at all (WP15 §7b).
  if (privateAbi && table.resultByValue(type)) {
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
    // `align` is the record alignment for a record type, 8 otherwise.
    attrs.push("nonnull");
    attrs.push(`align ${align}`);
    if (deref > 0) {
      attrs.push(`dereferenceable(${deref})`);
    }
    return attrs;
  }
  if (kind === K_NULLABLE) {
    attrs.push(`align ${align}`); // WP6: may be null
  }
  return attrs;
};
