/**
 * The type model.
 *
 * Every type maps 1:1 onto an LLVM first-class type. There is no
 * boxing, no runtime type tags, and no structural subtyping: two values are
 * compatible only if their StaticType kinds are identical.
 */
import ts from "typescript";
import { LANGUAGE } from "./branding";
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
   * specialise, or drop them. Off (`--no-strict-exports`) keeps every function
   * external (C ABI), which is what a program whose C driver calls a
   * non-exported function needs. Default: true (WP15 §3).
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
   * Emit `nsw` on signed `add`/`sub`/`mul` (WP9, defaulted on by WP15 §3):
   * signed overflow becomes undefined behaviour, as in C, so LLVM may widen
   * induction variables and strength-reduce loops. Off (`--wrapping`) restores
   * two's-complement wrapping, which is what a program that counts on
   * `2147483647 + 1 === -2147483648` needs. Unsigned arithmetic is defined as
   * wrapping either way and never carries a no-wrap flag. Default: true.
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
  strictExports: true,
  uncheckedIndexing: false,
  target: undefined,
  nsw: true,
  stackAlloc: true,
  debugInfo: false,
};

export type StaticType =
  | { kind: "i32" }
  | { kind: "i64" }
  /**
   * Unsigned integers (WP15). They share the LLVM types of the signed widths
   * (`u8`/`u16`/`u32`/`u64` are `i8`/`i16`/`i32`/`i64`), because LLVM has no
   * signedness: it lives in the *operations* (`udiv`, `icmp ult`, `lshr`,
   * `zext`, `uitofp`), which is why an unsigned type costs nothing to
   * represent. See `docs/LANGUAGE.md` -> "Unsigned integers".
   */
  | { kind: "u8" }
  | { kind: "u16" }
  | { kind: "u32" }
  | { kind: "u64" }
  /**
   * 32-bit IEEE-754 (WP15). `float` in LLVM: half the footprint of an `f64`
   * and twice the SIMD lane count, which is why a struct of coordinates or a
   * buffer of samples wants it. It never mixes with `f64` implicitly, exactly
   * as `i32` never mixes with `i64`.
   */
  | { kind: "f32" }
  | { kind: "f64" }
  | { kind: "bool" }
  | { kind: "string" }
  | { kind: "void" }
  /**
   * `T[]` / `Array<T>`: pointer to an arena header `{ i64 len, i64 cap, i8* data }` (WP4).
   *
   * `readonly` marks the `readonly T[]` / `ReadonlyArray<T>` spelling, which is
   * the *same* header, the same pointer and the same LLVM type — the flag
   * changes nothing about the value and everything about who may write through
   * it. A mutable array widens into a readonly sink (`assignable`) and never
   * back, so a callee that declares one cannot store, `push` or `pop`, and the
   * C header can spell the parameter `const amrit_array *` because the
   * signature said so rather than because the whole-program fixpoint happened
   * to prove it (`src/interop/abi.ts`). It is shallow, as TypeScript's is: the
   * element of a `readonly T[][]` is a mutable `T[]`.
   */
  | { kind: "array"; elem: StaticType; readonly?: true }
  /** A class or interface (WP2): a pointer to `%struct.<name>`, always arena-allocated and 8-aligned. */
  | { kind: "struct"; name: string }
  /**
   * `T | null` (WP6) for a pointer type `T` (struct, array, string): the same
   * LLVM pointer type, with `null` as an extra value. The only operations are
   * `=== null` / `!== null`, assignment, passing, and narrowing to `T` inside
   * `if (p !== null)`; everything else is a checker error.
   */
  | { kind: "nullable"; inner: StaticType }
  /**
   * `Result<T, E>` (WP16): the one way a function reports failure.
   * A pointer to a monomorphised `%struct.amrit_result.<T>.<E>` holding the
   * `ok` discriminant, the success payload and the error payload, so a
   * `Result` costs exactly what a class costs and the escape analysis stack-
   * allocates the ones that do not outlive their function.
   *
   * `state` is a *checker-only* refinement, not part of the layout: an
   * un-narrowed value is `"unknown"` and neither payload can be read; inside
   * `if (r.ok)` it reads as `"ok"` and `r.value` is legal; in the other
   * branch it reads as `"err"` and `r.error` is legal. `sameType` ignores it
   * for exactly that reason — the LLVM value is the same pointer either way.
   * See `src/checker/result.ts` and `docs/LANGUAGE.md` -> "Result and error handling".
   */
  | { kind: "result"; ok: StaticType; err: StaticType; state: ResultState };

