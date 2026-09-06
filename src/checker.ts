/**
 * Phase B: Static-TS validation and type checking.
 *
 * Walks the AST, enforces the StaticTS language rules, and records the
 * StaticType of every expression in a side table (`TypeMap`) that the IR
 * emitter consumes. The emitter never has to re-derive types.
 */
import ts from "typescript";
import { CompileError } from "./diagnostics";
import {
  BOOL,
  CompilerOptions,
  I32,
  F64,
  StaticType,
  VOID,
  isNumeric,
  resolveTypeNode,
  sameType,
  typeToString,
} from "./types";

export interface Param {
  name: string;
  type: StaticType;
}

export interface FunctionSig {
  name: string;
  params: Param[];
  returnType: StaticType;
  decl: ts.FunctionDeclaration;
}

export interface LocalVar {
  name: string;
  type: StaticType;
  mutable: boolean;
  /** `param` locals are SSA values; `local` ones live in an alloca slot. */
  storage: "param" | "local";
}

export interface CheckedProgram {
  sourceFile: ts.SourceFile;
  functions: FunctionSig[];
  /** Expression node -> resolved StaticType. */
  types: WeakMap<ts.Node, StaticType>;
  /** Identifier node -> the variable it refers to. */
  bindings: WeakMap<ts.Identifier, LocalVar>;
  /** VariableDeclaration node -> the local it introduces. */
  locals: WeakMap<ts.VariableDeclaration, LocalVar>;
  /** CallExpression node -> callee signature. */
  callees: WeakMap<ts.CallExpression, FunctionSig>;
}

class Scope {
  private vars = new Map<string, LocalVar>();
  constructor(private parent?: Scope) {}
  lookup(name: string): LocalVar | undefined {
    return this.vars.get(name) ?? this.parent?.lookup(name);
  }
  declare(v: LocalVar, node: ts.Node, sf: ts.SourceFile): void {
    if (this.vars.has(v.name)) {
      throw new CompileError(`Duplicate declaration of \`${v.name}\``, node, sf);
    }
    this.vars.set(v.name, v);
  }
}

const ARITH_OPS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.PlusToken,
  ts.SyntaxKind.MinusToken,
  ts.SyntaxKind.AsteriskToken,
  ts.SyntaxKind.SlashToken,
  ts.SyntaxKind.PercentToken,
]);

const COMPARE_OPS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
]);

export class Checker {
  private readonly sf: ts.SourceFile;
  private readonly program: CheckedProgram;
  private readonly sigs = new Map<string, FunctionSig>();
  private current!: FunctionSig;

  constructor(sourceFile: ts.SourceFile, private readonly opts: CompilerOptions) {
    this.sf = sourceFile;
    this.program = {
      sourceFile,
      functions: [],
      types: new WeakMap(),
      bindings: new WeakMap(),
      locals: new WeakMap(),
      callees: new WeakMap(),
    };
  }

  check(): CheckedProgram {
    // Pass 1: collect signatures so functions can call each other in any order.
    for (const stmt of this.sf.statements) {
      if (ts.isFunctionDeclaration(stmt)) {
        const sig = this.collectSignature(stmt);
        if (this.sigs.has(sig.name)) {
          throw new CompileError(`Duplicate function \`${sig.name}\``, stmt, this.sf);
        }
        this.sigs.set(sig.name, sig);
        this.program.functions.push(sig);
      } else {
        throw new CompileError(
          `Only top-level function declarations are supported in Phase 1 (found ${ts.SyntaxKind[stmt.kind]})`,
          stmt,
          this.sf
        );
      }
    }
    // Pass 2: check bodies.
    for (const sig of this.program.functions) {
      this.checkFunctionBody(sig);
    }
    return this.program;
  }

  // ---- Declarations -------------------------------------------------------

  private collectSignature(decl: ts.FunctionDeclaration): FunctionSig {
    const sf = this.sf;
    if (!decl.name) throw new CompileError("Functions must be named", decl, sf);
    if (!decl.body) throw new CompileError("Functions must have a body", decl, sf);
    if (decl.typeParameters) {
      throw new CompileError("Generic functions are not supported", decl, sf);
    }
    if (decl.asteriskToken) throw new CompileError("Generators are not supported", decl, sf);
    if (decl.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) {
      throw new CompileError("async functions are not supported", decl, sf);
    }
    if (!decl.type) {
      throw new CompileError(
        `Function \`${decl.name.text}\` needs an explicit return type annotation`,
        decl.name,
        sf
      );
    }

    const params: Param[] = [];
    const seen = new Set<string>();
    for (const p of decl.parameters) {
      if (!ts.isIdentifier(p.name)) {
        throw new CompileError("Destructured parameters are not supported", p, sf);
      }
      if (p.dotDotDotToken) throw new CompileError("Rest parameters are not supported", p, sf);
      if (p.questionToken || p.initializer) {
        throw new CompileError("Optional/default parameters are not supported", p, sf);
      }
      if (!p.type) {
        throw new CompileError(`Parameter \`${p.name.text}\` needs a type annotation`, p, sf);
      }
      if (seen.has(p.name.text)) {
        throw new CompileError(`Duplicate parameter \`${p.name.text}\``, p, sf);
      }
      seen.add(p.name.text);
      params.push({ name: p.name.text, type: resolveTypeNode(p.type, sf, this.opts) });
    }

    return {
      name: decl.name.text,
      params,
      returnType: resolveTypeNode(decl.type, sf, this.opts),
      decl,
    };
  }

