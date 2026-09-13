/**
 * WP18: generics by monomorphisation.
 *
 * A generic function is a *template*: its body is never checked and never
 * emitted. Every call the checker resolves picks a tuple of concrete type
 * arguments, and the pair (template, tuple) names one ordinary function —
 * `identity$i32` — whose signature, body, side tables, attribute facts and IR
 * are indistinguishable from the monomorphic twin somebody would have written
 * by hand. There is no boxing, no dictionary and no runtime type information;
 * see `docs/wp18-generics.md` §1 for why the memory model leaves nothing else.
 *
 * Three things here are worth reading before the code:
 *
 *   - **A type parameter is never a `StaticType`.** The template's annotations
 *     are left as syntax and resolved once per instantiation with `T` bound to
 *     a concrete type in the checker's named-type resolver, so no pass below
 *     the signature level ever meets a type variable and `llvmType`,
 *     `sameType`, `alignOf` and friends are untouched.
 *   - **One AST, N type assignments.** `CheckedProgram`'s node-keyed tables
 *     cannot hold two types for `return x;`, so each instantiation carries its
 *     own set of them (`NodeTables`) and every pass that walks a body swaps
 *     them in around the function it is walking (`enterInstance`). That is
 *     `docs/wp18-generics.md` §3d's overlay, mutating the seven table fields
 *     rather than putting an accessor in front of several hundred read sites.
 *   - **Termination is a rule, not a number.** An instantiation that asks for
 *     one of the same template whose type argument strictly *contains* its own
 *     is the shape that cannot terminate (`grow<T>` asking for `grow<T[]>`),
 *     and it is refused by name. The caps below are the backstop for anything
 *     the rule does not see, and they say they are a limit rather than a rule.
 */
import ts from "typescript";
import { LANGUAGE } from "../branding.js";
import { StaticType, assignable, mangleType, sameType, typeToString } from "../types.js";
import { CheckContext } from "./context.js";
import { Scope } from "./scope.js";
import { ConstInfo } from "./constants.js";
import { FunctionSig, LocalVar } from "./program.js";

/**
 * What an instantiation needs from the module that *declares* its template
 * (WP18 G7). An instantiation is defined once, in that module, and checked by
 * that module's `Checker` in that module's scope — its imports, its constants,
 * its structs — because any other choice would make one body mean different
 * things depending on who asked for it (§3b). A caller therefore hands the
 * request over rather than serving it, and this is the whole of the handover.
 */
export type TemplateOwner = {
  /** The declaring module's checked program: whose `functions` and whose prefix. */
  readonly program: { symbolPrefix: string; instantiations: Map<string, Instantiation> };
  /** Create (or answer) the instantiation, in the declaring module. */
  ownInstantiation: (template: TemplateInfo, args: StaticType[], symbol: string, from?: Instantiation) => FunctionSig;
};

/**
 * A generic function declaration, in either spelling. Nothing about it is
 * resolved: `decl` carries the parameter and return annotations, which mention
 * `typeParams` and therefore mean nothing until an instantiation binds them.
 */
export interface TemplateInfo {
  /**
   * The module that declares it (WP18 G7). Every instantiation of this template
   * belongs to that module whoever wrote the call, which is what makes the
   * symbol's package prefix the *template's* rather than the caller's — the one
   * thing that, got wrong, makes two packages importing one generic mint the
   * same symbol and share a fact table (`docs/wp18-generics.md` §16 item 2).
   */
  owner?: TemplateOwner;
  /** The identifier as written; what every diagnostic about the template names. */
  sourceName: string;
  /** `<T, U>` in declaration order; the tuple an instantiation is keyed by has the same order. */
  typeParams: string[];
  decl: ts.FunctionDeclaration | ts.ArrowFunction;
  /** Where a diagnostic that names the template points (the `const` for an arrow, WP22 §5). */
  nameNode: ts.Node;
  /**
   * Where the declaration begins, which every instantiation inherits as its own
   * `FunctionSig.declSite`. A template is written once and specialised many
   * times, so every instantiation of `identity<T>` is declared exactly where
   * `identity` is written -- which is the answer a debugger wants, and the one
   * WP22 requires not to depend on which of the two spellings was used.
   */
  declSite: ts.Node;
  body: ts.Block | ts.Expression;
  exported: boolean;
  /** How many instantiations this template has produced, for the per-template cap. */
  count: number;
}

