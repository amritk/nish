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
import { StaticType, assignable, mangleType, resolveTypeNode, sameType, typeToString } from "../types.js";
import { CheckContext } from "./context.js";
import { Scope } from "./scope.js";
import { ConstInfo } from "./constants.js";
import { FunctionSig, LocalVar, StructInfo } from "./program.js";

/**
 * Where a request was written, as the module that answers it needs it (WP18 G7).
 *
 * A template is instantiated in the scope it was *declared* in, so the work
 * crosses a module boundary while the mistake a user can make with it does
 * not: a termination refusal or a cap is about this call, in this file, inside
 * whichever instantiation's body was being checked when it was made. All three
 * therefore travel with the request rather than being read off the answering
 * module, whose own cursors are about its own work.
 */
export type RequestSite = {
  /** The file the request was written in: where a refusal about it points. */
  sf: ts.SourceFile;
  /** The instantiation whose body made the request, or `undefined` for ordinary code. */
  fromFunction: Instantiation | undefined;
  /** The struct instantiation whose members or method body made it, if one did. */
  fromStruct: StructInstantiation | undefined;
  /**
   * The requesting module's view of a struct name.
   *
   * A type argument may be a layout the *answering* module has never heard of
   * — `identity<Point>` where `Point` is the caller's own class — and the
   * answering module needs it, because it is the one that writes
   * `%struct.Point` into the monomorphised body. The requester had to have the
   * layout to write the request down, so this is where it comes from.
   */
  lookupStruct: (name: string) => StructInfo | undefined;
};

/**
 * The module that *declares* a template, as the rest of the package needs it
 * (WP18 G7).
 *
 * A template is instantiated in the scope its body was written in, whoever
 * asked: the annotations it resolves name that module's classes, its own
 * imports and its own aliases, and its symbols belong to that module's
 * package. So a request made from another module is forwarded here rather than
 * answered where it was written, and this is the whole of what a template
 * remembers about home.
 *
 * It is a structural type rather than `Checker` because `Checker` imports this
 * file. Three members are the whole of the crossing, which is also the argument
 * that the crossing is small.
 */
export type GenericHome = {
  /**
   * The package prefix every symbol this module mints carries (WP21 S1). An
   * instantiation's symbol is minted from *this* rather than from the prefix of
   * the module that asked for it, and that is the whole of why G7 is one change
   * and not two: two packages importing one generic would otherwise mint one
   * symbol for two different functions, and the whole-program fact table in
   * `codegen/attributes.ts` -- which is keyed by symbol -- would hand one of
   * them the other's purity and escape facts. That is a miscompile rather than
   * a link error, the same failure WP21 S1 exists to prevent for a plain
   * function.
   */
  readonly symbolPrefix: string;
  /** Answer a function template's request, in this module's scope. */
  instantiateHere: (
    template: TemplateInfo,
    args: StaticType[],
    at: ts.Node,
    site: RequestSite
  ) => FunctionSig;
  /**
   * This module's view of a struct name, for the layouts an instantiation hands
   * back: `Box<i32>` may have a field of a class only the declaring module ever
   * wrote, and the module holding the `Box$i32` needs that layout too. It is
   * `RequestSite.lookupStruct` pointing the other way.
   */
  lookupStruct: (name: string) => StructInfo | undefined;
  /** The struct half of the same forwarding. */
  instantiateStructHere: (
    template: StructTemplateInfo,
    args: StaticType[],
    at: ts.Node,
    site: RequestSite
  ) => StructInfo;
};

/**
 * A generic function declaration, in either spelling. Nothing about it is
 * resolved: `decl` carries the parameter and return annotations, which mention
 * `typeParams` and therefore mean nothing until an instantiation binds them.
 */
