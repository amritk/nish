// Phase 0 for stage1 (stage0's `src/validator.ts`, docs/wp14-selfhost.md milestone S3):
// a syntax-only sweep that refuses every construct the language can *never*
// compile, before the checker runs.
//
// The distinction Phase 0 draws is the one `docs/LANGUAGE.md` draws: what is
// here is forbidden by design — an interpreter at run time, a prototype
// chain, dynamic property lookup, unwinding — and what the checker refuses
// with `Unsupported ... in Phase 1` is merely not implemented yet. Keeping
// them apart is why a rejection message can say *why* rather than "no".
//
// Part of it is what parses as ordinary source and is forbidden anyway — a
// banned identifier, a `__proto__` or `.prototype` member, an `Object.*`
// shape mutation, a string-keyed element access. The rest is syntax the
// language forbids, which the parser reads into a node so that the rule is
// stated here rather than as a syntax error (WP33 R1; the shapes are in
// `src/nodes.ts`): `var`, `try`, `with`, a labelled statement, `for...in`, and
// the forbidden expressions — `==`, `?.`, `typeof` and the rest of the
// operators the language does not have, a regex, a dynamic `import()`,
// `import.meta` and an assertion to `any` or `unknown` — and the forbidden
// declarations: `async`, a generator, a decorator, a `namespace` or `module`
// block, `declare global` and type parameters on an alias — and the import
// forms nothing could make mean anything: `import defer`, a module export
// name written as a string, and import attributes — and the shapes a fixed
// layout rules out: a computed name in an object literal, a class or an
// interface, and object spread. What the parser still turns down itself is
// syntax TypeScript refuses as syntax too, listed case by case in
// `tests/self/parser-refusals.txt`.

import { LANGUAGE } from "./branding"
import { CheckContext } from "./context"
import { Edit } from "./diagnostics"
import { unwrapParens } from "./emit-util"
import { isIteratorMethod, isThreadsSource } from "./parallel"
import {
  FLAG_ASYNC,
  FLAG_ATTRIBUTES,
  FLAG_COMPUTED,
  FLAG_DEFER,
  FLAG_FOR_IN,
  FLAG_GENERATOR,
  FLAG_OPTIONAL,
  FLAG_SATISFIES,
  FLAG_VAR,
  N_AS,
  N_BIGINT,
  N_BINARY,
  N_ARROW,
  N_CALL,
  N_CONSTRUCTOR,
  N_DECORATOR,
  N_EMPTY,
  N_ENUM,
  N_EXPORT_DECLARATION,
  N_FIELD,
  N_FOR_OF,
  N_FUNCTION,
  N_IDENT,
  N_IMPORT,
  N_INDEX,
  N_LABELED,
  N_LIST,
  N_MEMBER,
  N_METHOD,
  N_MODULE_CONST,
  N_NAMESPACE,
  N_NEW,
  N_NUMBER,
  N_OBJECT,
  N_PAREN,
  N_PROPERTY,
  N_REGEX,
  N_SPREAD,
  N_STRING,
  N_TEMPLATE,
  N_THROW,
  N_TRY,
  N_TYPE_ALIAS,
  N_TYPE_NULL,
  N_TYPE_REF,
  N_TYPE_UNION,
  N_UNARY,
  N_VAR,
  N_WITH,
  Node,
} from "./nodes"

/**
 * `undefined`, as a value and as a type. One sentence for both, and for the
 * checker's refusal of `x === undefined` where `x` is not a `Map.get` result,
 * the one thing `undefined` may be compared with (WP32).
 */
export const undefinedForbidden = (): string =>
  "`undefined` is forbidden in " + LANGUAGE + "; use `null` with a `T | null` type"

/**
 * A computed name — `{ [k]: 1 }`, `[k]: i32` in a class or an interface, and
 * `[Symbol.iterator]() { }` — in every container that can hold one.
 */
const computedNameForbidden = (): string =>
  "Computed property names are forbidden in " + LANGUAGE + " (member names are fixed at compile time)"