/** The node-keyed half of `CheckedProgram`: what one instantiation owns a copy of. */
export interface NodeTables {
  types: WeakMap<ts.Node, StaticType>;
  bindings: WeakMap<ts.Identifier, LocalVar>;
  constRefs: WeakMap<ts.Identifier, ConstInfo>;
  locals: WeakMap<ts.VariableDeclaration, LocalVar>;
  callees: WeakMap<ts.CallExpression, FunctionSig>;
  coercions: WeakMap<ts.Expression, { from: StaticType; to: StaticType }>;
  caseValues: WeakMap<ts.CaseClause, bigint>;
}

/** One (template, type-argument tuple): the specialised function it names. */
export interface Instantiation {
  template: TemplateInfo;
  /** One concrete type per entry of `template.typeParams`, in that order. */
  typeArgs: StaticType[];
  /** The specialised signature, appended to the defining module's `functions`. */
  sig: FunctionSig;
  /** `T` -> the type it stands for while this instantiation is checked. */
  bindings: Map<string, StaticType>;
  tables: NodeTables;
  /**
   * The instantiation whose body asked for this one, or `undefined` for one
   * requested from ordinary code. The chain is what the termination rule walks
   * and what the diagnostic quotes.
   */
  from?: Instantiation;
}

/**
 * This compiler's instantiation limits. They are a backstop for a program that
 * asks for an absurd number of specialisations without tripping the
 * termination rule, not a statement about the language, and the diagnostic
 * says so (`docs/wp18-generics.md` §4, "The backstop").
 */
export const MAX_INSTANTIATIONS_PER_TEMPLATE = 256;
export const MAX_INSTANTIATIONS = 4096;

export function newNodeTables(): NodeTables {
  return {
    types: new WeakMap(),
    bindings: new WeakMap(),
    constRefs: new WeakMap(),
    locals: new WeakMap(),
    callees: new WeakMap(),
    coercions: new WeakMap(),
    caseValues: new WeakMap(),
  };
}

/** The seven node-keyed fields of a program, lifted out so they can be swapped as a unit. */
function tablesOf(program: NodeTables): NodeTables {
  return {
    types: program.types,
    bindings: program.bindings,
    constRefs: program.constRefs,
    locals: program.locals,
    callees: program.callees,
    coercions: program.coercions,
    caseValues: program.caseValues,
  };
}

/**
 * Point `program`'s node-keyed tables at `tables` and answer the ones that
 * were there. Every pass that walks a function body — the checker, the escape
 * analysis, the attribute fixpoint, the emitter and the `--emit-checked` dump
 * — brackets that walk with this pair, so a read of `program.types` inside an
 * instantiation's body answers with *that* instantiation's types and the code
 * doing the reading never learns there was a choice.
 */
export function swapTables(program: NodeTables, tables: NodeTables): NodeTables {
  const previous = tablesOf(program);
  program.types = tables.types;
  program.bindings = tables.bindings;
  program.constRefs = tables.constRefs;
  program.locals = tables.locals;
  program.callees = tables.callees;
  program.coercions = tables.coercions;
  program.caseValues = tables.caseValues;
  return previous;
}

/**
 * Run `body` with `sig`'s instantiation tables installed, if it has any. A
 * non-generic function is the common case and costs one property read.
 */
export function withInstance<T>(program: NodeTables, sig: FunctionSig, body: () => T): T {
  const instance = sig.instance;
  if (!instance) return body();
  const previous = swapTables(program, instance.tables);
  try {
    return body();
  } finally {
    swapTables(program, previous);
  }
}

/**
 * The LLVM symbol for one instantiation: the template's name, then `$` and the
 * `mangleType` of each type argument in order (`docs/wp18-generics.md` §3c).
 * `mangleType` is prefix-coded, so the arguments are self-delimiting and the
 * whole name splits again at the first `$` — which is why `$` may not appear
 * in a declared name.
 */
export function instanceSymbol(base: string, args: readonly StaticType[]): string {
  return base + args.map((a) => `$${mangleType(a)}`).join("");
}

/** `identity<i32>`: the source spelling, for diagnostics, `-g` and the dump. */
export function instanceDisplayName(base: string, args: readonly StaticType[]): string {
  return `${base}<${args.map(typeToString).join(", ")}>`;
}

