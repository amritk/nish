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
  /**
   * Drop the bounds check on `a[i]` (WP4). Unsafe: an out-of-range index is
   * undefined behaviour instead of a panic. For benchmarks only. Default: false.
   */
  uncheckedIndexing: boolean;
}

export const DEFAULT_OPTIONS: CompilerOptions = {
  numberMode: "i32",
  optimizeAttributes: true,
  runtimeDecls: false,
  strictExports: false,
  uncheckedIndexing: false,
};

export type StaticType =
  | { kind: "i32" }
  | { kind: "f64" }
  | { kind: "bool" }
  | { kind: "string" }
  | { kind: "void" }
  /** `T[]` / `Array<T>`: pointer to an arena header `{ i64 len, i64 cap, i8* data }` (WP4). */
  | { kind: "array"; elem: StaticType };

export const I32: StaticType = { kind: "i32" };
export const F64: StaticType = { kind: "f64" };
export const BOOL: StaticType = { kind: "bool" };
export const STRING: StaticType = { kind: "string" };
export const VOID: StaticType = { kind: "void" };

/** The one header type every array shares; see `ARRAY_TYPE` in codegen/runtime.ts. */
export const ARRAY_STRUCT = "%struct.sts_array";

export function arrayOf(elem: StaticType): StaticType {
  return { kind: "array", elem };
}

/** LLVM textual type for a StaticType. */
export function llvmType(t: StaticType): string {
  switch (t.kind) {
    case "i32":
      return "i32";
    case "f64":
      return "double";
    case "bool":
      return "i1";
    case "string":
      return "i8*";
    case "void":
      return "void";
    case "array":
      return `${ARRAY_STRUCT}*`;
  }
}

/** Natural alignment in bytes, as clang and rustc use for the same LLVM types. */
export function alignOf(t: StaticType): number {
  switch (t.kind) {
    case "i32":
      return 4;
    case "f64":
      return 8;
    case "bool":
      return 1;
    case "string":
      return 8;
    case "void":
      return 1;
    case "array":
      return 8;
  }
}

export function typeToString(t: StaticType): string {
  if (t.kind === "array") return `${typeToString(t.elem)}[]`;
  return t.kind === "bool" ? "boolean" : t.kind;
}

export function sameType(a: StaticType, b: StaticType): boolean {
  if (a.kind === "array") return b.kind === "array" && sameType(a.elem, b.elem);
  return a.kind === b.kind;
}

export function isNumeric(t: StaticType): boolean {
  return t.kind === "i32" || t.kind === "f64";
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
    case ts.SyntaxKind.ArrayType:
      return arrayOf(resolveTypeNode((node as ts.ArrayTypeNode).elementType, sourceFile, opts));
    case ts.SyntaxKind.TypeReference: {
      const ref = node as ts.TypeReferenceNode;
      if (ts.isIdentifier(ref.typeName) && ref.typeName.text === "Array") {
        if (ref.typeArguments?.length !== 1) {
          throw new CompileError("`Array` needs exactly one type argument, e.g. `Array<number>`", node, sourceFile);
        }
        return arrayOf(resolveTypeNode(ref.typeArguments[0], sourceFile, opts));
      }
      if (ts.isIdentifier(ref.typeName) && !ref.typeArguments) {
        switch (ref.typeName.text) {
          case "i32":
            return I32;
          case "f64":
            return F64;
        }
      }
      throw new CompileError(
        `Unsupported type reference \`${ref.getText(sourceFile)}\` (Phase 1 supports number, i32, f64, boolean, string, void)`,
        node,
        sourceFile
      );
    }
    default:
      throw new CompileError(
        `Unsupported type \`${node.getText(sourceFile)}\` (Phase 1 supports number, i32, f64, boolean, string, void)`,
        node,
        sourceFile
      );
  }
}
