// Questions about a checked tree that both the emitter and the whole-program
// analyses ask, for stage1 (docs/wp14-selfhost.md milestone S4).
//
// In `src/` these live next to the family that owns them — `arrayMethodName`
// in `emit/arrays.ts`, `isStringMethodCall` in `emit/strings.ts`,
// `dottedName` in `checker/builtins.ts` — and `escape.ts` imports them from
// there. Here they are gathered into one module that depends on nothing but
// the tree and the side tables, so `escape.ts` and `attributes.ts` need no
// import from the emitter at all. That is not a tidiness choice: the fact
// collectors and the lowerings must agree *exactly* (an omission in a
// collector is a wrong attribute, not a missed optimisation), and a single
// definition of "is this a `push`" is the cheapest way to keep them agreeing.

import { CheckedProgram, inlineElementStruct } from "./program";
import {
  N_BINARY,
  N_CALL,
  N_IDENT,
  N_MEMBER,
  N_PAREN,
  N_TEMPLATE,
  N_TEMPLATE_TEXT,
  Node,
} from "./nodes";
import { T_STRING, TypeTable } from "./types";

/** Through `(e)`, which is transparent to every rule here. */
export function unwrapParens(expr: Node): Node {
  let inner = expr;
  while (inner.kind === N_PAREN) {
    inner = inner.children[0];
  }
  return inner;
}

/**
 * `console.log` for a member access on a plain identifier, and the empty
 * string for anything else. Mirrors `dottedName` in `src/checker/builtins.ts`;
 * the empty string stands in for its `undefined`, and no builtin is called
 * `""`, so the two readings cannot be confused.
 */
export function dottedName(expr: Node): string {
  if (expr.kind !== N_MEMBER || expr.children[0].kind !== N_IDENT) {
    return "";
  }
  return `${expr.children[0].text}.${expr.text}`;
}

/**
 * Whether `receiver` is a value rather than a builtin namespace. The checker
 * records a type for every expression it checks and none for `console` or
 * `Math`, so the recorded type *is* the answer — the same test as
 * `program.types.has(receiver)` in `src/`.
 */
export function receiverIsValue(program: CheckedProgram, receiver: Node): boolean {
  return program.nodeTypes[receiver.id] >= 0;
}

/**
 * The type an expression produces *before* the coercion recorded on it
 * (class -> interface): `nodeTypes` holds the converted
 * type, but `new C(...)` still allocates and constructs a `C`.
 */
export function intrinsicType(program: CheckedProgram, expr: Node): i32 {
  const coerced = program.nodeCoercions[expr.id];
  return coerced >= 0 ? coerced : program.nodeTypes[expr.id];
}

/** Whether an operator writes its left operand: `=` and every `op=`. */
export function isAssignmentOperator(op: string): boolean {
  if (op === "=") {
    return true;
  }
  if (op.length < 2 || !op.endsWith("=")) {
    return false;
  }
  // `===`, `!==`, `<=`, `>=` end in `=` and write nothing.
  return op !== "===" && op !== "!==" && op !== "==" && op !== "!=" && op !== "<=" && op !== ">=";
}

/** `expr` is the left operand of an assignment, so the value it names is written. */
export function isAssignmentTarget(parent: Node | null, node: Node): boolean {
  if (parent === null) {
    return false;
  }
  return parent.kind === N_BINARY && parent.children[0] === node && isAssignmentOperator(parent.text);
}

/** The receiver of `recv.m(...)`, or `null` when `call` is not a method call. */
export function methodReceiver(call: Node): Node | null {
  if (call.kind !== N_CALL || call.children[0].kind !== N_MEMBER) {
    return null;
  }
  return call.children[0].children[0];
}

/**
 * The array method `call` invokes (`push`, `pop`, `indexOf`, `join`), or the
 * empty string. The receiver's *type* decides, so `s.indexOf(t)` on a string
 * is not one of these.
 */
export function arrayMethodName(program: CheckedProgram, table: TypeTable, call: Node): string {
  const receiver = methodReceiver(call);
  if (receiver === null) {
    return "";
  }
  const type = program.nodeTypes[receiver.id];
  return type >= 0 && table.isArray(type) ? call.children[0].text : "";
}

