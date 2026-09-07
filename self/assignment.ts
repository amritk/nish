// Definite assignment for stage1 (`src/checker/classes.ts` pass 1c,
// docs/wp14-selfhost.md milestone S3).
//
// A class has no zero value: every field is either given a literal
// initializer or assigned by the constructor on every path, and until it is,
// reading it — or handing `this` to anything that might — is refused. That is
// what lets `new C(...)` be one allocation and a store per field, with no
// zeroing pass and no "uninitialised" state a later read has to allow for.
//
// The inherited prefix is the base constructor's job: those fields count as
// assigned once `super(...)` has run, which is before the body when the call
// is implicit and after the first statement when it is written — and it must
// be the first statement, with no `this` in its arguments, because the base
// part of the object does not exist until it returns.

import { CheckContext } from "./context";
import { StringSet } from "./map";
import {
  N_BINARY,
  N_BLOCK,
  N_BREAK,
  N_CALL,
  N_CONTINUE,
  N_DO,
  N_EMPTY,
  N_EXPR_STMT,
  N_FOR,
  N_FOR_OF,
  N_IF,
  N_MEMBER,
  N_PAREN,
  N_RETURN,
  N_SUPER,
  N_THIS,
  N_THROW,
  N_VAR,
  N_WHILE,
  Node,
} from "./nodes";
import { FieldInfo, STRUCT_CLASS, StructInfo } from "./program";

/**
 * The set of fields assigned so far, and whether the path ended. A terminated
 * path contributes nothing to what follows, which is what makes
 * `if (c) { this.x = 1; } else { return; }` leave `x` assigned.
 */
export class Assigned {
  fields: StringSet;
  terminated: boolean;

  constructor(terminated: boolean) {
    this.fields = new StringSet();
    this.terminated = terminated;
  }

  copy(): Assigned {
    const out = new Assigned(this.terminated);
    let i = 0;
    while (i < this.fields.size()) {
      out.fields.add(this.fields.at(i));
      i = i + 1;
    }
    return out;
  }
}

/** The first field of `cls` that `assigned` does not hold, or `null`. */
function missingField(cls: StructInfo, assigned: Assigned): FieldInfo | null {
  for (const field of cls.fields) {
    if (!assigned.fields.has(field.name)) {
      return field;
    }
  }
  return null;
}

/** `this.name`, as a member access whose receiver is `this`. */
function thisAccess(node: Node): boolean {
  return node.kind === N_MEMBER && node.children[0].kind === N_THIS;
}

/** The fields `expr` definitely assigns: `this.a = this.b = v` assigns both. */
function assignedBy(expr: Node, out: Assigned): void {
  let inner = expr;
  while (inner.kind === N_PAREN) {
    inner = inner.children[0];
  }
  if (inner.kind === N_BINARY && inner.text === "=") {
    if (thisAccess(inner.children[0])) {
      out.fields.add(inner.children[0].text);
    }
    assignedBy(inner.children[1], out);
  }
}

/** Every use of `this` in `node` must be safe given what is assigned. */
function checkReads(
  ctx: CheckContext,
  cls: StructInfo,
  node: Node,
  assigned: Assigned,
  isTarget: boolean
): void {
  if (thisAccess(node)) {
    const field = node.text;
    if (!isTarget && cls.field(field) !== null && !assigned.fields.has(field)) {
      ctx.error(
        node,
        `Field \`${field}\` is read before it is assigned in the constructor of \`${cls.name}\``
      );
    }
    return; // the only children are `this` and the member name
  }
  if (node.kind === N_CALL && thisAccess(node.children[0])) {
    const missing = missingField(cls, assigned);
    if (missing !== null) {
      ctx.error(
        node.children[0],
        `Cannot call \`this.${node.children[0].text}()\` in the constructor of \`${cls.name}\` before field \`${missing.name}\` is assigned`
      );
    }
    for (const arg of node.children[1].children) {
      checkReads(ctx, cls, arg, assigned, false);
    }
    return;
  }
  if (node.kind === N_THIS) {
    const missing = missingField(cls, assigned);
    if (missing !== null) {
      ctx.error(
        node,
        `\`this\` cannot be used as a value in the constructor of \`${cls.name}\` before field \`${missing.name}\` is assigned`
      );
    }
    return;
  }
  // A plain `this.x = v` reads nothing on the left; `this.x += v` does.
  const plainStore = node.kind === N_BINARY && node.text === "=";
  let index = 0;
  for (const child of node.children) {
    checkReads(ctx, cls, child, assigned, plainStore && index === 0);
    index = index + 1;
  }
}