/** The message for an identifier that may never appear as a value, or "". */
const forbiddenValue = (name: string): string => {
  if (name === "eval") {
    return "`eval` is forbidden in " + LANGUAGE + " (no interpreter at runtime)"
  }
  if (name === "Function") {
    return "`Function` is forbidden in " + LANGUAGE + " (no interpreter at runtime)"
  }
  if (name === "Proxy") {
    return "`Proxy` is forbidden in " + LANGUAGE + " (no dynamic property interception)"
  }
  if (name === "Reflect") {
    return "`Reflect` is forbidden in " + LANGUAGE + " (no runtime reflection)"
  }
  if (name === "Symbol") {
    return "`Symbol` is forbidden in " + LANGUAGE + " (no symbol type)"
  }
  if (name === "globalThis") {
    return "`globalThis` is forbidden in " + LANGUAGE + " (no global object)"
  }
  if (name === "arguments") {
    return "`arguments` is forbidden in " + LANGUAGE + " (functions have fixed arity)"
  }
  if (name === "undefined") {
    return undefinedForbidden()
  }
  if (name === "debugger") {
    // `debugger;` parses as an expression statement naming an identifier, so
    // this is where it lands rather than in the parser.
    return "`debugger` is forbidden in " + LANGUAGE + " (no debugger hook)"
  }
  return ""
}

/** The message for a type name that may never be referenced, or "". */
const forbiddenType = (name: string): string => {
  if (name === "Function") {
    return "`Function` type is forbidden in " + LANGUAGE + " (no dynamic function values)"
  }
  if (name === "Symbol") {
    return "`Symbol` type is forbidden in " + LANGUAGE + " (no symbol type)"
  }
  if (name === "Proxy") {
    return "`Proxy` type is forbidden in " + LANGUAGE + " (no dynamic property interception)"
  }
  if (name === "symbol") {
    return "`symbol` type is forbidden in " + LANGUAGE + " (no symbol type)"
  }
  if (name === "bigint") {
    return "`bigint` type is forbidden in " + LANGUAGE + " (use number, i32, or f64)"
  }
  if (name === "undefined") {
    return undefinedForbidden()
  }
  if (name === "any") {
    return "`any` is forbidden in " + LANGUAGE
  }
  if (name === "unknown") {
    return "`unknown` is forbidden in " + LANGUAGE
  }
  return ""
}

/** The message for an operator the language forbids, by its text on an N_BINARY or N_UNARY, or "". */
const forbiddenOperator = (operator: string): string => {
  if (operator === "==" || operator === "!=") {
    return "Loose equality is forbidden; use === / !=="
  }
  if (operator === "in") {
    return "`in` operator is forbidden in " + LANGUAGE + " (no dynamic property lookup)"
  }
  if (operator === "instanceof") {
    return "`instanceof` is forbidden in " + LANGUAGE + " (no prototype chain)"
  }
  if (operator === ",") {
    return "Comma expressions are forbidden in " + LANGUAGE + " (write separate statements)"
  }
  if (operator === "typeof") {
    return "`typeof` is forbidden in " + LANGUAGE + " (no runtime type tags)"
  }
  if (operator === "void") {
    return "`void` expressions are forbidden in " + LANGUAGE + " (no `undefined` value)"
  }
  if (operator === "delete") {
    return "`delete` is forbidden in " + LANGUAGE + " (object layout is fixed)"
  }
  if (operator === "await") {
    return "`await` is forbidden in " + LANGUAGE + " (no event loop or promises)"
  }
  if (operator === "yield") {
    return "`yield` is forbidden in " + LANGUAGE + " (no coroutine runtime)"
  }
  return ""
}

/**
 * The fix for loose equality: `==` becomes `===` and `!=` becomes `!==`, the
 * operator token and nothing else. It keeps the meaning because both operands
 * already have to be one type in this language — the coercions that set `==`
 * apart from `===` are exactly what the checker refuses — and TypeScript reads
 * the strict operator the way it was plainly meant. Empty, so no fix, for any
 * other operator, and when the token cannot be found between the operands.
 */