/**
 * What the checker has proved about a `Result` value at one use site.
 * `"unknown"` is the declared state of every `Result`; the narrowing engine
 * (`src/checker/narrowing.ts`) produces the other two from an `r.ok` test.
 */
export type ResultState = "unknown" | "ok" | "err";

/** The `Result` member of `StaticType`, for handlers a dispatch table already selected. */
export type ResultType = Extract<StaticType, { kind: "result" }>;

export const I32: StaticType = { kind: "i32" };
/** 64-bit integer (WP7). Never the lowering of `number`; always spelled `i64`. */
export const I64: StaticType = { kind: "i64" };
export const U8: StaticType = { kind: "u8" };
export const U16: StaticType = { kind: "u16" };
export const U32: StaticType = { kind: "u32" };
export const U64: StaticType = { kind: "u64" };
export const F32: StaticType = { kind: "f32" };
export const F64: StaticType = { kind: "f64" };
export const BOOL: StaticType = { kind: "bool" };
export const STRING: StaticType = { kind: "string" };
export const VOID: StaticType = { kind: "void" };

/** The one header type every array shares; see `ARRAY_TYPE` in codegen/runtime.ts. */
export const ARRAY_STRUCT = "%struct.amrit_array";

export function arrayOf(elem: StaticType): StaticType {
  return { kind: "array", elem };
}

/** `readonly T[]` / `ReadonlyArray<T>`: `T[]`'s layout, with every write rejected. */
export function readonlyArrayOf(elem: StaticType): StaticType {
  return { kind: "array", elem, readonly: true };
}

/** True for the `readonly T[]` spelling of an array type; false for every other type. */
export function isReadonlyArray(t: StaticType): boolean {
  return t.kind === "array" && t.readonly === true;
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
  Float32Array: F32,
  Float64Array: F64,
  BigInt64Array: I64,
};

/** True for the types that may be nullable: every value that is an LLVM pointer. */
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

// ---- `Result<T, E>` (WP16) --------------------------------------------------

export function resultOf(ok: StaticType, err: StaticType, state: ResultState = "unknown"): StaticType {
  return { kind: "result", ok, err, state };
}

/** The same `Result` type read under a different proof; the LLVM value is unchanged. */
export function withResultState(t: StaticType, state: ResultState): StaticType {
  return t.kind === "result" ? { kind: "result", ok: t.ok, err: t.err, state } : t;
}

/**
 * A prefix-coded name for a type, so that one LLVM struct is monomorphised
 * per distinct `Result<T, E>` and two different `Result`s can never share a
 * layout. Every constructor writes its tag before its operands (`arr.i32`,
 * `res.i32.str`), which makes the encoding unambiguous without separators
 * of its own: `res.res.i32.str.str` can only be read one way.
 *
 * A class or interface name is prefixed with `$` because that character
 * cannot appear in a TypeScript identifier, so `Result<Foo, string>` cannot
 * collide with a `Result` over a class that happens to be called `res`.
 */
export function mangleType(t: StaticType): string {
  switch (t.kind) {
    case "string":
      return "str";
    case "bool":
      return "bool";
    case "array":
      return `arr.${mangleType(t.elem)}`;
    case "nullable":
      return `opt.${mangleType(t.inner)}`;
    case "struct":
      return `$${t.name}`;
    case "result":
      return `res.${mangleType(t.ok)}.${mangleType(t.err)}`;
    default:
      return t.kind;
  }
}

/** The LLVM struct name (without the `%struct.` prefix) backing a `Result` type. */
export function resultStructName(t: StaticType): string {
  if (t.kind !== "result") throw new Error(`resultStructName: not a Result type (${t.kind})`);
  return `amrit_result.${mangleType(t.ok)}.${mangleType(t.err)}`;
}

/**
 * WP17: the payload types the packed by-value `Result` word can carry — a
 * scalar of at most four bytes, so that a discriminant word and a payload
 * word together are one `i64`. `i64`, `u64` and `f64` are four bytes too
 * many; a string, an array, a class, a nullable or a nested `Result` is a
 * pointer, and a pointer payload would need the whole word on its own.
 */