function requireAll(ctx: CheckContext, cls: StructInfo, assigned: Assigned, at: Node): void {
  const missing = missingField(cls, assigned);
  if (missing !== null) {
    ctx.error(at, `Constructor of \`${cls.name}\` returns before field \`${missing.name}\` is assigned`);
  }
}

/** A statement list; the result is what is assigned after it. */
function walkStatements(ctx: CheckContext, cls: StructInfo, stmts: Node[], assigned: Assigned): Assigned {
  let current = assigned;
  for (const stmt of stmts) {
    if (current.terminated) {
      break; // unreachable code is reported by the body check
    }
    current = walkStatement(ctx, cls, stmt, current);
  }
  return current;
}

function walkStatement(ctx: CheckContext, cls: StructInfo, stmt: Node, assigned: Assigned): Assigned {
  switch (stmt.kind) {
    case N_BLOCK:
      return walkStatements(ctx, cls, stmt.children, assigned);
    case N_EXPR_STMT:
      checkReads(ctx, cls, stmt.children[0], assigned, false);
      assignedBy(stmt.children[0], assigned);
      return assigned;
    case N_VAR:
      for (const decl of stmt.children[0].children) {
        if (decl.children[2].kind !== N_EMPTY) {
          checkReads(ctx, cls, decl.children[2], assigned, false);
          assignedBy(decl.children[2], assigned);
        }
      }
      return assigned;
    case N_IF:
      return walkIf(ctx, cls, stmt, assigned);
    case N_RETURN:
      if (stmt.children[0].kind !== N_EMPTY) {
        checkReads(ctx, cls, stmt.children[0], assigned, false);
      }
      requireAll(ctx, cls, assigned, stmt);
      return terminated();
    case N_THROW:
      checkReads(ctx, cls, stmt.children[0], assigned, false);
      return terminated();
    case N_BREAK:
      return terminated();
    case N_CONTINUE:
      return terminated();
    case N_WHILE:
      return walkLoop(ctx, cls, stmt.children[0], stmt.children[1], assigned);
    case N_DO:
      return walkLoop(ctx, cls, stmt.children[1], stmt.children[0], assigned);
    case N_FOR_OF:
      return walkLoop(ctx, cls, stmt.children[1], stmt.children[2], assigned);
    case N_FOR:
      for (const part of stmt.children) {
        if (part !== stmt.children[3] && part.kind !== N_EMPTY) {
          checkReads(ctx, cls, part, assigned, false);
        }
      }
      walkStatement(ctx, cls, stmt.children[3], assigned.copy());
      return assigned;
    default:
      checkReads(ctx, cls, stmt, assigned, false);
      return assigned;
  }
}

function terminated(): Assigned {
  return new Assigned(true);
}

function walkIf(ctx: CheckContext, cls: StructInfo, stmt: Node, assigned: Assigned): Assigned {
  checkReads(ctx, cls, stmt.children[0], assigned, false);
  const whenTrue = walkStatement(ctx, cls, stmt.children[1], assigned.copy());
  const whenFalse =
    stmt.children[2].kind === N_EMPTY
      ? assigned.copy()
      : walkStatement(ctx, cls, stmt.children[2], assigned.copy());
  if (whenTrue.terminated) {
    return whenFalse;
  }
  if (whenFalse.terminated) {
    return whenTrue;
  }
  // Only what both branches assign is assigned after the `if`.
  const both = new Assigned(false);
  let i = 0;
  while (i < whenTrue.fields.size()) {
    const name = whenTrue.fields.at(i);
    if (whenFalse.fields.has(name)) {
      both.fields.add(name);
    }
    i = i + 1;
  }
  return both;
}

/**
 * A loop body may run zero times, so its assignments do not count — but every
 * read and every `return` inside it is still checked against what is known
 * before the loop.
 */
function walkLoop(ctx: CheckContext, cls: StructInfo, head: Node, body: Node, assigned: Assigned): Assigned {
  if (head.kind !== N_EMPTY) {
    checkReads(ctx, cls, head, assigned, false);
  }
  walkStatement(ctx, cls, body, assigned.copy());
  return assigned;
}

