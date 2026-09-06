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
   * Lower allocations that provably do not outlive their function to entry-block
   * `alloca`s instead of arena bumps (WP6, `src/codegen/escape.ts`). Off keeps
   * every `new`, object literal and array literal in the arena (`--no-stack-alloc`,
   * for debugging). Default: true.
   */
  stackAlloc: boolean;
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
  /**
   * Emit DWARF debug metadata (`-g`, WP10): a compile unit, a `DISubprogram`
   * per function, a `DILocation` on every instruction, and `DILocalVariable`s
   * for parameters and locals (`src/codegen/debug.ts`). Off leaves the IR
   * byte-for-byte unchanged. Default: false.
   */
  debugInfo: boolean;
}

export const DEFAULT_OPTIONS: CompilerOptions = {
  numberMode: "i32",
  optimizeAttributes: true,
  runtimeDecls: false,
  strictExports: false,
  uncheckedIndexing: false,
  target: undefined,
  nsw: false,
  stackAlloc: true,
  debugInfo: false,
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
  | { kind: "struct"; name: string }
  /**
   * `T | null` (WP6) for a pointer type `T` (struct, array, string): the same
   * LLVM pointer type, with `null` as an extra value. The only operations are
   * `=== null` / `!== null`, assignment, passing, and narrowing to `T` inside
   * `if (p !== null)`; everything else is a checker error.
   */
  | { kind: "nullable"; inner: StaticType };

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

/**
 * Typed-array aliases (WP4/WP8 interop): the JavaScript typed-array names are
 * accepted as spellings of the element-typed array. They are the *same*
 * StaticType (`sameType(Int32Array, i32[])` holds), so there is no second
 * layout; the names exist so a signature reads like the buffer a Node host
 * passes (`Int32Array` views map onto `{ len, cap, data }` byte for byte).
 */
export const TYPED_ARRAY_ALIASES: Readonly<Record<string, StaticType>> = {
  Int32Array: I32,
  Float64Array: F64,
  BigInt64Array: I64,
};

/** True for the types that may be nullable: every StaticTS value that is an LLVM pointer. */
export function isPointerType(t: StaticType): boolean {
  return t.kind === "struct" || t.kind === "array" || t.kind === "string";
}

export function nullableOf(inner: StaticType): StaticType {
  return inner.kind === "nullable" ? inner : { kind: "nullable", inner };
}

/** `T` for `T | null`; any other type unchanged. */
export function stripNull(t: StaticType): StaticType {
  return t.kind === "nullable" ? t.inner : t;
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
    case "nullable":
      return llvmType(t.inner);
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
    case "nullable":
      return 8; // a pointer
  }
}

export function typeToString(t: StaticType): string {
  if (t.kind === "array") return `${typeToString(t.elem)}[]`;
  if (t.kind === "struct") return t.name;
  if (t.kind === "nullable") return `${typeToString(t.inner)} | null`;
  return t.kind === "bool" ? "boolean" : t.kind;
}

export function sameType(a: StaticType, b: StaticType): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "struct") return a.name === (b as { name: string }).name;
  if (a.kind === "array") return sameType(a.elem, (b as { elem: StaticType }).elem);
  if (a.kind === "nullable") return sameType(a.inner, (b as { inner: StaticType }).inner);
  return true;
}

/**
 * `from` may be stored where `to` is expected: identical types, or a `T`
 * where `T | null` is expected (the pointer is the same LLVM value). Used by
 * every value sink: initializers, assignments, returns, arguments, fields,
 * pushes, elements.
 */
export function assignable(from: StaticType, to: StaticType): boolean {
  return sameType(from, to) || (to.kind === "nullable" && sameType(from, to.inner));
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
    case ts.SyntaxKind.ParenthesizedType:
      return resolveTypeNode((node as ts.ParenthesizedTypeNode).type, sourceFile, opts);
    case ts.SyntaxKind.UnionType:
      return resolveNullableUnion(node as ts.UnionTypeNode, sourceFile, opts);
    case ts.SyntaxKind.TypeReference: {
      const ref = node as ts.TypeReferenceNode;
      if (ts.isIdentifier(ref.typeName) && ref.typeName.text === "Array") {
        if (ref.typeArguments?.length !== 1) {
          throw new CompileError("`Array` needs exactly one type argument, e.g. `Array<number>`", node, sourceFile);
        }
        return arrayOf(resolveTypeNode(ref.typeArguments[0], sourceFile, opts));
      }
      if (ts.isIdentifier(ref.typeName) && ref.typeArguments && TYPED_ARRAY_ALIASES[ref.typeName.text]) {
        throw new CompileError(
          `\`${ref.typeName.text}\` takes no type argument (it is an alias of \`${typeToString(TYPED_ARRAY_ALIASES[ref.typeName.text])}[]\`)`,
          node,
          sourceFile
        );
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
        const alias = TYPED_ARRAY_ALIASES[ref.typeName.text];
        if (alias) return arrayOf(alias);
        const named = namedTypeResolvers.get(sourceFile)?.(ref.typeName.text);
        if (named) return named;
      }
      throw new CompileError(
        `Unsupported type reference \`${ref.getText(sourceFile)}\` (supported: number, i32, i64, f64, boolean, string, void, T[], Int32Array/Float64Array/BigInt64Array, and declared classes/interfaces)`,
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

function isNullTypeNode(t: ts.TypeNode): boolean {
  return ts.isLiteralTypeNode(t) && t.literal.kind === ts.SyntaxKind.NullKeyword;
}

/**
 * `T | null` (WP6): the validator already rejects every other union, so this
 * only has to find the non-null member and require it to be a pointer type.
 */
function resolveNullableUnion(node: ts.UnionTypeNode, sourceFile: ts.SourceFile, opts: CompilerOptions): StaticType {
  const members = node.types.filter((t) => !isNullTypeNode(t));
  if (members.length !== 1 || node.types.length !== 2) {
    throw new CompileError("Union types other than `T | null` are forbidden in StaticTS", node, sourceFile);
  }
  const inner = resolveTypeNode(members[0], sourceFile, opts);
  if (!isPointerType(inner)) {
    throw new CompileError(
      `\`${typeToString(inner)} | null\` is not supported: only class, interface, array, and string types can be nullable (a scalar has no null value)`,
      node,
      sourceFile
    );
  }
  return nullableOf(inner);
}
