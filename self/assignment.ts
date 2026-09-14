// Definite assignment for stage1 (`src/checker/classes.ts` pass 1c,
// docs/wp14-selfhost.md milestone S3).
//
// A class has no zero value: every field is either given a literal
// initializer or assigned by the constructor on every path, and until it is,
// reading it — or handing `this` to anything that might — is refused. That is
// what lets `new C(...)` be one allocation and a store per field, with no
// zeroing pass and no "uninitialised" state a later read has to allow for.
//
// There is no inheritance (WP25), so there is no inherited prefix and no
// `super(...)`: every field a class has is one it declares, and the whole of
// the constructor body is what assigns them.

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
const missingField = (cls: StructInfo, assigned: Assigned): FieldInfo | null => {
  for (const field of cls.fields) {
    if (!assigned.fields.has(field.name)) {
      return field;
    }
  }
  return null;
};

/** `this.name`, as a member access whose receiver is `this`. */
const thisAccess = (node: Node): boolean => node.kind === N_MEMBER && node.children[0].kind === N_THIS;

/** The fields `expr` definitely assigns: `this.a = this.b = v` assigns both. */
const assignedBy = (expr: Node, out: Assigned): void => {
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
};

/** Every use of `this` in `node` must be safe given what is assigned. */
const checkReads = (
  ctx: CheckContext,
  cls: StructInfo,
  node: Node,
  assigned: Assigned,
  isTarget: boolean
): void => {
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
};

const requireAll = (ctx: CheckContext, cls: StructInfo, assigned: Assigned, at: Node): void => {
  const missing = missingField(cls, assigned);
  if (missing !== null) {
    ctx.error(at, `Constructor of \`${cls.name}\` returns before field \`${missing.name}\` is assigned`);
  }
};

/** A statement list; the result is what is assigned after it. */
const walkStatements = (ctx: CheckContext, cls: StructInfo, stmts: Node[], assigned: Assigned): Assigned => {
  let current = assigned;
  for (const stmt of stmts) {
    if (current.terminated) {
      break; // unreachable code is reported by the body check
    }
    current = walkStatement(ctx, cls, stmt, current);
  }
  return current;
};

const walkStatement = (ctx: CheckContext, cls: StructInfo, stmt: Node, assigned: Assigned): Assigned => {
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
};

const terminated = (): Assigned => new Assigned(true);

const walkIf = (ctx: CheckContext, cls: StructInfo, stmt: Node, assigned: Assigned): Assigned => {
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
};

/**
 * A loop body may run zero times, so its assignments do not count — but every
 * read and every `return` inside it is still checked against what is known
 * before the loop.
 */
const walkLoop = (ctx: CheckContext, cls: StructInfo, head: Node, body: Node, assigned: Assigned): Assigned => {
  if (head.kind !== N_EMPTY) {
    checkReads(ctx, cls, head, assigned, false);
  }
  walkStatement(ctx, cls, body, assigned.copy());
  return assigned;
};

/**
 * Every field of `cls` is assigned by the time its constructor returns, and
 * none is read before it is. Runs after the layouts are known.
 */
export const checkDefiniteAssignment = (ctx: CheckContext, cls: StructInfo): void => {
  if (cls.kind !== STRUCT_CLASS) {
    return;
  }
  const assigned = new Assigned(false);
  let i = 0;
  while (i < cls.fields.length) {
    if (cls.fields[i].initializer !== null) {
      assigned.fields.add(cls.fields[i].name);
    }
    i = i + 1;
  }

  const ctor = cls.ctor;
  if (ctor === null) {
    i = 0;
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

  const result = walkStatements(ctx, cls, ctor.decl.children[1].children, assigned);
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
};