function packablePayload(t: StaticType): boolean {
  switch (t.kind) {
    case "void":
    case "bool":
    case "u8":
    case "u16":
    case "i32":
    case "u32":
    case "f32":
      return true;
    default:
      return false;
  }
}

/**
 * WP17: whether a `Result` is returned by value, in one `i64`, rather than as
 * the WP16 pointer to an arena struct.
 *
 *   bits  0..31   the discriminant: 1 for `Ok`, 0 for `Err`
 *   bits 32..63   the live arm's payload, zero-extended
 *
 * The dead arm is not represented, which is what makes `Result<i32, i32>` —
 * twelve bytes as a struct — fit in a word. Eight bytes is not a tuning knob:
 * `i64` is the only return width whose C-ABI lowering is the same LLVM type on
 * all six supported triples (`__int128` is `{ i64, i64 }` on x86-64 and `i128`
 * elsewhere; an eight-byte C struct is `i64` on the four native ones and
 * `sret` on wasm32). See `docs/wp17-result-abi.md` §1-2 for the measurements.
 */
export function resultByValue(t: StaticType): boolean {
  return t.kind === "result" && packablePayload(t.ok) && packablePayload(t.err);
}

/** Bit position of the payload in the packed word; the tag owns the low half. */
export const RESULT_PAYLOAD_SHIFT = 32;

/** LLVM textual type for a StaticType. */
export function llvmType(t: StaticType): string {
  switch (t.kind) {
    case "i32":
      return "i32";
    case "i64":
      return "i64";
    case "u8":
      return "i8";
    case "u16":
      return "i16";
    case "u32":
      return "i32";
    case "u64":
      return "i64";
    case "f32":
      return "float";
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
    case "result":
      return `%struct.${resultStructName(t)}*`;
  }
}

/**
 * LLVM type at a call boundary — a parameter or a return slot. It differs
 * from `llvmType` for exactly one shape: a `Result` small enough to pack
 * travels in a register as an `i64` (WP17), never as a pointer to arena
 * memory. Every other type is what it is.
 */
export function llvmAbiType(t: StaticType): string {
  return resultByValue(t) ? "i64" : llvmType(t);
}

/** Natural alignment in bytes, as clang and rustc use for the same LLVM types. */
export function alignOf(t: StaticType): number {
  switch (t.kind) {
    case "i32":
      return 4;
    case "i64":
      return 8;
    case "u8":
      return 1;
    case "u16":
      return 2;
    case "u32":
      return 4;
    case "u64":
      return 8;
    case "f32":
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
    case "struct":
      return 8; // a pointer
    case "nullable":
      return 8; // a pointer
    case "result":
      return 8; // a pointer
  }
}

export function typeToString(t: StaticType): string {
  if (t.kind === "array") return `${t.readonly === true ? "readonly " : ""}${typeToString(t.elem)}[]`;
  if (t.kind === "struct") return t.name;
  if (t.kind === "nullable") return `${typeToString(t.inner)} | null`;
  if (t.kind === "result") return `Result<${typeToString(t.ok)}, ${typeToString(t.err)}>`;
  return t.kind === "bool" ? "boolean" : t.kind;
}

export function sameType(a: StaticType, b: StaticType): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "struct") return a.name === (b as { name: string }).name;
  if (a.kind === "array") {
    const other = b as { elem: StaticType; readonly?: true };
    return a.readonly === other.readonly && sameType(a.elem, other.elem);
  }
  if (a.kind === "nullable") return sameType(a.inner, (b as { inner: StaticType }).inner);
  // `state` is a proof about one use site, not part of the type: a `Result`
  // narrowed to its `ok` arm is the same value, and the same LLVM pointer, as
  // the un-narrowed one it came from (WP16).
  if (a.kind === "result") {
    const other = b as { ok: StaticType; err: StaticType };
    return sameType(a.ok, other.ok) && sameType(a.err, other.err);
  }
  return true;
}

/**
 * A `T[]` where a `readonly T[]` is wanted. One direction only: handing a
 * mutable array to something that promises not to write through it is safe,
 * and the reverse would launder the promise away. The LLVM value is the same
 * pointer either way, so nothing is emitted for the conversion.
 */
function widensToReadonlyArray(from: StaticType, to: StaticType): boolean {
  return to.kind === "array" && to.readonly === true && from.kind === "array" && sameType(from.elem, to.elem);
}