/**
 * Whether `inner` occurs as a strict subterm of `outer`. The termination rule
 * is stated over this: an instantiation that asks for one of the same template
 * with an argument that *contains* its own has put that argument under a type
 * constructor, and the chain it starts has no end.
 */
export function containsType(inner: StaticType, outer: StaticType): boolean {
  if (sameType(inner, outer)) return true;
  if (outer.kind === "array") return containsType(inner, outer.elem);
  if (outer.kind === "nullable") return containsType(inner, outer.inner);
  if (outer.kind === "result") return containsType(inner, outer.ok) || containsType(inner, outer.err);
  return false;
}

/**
 * The ancestor instantiation of the same template whose type arguments this
 * request grows, or `undefined` when the request is finite by §4's rule.
 *
 * Walking the whole chain rather than only the immediate parent is what covers
 * mutual recursion: `f<T>` asking for `g<T>` asking for `f<T[]>` expands, and
 * neither of its two edges does so on its own.
 */
export function expandingAncestor(
  from: Instantiation | undefined,
  template: TemplateInfo,
  args: readonly StaticType[]
): { ancestor: Instantiation; index: number } | undefined {
  for (let at = from; at; at = at.from) {
    if (at.template !== template) continue;
    for (let i = 0; i < args.length; i++) {
      const previous = at.typeArgs[i];
      if (!sameType(previous, args[i]) && containsType(previous, args[i])) {
        return { ancestor: at, index: i };
      }
    }
  }
  return undefined;
}

/**
 * Bind the template's type parameters by matching one declared parameter
 * annotation against the type of the argument written for it
 * (`docs/wp18-generics.md` §2a). Only the *shape* of the annotation is read,
 * so nothing here resolves a type: `T[]` against `i32[]` binds `T := i32`
 * without either side becoming a `StaticType` for `T`.
 *
 * First binding wins. A second, incompatible occurrence is not reported here
 * — the ordinary argument check against the instantiated signature reports it,
 * naming both types the way every other argument mismatch does.
 */
export function unifyAnnotation(
  annotation: ts.TypeNode,
  arg: StaticType,
  params: ReadonlySet<string>,
  out: Map<string, StaticType>
): void {
  switch (annotation.kind) {
    case ts.SyntaxKind.ParenthesizedType:
      unifyAnnotation((annotation as ts.ParenthesizedTypeNode).type, arg, params, out);
      return;
    case ts.SyntaxKind.ArrayType:
      if (arg.kind === "array") {
        unifyAnnotation((annotation as ts.ArrayTypeNode).elementType, arg.elem, params, out);
      }
      return;
    case ts.SyntaxKind.TypeOperator: {
      // `readonly T[]`: the modifier changes who may write, not the shape.
      const op = annotation as ts.TypeOperatorNode;
      if (op.operator === ts.SyntaxKind.ReadonlyKeyword) unifyAnnotation(op.type, arg, params, out);
      return;
    }
    case ts.SyntaxKind.UnionType: {
      // `T | null` against a nullable argument binds `T` to the inner type, and
      // against a plain pointer binds it to the argument itself, because `T`
      // is assignable into `T | null` and the call would have been legal.
      const members = (annotation as ts.UnionTypeNode).types.filter(
        (t) => !(ts.isLiteralTypeNode(t) && t.literal.kind === ts.SyntaxKind.NullKeyword)
      );
      if (members.length === 1) {
        unifyAnnotation(members[0], arg.kind === "nullable" ? arg.inner : arg, params, out);
      }
      return;
    }
    case ts.SyntaxKind.TypeReference: {
      const ref = annotation as ts.TypeReferenceNode;
      if (!ts.isIdentifier(ref.typeName)) return;
      const name = ref.typeName.text;
      const args = ref.typeArguments;
      if (!args || args.length === 0) {
        if (params.has(name) && !out.has(name)) out.set(name, arg);
        return;
      }
      if ((name === "Array" || name === "ReadonlyArray") && args.length === 1 && arg.kind === "array") {
        unifyAnnotation(args[0], arg.elem, params, out);
        return;
      }
      if (name === "Result" && args.length === 2 && arg.kind === "result") {
        unifyAnnotation(args[0], arg.ok, params, out);
        unifyAnnotation(args[1], arg.err, params, out);
      }
      return;
    }
    default:
      return;
  }
}

