// Phase 0 for stage1 (`src/validator.ts`, docs/wp14-selfhost.md milestone S3):
// a syntax-only sweep that refuses every construct the language can *never*
// compile, before the checker runs.
//
// The distinction Phase 0 draws is the one `docs/LANGUAGE.md` draws: what is
// here is forbidden by design — an interpreter at run time, a prototype
// chain, dynamic property lookup, unwinding — and what the checker refuses
// with `Unsupported ... in Phase 1` is merely not implemented yet. Keeping
// them apart is why a rejection message can say *why* rather than "no".
//
// It is smaller than stage0's, and for the same reason `self/declarations.ts`
// is: the S2 parser refuses most of this syntax where it stands, by name.
// What is left is what parses as ordinary source and is forbidden anyway —
// a banned identifier, a `__proto__` or `.prototype` member, an `Object.*`
// shape mutation, a string-keyed element access.

import { LANGUAGE } from "./branding";
import { CheckContext } from "./context";
import { unwrapParens } from "./emit_util";
import {
  FLAG_CONST,
  N_BIGINT,
  N_BINARY,
  N_CALL,
  N_EMPTY,
  N_ENUM,
  N_IDENT,
  N_INDEX,
  N_MEMBER,
  N_MODULE_CONST,
  N_NEW,
  N_NUMBER,
  N_PAREN,
  N_PROPERTY,
  N_STRING,
  N_TEMPLATE,
  N_THROW,
  N_TYPE_NULL,
  N_TYPE_REF,
  N_TYPE_UNION,
  N_UNARY,
  N_VAR,
  Node,
} from "./nodes";

/**
 * `undefined`, as a value and as a type. One sentence for both, and for the
 * checker's refusal of `x === undefined` where `x` is not a `Map.get` result,
 * the one thing `undefined` may be compared with (WP32).
 */
export const undefinedForbidden = (): string => "`undefined` is forbidden in " + LANGUAGE + "; use `null` with a `T | null` type";

/** The message for an identifier that may never appear as a value, or "". */
const forbiddenValue = (name: string): string => {
  if (name === "eval") {
    return "`eval` is forbidden in " + LANGUAGE + " (no interpreter at runtime)";
  }
  if (name === "Function") {
    return "`Function` is forbidden in " + LANGUAGE + " (no interpreter at runtime)";
  }
  if (name === "Proxy") {
    return "`Proxy` is forbidden in " + LANGUAGE + " (no dynamic property interception)";
  }
  if (name === "Reflect") {
    return "`Reflect` is forbidden in " + LANGUAGE + " (no runtime reflection)";
  }
  if (name === "Symbol") {
    return "`Symbol` is forbidden in " + LANGUAGE + " (no symbol type)";
  }
  if (name === "globalThis") {
    return "`globalThis` is forbidden in " + LANGUAGE + " (no global object)";
  }
  if (name === "arguments") {
    return "`arguments` is forbidden in " + LANGUAGE + " (functions have fixed arity)";
  }
  if (name === "undefined") {
    return undefinedForbidden();
  }
  if (name === "debugger") {
    // `debugger;` parses as an expression statement naming an identifier, so
    // this is where it lands rather than in the parser.
    return "`debugger` is forbidden in " + LANGUAGE + " (no debugger hook)";
  }
  return "";
};

/** The message for a type name that may never be referenced, or "". */
const forbiddenType = (name: string): string => {
  if (name === "Function") {
    return "`Function` type is forbidden in " + LANGUAGE + " (no dynamic function values)";
  }
  if (name === "Symbol") {
    return "`Symbol` type is forbidden in " + LANGUAGE + " (no symbol type)";
  }
  if (name === "Proxy") {
    return "`Proxy` type is forbidden in " + LANGUAGE + " (no dynamic property interception)";
  }
  if (name === "symbol") {
    return "`symbol` type is forbidden in " + LANGUAGE + " (no symbol type)";
  }
  if (name === "bigint") {
    return "`bigint` type is forbidden in " + LANGUAGE + " (use number, i32, or f64)";
  }
  if (name === "undefined") {
    return undefinedForbidden();
  }
  if (name === "any") {
    return "`any` is forbidden in " + LANGUAGE;
  }
  if (name === "unknown") {
    return "`unknown` is forbidden in " + LANGUAGE;
  }
  return "";
};