  private checkFunctionBody(sig: FunctionSig): void {
    this.current = sig;
    const scope = new Scope();
    sig.decl.parameters.forEach((p, i) => {
      const v: LocalVar = {
        name: sig.params[i].name,
        type: sig.params[i].type,
        mutable: false,
        storage: "param",
      };
      scope.declare(v, p, this.sf);
    });

    const body = sig.decl.body!;
    const terminates = this.checkBlock(body, scope);
    if (sig.returnType.kind !== "void" && !terminates) {
      throw new CompileError(
        `Function \`${sig.name}\` must return a value of type ${typeToString(sig.returnType)} on every path`,
        sig.decl.name!,
        this.sf
      );
    }
  }

  // ---- Statements ---------------------------------------------------------

  /** Returns true if the block definitely returns. */
  private checkBlock(block: ts.Block, scope: Scope): boolean {
    let terminated = false;
    for (const stmt of block.statements) {
      if (terminated) {
        throw new CompileError("Unreachable code after return", stmt, this.sf);
      }
      terminated = this.checkStatement(stmt, scope);
    }
    return terminated;
  }

  private checkStatement(stmt: ts.Statement, scope: Scope): boolean {
    const sf = this.sf;
    if (ts.isReturnStatement(stmt)) {
      const want = this.current.returnType;
      if (!stmt.expression) {
        if (want.kind !== "void") {
          throw new CompileError(`Expected a return value of type ${typeToString(want)}`, stmt, sf);
        }
        return true;
      }
      const got = this.checkExpression(stmt.expression, scope);
      if (!sameType(got, want)) {
        throw new CompileError(
          `Return type mismatch: function returns ${typeToString(want)} but expression is ${typeToString(got)}`,
          stmt.expression,
          sf
        );
      }
      return true;
    }

    if (ts.isVariableStatement(stmt)) {
      const list = stmt.declarationList;
      const isVar = !(list.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const));
      if (isVar) throw new CompileError("`var` is forbidden; use `let` or `const`", stmt, sf);
      const mutable = (list.flags & ts.NodeFlags.Const) === 0;
      for (const decl of list.declarations) {
        if (!ts.isIdentifier(decl.name)) {
          throw new CompileError("Destructuring is not supported", decl, sf);
        }
        if (!decl.initializer) {
          throw new CompileError(`Variable \`${decl.name.text}\` must be initialized`, decl, sf);
        }
        const initType = this.checkExpression(decl.initializer, scope);
        let type = initType;
        if (decl.type) {
          type = resolveTypeNode(decl.type, sf, this.opts);
          if (!sameType(type, initType)) {
            throw new CompileError(
              `Cannot initialize ${typeToString(type)} variable \`${decl.name.text}\` with ${typeToString(initType)}`,
              decl.initializer,
              sf
            );
          }
        }
        if (type.kind === "void") {
          throw new CompileError("Cannot declare a variable of type void", decl, sf);
        }
        const v: LocalVar = { name: decl.name.text, type, mutable, storage: "local" };
        scope.declare(v, decl.name, sf);
        this.program.locals.set(decl, v);
      }
      return false;
    }

    if (ts.isExpressionStatement(stmt)) {
      this.checkExpression(stmt.expression, scope);
      return false;
    }

    if (ts.isBlock(stmt)) {
      return this.checkBlock(stmt, new Scope(scope));
    }