/** Whether an annotation mentions any of `params`, i.e. whether it needs an instantiation to resolve. */
export function mentionsTypeParam(annotation: ts.TypeNode, params: ReadonlySet<string>): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName) && params.has(node.typeName.text)) {
      // A type *argument* list on the name would make it a different type, but
      // a bare parameter cannot take one, so the name alone decides.
      if (!node.typeArguments || node.typeArguments.length === 0) found = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(annotation);
  return found;
}


/**
 * A call whose callee is a generic template. The type arguments are inferred
 * from the argument types and never written here (§2a: one token of lookahead
 * cannot tell `f<i32>(x)` from `(f < i32) > (x)`), so the whole of the
 * resolution is: check the arguments, unify, request the instantiation, and
 * then check the arguments *again* against the signature that came back —
 * which is the ordinary monomorphic check and reports the ordinary message.
 */
export function checkGenericCall(
  ctx: CheckContext,
  expr: ts.CallExpression,
  template: TemplateInfo,
  scope: Scope
): StaticType {
  if (expr.typeArguments && expr.typeArguments.length > 0) {
    throw ctx.error(
      `Type arguments are not written at a call site in ${LANGUAGE}: \`${template.typeParams[0] ?? "T"}\` is ` +
        `inferred from the arguments, so write \`${template.sourceName}(...)\``,
      expr.typeArguments[0]
    );
  }
  const parameters = template.decl.parameters;
  if (expr.arguments.length !== parameters.length) {
    throw ctx.error(
      `\`${template.sourceName}\` expects ${parameters.length} argument(s), got ${expr.arguments.length}`,
      expr
    );
  }
  const names = new Set(template.typeParams);
  const bindings = new Map<string, StaticType>();
  const argTypes = expr.arguments.map((arg) => ctx.checkExpression(arg, scope));
  parameters.forEach((p, i) => {
    if (p.type) unifyAnnotation(p.type, argTypes[i], names, bindings);
  });
  for (const name of template.typeParams) {
    if (bindings.has(name)) continue;
    // Every parameter that mentions `name` failed to match its argument's
    // shape, so the message points at the first of them rather than at the
    // whole call: that is the argument the programmer has to change.
    const at = parameters.findIndex((p) => p.type !== undefined && mentionsTypeParam(p.type, names));
    const shown = at >= 0 ? parameters[at].type!.getText(ctx.sf) : "T";
    throw ctx.error(
      `Cannot infer \`${name}\` for \`${template.sourceName}\`: argument ${at + 1} is ` +
        `${typeToString(argTypes[at >= 0 ? at : 0])}, which does not match the declared \`${shown}\``,
      at >= 0 ? expr.arguments[at] : expr
    );
  }
  const args = template.typeParams.map((name) => bindings.get(name) as StaticType);
  const sig = ctx.instantiate(template, args, expr);
  expr.arguments.forEach((arg, i) => {
    if (!assignable(argTypes[i], sig.params[i].type)) {
      throw ctx.error(
        `Argument ${i + 1} of \`${instanceDisplayName(template.sourceName, args)}\`: expected ` +
          `${typeToString(sig.params[i].type)}, got ${typeToString(argTypes[i])}`,
        arg
      );
    }
  });
  ctx.program.callees.set(expr, sig);
  return sig.returnType;
}

/**
 * The four names the non-terminating-request message needs (§8 message 5): the
 * chain it quotes, the argument that grew, and the parameter to pass instead.
 *
 * The *sentence* is written at the diagnostic call in `checker/index.ts` rather
 * than here, and this returns only the pieces, because
 * `scripts/gen-diagnostic-codes.mjs` derives a rule's stable code from the
 * string literal it finds at that call. A message assembled behind a function
 * call is invisible to it and carries `NL0000` however many words of its own it
 * has -- which this one did. It names the type argument that grew and the two
 * shapes the rule accepts, never a number: a user who sees it has to change the
 * call, not raise a limit.
 */
export function nonTerminatingParts(
  template: TemplateInfo,
  ancestor: Instantiation,
  args: readonly StaticType[],
  index: number
): { from: string; to: string; under: string; param: string } {
  return {
    from: instanceDisplayName(template.sourceName, ancestor.typeArgs),
    to: instanceDisplayName(template.sourceName, args),
    under: typeToString(ancestor.typeArgs[index]),
    param: template.typeParams[index],
  };
}