/** `Object.<member>` calls that mutate an object's shape or its prototype chain. */
const isShapeMutation = (member: string): boolean => (
    member === "assign" ||
    member === "create" ||
    member === "defineProperty" ||
    member === "defineProperties" ||
    member === "setPrototypeOf" ||
    member === "getPrototypeOf"
  );

/**
 * Whether an element-access key *looks* numeric. It is a syntactic test, not
 * a type test — Phase 0 has no types — so it accepts anything arithmetic and
 * refuses the shapes that could only be a property name.
 */
const isNumericIndexShape = (expr: Node): boolean => {
  switch (expr.kind) {
    case N_IDENT:
      return true;
    case N_NUMBER:
      return true;
    case N_CALL:
      return true;
    case N_MEMBER:
      return true;
    case N_INDEX:
      return true;
    case N_PAREN:
      return isNumericIndexShape(expr.children[0]);
    case N_UNARY:
      return expr.text === "-" || expr.text === "+";
    case N_BINARY:
      if (
        expr.text === "+" ||
        expr.text === "-" ||
        expr.text === "*" ||
        expr.text === "/" ||
        expr.text === "%"
      ) {
        return isNumericIndexShape(expr.children[0]) && isNumericIndexShape(expr.children[1]);
      }
      return false;
    default:
      return false;
  }
};

/**
 * Sweep a whole tree. Every rejection is reported and the walk continues, so
 * a file with several forbidden constructs names them all — which is the
 * behaviour stage0's sink gives Phase 0 and the reason it is a *sweep* rather
 * than a bail-out.
 */
export const validate = (ctx: CheckContext, node: Node): void => {
  visit(ctx, node, false);
};

const visit = (ctx: CheckContext, node: Node, inTypePosition: boolean): void => {
  switch (node.kind) {
    case N_IDENT: {
      const message = forbiddenValue(node.text);
      if (message.length > 0) {
        ctx.error(node, message);
      }
      break;
    }
    case N_TYPE_REF: {
      const message = forbiddenType(node.text);
      if (message.length > 0) {
        ctx.error(node, message);
      }
      break;
    }
    case N_MEMBER:
      rejectForbiddenMember(ctx, node);
      break;
    case N_INDEX:
      rejectForbiddenIndex(ctx, node);
      break;
    case N_BIGINT:
      ctx.error(node, "`bigint` literals are forbidden in " + LANGUAGE + " (use number, i32, or f64)");
      break;
    case N_TYPE_UNION:
      // Everything but `T | null` is refused here, before the checker reports
      // the offending member on its own — `T | undefined` is a union first.
      checkNullUnion(ctx, node);
      break;
    case N_PROPERTY:
      if (node.text === "__proto__") {
        ctx.errorAtKey(node, "`__proto__` is forbidden in " + LANGUAGE + " (no prototype chain)");
      }
      break;
    case N_NEW:
      rejectForbiddenNew(ctx, node);
      break;
    case N_CALL:
      rejectForbiddenCall(ctx, node);
      break;
    case N_ENUM:
      rejectComputedEnumMembers(ctx, node);
      break;
    case N_BINARY:
      // WP32: `x === undefined` and `x !== undefined` are how a maybe is
      // tested, so `undefined` is let through as an operand of those two and
      // nowhere else. Whether `x` is a maybe is the checker's question.
      if (node.text === "===" || node.text === "!==") {
        for (const child of node.children) {
          if (!isUndefined(child)) {
            visit(ctx, child, inTypePosition);
          }
        }
        return;
      }
      break;
    case N_VAR:
      // WP32: `const a: V | undefined = m.get(k)` is the one place the maybe
      // type is spelled. `V` itself is still swept.
      if ((node.flags & FLAG_CONST) !== 0) {
        for (const decl of node.children[0].children) {
          visitDeclaration(ctx, decl, inTypePosition);
        }
        return;
      }
      break;
    case N_MODULE_CONST:
      refuseUndefinedIn(ctx, node);
      break;
    case N_THROW:
      // WP16: `throw` never unwound, it trapped and discarded its value, so it
      // was an abort wearing the syntax of error handling. The parser still
      // reads it (so the message can point at the statement) and Phase 0
      // refuses it, exactly as stage0 does.
      ctx.error(
        node,
        "`throw` is forbidden in " + LANGUAGE + " (it aborts rather than unwinding): return a `Result<T, E>` for a failure a caller should handle, or `panic(message)` to end the process"
      );
      break;
    default:
      break;
  }
  for (const child of node.children) {
    visit(ctx, child, inTypePosition);
  }
};

