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
  /**
   * Target triple (WP9). When set, the module carries `target datalayout` and
   * `target triple` so `opt`/`llc` run with the right layout and vector width
   * without `-mtriple`. Undefined keeps the IR target-neutral. Default: undefined.
   */
  target?: string;
  /**
   * Emit `nsw` on i32/i64 `add`/`sub`/`mul` (WP9): signed overflow becomes
   * undefined behaviour, as in C (Rust release builds wrap instead), so LLVM
   * may assume induction variables and address arithmetic never wrap.
   * Default: false (wrapping, the documented StaticTS semantics).
   */
  nsw: boolean;
}

export const DEFAULT_OPTIONS: CompilerOptions = {
  numberMode: "i32",
  optimizeAttributes: true,
  runtimeDecls: false,
  strictExports: false,
  uncheckedIndexing: false,
  target: undefined,
  nsw: false,
};

export type StaticType =
  | { kind: "i32" }
  | { kind: "i64" }
  | { kind: "f64" }
  | { kind: "bool" }
  | { kind: "string" }
  | { kind: "void" }
  /** `T[]` / `Array<T>`: pointer to an arena header `{ i64 len, i64 cap, i8* data }` (WP4). */
  | { kind: "array"; elem: StaticType }
  /** A class or interface (WP2): a pointer to `%struct.<name>`, always arena-allocated and 8-aligned. */
  | { kind: "struct"; name: string };

export const I32: StaticType = { kind: "i32" };
/** 64-bit integer (WP7). Never the lowering of `number`; always spelled `i64`. */
export const I64: StaticType = { kind: "i64" };
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
    case "array":
      return `${ARRAY_STRUCT}*`;
    case "struct":
      return `%struct.${t.name}*`;
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
    case "array":
      return 8;
    case "struct":
      return 8; // a pointer
  }
}

export function typeToString(t: StaticType): string {
  if (t.kind === "array") return `${typeToString(t.elem)}[]`;
  if (t.kind === "struct") return t.name;
  return t.kind === "bool" ? "boolean" : t.kind;
}

export function sameType(a: StaticType, b: StaticType): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "struct") return a.name === (b as { name: string }).name;
  if (a.kind === "array") return sameType(a.elem, (b as { elem: StaticType }).elem);
  return true;
}

export function isNumeric(t: StaticType): boolean {
  return t.kind === "i32" || t.kind === "i64" || t.kind === "f64";
}

/** Integer types: wrapping two's-complement arithmetic, `icmp`, `sext`/`trunc` between them. */
export function isInteger(t: StaticType): boolean {
  return t.kind === "i32" || t.kind === "i64";
}

/**
 * Named types (classes and interfaces, WP2) are declared per module. The
 * checker registers a resolver for its source file before it resolves any
 * annotation, and `resolveTypeNode` consults it for a bare `TypeReference`.
 * Keying the registry by `SourceFile` keeps the signature of `resolveTypeNode`
 * unchanged for every caller, including recursive ones (element types of
 * arrays, for instance) that would otherwise have to thread a lookup through.
 */
export type NamedTypeResolver = (name: string) => StaticType | undefined;
const namedTypeResolvers = new WeakMap<ts.SourceFile, NamedTypeResolver>();

export function registerNamedTypes(sourceFile: ts.SourceFile, resolver: NamedTypeResolver): void {
  namedTypeResolvers.set(sourceFile, resolver);
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
          case "i64":
            return I64;
          case "f64":
            return F64;
        }
        const named = namedTypeResolvers.get(sourceFile)?.(ref.typeName.text);
        if (named) return named;
      }
      throw new CompileError(
        `Unsupported type reference \`${ref.getText(sourceFile)}\` (supported: number, i32, i64, f64, boolean, string, void, T[], and declared classes/interfaces)`,
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