/**
 * `from` may be stored where `to` is expected: identical types, a `T` where
 * `T | null` is expected (the pointer is the same LLVM value), or a mutable
 * array where a `readonly T[]` is expected. Used by every value sink:
 * initializers, assignments, returns, arguments, fields, pushes, elements.
 */
export function assignable(from: StaticType, to: StaticType): boolean {
  if (sameType(from, to) || widensToReadonlyArray(from, to)) return true;
  if (to.kind === "nullable") return sameType(from, to.inner) || widensToReadonlyArray(from, to.inner);
  return false;
}

export function isNumeric(t: StaticType): boolean {
  return isInteger(t) || isFloat(t);
}

/**
 * IEEE-754 types (WP15). Every float lowering (`fadd`, `fcmp o*`, `fneg`,
 * `fptrunc`/`fpext`, `sitofp`) is the same instruction at both widths, so
 * almost every site that used to test `kind === "f64"` tests this instead;
 * only the LLVM type name and the constant encoding differ.
 */
export function isFloat(t: StaticType): boolean {
  return t.kind === "f32" || t.kind === "f64";
}

/**
 * Integer widths in bits. The map doubles as the membership test for "is this
 * an integer type", so a width added here becomes an integer everywhere at
 * once: `isInteger`, `intBits`, and through them the whole conversion matrix.
 */
const INT_BITS: Readonly<Partial<Record<StaticType["kind"], number>>> = {
  i32: 32,
  i64: 64,
  u8: 8,
  u16: 16,
  u32: 32,
  u64: 64,
};

/** Integer types: wrapping two's-complement arithmetic, `icmp`, `sext`/`zext`/`trunc` between them. */
export function isInteger(t: StaticType): boolean {
  return INT_BITS[t.kind] !== undefined;
}

/**
 * Unsigned integer types (WP15). Signedness is not part of the LLVM type, so
 * this predicate is what every lowering consults to pick `udiv` over `sdiv`,
 * `icmp ult` over `icmp slt`, `lshr` over `ashr`, `zext` over `sext`, and
 * `uitofp` over `sitofp`.
 */
export function isUnsigned(t: StaticType): boolean {
  return t.kind === "u8" || t.kind === "u16" || t.kind === "u32" || t.kind === "u64";
}

/** Width in bits of an integer type; `0` for everything else. */
export function intBits(t: StaticType): number {
  return INT_BITS[t.kind] ?? 0;
}

/**
 * Largest value an unsigned type can hold, as a `bigint` so that `u64` is
 * exact. Only meaningful for the unsigned widths; `isUnsigned` gates callers.
 */
