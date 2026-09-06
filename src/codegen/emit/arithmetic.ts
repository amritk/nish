/**
 * Integer arithmetic lowering shared by every construct that computes with
 * integers (binary operators, compound assignment on locals, fields and
 * elements).
 *
 * Division follows Rust, not C: `a / b` and `a % b` on i32/i64 check the
 * divisor first and panic ("attempt to divide by zero" / "... with overflow")
 * instead of executing an `sdiv`/`srem` whose result LLVM defines as poison
 * for `b == 0` and `MIN / -1`. The check is two compares and a branch to a
 * cold block; the panic is `noreturn`, so a function containing a division
 * loses `willreturn` and is treated as writing memory, exactly like a bounds
 * check (`docs/wp4-arrays.md`).
 */
import ts from "typescript";
import { isInteger } from "../../types";
import { EmitContext, intOpcode } from "./context";
import { factCollectors } from "./members";

const INT_MIN: Record<string, string> = { i32: "-2147483648", i64: "-9223372036854775808" };

/** `<opcode> <ty> lhs, rhs` for integer types, with checked `sdiv` / `srem`. */
export function emitIntBinary(ctx: EmitContext, opcode: string, ty: string, lhs: string, rhs: string): string {
  if (opcode !== "sdiv" && opcode !== "srem") {
    return ctx.fn.emitValue(`${intOpcode(ctx, opcode)} ${ty} ${lhs}, ${rhs}`);
  }
  const fn = ctx.fn;
  const byZero = fn.emitValue(`icmp eq ${ty} ${rhs}, 0`);
  const minLhs = fn.emitValue(`icmp eq ${ty} ${lhs}, ${INT_MIN[ty]}`);
  const negOne = fn.emitValue(`icmp eq ${ty} ${rhs}, -1`);
  const overflow = fn.emitValue(`and i1 ${minLhs}, ${negOne}`);
  const bad = fn.emitValue(`or i1 ${byZero}, ${overflow}`);
  const failBlock = fn.newBlock("div.fail");
  const okBlock = fn.newBlock("div.ok");
  fn.emit(`br i1 ${bad}, label %${failBlock.label}, label %${okBlock.label}`);
  fn.placeBlock(failBlock);
  fn.emit(`call void ${ctx.useRuntime("sts_panic_div")}(i1 zeroext ${byZero})`);
  fn.emit("unreachable");
  fn.placeBlock(okBlock);
  return fn.emitValue(`${opcode} ${ty} ${lhs}, ${rhs}`);
}

const DIVISION_OPERATORS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.SlashToken,
  ts.SyntaxKind.PercentToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
]);

/** Every integer division may call the noreturn panic; `attributes.ts` needs to know. */
factCollectors.push((program, node, facts) => {
  if (!ts.isBinaryExpression(node) || !DIVISION_OPERATORS.has(node.operatorToken.kind)) return;
  const left = program.types.get(node.left);
  if (left && isInteger(left)) facts.callees.add("sts_panic_div");
});