export interface TemplateInfo {
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
  /** The module that declares it, which is where every instantiation of it is made (WP18 G7). */
  home: GenericHome;
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

/**
 * A generic class or interface declaration (WP18 G5). It is the same idea as
 * `TemplateInfo` one level up: nothing is resolved, because the field and
 * method annotations mention `typeParams` and mean nothing until an
 * instantiation binds them.
 */
export type StructTemplateInfo = {
  /** The identifier as written; what every diagnostic about the template names. */
  sourceName: string;
  kind: "class" | "interface";
  /** `<T, U>` in declaration order; an instantiation's tuple has the same order. */
  typeParams: string[];
  decl: ts.ClassDeclaration | ts.InterfaceDeclaration;
  /** Where a diagnostic that names the template points. */
  nameNode: ts.Node;
  exported: boolean;
  /** How many instantiations this template has produced, for the per-template cap. */
  count: number;
  /** The module that declares it, which is where every instantiation of it is made (WP18 G7). */
  home: GenericHome;
};

/**
 * One (struct template, type-argument tuple): the ordinary struct it names.
 *
 * `docs/wp18-generics.md` §3c is what makes this affordable — `info` is an
 * ordinary `StructInfo` called `Box$i32`, so `llvmType`, `sameType`, the layout
 * computation, `implements`, `structTypeDeclarations`, the DWARF composite type
 * and the C header all work on it with no change at all.
 */
export type StructInstantiation = {
  template: StructTemplateInfo;
  /** One concrete type per entry of `template.typeParams`, in that order. */
  typeArgs: StaticType[];
  info: StructInfo;
  /** `T` -> the type it stands for while this struct's members are collected. */
  bindings: Map<string, StaticType>;
  /**
   * The struct instantiation whose members or whose method body asked for this
   * one, or `undefined` for one named by ordinary code. The chain is what the
   * termination rule walks and what the diagnostic quotes.
   */
  from?: StructInstantiation;
};

/** One (template, type-argument tuple): the specialised function it names. */
export interface Instantiation {
  /**
   * The generic function this specialises, or `undefined` when this is a method
   * or constructor of an instantiated generic class — which needs the overlay
   * and the type bindings for exactly the same reason and has no template of
   * its own, because the class is the template.
   */
  template?: TemplateInfo;
  /** The instantiated class this is a member of, when it is one. */
  owner?: StructInstantiation;
  /** One concrete type per entry of the template's parameters, in that order. */
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
 * The type arguments an instantiated generic struct was made from, by mangled
 * name, or `undefined` for a struct somebody declared. `containsType` needs it
 * because `Box$i32` is an *ordinary* struct type (§3c) and therefore carries no
 * arguments of its own: without the lookup, `grow<T>` asking for `grow<Box<T>>`
 * would look like a request for an unrelated named type and would not
 * terminate.
 */
export type StructArguments = (name: string) => StructInstantiation | undefined;

/**
 * Whether `inner` occurs as a strict subterm of `outer`. The termination rule
 * is stated over this: an instantiation that asks for one of the same template
 * with an argument that *contains* its own has put that argument under a type
 * constructor, and the chain it starts has no end.
 */
export function containsType(inner: StaticType, outer: StaticType, argsOf: StructArguments): boolean {
  if (sameType(inner, outer)) return true;
  if (outer.kind === "array") return containsType(inner, outer.elem, argsOf);
  if (outer.kind === "nullable") return containsType(inner, outer.inner, argsOf);
  if (outer.kind === "result") {
    return containsType(inner, outer.ok, argsOf) || containsType(inner, outer.err, argsOf);
  }
  if (outer.kind === "struct") {
    for (const arg of argsOf(outer.name)?.typeArgs ?? []) {
      if (containsType(inner, arg, argsOf)) return true;
    }
  }
  return false;
}

/**
 * Which type argument of `previous` this request puts under a type constructor,
 * or `-1` when none of them grew. Shared by the function and the struct halves
 * of the rule, because both say the same thing about the same tuples.
 */
const growingArgument = (
  previous: readonly StaticType[],
  args: readonly StaticType[],
  argsOf: StructArguments
): number => {
  for (let i = 0; i < args.length; i++) {
    if (!sameType(previous[i], args[i]) && containsType(previous[i], args[i], argsOf)) return i;
  }
  return -1;
};

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
  args: readonly StaticType[],
  argsOf: StructArguments
): { ancestor: Instantiation; index: number } | undefined {
  for (let at = from; at; at = at.from) {
    if (at.template !== template) continue;
    const index = growingArgument(at.typeArgs, args, argsOf);
    if (index >= 0) return { ancestor: at, index };
  }
  return undefined;
}

/**
 * The struct half of the same rule (WP18 G5). A field's type is resolved while
 * the struct is being collected rather than while a body runs, so the chain
 * this walks is the one `Checker.currentStructInstance` maintains: the struct
 * whose members are being collected, or the struct whose method body is being
 * checked. `class Nest<T> { inner: Nest<T[]> | null }` is the shape it exists
 * for, and `reject_generic_expanding_field` is its case.
 *
 * The ancestor is also the answer, in the half of that chain where the request
 * is a declaration's: a field or a member signature refused while the struct
 * is being collected is handed `ancestor.info` rather than nothing, so the
 * class the programmer did write keeps its field and its layout. A request
 * from a method *body* is an expression's and keeps the refusal's throw. §4a
 * of `docs/wp18-generics.md` is the argument for that and what it costs.
 */
export const expandingStructAncestor = (
  from: StructInstantiation | undefined,
  template: StructTemplateInfo,
  args: readonly StaticType[],
  argsOf: StructArguments
): { ancestor: StructInstantiation; index: number } | undefined => {
  for (let at = from; at; at = at.from) {
    if (at.template !== template) continue;
    const index = growingArgument(at.typeArgs, args, argsOf);
    if (index >= 0) return { ancestor: at, index };
  }
  return undefined;
};

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
  out: Map<string, StaticType>,
  argsOf: StructArguments
): void {
  switch (annotation.kind) {
    case ts.SyntaxKind.ParenthesizedType:
      unifyAnnotation((annotation as ts.ParenthesizedTypeNode).type, arg, params, out, argsOf);
      return;
    case ts.SyntaxKind.ArrayType:
      if (arg.kind === "array") {
        unifyAnnotation((annotation as ts.ArrayTypeNode).elementType, arg.elem, params, out, argsOf);
      }
      return;
    case ts.SyntaxKind.TypeOperator: {
      // `readonly T[]`: the modifier changes who may write, not the shape.
      const op = annotation as ts.TypeOperatorNode;
      if (op.operator === ts.SyntaxKind.ReadonlyKeyword) unifyAnnotation(op.type, arg, params, out, argsOf);
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
        unifyAnnotation(members[0], arg.kind === "nullable" ? arg.inner : arg, params, out, argsOf);
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
        unifyAnnotation(args[0], arg.elem, params, out, argsOf);
        return;
      }
      if (name === "Result" && args.length === 2 && arg.kind === "result") {
        unifyAnnotation(args[0], arg.ok, params, out, argsOf);
        unifyAnnotation(args[1], arg.err, params, out, argsOf);
        return;
      }
      // A user generic: `Box<T>` against a `Box$i32` argument binds `T := i32`.
      // The argument's own `StaticType` carries no type arguments, because an
      // instantiated class is an ordinary struct (§3c), so they are read back
      // out of the instantiation the mangled name belongs to.
      if (arg.kind === "struct") {
        const instance = argsOf(arg.name);
        if (instance?.template.sourceName === name && instance.typeArgs.length === args.length) {
          args.forEach((a, i) => {
            unifyAnnotation(a, instance.typeArgs[i], params, out, argsOf);
          });
        }
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
 * The struct one written type-argument list names (WP18 G5). All three
 * positions that may carry one go through here — an annotation (`Box<i32>`),
 * `new Box<i32>(v)` and an `implements Container<T>` clause — so the arity rule
 * is stated once and a reader is told the same thing wherever the mistake was
 * made. The arguments are resolved in the scope the list sits in, which is what
 * makes `Box<T>` inside another template and `Box<Box<i32>>` work with no case
 * of their own.
 */
export const instantiateWritten = (
  ctx: CheckContext,
  template: StructTemplateInfo,
  written: readonly ts.TypeNode[],
  at: ts.Node
): StructInfo => {
  if (written.length !== template.typeParams.length) {
    const example = template.typeParams.map(() => "number").join(", ");
    throw ctx.error(
      `\`${template.sourceName}\` is generic: it must be written with its type arguments, e.g. ` +
        `\`${template.sourceName}<${example}>\``,
      at
    );
  }
  const args = written.map((node) => resolveTypeNode(node, ctx.sf, ctx.opts));
  return ctx.instantiateStruct(template, args, at);
};

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
  const argsOf: StructArguments = (name) => ctx.structInstance(name);
  parameters.forEach((p, i) => {
    if (p.type) unifyAnnotation(p.type, argTypes[i], names, bindings, argsOf);
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

/**
 * The same four names for the struct half (WP18 G5). A field, not a call, is
 * what names the next instantiation, so the sentence says "names" where the
 * function's says "asks for"; everything else about it is the same, including
 * that it quotes the concrete chain rather than a depth.
 */
export const nonTerminatingStructParts = (
  template: StructTemplateInfo,
  ancestor: StructInstantiation,
  args: readonly StaticType[],
  index: number
): { from: string; to: string; under: string; param: string } => ({
  from: instanceDisplayName(template.sourceName, ancestor.typeArgs),
  to: instanceDisplayName(template.sourceName, args),
  under: typeToString(ancestor.typeArgs[index]),
  param: template.typeParams[index],
});