const strictEqualityFix = (ctx: CheckContext, node: Node): Edit[] => {
  const edits: Edit[] = []
  if (node.text !== "==" && node.text !== "!=") {
    return edits
  }
  const at = ctx.operatorStart(node)
  if (at >= 0) {
    edits.push(ctx.edit(at, at + node.text.length, `${node.text}=`))
  }
  return edits
}

/** `Object.<member>` calls that mutate an object's shape or its prototype chain. */
const isShapeMutation = (member: string): boolean =>
  member === "assign" ||
  member === "create" ||
  member === "defineProperty" ||
  member === "defineProperties" ||
  member === "setPrototypeOf" ||
  member === "getPrototypeOf"

/**
 * Whether an element-access key *looks* numeric. It is a syntactic test, not
 * a type test — Phase 0 has no types — so it accepts anything arithmetic and
 * refuses the shapes that could only be a property name.
 */
const isNumericIndexShape = (expr: Node): boolean => {
  switch (expr.kind) {
    case N_IDENT:
      return true
    case N_NUMBER:
      return true
    case N_CALL:
      return true
    case N_MEMBER:
      return true
    case N_INDEX:
      return true
    case N_PAREN:
      return isNumericIndexShape(expr.children[0])
    case N_UNARY:
      return expr.text === "-" || expr.text === "+"
    case N_BINARY:
      if (
        expr.text === "+" ||
        expr.text === "-" ||
        expr.text === "*" ||
        expr.text === "/" ||
        expr.text === "%"
      ) {
        return isNumericIndexShape(expr.children[0]) && isNumericIndexShape(expr.children[1])
      }
      return false
    default:
      return false
  }
}

/**
 * Sweep a whole tree, and report the first forbidden construct in source
 * order. The walk goes on past a refusal, but `ctx.error` stays quiet once the
 * module has one (`CheckContext.errored`, which nothing here clears), and a
 * Phase 0 refusal ends the module (`src/compilation.ts`, as stage0's `throw`
 * out of `load` did): one diagnostic per module
 * (`tests/cases/reject_stmt_forms_together`, pinned through `--json`).
 */
export const validate = (ctx: CheckContext, node: Node): void => {
  visit(ctx, node, false)
}

