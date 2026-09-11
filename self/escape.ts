// Allocation escape analysis for stage1 (`src/codegen/escape.ts`,
// docs/wp14-selfhost.md milestone S4): which allocations can live on the
// stack, and which functions can reclaim their arena temporaries on exit.
//
// The model is `src/codegen/escape.ts`'s and its long header states it in
// full: an *allocation site* is an expression that produces fresh memory, its
// value *flows* somewhere through the transparent wrappers and the locals it
// is stored in, and the flow is `local`, `returned` or `leaks`. A stackable
// site whose flow is `local` and whose holding locals are never reassigned
// becomes an entry-block `alloca`; a function whose direct arena allocations
// all flow `local` brackets its body with `nish_arena_mark` /
// `nish_arena_release`.
//
// The call-site reclaim (WP9) is stated there too: `leaks` merges a value the
// caller can still reach with one merely assigned to a local of this frame, so
// every outcome also carries `escapes`, true only in the first case and
// following the value into the local in the second. `allocEscapes` is the
// per-function union; `reclaimsReturnedString` is what it buys.
//
// What is different here is only the bookkeeping. `Set`/`Map` keyed by node or
// by local become a `boolean[]` indexed by `Node.id` and short lists scanned
// by identity — a function has a handful of locals, and `===` on a class value
// is the identity the maps were there for. The upward walks read `self/
// parents.ts` instead of `node.parent`, and an argument's parent is the
// `N_LIST` that holds it, which `attributes.ts` handles for both of us.

import {
  classifyUse,
  constructorOf,
  AnalysisUnit,
  CallSite,
  FactsTable,
  USE_ARGUMENT,
  USE_NONE,
  USE_READ,
  USE_WRITE,
} from "./attributes";
import {
  dottedName,
  intrinsicType,
  isAssignmentOperator,
  isJoinCall,
  isPushCall,
  isStringAllocCall,
  isTemplateExpression,
  unwrapParens,
  unwrapStringPassthrough,
} from "./emit_util";
import {
  N_ARRAY,
  N_BINARY,
  N_CALL,
  N_CONDITIONAL,
  N_EMPTY,
  N_IDENT,
  N_NEW,
  N_NUMBER,
  N_OBJECT,
  N_PAREN,
  N_RETURN,
  N_VAR_DECL,
  Node,
} from "./nodes";
import { literalLength } from "./emit_arrays";
import { isResultConstructorCall, resultMethodName } from "./emit_result";
import { StringSet } from "./map";
import { Options } from "./options";
import { CheckedProgram, FunctionSig } from "./program";
import { Local, STORAGE_LOCAL, STORAGE_PARAM } from "./symbols";
import { isNumeric, T_STRING, TypeTable } from "./types";

/** Largest array data block (`[n x T]`) placed on the stack, in bytes. */
export const STACK_ARRAY_BYTES: i32 = 4096;

/** Where the value of an allocation site ends up. The order is the severity order. */
export const FLOW_LOCAL: i32 = 0;
export const FLOW_RETURNED: i32 = 1;
export const FLOW_LEAKS: i32 = 2;

function worse(a: i32, b: i32): i32 {
  return a >= b ? a : b;
}

export class EscapeResult {
  /** Node id -> the allocation there is lowered to an entry-block alloca. */
  stackSites: boolean[];
  /** Locals that only ever hold a stack object (their fields are own memory). */
  stackLocals: Local[];
  /** The body performs an arena allocation whose flow is `local`. */
  directArena: boolean;
  /** Some direct allocation `leaks`. */
  allocLeaks: boolean;
  /**
   * WP9: some direct allocation is reachable after this function returns other
   * than through its return value. Refines `allocLeaks`, which also counts a
   * value assigned to a local of this frame; see the header.
   */
  allocEscapes: boolean;
  /** Some direct allocation is `returned`. */
  returnsAllocation: boolean;
  /** Calls `Arena.reset` / `Arena.release` directly. */
  usesArenaControl: boolean;
  /** Calls to pointer-returning user functions, with the flow of each result. */
  callSites: CallSite[];
  /**
   * WP17: names of the by-value `Result` parameters whose unpacked object may
   * be an entry-block alloca. The word arrives in a register, so the object
   * the body reads is built by the callee; it is this function's own memory
   * unless a use of the parameter stores the pointer somewhere that outlives
   * the frame (an object literal, `push`), which is exactly what
   * `localOutcome` decides for a local holding an allocation.
   */
  stackParams: StringSet;

