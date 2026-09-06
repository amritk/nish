/**
 * Function/parameter attribute analysis ("Rust parity" hints for LLVM).
 *
 * Everything emitted here must be a *guarantee*, never a hope: a wrong
 * attribute is undefined behaviour, not a missed optimisation. The rules:
 *
 *   nounwind    StaticTS has no exceptions; nothing can unwind.
 *   willreturn  Only when the function contains no loops (Phase 1: always).
 *   readnone    The function touches no memory except its own allocas and
 *               calls only functions that are themselves readnone. LLVM's
 *               FunctionAttrs pass infers exactly this, so it is safe to
 *               assert it up front. (Spelled `readnone`, which every LLVM
 *               version accepts; LLVM 16+ upgrades it to `memory(none)`.)
 *   readonly    As above, but callees may read memory (e.g. string length).
 *   noundef     Every StaticTS value is initialised, so no param or return
 *               value is ever undef/poison.
 *   zeroext     `boolean` is i1; the C ABI wants it zero-extended in a register.
 *   String params (`i8*`):
 *     nonnull   StaticTS has no null.
 *     readonly  Strings are immutable.
 *     align 8   Literals and arena strings are 8-byte aligned.
 *     noalias   Valid because nothing writes through string pointers: the
 *               noalias guarantee only concerns *modified* memory.
 *     nocapture Only when the param never escapes: it is not returned and
 *               not passed to any call (there are no stores of pointers yet).
 *
 * Cross-module facts (WP5): the analysis runs over *every* module of a
 * program at once, keyed by LLVM symbol, so a caller in `main.ts` sees the
 * same purity facts for an imported `square` as `math.ts` proved for its
 * definition. The importer's `declare` therefore carries exactly the
 * attributes of the exporter's `define`, which is what lets the optimiser
 * treat cross-module calls like local ones. Symbols are unique across the
 * program (the Compilation rejects clashes), so one map suffices.
 */
import ts from "typescript";
import { CheckedProgram, FunctionSig, Param } from "../checker";
import { StaticType } from "../types";
import { MemoryEffect, RUNTIME_BY_NAME } from "./runtime";

export interface FunctionFacts {
  hasLoops: boolean;
  effect: MemoryEffect;
  /** Parameter names that escape (returned or passed to a call). */
  escaping: Set<string>;
  /** User functions called directly (by LLVM symbol). */
  callees: Set<string>;
}

const EFFECT_RANK: Record<MemoryEffect, number> = { none: 0, read: 1, write: 2 };
function maxEffect(a: MemoryEffect, b: MemoryEffect): MemoryEffect {
  return EFFECT_RANK[a] >= EFFECT_RANK[b] ? a : b;
}

/**
 * Gather per-function facts for one module or a whole program, then
 * propagate memory effects over the (cross-module) call graph to a fixpoint.
 * The result is keyed by LLVM symbol (`FunctionSig.name`).
 */
export function analyzeFunctions(programs: CheckedProgram | readonly CheckedProgram[]): Map<string, FunctionFacts> {
  const list = Array.isArray(programs) ? (programs as readonly CheckedProgram[]) : [programs as CheckedProgram];
  const facts = new Map<string, FunctionFacts>();
  for (const program of list) {
    for (const sig of program.functions) facts.set(sig.name, collectFacts(program, sig));
  }

  // Optimistic fixpoint: a function is as impure as the most impure thing it calls.
  let changed = true;
  while (changed) {
    changed = false;
    for (const [, f] of facts) {
      for (const callee of f.callees) {
        const calleeFacts = facts.get(callee);
        const calleeEffect: MemoryEffect = calleeFacts
          ? calleeFacts.effect
          : RUNTIME_BY_NAME.get(callee)?.effect ?? "write";
        const merged = maxEffect(f.effect, calleeEffect);
        if (merged !== f.effect) {
          f.effect = merged;
          changed = true;
        }
      }
    }
  }
  return facts;
}

function collectFacts(program: CheckedProgram, sig: FunctionSig): FunctionFacts {
  const facts: FunctionFacts = { hasLoops: false, effect: "none", escaping: new Set(), callees: new Set() };
  const paramNames = new Set(sig.params.map((p) => p.name));

  const noteEscape = (expr: ts.Expression) => {
    while (ts.isParenthesizedExpression(expr)) expr = expr.expression;
    if (ts.isIdentifier(expr)) {
      const v = program.bindings.get(expr);
      if (v?.storage === "param" && paramNames.has(v.name)) facts.escaping.add(v.name);
    }
  };

  const visit = (node: ts.Node): void => {
    if (ts.isIterationStatement(node, false)) facts.hasLoops = true;
    if (ts.isReturnStatement(node) && node.expression) noteEscape(node.expression);
    if (ts.isCallExpression(node)) {
      const callee = program.callees.get(node);
      if (callee) facts.callees.add(callee.name);
      node.arguments.forEach(noteEscape);
    }
    ts.forEachChild(node, visit);
  };
  visit(sig.decl.body!);
  return facts;
}

// ---- Attribute rendering ----------------------------------------------------

export function functionAttributes(f: FunctionFacts): string[] {
  const attrs = ["nounwind"];
  if (!f.hasLoops) attrs.push("willreturn");
  if (f.effect === "none") attrs.push("readnone");
  else if (f.effect === "read") attrs.push("readonly");
  return attrs;
}

export function paramAttributes(p: Param, f: FunctionFacts): string[] {
  const attrs = ["noundef"];
  switch (p.type.kind) {
    case "bool":
      attrs.push("zeroext");
      break;
    case "string":
      attrs.push("nonnull", "noalias", "readonly", "align 8");
      if (!f.escaping.has(p.name)) attrs.push("nocapture");
      break;
  }
  return attrs;
}

export function returnAttributes(t: StaticType): string[] {
  switch (t.kind) {
    case "void":
      return [];
    case "bool":
      return ["noundef", "zeroext"];
    case "string":
      return ["noundef", "nonnull", "align 8"];
    default:
      return ["noundef"];
  }
}