const visit = (ctx: CheckContext, node: Node, inTypePosition: boolean): void => {
  rejectFunctionModifiers(ctx, node)
  // `a?.b`, `a?.[i]` and `f?.()` are the member, element and call they
  // resemble, with a flag (`src/nodes.ts`).
  if (
    (node.flags & FLAG_OPTIONAL) !== 0 &&
    (node.kind === N_MEMBER || node.kind === N_INDEX || node.kind === N_CALL)
  ) {
    ctx.error(
      node,
      "Optional chaining `?.` is forbidden in " + LANGUAGE + " (narrow with `!== null` instead)"
    )
  }
  switch (node.kind) {
    case N_IDENT: {
      const message = forbiddenValue(node.text)
      if (message.length > 0) {
        ctx.error(node, message)
      }
      break
    }
    case N_TYPE_REF: {
      const message = forbiddenType(node.text)
      if (message.length > 0) {
        ctx.error(node, message)
      }
      break
    }
    case N_MEMBER:
      rejectForbiddenMember(ctx, node)
      break
    case N_INDEX:
      rejectForbiddenIndex(ctx, node)
      break
    case N_BIGINT:
      ctx.error(node, "`bigint` literals are forbidden in " + LANGUAGE + " (use number, i32, or f64)")
      break
    case N_TYPE_UNION:
      // Everything but `T | null` is refused here, before the checker reports
      // the offending member on its own — `T | undefined` is a union first.
      checkNullUnion(ctx, node)
      break
    case N_OBJECT:
      // `{ ...a }` is an N_SPREAD among the properties (`src/nodes.ts`),
      // refused in its turn so that the first form in the literal is the one
      // reported.
      for (const member of node.children) {
        if (member.kind === N_SPREAD) {
          ctx.error(member, "Object spread is forbidden in " + LANGUAGE + " (set each field by name)")
        }
        visit(ctx, member, inTypePosition)
      }
      return
    case N_PROPERTY:
      // A computed key is the property's second child, where a string key
      // would be. Its expression is not swept: `[Symbol.iterator]` is one
      // refusal, not two.
      if ((node.flags & FLAG_COMPUTED) !== 0) {
        ctx.error(node.children[1], computedNameForbidden())
        visit(ctx, node.children[0], inTypePosition)
        return
      }
      if (node.text === "__proto__") {
        ctx.errorAtKey(node, "`__proto__` is forbidden in " + LANGUAGE + " (no prototype chain)")
      }
      break
    case N_FIELD:
    case N_METHOD:
      // A computed name is the member's first child, where its IDENT would be.
      // WP29 P3: `nish/threads`'s `Channel` declares `[Symbol.iterator]`, the
      // one computed name it may, for Node's `for...of`; it has no signature
      // here (`collectMethod`), because the compiler lowers the loop itself.
      if ((node.flags & FLAG_COMPUTED) !== 0) {
        if (!(isIteratorMethod(node) && isThreadsSource(ctx.program))) {
          ctx.error(node.children[0], computedNameForbidden())
        }
        for (let i: i32 = 1; i < node.children.length; i++) {
          visit(ctx, node.children[i], inTypePosition)
        }
        return
      }
      break
    case N_NEW:
      rejectForbiddenNew(ctx, node)
      break
    case N_CALL:
      rejectForbiddenCall(ctx, node)
      break
    case N_UNARY: {
      const message = forbiddenOperator(node.text)
      if (message.length > 0) {
        ctx.error(node, message)
      }
      break
    }
    case N_REGEX:
      ctx.error(
        node,
        "Regular expression literals are forbidden in " + LANGUAGE + " (no regex engine in the runtime)"
      )
      break
    case N_AS:
      rejectForbiddenAssertion(ctx, node)
      break
    case N_ENUM:
      rejectComputedEnumMembers(ctx, node)
      break
    case N_BINARY: {
      const message = forbiddenOperator(node.text)
      if (message.length > 0) {
        ctx.errorFix(node, message, strictEqualityFix(ctx, node))
      }
      // WP32: `x === undefined` and `x !== undefined` are how a maybe is
      // tested, so `undefined` is let through as an operand of those two and
      // nowhere else. Whether `x` is a maybe is the checker's question.
      if (node.text === "===" || node.text === "!==") {
        for (const child of node.children) {
          if (!isUndefined(child)) {
            visit(ctx, child, inTypePosition)
          }
        }
        return
      }
      break
    }
    case N_VAR:
      rejectVar(ctx, node)
      // WP32: `const a: V | undefined = m.get(k)` is the one place the maybe
      // type is spelled, and `V` itself is still swept. On a `let` the
      // checker refuses it, with the rewrite the unannotated `let` gets.
      for (const decl of node.children[0].children) {
        visitDeclaration(ctx, decl, inTypePosition)
      }
      return
    case N_MODULE_CONST:
      rejectVar(ctx, node)
      refuseUndefinedIn(ctx, node)
      break
    case N_TRY:
      ctx.error(
        node,
        "`try`/`catch`/`finally` is forbidden in " + LANGUAGE + " (no unwinding; use `Result<T, E>`)"
      )
      break
    case N_WITH:
      ctx.error(node, "`with` is forbidden in " + LANGUAGE + " (no dynamic scope)")
      break
    case N_LABELED:
      // A `break` or `continue` that names the label is part of this one
      // refusal: the parser reads a label only inside the statement that
      // declares it (`Parser.labels`).
      ctx.error(node, "Labeled statements are forbidden in " + LANGUAGE + " (use structured loops)")
      break
    case N_FOR_OF:
      if ((node.flags & FLAG_FOR_IN) !== 0) {
        ctx.error(
          node,
          "`for...in` is forbidden in " +
            LANGUAGE +
            " (it enumerates property names, and object layout is fixed at compile time); use `for...of`"
        )
      }
      break
    case N_DECORATOR:
      ctx.error(node, "Decorators are forbidden in " + LANGUAGE + " (no runtime metadata or class rewriting)")
      break
    case N_NAMESPACE:
      if (node.text === "global") {
        ctx.error(node, "`declare global` is forbidden in " + LANGUAGE + " (no global object to augment)")
      } else {
        ctx.error(
          node,
          "`namespace` and `module` blocks are forbidden in " + LANGUAGE + " (use ES module files)"
        )
      }
      break
    case N_TYPE_ALIAS:
      // The third child is the type parameter list, there only when written.
      if (node.children.length > 2) {
        ctx.error(
          node,
          "Generic type parameters are forbidden on a type alias in " +
            LANGUAGE +
            "; a generic function, class or interface is monomorphised, and an alias only renames a type that already exists"
        )
      }
      break
    case N_IMPORT:
      rejectImportForms(ctx, node)
      return
    case N_EXPORT_DECLARATION:
      // `export { a }` is refused by pass 1 whatever it names (NL2128), and
      // nothing in it is a value for a rule here to judge.
      return
    case N_THROW:
      // WP16: `throw` never unwound, it trapped and discarded its value, so it
      // was an abort wearing the syntax of error handling. The parser still
      // reads it (so the message can point at the statement) and Phase 0
      // refuses it, exactly as stage0 does.
      ctx.error(
        node,
        "`throw` is forbidden in " +
          LANGUAGE +
          " (it aborts rather than unwinding): return a `Result<T, E>` for a failure a caller should handle, or `panic(message)` to end the process"
      )
      break
    default:
      break
  }
  for (const child of node.children) {
    visit(ctx, child, inTypePosition)
  }
}