/** `recv.push(v)` on an array receiver. */
export function isPushCall(program: CheckedProgram, table: TypeTable, node: Node): boolean {
  return arrayMethodName(program, table, node) === "push";
}

/**
 * WP15 §2a: `expr` is an array whose slots hold their elements *inline*, so a
 * value stored into one is copied into the slot rather than pointed at from
 * it. `attributes.ts` reads this to keep `nocapture` exact: a struct handed to
 * `xs.push(p)` or written with `xs[i] = p` is read, not retained, and an
 * object built only to be stored into such an array does not escape its frame.
 */
export function storesInlineElements(program: CheckedProgram, table: TypeTable, expr: Node): boolean {
  const type = program.nodeTypes[expr.id];
  if (type < 0 || !table.isArray(type)) {
    return false;
  }
  return inlineElementStruct(program, table, table.refOf(type)) !== null;
}

/** `parts.join(sep)` bumps one string out of the arena, so it is an allocation site. */
export function isJoinCall(program: CheckedProgram, table: TypeTable, node: Node): boolean {
  return arrayMethodName(program, table, node) === "join";
}

/** The byte methods that lower inline on a string receiver (WP14 A2). */
export function isStringMethod(name: string): boolean {
  return (
    name === "charCodeAt" ||
    name === "substring" ||
    name === "slice" ||
    name === "indexOf" ||
    name === "startsWith" ||
    name === "endsWith"
  );
}

/** `call` invokes one of the byte methods on a string receiver. */
export function isStringMethodCall(program: CheckedProgram, call: Node): boolean {
  const receiver = methodReceiver(call);
  if (receiver === null || !isStringMethod(call.children[0].text)) {
    return false;
  }
  return program.nodeTypes[receiver.id] === T_STRING;
}

/** `call` allocates a string: `s.substring(...)`, `s.slice(...)` or `String.fromCharCode(c)`. */
export function isStringAllocCall(program: CheckedProgram, call: Node): boolean {
  if (call.kind !== N_CALL) {
    return false;
  }
  const callee = call.children[0];
  if (dottedName(callee) === "String.fromCharCode" && !receiverIsValue(program, callee.children[0])) {
    return true;
  }
  if (!isStringMethodCall(program, call)) {
    return false;
  }
  return callee.text === "substring" || callee.text === "slice";
}

/**
 * A `N_TEMPLATE` with at least one hole. A template with none is a plain
 * string literal — `src/` parses `` `abc` `` as a
 * `NoSubstitutionTemplateLiteral`, which is not a `TemplateExpression` and so
 * is neither an allocation site nor a concatenation, and this is the test that
 * keeps the two trees answering the same way.
 */
export function isTemplateExpression(node: Node): boolean {
  return node.kind === N_TEMPLATE && node.children.length > 1;
}

/** Head, holes and middles/tail in order, with the empty text parts dropped. */
export function templateParts(node: Node): Node[] {
  const parts: Node[] = [];
  for (const child of node.children) {
    if (child.kind === N_TEMPLATE_TEXT) {
      if (child.text.length > 0) {
        parts.push(child);
      }
    } else {
      parts.push(child);
    }
  }
  return parts;
}

/**
 * A template whose only part is a string-typed hole lowers to that hole's
 * value unchanged. The escape analysis must see through it (and through
 * parentheses), or `` return `${s}` `` would wrongly keep `nocapture` on `s`.
 */
export function unwrapStringPassthrough(program: CheckedProgram, expr: Node): Node {
  let inner = expr;
  for (;;) {
    if (inner.kind === N_PAREN) {
      inner = inner.children[0];
      continue;
    }
    if (isTemplateExpression(inner)) {
      const parts = templateParts(inner);
      if (
        parts.length === 1 &&
        parts[0].kind !== N_TEMPLATE_TEXT &&
        program.nodeTypes[parts[0].id] === T_STRING
      ) {
        inner = parts[0];
        continue;
      }
    }
    return inner;
  }
}