  constructor(nodeCount: i32) {
    this.stackSites = new Array<boolean>(nodeCount);
    this.stackLocals = [];
    this.stackParams = new StringSet();
    this.directArena = false;
    this.allocLeaks = false;
    this.allocEscapes = false;
    this.returnsAllocation = false;
    this.usesArenaControl = false;
    this.callSites = [];
  }
}

/** One allocation expression. */
class Site {
  node: Node;
  /** Struct or array of a known size within budget: may become an alloca. */
  stackable: boolean;
  /** A user call: the site counts only if the callee allocates (fixpoint). Empty otherwise. */
  callee: string;

  constructor(node: Node, stackable: boolean) {
    this.node = node;
    this.stackable = stackable;
    this.callee = "";
  }
}

/** The flow of one value, and whether every local on the path is a fixed binding. */
class Outcome {
  flow: i32;
  /** No local on the path is ever reassigned (required for the stack). */
  stable: boolean;
  /**
   * WP9: the value is reachable after this function returns, other than
   * through its return value. Always false for a `local` or `returned` flow;
   * false for a `leaks` flow whose only cause is an assignment to a local of
   * this frame, whose own outcome it takes instead.
   */
  escapes: boolean;

  constructor(flow: i32, stable: boolean, escapes: boolean) {
    this.flow = flow;
    this.stable = stable;
    this.escapes = escapes;
  }
}

/** Where a value is stored: a local, the return value, or neither. */
class FlowTarget {
  local: Local | null;
  isReturn: boolean;

  constructor(local: Local | null, isReturn: boolean) {
    this.local = local;
    this.isReturn = isReturn;
  }
}

class EscapeAnalysis {
  unit: AnalysisUnit;
  table: TypeTable;
  facts: FactsTable;
  opts: Options;
  result: EscapeResult;

  sites: Site[];
  /** Every identifier reference to each local of this function, in source order. */
  refLocals: Local[];
  refNodes: Node[][];
  declarations: Node[];
  /** `push` receivers that are locals, checked against the site locals below. */
  pushes: Node[];
  logsNumbers: boolean;
  /** WP17: this function hands its `Result` back in a register, not as a pointer. */
  returnsByValueResult: boolean;
  /** Memoised outcomes, keyed by local identity. */
  outcomeLocals: Local[];
  outcomeValues: Outcome[];
  /** The signature being analysed; WP17 reads its parameter list. */
  sig: FunctionSig;

  constructor(
    unit: AnalysisUnit,
    table: TypeTable,
    facts: FactsTable,
    opts: Options,
    nodeCount: i32,
    sig: FunctionSig,
    returnsByValueResult: boolean
  ) {
    this.unit = unit;
    this.table = table;
    this.facts = facts;
    this.opts = opts;
    this.sig = sig;
    this.returnsByValueResult = returnsByValueResult;
    this.result = new EscapeResult(nodeCount);
    this.sites = [];
    this.refLocals = [];
    this.refNodes = [];
    this.declarations = [];
    this.pushes = [];
    this.logsNumbers = false;
    this.outcomeLocals = [];
    this.outcomeValues = [];
  }

  // ---- Collection -------------------------------------------------------------------