/**
 * The import forms that are forbidden by design, in the order the source
 * writes them: `import defer` (NL1059), a module export name written as a
 * string (NL1058), and attributes after the specifier (NL1057). What an
 * import *means* — a default, a namespace, a type-only one — is pass 1a's to
 * refuse (`collectImports`).
 */
const rejectImportForms = (ctx: CheckContext, node: Node): void => {
  if ((node.flags & FLAG_DEFER) !== 0) {
    ctx.error(
      node,
      "`import defer` is forbidden in " +
        LANGUAGE +
        " (a module has no top-level code, so there is nothing to defer)"
    )
  }
  const bindings = node.children[0]
  if (bindings.kind === N_LIST) {
    for (const spec of bindings.children) {
      if (spec.children[0].kind === N_STRING) {
        ctx.error(
          spec.children[0],
          "A module export name written as a string is forbidden in " +
            LANGUAGE +
            " (an export is a declaration, and a declaration has a name; import it by that name)"
        )
      }
    }
  }
  for (const child of node.children) {
    visit(ctx, child, false)
  }
  if ((node.flags & FLAG_ATTRIBUTES) !== 0) {
    ctx.error(
      node,
      "Import attributes (`with { ... }`) are forbidden in " +
        LANGUAGE +
        " (an import names source this compiler reads, never a resource loaded at run time)"
    )
  }
}

/**
 * `async` and the `*` of a generator, on a function, a method or an arrow —
 * and `async` on a field or a constructor, which the parser reads as the
 * modifier it is there too. `async` is written first, so it is the refusal.
 */
const rejectFunctionModifiers = (ctx: CheckContext, node: Node): void => {
  const holdsModifiers =
    node.kind === N_FUNCTION ||
    node.kind === N_METHOD ||
    node.kind === N_ARROW ||
    node.kind === N_FIELD ||
    node.kind === N_CONSTRUCTOR
  if (!holdsModifiers) {
    return
  }
  if ((node.flags & FLAG_ASYNC) !== 0) {
    ctx.error(node, "`async` functions are forbidden in " + LANGUAGE + " (no event loop or promises)")
  } else if ((node.flags & FLAG_GENERATOR) !== 0) {
    ctx.error(node, "Generators are forbidden in " + LANGUAGE + " (no coroutine runtime)")
  }
}

/** `var`, in a function body, a `for` head or at the top level. */
const rejectVar = (ctx: CheckContext, node: Node): void => {
  if ((node.flags & FLAG_VAR) !== 0) {
    ctx.error(node, "`var` is forbidden; use `let` or `const`")
  }
}

