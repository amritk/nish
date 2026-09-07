/**
 * Integer arithmetic lowering shared by every construct that computes with
 * integers (binary operators, compound assignment on locals, fields and
 * elements).
 *
 * LLVM has no unsigned types, so signedness lives entirely in the opcode:
 * `u8`/`u16`/`u32`/`u64` are `i8`/`i16`/`i32`/`i64` and `signedOpcode` swaps
 * `sdiv`/`srem`/`icmp s*`/`ashr` for `udiv`/`urem`/`icmp u*`/`lshr` when the
 * operand type is unsigned. `add`, `sub` and `mul` are the same instruction
 * for both signednesses (two's complement), which is why an unsigned type
 * costs nothing to represent (WP15).
 *
 * Division follows Rust, not C: `a / b` and `a % b` check the divisor first
 * and panic ("attempt to divide by zero" / "... with overflow") instead of
 * executing a division whose result LLVM defines as poison. The *signed*
 * check tests two things, a zero divisor and `MIN / -1`; unsigned division
 * has no overflow case at all, so its check is a single compare against zero
 * (`tests/cases/u_div_one_check`). Either way the panic is `noreturn`, so a
 * function containing a division loses `willreturn` and is treated as writing
 * memory, exactly like a bounds check (`docs/wp4-arrays.md`).
 */
import ts from "typescript";
import { StaticType, isInteger, isUnsigned, llvmType } from "../../types";
import { EmitContext, intOpcode } from "./context";
import { factCollectors } from "./members";

const INT_MIN: Record<string, string> = { i32: "-2147483648", i64: "-9223372036854775808" };

/**
 * The unsigned instruction that means on an unsigned type what the signed one
 * means on a signed type. Anything absent (`add`, `sub`, `mul`, `icmp eq`,
 * `icmp ne`, the bitwise ops) is bit-identical for both signednesses.
 */
const UNSIGNED_OPCODES: Readonly<Record<string, string>> = {
  sdiv: "udiv",
  srem: "urem",
  ashr: "lshr",
  "icmp slt": "icmp ult",
  "icmp sle": "icmp ule",
  "icmp sgt": "icmp ugt",
  "icmp sge": "icmp uge",
};

/** Pick the signed or unsigned form of `opcode` for `type` (WP15). */
export function signedOpcode(opcode: string, type: StaticType): string {
  return isUnsigned(type) ? (UNSIGNED_OPCODES[opcode] ?? opcode) : opcode;
}

const DIVISIONS = new Set(["sdiv", "srem", "udiv", "urem"]);

/**
 * `<opcode> <ty> lhs, rhs` for an integer type, with the checked division
 * described above. `opcode` is the *signed* spelling; the unsigned form is
 * selected from `type`, so every caller can name one opcode per operator.
 */
export function emitIntBinary(
  ctx: EmitContext,
  opcode: string,
  type: StaticType,
  lhs: string,
  rhs: string
): string {
  const ty = llvmType(type);
  const op = signedOpcode(opcode, type);
  if (!DIVISIONS.has(op)) return ctx.fn.emitValue(`${intOpcode(ctx, op, type)} ${ty} ${lhs}, ${rhs}`);

  const fn = ctx.fn;
  const byZero = fn.emitValue(`icmp eq ${ty} ${rhs}, 0`);
  // Unsigned division cannot overflow: there is no value whose negation is out
  // of range, so `MIN / -1` has no unsigned counterpart and one compare decides.
  let bad = byZero;
  if (!isUnsigned(type)) {
    const minLhs = fn.emitValue(`icmp eq ${ty} ${lhs}, ${INT_MIN[ty]}`);
    const negOne = fn.emitValue(`icmp eq ${ty} ${rhs}, -1`);
    const overflow = fn.emitValue(`and i1 ${minLhs}, ${negOne}`);
    bad = fn.emitValue(`or i1 ${byZero}, ${overflow}`);
  }
  const failBlock = fn.newBlock("div.fail");
  const okBlock = fn.newBlock("div.ok");
  fn.emit(`br i1 ${bad}, label %${failBlock.label}, label %${okBlock.label}`);
  fn.placeBlock(failBlock);
  fn.emit(`call void ${ctx.useRuntime("sts_panic_div")}(i1 zeroext ${byZero})`);
  fn.emit("unreachable");
  fn.placeBlock(okBlock);
  return fn.emitValue(`${op} ${ty} ${lhs}, ${rhs}`);
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