  /** The `Local` of the parameter called `name`, from the refs collected, or null. */
  paramLocal(name: string): Local | null {
    let i = 0;
    while (i < this.refLocals.length) {
      const v = this.refLocals[i];
      if (v.storage === STORAGE_PARAM && v.name === name) {
        return v;
      }
      i = i + 1;
    }
    return null;
  }

  addRef(local: Local, node: Node): void {
    let i = 0;
    while (i < this.refLocals.length) {
      if (this.refLocals[i] === local) {
        this.refNodes[i].push(node);
        return;
      }
      i = i + 1;
    }
    const list: Node[] = [];
    list.push(node);
    this.refLocals.push(local);
    this.refNodes.push(list);
  }

  refsOf(local: Local): Node[] {
    let i = 0;
    while (i < this.refLocals.length) {
      if (this.refLocals[i] === local) {
        return this.refNodes[i];
      }
      i = i + 1;
    }
    return [];
  }

  /** Bytes per element: every value is a scalar or a pointer, so its size is its alignment. */
  elementSize(elem: i32): i32 {
    return this.table.alignOf(elem);
  }

  visit(node: Node): void {
    const program = this.unit.program;
    if (node.kind === N_IDENT) {
      const local = program.nodeLocals[node.id];
      // WP17: a by-value `Result` parameter owns its object, so its uses are
      // walked like a local's: the same alias chain decides alloca or arena.
      if (
        local !== null &&
        (local.storage === STORAGE_LOCAL ||
          (local.storage === STORAGE_PARAM && this.table.resultByValue(local.type)))
      ) {
        this.addRef(local, node);
      }
    } else if (node.kind === N_VAR_DECL) {
      this.declarations.push(node);
    } else if (node.kind === N_NEW) {
      this.visitNew(node);
    } else if (node.kind === N_OBJECT) {
      this.sites.push(new Site(node, true));
    } else if (node.kind === N_ARRAY) {
      const type = program.nodeTypes[node.id];
      const stackable =
        type >= 0 &&
        this.table.isArray(type) &&
        node.children.length * this.elementSize(this.table.refOf(type)) <= STACK_ARRAY_BYTES;
      this.sites.push(new Site(node, stackable));
    } else if (node.kind === N_BINARY) {
      if (node.text === "+" && program.nodeTypes[node.children[0].id] === T_STRING) {
        this.sites.push(new Site(node, false));
      }
    } else if (isTemplateExpression(node)) {
      if (unwrapStringPassthrough(program, node) === node) {
        this.sites.push(new Site(node, false));
      }
    } else if (node.kind === N_CALL) {
      this.visitCall(node);
    }
    for (const child of node.children) {
      this.visit(child);
    }
  }

  visitNew(node: Node): void {
    const type = this.unit.program.nodeTypes[node.id];
    if (type >= 0 && this.table.isStruct(type)) {
      this.sites.push(new Site(node, true));
      return;
    }
    if (type < 0 || !this.table.isArray(type)) {
      return;
    }
    const args = node.children[2];
    const n = args.children.length > 0 ? literalLength(args.children[0]) : -1;
    const stackable = n >= 0 && n * this.elementSize(this.table.refOf(type)) <= STACK_ARRAY_BYTES;
    this.sites.push(new Site(node, stackable));
  }