/** The identifier `undefined`, as a value. */
export const isUndefined = (node: Node): boolean => node.kind === N_IDENT && node.text === "undefined"

/** The type `undefined`, as a union member. */
export const isUndefinedType = (node: Node): boolean =>
  node.kind === N_TYPE_REF && node.text === "undefined" && node.children[0].children.length === 0

/**
 * `V | undefined`, `undefined | V`, or `V | null | undefined` for a nullable
 * `V`: the spelling of the maybe type (WP32). The checker resolves exactly
 * this shape (`resolveMaybeAnnotation`), so both layers read it here.
 */
export const isMaybeAnnotation = (annotation: Node): boolean => {
  if (annotation.kind !== N_TYPE_UNION) {
    return false
  }
  let undefineds = 0
  let nulls = 0
  for (const member of annotation.children) {
    if (isUndefinedType(member)) {
      undefineds = undefineds + 1
    } else if (member.kind === N_TYPE_NULL) {
      nulls = nulls + 1
    }
  }
  return undefineds === 1 && nulls <= 1 && annotation.children.length - undefineds - nulls === 1
}

/**
 * A declaration annotated with the maybe type whose initialiser is a call of
 * a member named `get` (docs/wp32-map.md §3.2: the maybe type is spelled only
 * as the annotation of a `const` initialised directly from `get`). Whether the
 * receiver is a `Map`, the annotation its value type and the declaration a
 * `const` is the checker's to say. Every other `T | undefined` is refused
 * below as the union it is.
 */
const isMaybeDeclaration = (decl: Node): boolean => {
  const init = unwrapParens(decl.children[2])
  const callsGet =
    init.kind === N_CALL && init.children[0].kind === N_MEMBER && init.children[0].text === "get"
  return callsGet && isMaybeAnnotation(decl.children[1])
}

/**
 * `undefined` anywhere in a module constant's initialiser. The `===` exemption
 * above is for a `Map.get` result, which a module constant, folded at compile
 * time, never holds, so there it is refused as it always was.
 */
const refuseUndefinedIn = (ctx: CheckContext, node: Node): void => {
  if (isUndefined(node)) {
    ctx.error(node, undefinedForbidden())
    return
  }
  for (const child of node.children) {
    refuseUndefinedIn(ctx, child)
  }
}

/** One declaration of a `const` list, whose annotation may be the maybe type. */
const visitDeclaration = (ctx: CheckContext, decl: Node, inTypePosition: boolean): void => {
  if (!isMaybeDeclaration(decl)) {
    visit(ctx, decl, inTypePosition)
    return
  }
  visit(ctx, decl.children[0], inTypePosition)
  for (const member of decl.children[1].children) {
    if (!isUndefinedType(member)) {
      visit(ctx, member, inTypePosition)
    }
  }
  visit(ctx, decl.children[2], inTypePosition)
}

/**
 * An enum member's value has to be a numeric literal, because an enum lowers
 * to a plain integer and a module has no code that could compute one. What the
 * *checker* adds on top is what needs the type model: the literal must be an
 * integer and it must fit in `i32` (WP23).
 */
const rejectComputedEnumMembers = (ctx: CheckContext, node: Node): void => {
  for (const member of node.children[1].children) {
    const initializer = member.children[1]
    if (initializer.kind !== N_EMPTY && !isNumericLiteralShape(initializer)) {
      ctx.error(
        initializer,
        "Enum members must be numeric literals in " + LANGUAGE + " (enums lower to plain integers)"
      )
    }
  }
}

/** A numeric literal, or one with a leading `-`: everything an enum member may be. */
const isNumericLiteralShape = (expr: Node): boolean => {
  if (expr.kind === N_NUMBER) {
    return true
  }
  return expr.kind === N_UNARY && expr.text === "-" && expr.children[0].kind === N_NUMBER
}