    throw new CompileError(
      `Unsupported statement in Phase 1: ${ts.SyntaxKind[stmt.kind]}`,
      stmt,
      sf
    );
  }

  // ---- Expressions --------------------------------------------------------

  private checkExpression(expr: ts.Expression, scope: Scope): StaticType {
    const t = this.computeType(expr, scope);
    this.program.types.set(expr, t);
    return t;
  }

  private computeType(expr: ts.Expression, scope: Scope): StaticType {
    const sf = this.sf;

    if (ts.isParenthesizedExpression(expr)) {
      return this.checkExpression(expr.expression, scope);
    }

    if (ts.isNumericLiteral(expr)) {
      if (this.opts.numberMode === "i32") {
        const n = Number(expr.text);
        if (!Number.isInteger(n)) {
          throw new CompileError(
            `Non-integer literal \`${expr.text}\` in i32 number mode (use --number-mode f64)`,
            expr,
            sf
          );
        }
        if (n > 0x7fffffff) {
          throw new CompileError(`Literal \`${expr.text}\` does not fit in i32`, expr, sf);
        }
        return I32;
      }
      return F64;
    }

    if (expr.kind === ts.SyntaxKind.TrueKeyword || expr.kind === ts.SyntaxKind.FalseKeyword) {
      return BOOL;
    }

    if (ts.isIdentifier(expr)) {
      const v = scope.lookup(expr.text);
      if (!v) throw new CompileError(`Unknown identifier \`${expr.text}\``, expr, sf);
      this.program.bindings.set(expr, v);
      return v.type;
    }

    if (ts.isPrefixUnaryExpression(expr)) {
      const operand = this.checkExpression(expr.operand, scope);
      if (expr.operator === ts.SyntaxKind.MinusToken && isNumeric(operand)) return operand;
      if (expr.operator === ts.SyntaxKind.ExclamationToken && operand.kind === "bool") return BOOL;
      throw new CompileError(
        `Unsupported unary operator \`${ts.tokenToString(expr.operator)}\` on ${typeToString(operand)}`,
        expr,
        sf
      );
    }

    if (ts.isBinaryExpression(expr)) {
      const op = expr.operatorToken.kind;

      if (op === ts.SyntaxKind.EqualsToken) {
        if (!ts.isIdentifier(expr.left)) {
          throw new CompileError("Only simple variables can be assigned", expr.left, sf);
        }
        const target = scope.lookup(expr.left.text);
        if (!target) throw new CompileError(`Unknown identifier \`${expr.left.text}\``, expr.left, sf);
        if (!target.mutable) {
          throw new CompileError(
            `Cannot assign to \`${target.name}\` because it is a ${target.storage === "param" ? "parameter" : "const"}`,
            expr.left,
            sf
          );
        }
        this.program.bindings.set(expr.left, target);
        const rhs = this.checkExpression(expr.right, scope);
        if (!sameType(rhs, target.type)) {
          throw new CompileError(
            `Cannot assign ${typeToString(rhs)} to ${typeToString(target.type)} variable \`${target.name}\``,
            expr.right,
            sf
          );
        }
        return target.type;
      }

      const lhs = this.checkExpression(expr.left, scope);
      const rhs = this.checkExpression(expr.right, scope);
      const opText = ts.tokenToString(op);

      if (ARITH_OPS.has(op)) {
        if (!isNumeric(lhs) || !sameType(lhs, rhs)) {
          throw new CompileError(
            `Operator \`${opText}\` requires two operands of the same numeric type, got ${typeToString(lhs)} and ${typeToString(rhs)}`,
            expr,
            sf
          );
        }
        return lhs;
      }
      if (COMPARE_OPS.has(op)) {
        if (!sameType(lhs, rhs) || lhs.kind === "void" || lhs.kind === "string") {
          throw new CompileError(
            `Operator \`${opText}\` requires two operands of the same primitive type, got ${typeToString(lhs)} and ${typeToString(rhs)}`,
            expr,
            sf
          );
        }
        return BOOL;
      }
      if (op === ts.SyntaxKind.EqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsToken) {
        throw new CompileError("Loose equality is forbidden; use === / !==", expr, sf);
      }
      throw new CompileError(`Unsupported binary operator \`${opText}\``, expr, sf);
    }

    if (ts.isCallExpression(expr)) {
      if (!ts.isIdentifier(expr.expression)) {
        throw new CompileError("Only direct calls to named functions are supported", expr, sf);
      }
      const callee = this.sigs.get(expr.expression.text);
      if (!callee) {
        throw new CompileError(`Unknown function \`${expr.expression.text}\``, expr.expression, sf);
      }
      if (expr.arguments.length !== callee.params.length) {
        throw new CompileError(
          `\`${callee.name}\` expects ${callee.params.length} argument(s), got ${expr.arguments.length}`,
          expr,
          sf
        );
      }
      expr.arguments.forEach((arg, i) => {
        const t = this.checkExpression(arg, scope);
        if (!sameType(t, callee.params[i].type)) {
          throw new CompileError(
            `Argument ${i + 1} of \`${callee.name}\`: expected ${typeToString(callee.params[i].type)}, got ${typeToString(t)}`,
            arg,
            sf
          );
        }
      });
      this.program.callees.set(expr, callee);
      return callee.returnType;
    }

    throw new CompileError(`Unsupported expression in Phase 1: ${ts.SyntaxKind[expr.kind]}`, expr, sf);
  }
}

export function checkProgram(sourceFile: ts.SourceFile, opts: CompilerOptions): CheckedProgram {
  return new Checker(sourceFile, opts).check();
}

// Re-exported for convenience of downstream phases.
export { VOID };
