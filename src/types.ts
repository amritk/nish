/**
 * StaticTS type model.
 *
 * Every StaticTS type maps 1:1 onto an LLVM first-class type. There is no
 * boxing, no runtime type tags, and no structural subtyping: two values are
 * compatible only if their StaticType kinds are identical.
 */
import ts from "typescript";
import { CompileError } from "./diagnostics";

export type NumberMode = "i32" | "f64";

export interface CompilerOptions {
  /** How the TypeScript `number` keyword is lowered. Default: "i32". */
  numberMode: NumberMode;
  /**
   * Emit LLVM performance attributes (nounwind, readnone, noalias, ...) and
   * explicit alignment on memory operations. Off produces the bare Phase 1
   * output. Default: true.
   */
  optimizeAttributes: boolean;
  /** Always emit the runtime ABI prelude, even when nothing in the module uses it. */
  runtimeDecls: boolean;
  /**
   * Give non-`export`ed functions `internal` linkage so LLVM may inline,
   * specialise, or drop them. Off keeps every function external (C ABI).
   * Default: false.
   */
  strictExports: boolean;
}

export const DEFAULT_OPTIONS: CompilerOptions = {
  numberMode: "i32",
  optimizeAttributes: true,
  runtimeDecls: false,
  strictExports: false,
};

export type StaticType =
  | { kind: "i32" }
  | { kind: "i64" }
  | { kind: "f64" }
  | { kind: "bool" }
  | { kind: "string" }
  | { kind: "void" };

export const I32: StaticType = { kind: "i32" };
/** 64-bit integer (WP7). Never the lowering of `number`; always spelled `i64`. */
export const I64: StaticType = { kind: "i64" };
export const F64: StaticType = { kind: "f64" };
export const BOOL: StaticType = { kind: "bool" };
export const STRING: StaticType = { kind: "string" };
export const VOID: StaticType = { kind: "void" };

/** LLVM textual type for a StaticType. */
export function llvmType(t: StaticType): string {
  switch (t.kind) {
    case "i32":
      return "i32";
    case "i64":
      return "i64";
    case "f64":
      return "double";
    case "bool":
      return "i1";
    case "string":
      return "i8*";
    case "void":
      return "void";
  }
}

/** Natural alignment in bytes, as clang and rustc use for the same LLVM types. */
export function alignOf(t: StaticType): number {
  switch (t.kind) {
    case "i32":
      return 4;
    case "i64":
      return 8;
    case "f64":
      return 8;
    case "bool":
      return 1;
    case "string":
      return 8;
    case "void":
      return 1;
  }
}

export function typeToString(t: StaticType): string {
  return t.kind === "bool" ? "boolean" : t.kind;
}

export function sameType(a: StaticType, b: StaticType): boolean {
  return a.kind === b.kind;
}

export function isNumeric(t: StaticType): boolean {
  return t.kind === "i32" || t.kind === "i64" || t.kind === "f64";
}

/** Integer types: wrapping two's-complement arithmetic, `icmp`, `sext`/`trunc` between them. */
export function isInteger(t: StaticType): boolean {
  return t.kind === "i32" || t.kind === "i64";
}

/**
 * Resolve a TypeScript type annotation node into a StaticType.
 * Anything outside the rigid primitive set is a hard error: StaticTS refuses
 * `any`, `unknown`, unions, generics, object literals, etc.
 */
export function resolveTypeNode(
  node: ts.TypeNode,
  sourceFile: ts.SourceFile,
  opts: CompilerOptions
): StaticType {
  switch (node.kind) {
    case ts.SyntaxKind.NumberKeyword:
      return opts.numberMode === "i32" ? I32 : F64;
    case ts.SyntaxKind.BooleanKeyword:
      return BOOL;
    case ts.SyntaxKind.StringKeyword:
      return STRING;
    case ts.SyntaxKind.VoidKeyword:
      return VOID;
    case ts.SyntaxKind.AnyKeyword:
      throw new CompileError("`any` is forbidden in StaticTS", node, sourceFile);
    case ts.SyntaxKind.UnknownKeyword:
      throw new CompileError("`unknown` is forbidden in StaticTS", node, sourceFile);
    case ts.SyntaxKind.TypeReference: {
      const ref = node as ts.TypeReferenceNode;
      if (ts.isIdentifier(ref.typeName) && !ref.typeArguments) {
        switch (ref.typeName.text) {
          case "i32":
            return I32;
          case "i64":
            return I64;
          case "f64":
            return F64;
        }
      }
      throw new CompileError(
        `Unsupported type reference \`${ref.getText(sourceFile)}\` (Phase 1 supports number, i32, i64, f64, boolean, string, void)`,
        node,
        sourceFile
      );
    }
    default:
      throw new CompileError(
        `Unsupported type \`${node.getText(sourceFile)}\` (Phase 1 supports number, i32, i64, f64, boolean, string, void)`,
        node,
        sourceFile
      );
  }
}