/** The identifier `undefined`, as a value. */
export const isUndefined = (node: Node): boolean => node.kind === N_IDENT && node.text === "undefined";

/** The type `undefined`, as a union member. */
export const isUndefinedType = (node: Node): boolean =>
  node.kind === N_TYPE_REF && node.text === "undefined" && node.children[0].children.length === 0;

/**
 * `V | undefined`, `undefined | V`, or `V | null | undefined` for a nullable
 * `V`: the spelling of the maybe type (WP32). The checker resolves exactly
 * this shape (`resolveMaybeAnnotation`), so both layers read it here.
 */
export const isMaybeAnnotation = (annotation: Node): boolean => {
  if (annotation.kind !== N_TYPE_UNION) {
    return false;
  }
  let undefineds = 0;
  let nulls = 0;
  for (const member of annotation.children) {
    if (isUndefinedType(member)) {
      undefineds = undefineds + 1;
    } else if (member.kind === N_TYPE_NULL) {
      nulls = nulls + 1;
    }
  }
  return undefineds === 1 && nulls <= 1 && annotation.children.length - undefineds - nulls === 1;
};

/**
 * A `const` declaration annotated with the maybe type whose initialiser is a
 * call of a member named `get` (docs/wp32-map.md §3.2: the maybe type is
 * spelled only as the annotation of a `const` initialised directly from
 * `get`). Whether the receiver is a `Map`, and the annotation its value type,
 * is the checker's to say. Every other `T | undefined` is refused below as the
 * union it is.
 */
const isMaybeDeclaration = (decl: Node): boolean => {
  const init = unwrapParens(decl.children[2]);
  const callsGet = init.kind === N_CALL && init.children[0].kind === N_MEMBER && init.children[0].text === "get";
  return callsGet && isMaybeAnnotation(decl.children[1]);
};

/**
 * `undefined` anywhere in a module constant's initialiser. The `===` exemption
 * above is for a `Map.get` result, which a module constant, folded at compile
 * time, never holds, so there it is refused as it always was.
 */
const refuseUndefinedIn = (ctx: CheckContext, node: Node): void => {
  if (isUndefined(node)) {
    ctx.error(node, undefinedForbidden());
    return;
  }
  for (const child of node.children) {
    refuseUndefinedIn(ctx, child);
  }
};

/** One declaration of a `const` list, whose annotation may be the maybe type. */
const visitDeclaration = (ctx: CheckContext, decl: Node, inTypePosition: boolean): void => {
  if (!isMaybeDeclaration(decl)) {
    visit(ctx, decl, inTypePosition);
    return;
  }
  visit(ctx, decl.children[0], inTypePosition);
  for (const member of decl.children[1].children) {
    if (!isUndefinedType(member)) {
      visit(ctx, member, inTypePosition);
    }
  }
  visit(ctx, decl.children[2], inTypePosition);
};

