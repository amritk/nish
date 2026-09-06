/**
 * Phase C: LLVM IR emission.
 *
 * An AST visitor that lowers a *checked* program into LLVM IR text. Because
 * the checker already resolved every type and binding, this file contains no
 * error handling for user mistakes: any node it sees is known to be valid.
 *
 * Lowering rules (Phase 1):
 *   - Parameters are immutable and used directly as SSA values (`%a`).
 *   - `let`/`const` locals get an `alloca` slot in the entry block; reads are
 *     `load`s and writes are `store`s. `opt -mem2reg` turns these back into
 *     pure SSA registers.
 *   - Every expression lowers to a single LLVM value (a temp, a param name,
 *     or a constant).
 */
import ts from "typescript";
import { CheckedProgram, FunctionSig, LocalVar } from "../checker";
import { StaticType, llvmType } from "../types";
import { IRFunction, IRModule } from "./ir";

export class Emitter {
  private readonly module: IRModule;
  private fn!: IRFunction;
  /** Local variable -> its alloca slot (`%x.addr`). */
  private slots = new WeakMap<LocalVar, string>();

  constructor(private readonly program: CheckedProgram) {
    this.module = new IRModule(program.sourceFile.fileName);
  }

  emitModule(): string {
    for (const sig of this.program.functions) {
      this.module.addFunction(this.emitFunction(sig));
    }
    return this.module.toString();
  }

  // ---- Functions ----------------------------------------------------------

  private emitFunction(sig: FunctionSig): IRFunction {
    this.fn = new IRFunction(
      sig.name,
      sig.params.map((p) => ({ name: p.name, type: llvmType(p.type) })),
      llvmType(sig.returnType)
    );
    this.slots = new WeakMap();

    this.emitBlock(sig.decl.body!);

    // Void functions may fall off the end; give them an explicit terminator.
    if (!this.fn.currentBlock.terminated) {
      this.fn.emit("ret void");
    }
    return this.fn;
  }

  // ---- Statements ---------------------------------------------------------

  private emitBlock(block: ts.Block): void {
    for (const stmt of block.statements) this.emitStatement(stmt);
  }