  visitCall(call: Node): void {
    const program = this.unit.program;
    const callee = program.nodeCallees[call.id];
    if (callee !== null) {
      if (this.isPointerResult(callee.returnType)) {
        const site = new Site(call, false);
        site.callee = callee.name;
        this.sites.push(site);
      } else if (this.table.resultByValue(callee.returnType)) {
        // WP17: a `Result` returned in a register is materialised by the
        // *caller*, so the call is an allocation site of this function like
        // `new C(...)` is: an entry-block alloca unless the pointer is handed
        // to something that keeps it, and never memory the callee owns.
        this.sites.push(new Site(call, true));
      }
      return;
    }
    if (isPushCall(program, this.table, call)) {
      this.pushes.push(call);
      return;
    }
    // WP14: `s.substring(...)`, `String.fromCharCode(c)` and `parts.join(s)`
    // each bump one string out of the arena, so they are allocation sites
    // exactly as `a + b` is.
    if (isStringAllocCall(program, call) || isJoinCall(program, this.table, call)) {
      this.sites.push(new Site(call, false));
      return;
    }
    // WP16: `r.orReturn()` builds the `Result` this function returns early, so
    // the body hands out arena memory whatever else it does — which is exactly
    // what disqualifies it from an automatic arena scope. WP17: not when the
    // `Result` is packed into the return register, because then nothing is
    // built at all.
    if (resultMethodName(program, this.table, call) === "orReturn") {
      if (!this.returnsByValueResult) {
        this.result.returnsAllocation = true;
      }
      return;
    }
    const target = call.children[0];
    if (target.kind === N_IDENT) {
      // `Ok(v)` / `Err(e)` bump one fixed-size struct, so they are stackable
      // exactly as `new C(...)` is.
      if (isResultConstructorCall(program, this.table, call)) {
        this.sites.push(new Site(call, true));
        return;
      }
      if (target.text === "readFileSync" || target.text === "readFileSyncOrNull") {
        this.sites.push(new Site(call, false));
      }
      return;
    }
    const name = dottedName(target);
    if (name === "Arena.reset" || name === "Arena.release") {
      this.result.usesArenaControl = true;
      return;
    }
    if (name === "console.log") {
      const args = call.children[1];
      const type = args.children.length > 0 ? program.nodeTypes[args.children[0].id] : -1;
      if (type >= 0 && isNumeric(type)) {
        // `nish_str_from_*` allocates the text; `nish_print` does not retain it.
        this.logsNumbers = true;
      }
    }
  }

  isPointerResult(type: i32): boolean {
    const inner = this.table.stripNull(type);
    // A `Result` (WP16) is a pointer into the arena like the others, so a call
    // that answers one is an allocation site of its caller — unless WP17 packs
    // it into a register, in which case the callee allocated nothing and the
    // caller's copy is its own (see the `resultByValue` arm of `visitCall`).
    return (
      this.table.isStruct(inner) ||
      this.table.isArray(inner) ||
      inner === T_STRING ||
      (this.table.isResult(inner) && !this.table.resultByValue(inner))
    );
  }

  // ---- Flow of one value -------------------------------------------------------------

  /** The local the value is stored in, or the return value, or neither. */
  flowTarget(expr: Node): FlowTarget {
    let node = expr;
    for (;;) {
      const parent = this.unit.parents.parentOf(node);
      if (parent === null) {
        return new FlowTarget(null, false);
      }
      if (parent.kind === N_PAREN || (parent.kind === N_CONDITIONAL && parent.children[0] !== node)) {
        node = parent;
        continue;
      }
      if (parent.kind === N_VAR_DECL && parent.children[2] === node) {
        return new FlowTarget(this.unit.program.nodeLocals[parent.id], false);
      }
      if (parent.kind === N_RETURN) {
        return new FlowTarget(null, true);
      }
      return new FlowTarget(null, false);
    }
  }

  /** Whether `callee` retains the pointer passed as parameter `index` (`this` is 0). */
  calleeCaptures(callee: FunctionSig, index: i32): boolean {
    const g = this.facts.get(callee.name);
    if (g === null || index < 0 || index >= g.paramNames.length) {
      return true;
    }
    const name = g.paramNames[index];
    const pointer = g.pointerParam(name);
    return pointer !== null ? pointer.captured : g.escaping.has(name);
  }