/**
 * An enum member's value has to be a numeric literal, because an enum lowers
 * to a plain integer and a module has no code that could compute one. What the
 * *checker* adds on top is what needs the type model: the literal must be an
 * integer and it must fit in `i32` (WP23).
 */
const rejectComputedEnumMembers = (ctx: CheckContext, node: Node): void => {
  for (const member of node.children[1].children) {
    const initializer = member.children[1];
    if (initializer.kind !== N_EMPTY && !isNumericLiteralShape(initializer)) {
      ctx.error(
        initializer,
        "Enum members must be numeric literals in " + LANGUAGE + " (enums lower to plain integers)"
      );
    }
  }
};

/** A numeric literal, or one with a leading `-`: everything an enum member may be. */
const isNumericLiteralShape = (expr: Node): boolean => {
  if (expr.kind === N_NUMBER) {
    return true;
  }
  return expr.kind === N_UNARY && expr.text === "-" && expr.children[0].kind === N_NUMBER;
};

const rejectForbiddenMember = (ctx: CheckContext, node: Node): void => {
  // Against the member name, as stage0 hands `access.name` to `fail`
  // (`src/validator.ts`), not against the whole access.
  if (node.text === "__proto__") {
    ctx.errorAtProperty(node, "`__proto__` access is forbidden in " + LANGUAGE + " (no prototype chain)");
    return;
  }
  if (node.text === "prototype") {
    ctx.errorAtProperty(node, "`.prototype` access is forbidden in " + LANGUAGE + " (no prototype chain)");
    return;
  }
  const receiver = node.children[0];
  if (receiver.kind === N_IDENT && receiver.text === "Object" && isShapeMutation(node.text)) {
    ctx.error(
      node,
      "`Object." + node.text + "` is forbidden in " + LANGUAGE + " (object layout is fixed at compile time)"
    );
  }
};

const rejectForbiddenIndex = (ctx: CheckContext, node: Node): void => {
  const key = node.children[1];
  if (key.kind === N_STRING || key.kind === N_TEMPLATE) {
    ctx.error(
      key,
      "String-keyed element access is forbidden in " +
        LANGUAGE +
        "; use `obj.name` (no dynamic property lookup)"
    );
    return;
  }
  if (!isNumericIndexShape(key)) {
    ctx.error(
      key,
      "Element access requires a numeric index in " + LANGUAGE + " (no dynamic property lookup)"
    );
  }
};

const rejectForbiddenNew = (ctx: CheckContext, node: Node): void => {
  const callee = node.children[0];
  if (callee.kind !== N_IDENT) {
    return;
  }
  if (callee.text === "Function") {
    ctx.error(node, "`new Function` is forbidden in " + LANGUAGE + " (no interpreter at runtime)");
  } else if (callee.text === "Proxy") {
    ctx.error(node, "`new Proxy` is forbidden in " + LANGUAGE + " (no dynamic property interception)");
  }
};

const rejectForbiddenCall = (ctx: CheckContext, node: Node): void => {
  const callee = node.children[0];
  if (callee.kind !== N_IDENT) {
    return;
  }
  if (callee.text === "eval") {
    ctx.error(node, "`eval` is forbidden in " + LANGUAGE + " (no interpreter at runtime)");
  } else if (callee.text === "Function") {
    ctx.error(node, "`Function` constructor is forbidden in " + LANGUAGE + " (no interpreter at runtime)");
  }
};

/** `T | null` is the only union; anything else is refused with one message. */
const checkNullUnion = (ctx: CheckContext, node: Node): void => {
  let nulls = 0;
  for (const member of node.children) {
    if (member.kind === N_TYPE_NULL) {
      nulls = nulls + 1;
    }
  }
  if (nulls !== 1 || node.children.length !== 2) {
    ctx.error(
      node,
      "Union types other than `T | null` are forbidden in " + LANGUAGE + " (values have one fixed layout)"
    );
  }
};
