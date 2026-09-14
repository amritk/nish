/**
 * Module-level `type` aliases (WP23).
 *
 * An alias is not a type of its own: `type Byte = u8` says that `Byte` and
 * `u8` are two spellings of one type, exactly as `Int32Array` is a spelling of
 * `i32[]` (`src/types.ts`, `TYPED_ARRAY_ALIASES`). So there is no new
 * `StaticType` kind, `sameType` never sees the alias's name, and the emitter
 * is untouched: the same program written with and without its aliases produces
 * byte-identical IR (`tests/cases/type_alias_ir` and `type_alias_expanded`).
 *
 * Resolution is lazy and memoised, for the two reasons a module constant's
 * fold is (`src/checker/constants.ts`): an alias may name a class declared
 * further down the file, and one that names itself has to be caught rather
 * than followed forever.
 */
import ts from "typescript";
import { CompileError } from "../diagnostics.js";
import { CPTR_NAME, CompilerOptions, StaticType, TYPED_ARRAY_ALIASES, resolveTypeNode } from "../types.js";

/** One `type X = T;` declaration, and its resolution once something has asked for it. */
export type AliasInfo = {
  name: string;
  decl: ts.TypeAliasDeclaration;
  /** Memoised resolution; `"resolving"` while in progress, which is how a cycle is caught. */
  type?: StaticType | "resolving";
};

/**
 * The names a declared type may not take, shared with `enums.ts` (WP23). A
 * type keyword (`string`, `number`) is resolved by `resolveTypeNode` from the
 * syntax alone and a type reference (`i32`, `Result`) before the module's own
 * names are consulted, so an alias or an enum spelled with one of these would
 * simply never be looked at — silently, which is the part worth refusing.
 */
export const BUILTIN_TYPE_NAMES: ReadonlySet<string> = new Set([
  // resolved from the keyword's SyntaxKind, never as a name
  "number",
  "boolean",
  "string",
  "void",
  "any",
  "unknown",
  "undefined",
  "never",
  // resolved as a type reference, before any declared name
  "i32",
  "i64",
  "u8",
  "u16",
  "u32",
  "u64",
  "f32",
  "f64",
  "Array",
  "ReadonlyArray",
  "Result",
  // WP27 S2. `resolveTypeNode` answers `CPtr` before it consults a declared
  // name, so an alias under it would never be looked at -- silently, which is
  // the part this set exists to refuse.
  CPTR_NAME,
  ...Object.keys(TYPED_ARRAY_ALIASES),
]);

/**
 * Register `decl` under its name. Nothing is resolved here: the right-hand
 * side may name a class or another alias that pass 1 has not reached yet.
 */
export function collectAlias(decl: ts.TypeAliasDeclaration, sf: ts.SourceFile): AliasInfo {
  const name = decl.name.text;
  if (BUILTIN_TYPE_NAMES.has(name)) {
    throw new CompileError(
      `\`${name}\` is a built-in type name and cannot be used for a type alias`,
      decl.name,
      sf
    );
  }
  if (hasExportKeyword(decl)) {
    throw new CompileError(
      "Type aliases cannot be exported: an alias names a type inside one module (declare it in every module that needs it)",
      decl,
      sf
    );
  }
  return { name, decl };
}

/**
 * The type `info` names, resolved once. A second reference gets the memo, and
 * a reference reached from `info`'s own right-hand side is the cycle.
 */
export function aliasType(info: AliasInfo, opts: CompilerOptions): StaticType {
  const sf = info.decl.getSourceFile();
  if (info.type === "resolving") {
    throw new CompileError(`Type alias \`${info.name}\` is defined in terms of itself`, info.decl, sf);
  }
  if (info.type !== undefined) return info.type;
  info.type = "resolving";
  try {
    const resolved = resolveTypeNode(info.decl.type, sf, opts);
    info.type = resolved;
    return resolved;
  } catch (e) {
    // Clear the mark so a second reference reports the same error rather than
    // a spurious cycle, exactly as `constValue` does with a failed fold.
    info.type = undefined;
    throw e;
  }
}

const hasExportKeyword = (decl: ts.TypeAliasDeclaration): boolean =>
  ts.getModifiers(decl)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) === true;