  /**
   * `x = <expr>`: the local of this function the value is assigned to, or
   * null. It is still `leaks` for the stack rule — the binding is not fixed,
   * so the slot may not be reused — but the value has not left the frame, so
   * `escapes` follows it into `x` the way `flow` already follows
   * `const x = <expr>`. A store through anything else (`o.f = v`, `a[i] = v`)
   * or into a parameter is not a local of this frame and keeps the
   * conservative answer.
   */
  assignedLocal(expr: Node): Local | null {
    let node = expr;
    for (;;) {
      const parent = this.unit.parents.parentOf(node);
      if (parent === null) {
        return null;
      }
      if (parent.kind === N_PAREN || (parent.kind === N_CONDITIONAL && parent.children[0] !== node)) {
        node = parent;
        continue;
      }
      if (
        parent.kind !== N_BINARY ||
        parent.children[1] !== node ||
        !isAssignmentOperator(parent.text) ||
        parent.children[0].kind !== N_IDENT
      ) {
        return null;
      }
      const target = this.unit.program.nodeLocals[parent.children[0].id];
      if (target === null || target.storage !== STORAGE_LOCAL) {
        return null;
      }
      return target;
    }
  }

  useOutcome(expr: Node, visiting: Local[]): Outcome {
    const found = classifyUse(this.unit, this.table, expr);
    if (found.kind === USE_NONE || found.kind === USE_READ || found.kind === USE_WRITE) {
      return new Outcome(FLOW_LOCAL, true, false);
    }
    if (found.kind === USE_ARGUMENT) {
      const callee = found.callee;
      // WP17: a by-value `Result` argument is packed into a register, so the
      // callee gets a copy and never sees this object at all.
      if (
        callee !== null &&
        found.index < callee.paramTypes.length &&
        this.table.resultByValue(callee.paramTypes[found.index])
      ) {
        return new Outcome(FLOW_LOCAL, true, false);
      }
      const captures = callee === null ? true : this.calleeCaptures(callee, found.index);
      return new Outcome(captures ? FLOW_LEAKS : FLOW_LOCAL, true, captures);
    }
    const target = this.assignedLocal(expr);
    const escapes = target === null ? true : this.localOutcome(target, visiting).escapes;
    return new Outcome(FLOW_LEAKS, true, escapes);
  }

  memoised(v: Local): Outcome | null {
    let i = 0;
    while (i < this.outcomeLocals.length) {
      if (this.outcomeLocals[i] === v) {
        return this.outcomeValues[i];
      }
      i = i + 1;
    }
    return null;
  }

  localOutcome(v: Local, visiting: Local[]): Outcome {
    const known = this.memoised(v);
    if (known !== null) {
      return known;
    }
    for (const seen of visiting) {
      if (seen === v) {
        // `const y = x; const x2 = y` chains are acyclic, but `escapes` also
        // follows `y = x`, and two locals assigned to each other do cycle. The
        // re-entry is therefore pessimistic about escaping and optimistic about
        // the flow, which is what the existing decisions were computed with.
        return new Outcome(FLOW_LOCAL, true, true);
      }
    }
    visiting.push(v);
    let flow = FLOW_LOCAL;
    let stable = true;
    let escapes = false;
    for (const ref of this.refsOf(v)) {
      const parent = this.unit.parents.parentOf(ref);
      if (parent !== null && parent.kind === N_BINARY && parent.children[0] === ref && isAssignmentOperator(parent.text)) {
        // `x = other`: the object is no longer named by `x`, and the stack
        // rule wants a fixed binding.
        stable = false;
        continue;
      }
      const step = this.valueOutcome(ref, visiting);
      flow = worse(flow, step.flow);
      stable = stable && step.stable;
      escapes = escapes || step.escapes;
    }
    const outcome = new Outcome(flow, stable, escapes);
    this.outcomeLocals.push(v);
    this.outcomeValues.push(outcome);
    return outcome;
  }