export function unsignedMax(t: StaticType): bigint {
  return (1n << BigInt(intBits(t))) - 1n;
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
 * Anything outside the rigid primitive set is a hard error: the language refuses
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
      throw new CompileError(`\`any\` is forbidden in ${LANGUAGE}`, node, sourceFile);
    case ts.SyntaxKind.UnknownKeyword:
      throw new CompileError(`\`unknown\` is forbidden in ${LANGUAGE}`, node, sourceFile);
    case ts.SyntaxKind.ArrayType:
      return arrayOf(resolveTypeNode((node as ts.ArrayTypeNode).elementType, sourceFile, opts));
    case ts.SyntaxKind.TypeOperator: {
      // `readonly T[]`. TypeScript itself allows the modifier on nothing else
      // (TS1354, "only permitted on array and tuple literal types"), so a
      // `readonly` on anything here means the source is not TypeScript either
      // and the message says which rule it broke rather than "unsupported".
      const op = node as ts.TypeOperatorNode;
      if (op.operator !== ts.SyntaxKind.ReadonlyKeyword) {
        // `keyof T`, `unique symbol`: no rule of their own, so the generic
        // "unsupported type" message the default arm prints is the right one.
        throw new CompileError(
          `Unsupported type \`${node.getText(sourceFile)}\` (Phase 1 supports number, i32, i64, u8, u16, u32, u64, f32, f64, boolean, string, void)`,
          node,
          sourceFile
        );
      }
      const inner = resolveTypeNode(op.type, sourceFile, opts);
      if (inner.kind !== "array") {
        throw new CompileError(
          `\`readonly\` is only permitted on an array type, got ${typeToString(inner)}`,
          node,
          sourceFile
        );
      }
      return readonlyArrayOf(inner.elem);
    }
    case ts.SyntaxKind.ParenthesizedType:
      return resolveTypeNode((node as ts.ParenthesizedTypeNode).type, sourceFile, opts);
    case ts.SyntaxKind.UnionType:
      return resolveNullableUnion(node as ts.UnionTypeNode, sourceFile, opts);
    case ts.SyntaxKind.TypeReference: {
      const ref = node as ts.TypeReferenceNode;
      if (ts.isIdentifier(ref.typeName) && ref.typeName.text === "Result") {
        return resolveResult(ref, sourceFile, opts);
      }
      if (ts.isIdentifier(ref.typeName) && ref.typeName.text === "Array") {
        if (ref.typeArguments?.length !== 1) {
          throw new CompileError("`Array` needs exactly one type argument, e.g. `Array<number>`", node, sourceFile);
        }
        return arrayOf(resolveTypeNode(ref.typeArguments[0], sourceFile, opts));
      }
      // `ReadonlyArray<T>` is `readonly T[]`, the way `Array<T>` is `T[]`.
      if (ts.isIdentifier(ref.typeName) && ref.typeName.text === "ReadonlyArray") {
        if (ref.typeArguments?.length !== 1) {
          throw new CompileError(
            "`ReadonlyArray` needs exactly one type argument, e.g. `ReadonlyArray<number>`",
            node,
            sourceFile
          );
        }
        return readonlyArrayOf(resolveTypeNode(ref.typeArguments[0], sourceFile, opts));
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
          case "u8":
            return U8;
          case "u16":
            return U16;
          case "u32":
            return U32;
          case "u64":
            return U64;
          case "f32":
            return F32;
          case "f64":
            return F64;
        }
        const alias = TYPED_ARRAY_ALIASES[ref.typeName.text];
        if (alias) return arrayOf(alias);
        const named = namedTypeResolvers.get(sourceFile)?.(ref.typeName.text);
        if (named) return named;
      }
      throw new CompileError(
        `Unsupported type reference \`${ref.getText(sourceFile)}\` (supported: number, i32, i64, u8, u16, u32, u64, f32, f64, boolean, string, void, T[], Result<T, E>, Int32Array/Float64Array/BigInt64Array, and declared classes/interfaces)`,
        node,
        sourceFile
      );
    }
    default:
      throw new CompileError(
        `Unsupported type \`${node.getText(sourceFile)}\` (Phase 1 supports number, i32, i64, u8, u16, u32, u64, f32, f64, boolean, string, void)`,
        node,
        sourceFile
      );
  }
}

/**
 * `Result<T, E>` (WP16). Written like a generic, but there are no user
 * generics in the language: this is one built-in type constructor whose two
 * arguments pick a monomorphised layout, exactly as `Array<T>` does.
 *
 * `T` may be `void` — `Result<void, E>` is the fallible operation that has
 * nothing to hand back, and it carries no `value` field at all. `E` may not
 * be, because a failure that says nothing is what `panic` is for.
 */
function resolveResult(ref: ts.TypeReferenceNode, sourceFile: ts.SourceFile, opts: CompilerOptions): StaticType {
  if (ref.typeArguments?.length !== 2) {
    throw new CompileError(
      "`Result` needs exactly two type arguments, e.g. `Result<number, string>`",
      ref,
      sourceFile
    );
  }
  const ok = resolveTypeNode(ref.typeArguments[0], sourceFile, opts);
  const err = resolveTypeNode(ref.typeArguments[1], sourceFile, opts);
  if (err.kind === "void") {
    throw new CompileError(
      "`Result<T, void>` is not supported: an error must carry a value (use `Result<T, string>`)",
      ref.typeArguments[1],
      sourceFile
    );
  }
  return resultOf(ok, err);
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
    throw new CompileError(
      `Union types other than \`T | null\` are forbidden in ${LANGUAGE}`,
      node,
      sourceFile
    );
  }
  const inner = resolveTypeNode(members[0], sourceFile, opts);
  if (inner.kind === "result") {
    throw new CompileError(
      "`Result<T, E> | null` is not supported: a `Result` already models absence through its error arm",
      node,
      sourceFile
    );
  }
  if (!isPointerType(inner)) {
    throw new CompileError(
      `\`${typeToString(inner)} | null\` is not supported: only class, interface, array, and string types can be nullable (a scalar has no null value)`,
      node,
      sourceFile
    );
  }
  return nullableOf(inner);
}