  private emitStatement(stmt: ts.Statement): void {
    if (ts.isReturnStatement(stmt)) {
      if (!stmt.expression) {
        this.fn.emit("ret void");
        return;
      }
      const type = this.typeOf(stmt.expression);
      const value = this.emitExpression(stmt.expression);
      this.fn.emit(`ret ${llvmType(type)} ${value}`);
      return;
    }

    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        const local = this.program.locals.get(decl)!;
        const ty = llvmType(local.type);
        const slot = this.fn.emitAlloca(`${local.name}.addr`, ty);
        this.slots.set(local, slot);
        const init = this.emitExpression(decl.initializer!);
        this.fn.emit(`store ${ty} ${init}, ${ty}* ${slot}`);
      }
      return;
    }

    if (ts.isExpressionStatement(stmt)) {
      this.emitExpression(stmt.expression);
      return;
    }

    if (ts.isBlock(stmt)) {
      this.emitBlock(stmt);
      return;
    }

    throw new Error(`emitter: unexpected statement ${ts.SyntaxKind[stmt.kind]}`);
  }

  // ---- Expressions --------------------------------------------------------

  /** Lower an expression and return the LLVM value that holds its result. */
  private emitExpression(expr: ts.Expression): string {
    if (ts.isParenthesizedExpression(expr)) {
      return this.emitExpression(expr.expression);
    }

    if (ts.isNumericLiteral(expr)) {
      return this.numericConstant(expr.text, this.typeOf(expr));
    }

    if (expr.kind === ts.SyntaxKind.TrueKeyword) return "true";
    if (expr.kind === ts.SyntaxKind.FalseKeyword) return "false";

    if (ts.isIdentifier(expr)) {
      const local = this.program.bindings.get(expr)!;
      if (local.storage === "param") return `%${local.name}`;
      const ty = llvmType(local.type);
      return this.fn.emitValue(`load ${ty}, ${ty}* ${this.slots.get(local)!}`);
    }

    if (ts.isPrefixUnaryExpression(expr)) {
      const type = this.typeOf(expr.operand);
      const operand = this.emitExpression(expr.operand);
      if (expr.operator === ts.SyntaxKind.MinusToken) {
        return type.kind === "f64"
          ? this.fn.emitValue(`fneg double ${operand}`)
          : this.fn.emitValue(`sub i32 0, ${operand}`);
      }
      if (expr.operator === ts.SyntaxKind.ExclamationToken) {
        return this.fn.emitValue(`xor i1 ${operand}, true`);
      }
      throw new Error(`emitter: unexpected unary operator`);
    }

    if (ts.isBinaryExpression(expr)) {
      return this.emitBinary(expr);
    }

    if (ts.isCallExpression(expr)) {
      const callee = this.program.callees.get(expr)!;
      const args = expr.arguments
        .map((arg, i) => `${llvmType(callee.params[i].type)} ${this.emitExpression(arg)}`)
        .join(", ");
      const ret = llvmType(callee.returnType);
      const call = `call ${ret} @${callee.name}(${args})`;
      if (callee.returnType.kind === "void") {
        this.fn.emit(call);
        return "void";
      }
      return this.fn.emitValue(call);
    }

    throw new Error(`emitter: unexpected expression ${ts.SyntaxKind[expr.kind]}`);
  }

  private emitBinary(expr: ts.BinaryExpression): string {
    const op = expr.operatorToken.kind;

    if (op === ts.SyntaxKind.EqualsToken) {
      const target = this.program.bindings.get(expr.left as ts.Identifier)!;
      const ty = llvmType(target.type);
      const value = this.emitExpression(expr.right);
      this.fn.emit(`store ${ty} ${value}, ${ty}* ${this.slots.get(target)!}`);
      return value;
    }

    const operandType = this.typeOf(expr.left);
    const ty = llvmType(operandType);
    // Operand order matters: evaluate left before right, as JS does.
    const lhs = this.emitExpression(expr.left);
    const rhs = this.emitExpression(expr.right);

    const opcode = binaryOpcode(op, operandType);
    return this.fn.emitValue(`${opcode} ${ty} ${lhs}, ${rhs}`);
  }

  // ---- Helpers ------------------------------------------------------------

  private typeOf(expr: ts.Expression): StaticType {
    const t = this.program.types.get(expr);
    if (!t) throw new Error(`emitter: no type recorded for ${ts.SyntaxKind[expr.kind]}`);
    return t;
  }

  private numericConstant(text: string, type: StaticType): string {
    const n = Number(text);
    if (type.kind === "i32") return String(n | 0);
    // LLVM only accepts decimal float literals that round-trip exactly, so
    // emit the IEEE-754 bit pattern instead; that is always valid.
    const buf = Buffer.alloc(8);
    buf.writeDoubleBE(n);
    return "0x" + buf.toString("hex").toUpperCase();
  }
}

function binaryOpcode(op: ts.SyntaxKind, type: StaticType): string {
  const float = type.kind === "f64";
  switch (op) {
    case ts.SyntaxKind.PlusToken:
      return float ? "fadd" : "add";
    case ts.SyntaxKind.MinusToken:
      return float ? "fsub" : "sub";
    case ts.SyntaxKind.AsteriskToken:
      return float ? "fmul" : "mul";
    case ts.SyntaxKind.SlashToken:
      return float ? "fdiv" : "sdiv";
    case ts.SyntaxKind.PercentToken:
      return float ? "frem" : "srem";
    case ts.SyntaxKind.LessThanToken:
      return float ? "fcmp olt" : "icmp slt";
    case ts.SyntaxKind.LessThanEqualsToken:
      return float ? "fcmp ole" : "icmp sle";
    case ts.SyntaxKind.GreaterThanToken:
      return float ? "fcmp ogt" : "icmp sgt";
    case ts.SyntaxKind.GreaterThanEqualsToken:
      return float ? "fcmp oge" : "icmp sge";
    case ts.SyntaxKind.EqualsEqualsEqualsToken:
      return float ? "fcmp oeq" : "icmp eq";
    case ts.SyntaxKind.ExclamationEqualsEqualsToken:
      return float ? "fcmp une" : "icmp ne";
  }
  throw new Error(`emitter: unexpected binary operator ${ts.SyntaxKind[op]}`);
}

export function emitProgram(program: CheckedProgram): string {
  return new Emitter(program).emitModule();
}