  valueOutcome(expr: Node, visiting: Local[]): Outcome {
    const target = this.flowTarget(expr);
    if (target.isReturn) {
      // WP17: `return r` on a by-value `Result` copies the two live words into
      // the return register; the object itself does not leave the frame, so it
      // is as local as one that is never returned at all.
      return new Outcome(this.returnsByValueResult ? FLOW_LOCAL : FLOW_RETURNED, true, false);
    }
    const local = target.local;
    if (local !== null) {
      return this.localOutcome(local, visiting);
    }
    return this.useOutcome(expr, visiting);
  }

  // ---- Decisions ----------------------------------------------------------------------

  decide(): void {
    for (const site of this.sites) {
      const fresh: Local[] = [];
      const outcome = this.valueOutcome(site.node, fresh);
      let flow = outcome.flow;
      let escapes = outcome.escapes;
      // A `new` object is also handed to its constructor as `this`; a
      // constructor that captures it makes the object escape however the
      // local is used afterwards.
      if (site.node.kind === N_NEW) {
        const ctor = constructorOf(this.unit.program, this.table, intrinsicType(this.unit.program, site.node));
        if (ctor !== null && this.calleeCaptures(ctor, 0)) {
          flow = FLOW_LEAKS;
          // The constructor stored `this` somewhere the caller may reach.
          escapes = true;
        }
      }
      if (escapes) {
        this.result.allocEscapes = true;
      }
      if (site.callee.length > 0) {
        this.result.callSites.push(new CallSite(site.callee, flow, escapes));
        continue;
      }
      if (site.stackable && this.opts.stackAlloc && flow === FLOW_LOCAL && outcome.stable) {
        this.result.stackSites[site.node.id] = true;
        continue;
      }
      if (flow === FLOW_LOCAL) {
        this.result.directArena = true;
      } else if (flow === FLOW_RETURNED) {
        this.result.returnsAllocation = true;
      } else {
        this.result.allocLeaks = true;
      }
    }

    // WP17: the same decision for each by-value `Result` parameter. A
    // parameter never referenced has no refs and therefore no way to escape,
    // so its object stays an alloca (and the unpack is dead code the optimiser
    // removes).
    let p = 0;
    while (p < this.sig.paramNames.length) {
      if (this.table.resultByValue(this.sig.paramTypes[p])) {
        const name = this.sig.paramNames[p];
        const v = this.paramLocal(name);
        let flow = FLOW_LOCAL;
        let stable = true;
        if (v !== null) {
          const fresh: Local[] = [];
          const outcome = this.localOutcome(v, fresh);
          flow = outcome.flow;
          stable = outcome.stable;
          if (outcome.escapes) {
            this.result.allocEscapes = true;
          }
        }
        if (this.opts.stackAlloc && flow === FLOW_LOCAL && stable) {
          this.result.stackParams.add(name);
        } else if (flow === FLOW_LOCAL) {
          this.result.directArena = true;
        } else {
          this.result.allocLeaks = true;
        }
      }
      p = p + 1;
    }

    // Locals that hold nothing but a stack object: their initializer is a
    // stack site or such a local, and they are never reassigned. Source order
    // is declaration order, so an alias sees its source decided first.
    for (const decl of this.declarations) {
      const v = this.unit.program.nodeLocals[decl.id];
      if (v === null || decl.children[2].kind === N_EMPTY) {
        continue;
      }
      const init = unwrapParens(decl.children[2]);
      let holds = this.result.stackSites[init.id];
      if (!holds && init.kind === N_IDENT) {
        const alias = this.unit.program.nodeLocals[init.id];
        holds = alias !== null && this.holdsStackObject(alias);
      }
      const visiting: Local[] = [];
      if (holds && this.localOutcome(v, visiting).stable) {
        this.result.stackLocals.push(v);
      }
    }

    // `xs.push(v)`: growth memory belongs to `xs`. Fine when `xs` is a local
    // allocation of this function that flows `local` (the growth dies with
    // it); a leak otherwise (a parameter, a field, an element, a returned array).
    for (const push of this.pushes) {
      const receiver = unwrapParens(push.children[0].children[0]);
      let v: Local | null = null;
      if (receiver.kind === N_IDENT) {
        v = this.unit.program.nodeLocals[receiver.id];
      }
      let owned = false;
      // WP9: the growth is reachable exactly where the array it belongs to is.
      // An array this function allocated and only keeps or returns takes its
      // growth with it; anyone else's array leaves it reachable by the caller.
      let escapes = true;
      if (v !== null && v.storage === STORAGE_LOCAL && this.ownsSite(v)) {
        const visiting: Local[] = [];
        const outcome = this.localOutcome(v, visiting);
        owned = outcome.flow === FLOW_LOCAL;
        escapes = outcome.escapes;
      }
      if (escapes) {
        this.result.allocEscapes = true;
      }
      if (owned) {
        this.result.directArena = true;
      } else {
        this.result.allocLeaks = true;
      }
    }
    if (this.logsNumbers) {
      this.result.directArena = true;
    }
  }