const rejectForbiddenMember = (ctx: CheckContext, node: Node): void => {
  // Against the member name, as stage0 hands `access.name` to `fail`
  // (stage0's `src/validator.ts`), not against the whole access.
  if (node.text === "__proto__") {
    ctx.errorAtProperty(node, "`__proto__` access is forbidden in " + LANGUAGE + " (no prototype chain)")
    return
  }
  if (node.text === "prototype") {
    ctx.errorAtProperty(node, "`.prototype` access is forbidden in " + LANGUAGE + " (no prototype chain)")
    return
  }
  const receiver = node.children[0]
  // `import` is a keyword, so an IDENT of that name is only ever the
  // parser's receiver of `import.meta` (`src/nodes.ts`). A member access or a
  // call after it is read through and costs nothing more.
  if (receiver.kind === N_IDENT && receiver.text === "import") {
    ctx.error(
      node,
      "`import.meta` is forbidden in " +
        LANGUAGE +
        " (a module has no runtime object; resolve paths at compile time)"
    )
    return
  }
  if (receiver.kind === N_IDENT && receiver.text === "Object" && isShapeMutation(node.text)) {
    ctx.error(
      node,
      "`Object." + node.text + "` is forbidden in " + LANGUAGE + " (object layout is fixed at compile time)"
    )
  }
}

const rejectForbiddenIndex = (ctx: CheckContext, node: Node): void => {
  const key = node.children[1]
  if (key.kind === N_STRING || key.kind === N_TEMPLATE) {
    ctx.error(
      key,
      "String-keyed element access is forbidden in " +
        LANGUAGE +
        "; use `obj.name` (no dynamic property lookup)"
    )
    return
  }
  if (!isNumericIndexShape(key)) {
    ctx.error(key, "Element access requires a numeric index in " + LANGUAGE + " (no dynamic property lookup)")
  }
}

const rejectForbiddenNew = (ctx: CheckContext, node: Node): void => {
  const callee = node.children[0]
  if (callee.kind !== N_IDENT) {
    return
  }
  if (callee.text === "Function") {
    ctx.error(node, "`new Function` is forbidden in " + LANGUAGE + " (no interpreter at runtime)")
  } else if (callee.text === "Proxy") {
    ctx.error(node, "`new Proxy` is forbidden in " + LANGUAGE + " (no dynamic property interception)")
  }
}

const rejectForbiddenCall = (ctx: CheckContext, node: Node): void => {
  const callee = node.children[0]
  if (callee.kind !== N_IDENT) {
    return
  }
  // `import` is a keyword, so an IDENT of that name is only ever the
  // parser's callee of a dynamic `import(...)` (`src/nodes.ts`).
  if (callee.text === "import") {
    ctx.error(
      node,
      "Dynamic `import()` is forbidden in " + LANGUAGE + " (modules are resolved at compile time)"
    )
  } else if (callee.text === "eval") {
    ctx.error(node, "`eval` is forbidden in " + LANGUAGE + " (no interpreter at runtime)")
  } else if (callee.text === "Function") {
    ctx.error(node, "`Function` constructor is forbidden in " + LANGUAGE + " (no interpreter at runtime)")
  }
}

/**
 * `x as any`, `<any>x`, and the same to `unknown`: stated here, ahead of the
 * type's own refusal, because the assertion is what the program wrote. Every
 * other assertion, and `satisfies`, is the checker's (NL2256).
 */
const rejectForbiddenAssertion = (ctx: CheckContext, node: Node): void => {
  const type = node.children[1]
  if ((node.flags & FLAG_SATISFIES) !== 0 || type.kind !== N_TYPE_REF) {
    return
  }
  if (type.text === "any") {
    ctx.error(node, "Type assertion to `any` is forbidden in " + LANGUAGE)
  } else if (type.text === "unknown") {
    ctx.error(node, "Type assertion to `unknown` is forbidden in " + LANGUAGE)
  }
}

/** `T | null` is the only union; anything else is refused with one message. */
const checkNullUnion = (ctx: CheckContext, node: Node): void => {
  let nulls = 0
  for (const member of node.children) {
    if (member.kind === N_TYPE_NULL) {
      nulls = nulls + 1
    }
  }
  if (nulls !== 1 || node.children.length !== 2) {
    ctx.error(
      node,
      "Union types other than `T | null` are forbidden in " + LANGUAGE + " (values have one fixed layout)"
    )
  }
}
