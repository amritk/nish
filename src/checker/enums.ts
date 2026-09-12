/**
 * Numeric `enum` declarations (WP23).
 *
 * An enum is a **distinct type with `i32` representation**: `enum Kind { If = 1 }`
 * declares a type called `Kind` that is compatible with nothing else, not even
 * with the `i32` it is stored as. That is stricter than TypeScript, where a
 * numeric enum member is assignable to `number`, and it has to be: the rule
 * this language is built on is that two values are compatible only when their
 * types are identical, so an enum that were silently `i32` would be the one
 * type compatible with something it is not spelled as.
 *
 * There is no lowering. A member is folded here, exactly as a module constant
 * is folded in `constants.ts`, and `Kind.If` lowers to the literal `1` — no
 * symbol, no table, no `%struct`, and not one line of IR beyond what the same
 * program written with `i32` constants already emits (`tests/cases/enum_ir`
 * and `enum_expanded` are that program twice, with one golden between them).
 *
 * Phase 0 owns the shape of a member's initialiser: `src/validator.ts`
 * (`checkEnum`) refuses anything that is not a numeric literal, so
 * `B = A + 1` and `A = "a"` never reach this file. What is left here is what
 * needs the type model: the value has to be an integer, it has to fit in
 * `i32`, and the name has to be one the module does not already use.
 */
import ts from "typescript";
import { CompileError } from "../diagnostics.js";
import { StaticType, enumOf } from "../types.js";
import { BUILTIN_TYPE_NAMES } from "./aliases.js";

/** One `enum X { ... }` declaration: its type, and every member's folded value. */
export type EnumInfo = {
  name: string;
  decl: ts.EnumDeclaration;
  /** The distinct `{ kind: "enum", name }`, shared by every annotation that names it. */
  type: StaticType;
  /**
   * Member name -> the integer it stands for, in declaration order. A member
   * is a compile-time constant, so this table is the whole of an enum's
   * existence: the emitter reads the folded value out of `enumRefs` and never
   * sees this record at all.
   */
  members: Map<string, bigint>;
};

const I32_MIN = -(2n ** 31n);
const I32_MAX = 2n ** 31n - 1n;

/**
 * The integer a member's initialiser denotes, or `undefined` when it is not an
 * integer literal. Phase 0 has already refused everything but a numeric
 * literal and its negation, so the only thing left to reject is a literal that
 * is not an integer (`1.5`) — plus, for a caller that runs the checker without
 * Phase 0, whatever else it let through.
 */
const literalValue = (expr: ts.Expression): bigint | undefined => {
  if (ts.isPrefixUnaryExpression(expr) && expr.operator === ts.SyntaxKind.MinusToken) {
    const operand = literalValue(expr.operand);
    return operand === undefined ? undefined : -operand;
  }
  // TypeScript normalises every numeric literal's text to decimal digits
  // (`0x10` reads back as `16`), so a text of digits alone is an exact integer.
  return ts.isNumericLiteral(expr) && /^\d+$/.test(expr.text) ? BigInt(expr.text) : undefined;
};

/**
 * Collect `decl`: its name, and every member's value. Auto-numbering is
 * TypeScript's — the first member without an initialiser is `0` and every
 * later one is its predecessor plus one — because that is what an `enum Kind {
 * If, While }` means everywhere else, and a subset that numbered it differently
 * would be a trap rather than a restriction.
 */
export function collectEnum(decl: ts.EnumDeclaration, sf: ts.SourceFile): EnumInfo {
  const name = decl.name.text;
  if (BUILTIN_TYPE_NAMES.has(name)) {
    throw new CompileError(
      `\`${name}\` is a built-in type name and cannot be used for an enum`,
      decl.name,
      sf
    );
  }
  if (hasModifier(decl, ts.SyntaxKind.ExportKeyword)) {
    throw new CompileError(
      "Enums cannot be exported: an enum names a type inside one module (declare it in every module that needs it)",
      decl,
      sf
    );
  }
  if (hasModifier(decl, ts.SyntaxKind.DeclareKeyword)) {
    throw new CompileError("`declare enum` is not supported", decl, sf);
  }
  if (hasModifier(decl, ts.SyntaxKind.ConstKeyword)) {
    throw new CompileError(
      "`const enum` is not supported: an enum member is already folded to its integer, so `const` would ask for nothing",
      decl,
      sf
    );
  }
  if (decl.members.length === 0) {
    throw new CompileError(`Enum \`${name}\` must declare at least one member`, decl.name, sf);
  }
  const members = new Map<string, bigint>();
  let next = 0n;
  for (const member of decl.members) {
    const memberName = memberText(member);
    if (members.has(memberName)) {
      throw new CompileError(`Duplicate member \`${memberName}\` in enum \`${name}\``, member.name, sf);
    }
    let value = next;
    if (member.initializer) {
      const literal = literalValue(member.initializer);
      if (literal === undefined) {
        throw new CompileError(
          `Enum member \`${name}.${memberName}\` must be an integer literal`,
          member.initializer,
          sf
        );
      }
      value = literal;
    }
    if (value < I32_MIN || value > I32_MAX) {
      throw new CompileError(`Enum member \`${name}.${memberName}\` does not fit in i32`, member, sf);
    }
    members.set(memberName, value);
    next = value + 1n;
  }
  return { name, decl, type: enumOf(name), members };
}

/**
 * The member's name as it is written. Every spelling of a property name
 * carries its text, except a computed one — and that is already Phase 0's
 * `Computed property names are forbidden`, so the empty string it falls back
 * to is a name nothing can reach.
 */
const memberText = (member: ts.EnumMember): string =>
  ts.isComputedPropertyName(member.name) ? "" : member.name.text;

const hasModifier = (decl: ts.EnumDeclaration, kind: ts.SyntaxKind): boolean =>
  ts.getModifiers(decl)?.some((m) => m.kind === kind) === true;