  holdsStackObject(local: Local): boolean {
    for (const candidate of this.result.stackLocals) {
      if (candidate === local) {
        return true;
      }
    }
    return false;
  }

  /** `v` was initialised by an allocation site of this function, directly or through an alias. */
  ownsSite(v: Local): boolean {
    const decl = this.declarationOf(v);
    if (decl === null || decl.children[2].kind === N_EMPTY) {
      return false;
    }
    const init = unwrapParens(decl.children[2]);
    for (const site of this.sites) {
      if (site.node === init) {
        return true;
      }
    }
    if (init.kind !== N_IDENT) {
      return false;
    }
    const alias = this.unit.program.nodeLocals[init.id];
    return alias !== null && alias.storage === STORAGE_LOCAL && alias !== v && this.ownsSite(alias);
  }

  declarationOf(v: Local): Node | null {
    for (const decl of this.declarations) {
      const declared = this.unit.program.nodeLocals[decl.id];
      if (declared !== null && declared === v) {
        return decl;
      }
    }
    return null;
  }
}

/**
 * WP9: may the caller reclaim the arena around a call to `callee`?
 *
 * The proof has three parts, and all three are needed:
 *
 *  - **The callee's garbage is garbage.** `allocEscapes` is false, so nothing
 *    the callee allocated is reachable from anywhere the caller can see except
 *    through the value it returned. The caller holds no other pointer into the
 *    call, because a return value is the only thing a call hands back.
 *  - **The arena did not move under the mark.** `usesArenaControl` is false, so
 *    neither the callee nor anything it calls reset or released the arena
 *    between the mark and the reclaim.
 *  - **The kept value can be moved.** Only a plain `string` qualifies: it is one
 *    flat block with no interior pointers, so relocating its bytes relocates the
 *    whole value. An array header points at a separate data block, a struct or a
 *    `Result` may hold pointers into other blocks, and `string | null` may be
 *    null, so none of them is moved.
 *
 * `allocates` is not part of the proof, only of the profit: a callee that never
 * bumps the arena has nothing to reclaim, so the pair of calls is skipped.
 */
export function reclaimsReturnedString(callee: FunctionSig, facts: FactsTable): boolean {
  if (callee.returnType !== T_STRING) {
    return false;
  }
  const g = facts.get(callee.name);
  return g !== null && g.allocates && !g.allocEscapes && !g.usesArenaControl;
}

export function analyzeEscapes(
  unit: AnalysisUnit,
  table: TypeTable,
  sig: FunctionSig,
  facts: FactsTable,
  opts: Options
): EscapeResult {
  const analysis = new EscapeAnalysis(
    unit,
    table,
    facts,
    opts,
    unit.program.nodeTypes.length,
    sig,
    table.resultByValue(sig.returnType)
  );
  const body = sig.body();
  if (body === null) {
    return analysis.result;
  }
  analysis.visit(body);
  analysis.decide();
  return analysis.result;
}