/** The first `super(...)` anywhere inside `node`, however deeply nested. */
function findSuperCall(node: Node): Node | null {
  if (node.kind === N_CALL && node.children[0].kind === N_SUPER) {
    return node;
  }
  for (const child of node.children) {
    const found = findSuperCall(child);
    if (found !== null) {
      return found;
    }
  }
  return null;
}

/** `super(...)` written as the first statement of the constructor, or `null`. */
export function explicitSuperCall(body: Node): Node | null {
  if (body.children.length === 0) {
    return null;
  }
  const first = body.children[0];
  if (first.kind !== N_EXPR_STMT) {
    return null;
  }
  const call = first.children[0];
  return call.kind === N_CALL && call.children[0].kind === N_SUPER ? call : null;
}

/** The arguments of `super(...)` may not touch `this`: the base part does not exist yet. */
function rejectThisBeforeSuper(ctx: CheckContext, cls: StructInfo, call: Node): void {
  for (const arg of call.children[1].children) {
    rejectThis(ctx, cls, arg);
  }
}

function rejectThis(ctx: CheckContext, cls: StructInfo, node: Node): void {
  if (node.kind === N_THIS || node.kind === N_SUPER) {
    const what = node.kind === N_THIS ? "this" : "super";
    ctx.error(node, `\`${what}\` cannot be used before \`super(...)\` in the constructor of \`${cls.name}\``);
    return;
  }
  for (const child of node.children) {
    rejectThis(ctx, cls, child);
  }
}

/**
 * Every field of `cls` is assigned by the time its constructor returns, and
 * none is read before it is. Runs after the layouts are known, because the
 * inherited prefix decides what `super(...)` covers.
 */
export function checkDefiniteAssignment(ctx: CheckContext, cls: StructInfo): void {
  if (cls.kind !== STRUCT_CLASS) {
    return;
  }
  const base = cls.base;
  const inherited = base === null ? 0 : base.fields.length;
  const assigned = new Assigned(false);
  let i = inherited;
  while (i < cls.fields.length) {
    if (cls.fields[i].initializer !== null) {
      assigned.fields.add(cls.fields[i].name);
    }
    i = i + 1;
  }

  const ctor = cls.ctor;
  if (ctor === null) {
    i = inherited;
    while (i < cls.fields.length) {
      if (!assigned.fields.has(cls.fields[i].name)) {
        ctx.error(
          cls.fields[i].decl.children[0],
          `Field \`${cls.fields[i].name}\` of class \`${cls.name}\` has no initializer and no constructor assigns it`
        );
        return;
      }
      i = i + 1;
    }
    return;
  }

  const body = ctor.decl.children[1];
  const written = findSuperCall(body);
  const first = explicitSuperCall(body);
  let statements = body.children;
  if (base === null) {
    if (written !== null) {
      ctx.error(
        written,
        `\`super(...)\` in the constructor of \`${cls.name}\`, which does not extend a class`
      );
      return;
    }
  } else {
    if (written !== null) {
      // The only `super(...)` a constructor may hold is the one that opens it.
      const opens = first !== null && first === written;
      if (!opens) {
        ctx.error(
          written,
          `\`super(...)\` must be the first statement of the constructor of \`${cls.name}\``
        );
        return;
      }
    }
    const baseCtor = base.effectiveConstructor();
    if (first === null && baseCtor !== null && baseCtor.paramTypes.length > 1) {
      const owner = baseCtor.owner;
      const name = owner === null ? base.name : owner.name;
      ctx.error(
        ctor.decl,
        `Constructor of \`${cls.name}\` must start with \`super(...)\`: the constructor of \`${name}\` takes ${baseCtor.paramTypes.length - 1} argument(s)`
      );
      return;
    }
    if (first !== null) {
      rejectThisBeforeSuper(ctx, cls, first);
      const rest: Node[] = [];
      let at = 1;
      while (at < statements.length) {
        rest.push(statements[at]);
        at = at + 1;
      }
      statements = rest;
    }
    for (const field of base.fields) {
      assigned.fields.add(field.name);
    }
  }

  const result = walkStatements(ctx, cls, statements, assigned);
  if (result.terminated) {
    return;
  }
  const missing = missingField(cls, result);
  if (missing !== null) {
    ctx.error(
      missing.decl.children[0],
      `Field \`${missing.name}\` of class \`${cls.name}\` is not definitely assigned in the constructor`
    );
  }
}
