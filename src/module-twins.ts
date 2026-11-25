// A module and its wasm32 twin, compared (WP89 S6).
//
// A wasm build compiles `<name>.wasm32.ts` in place of `<name>.ts` — a
// library module's twin beside it, or a package's `nish-wasm32` file in place
// of its `nish` one — so an importer is checked against whichever file its
// build picked. The two must therefore export the same names with the same
// signatures, or a program that compiles for one target stops compiling for
// the other at a call site that is nowhere near the file that changed. Both
// builds ask, so the native build refuses the pair as early as the wasm one.
//
// The comparison is of the source, not of checked types: the twin is not
// compiled by the build that does not pick it, and parsing it is the cheapest
// thing that can see its exports. A signature is the declaration's text up to
// its body or initializer with its blank runs collapsed, so a reformatted
// twin still matches and a changed parameter type does not. A constant with
// no type annotation has no such cut: its type is whatever its initializer
// gives, so the whole declaration is compared (a field, function or method
// must be annotated to parse or check at all). A class's `private` members
// are no importer's business and are skipped; its public ones are compared
// in the order they are written.

import { Node, NodeKind, FLAG_EXPORTED } from "./nodes"
import { Parser } from "./parser"
import { SourceFile } from "./diagnostics"

const TWIN_SPACE: i32 = 32
const TWIN_TAB: i32 = 9
const TWIN_NEWLINE: i32 = 10
const TWIN_RETURN: i32 = 13

/** One exported name, and the text of its declaration a twin must repeat. */
class TwinExport {
  name: string
  signature: string

  constructor(name: string, signature: string) {
    this.name = name
    this.signature = signature
  }
}

const isTwinBlank = (code: i32): boolean =>
  code === TWIN_SPACE || code === TWIN_TAB || code === TWIN_NEWLINE || code === TWIN_RETURN

/** `text[start, end)` with every blank run one space and none at either end. */
const twinCollapsed = (text: string, start: i32, end: i32): string => {
  const words: string[] = []
  let from = -1
  for (let i = start; i < end; i++) {
    if (isTwinBlank(text.charCodeAt(i))) {
      if (from >= 0) {
        words.push(text.substring(from, i))
        from = -1
      }
    } else if (from < 0) {
      from = i
    }
  }
  if (from >= 0) {
    words.push(text.substring(from, end))
  }
  return words.join(" ")
}

/** Where a declaration's signature stops: its `at`th child when that child is there, else its end. */
const cutAt = (node: Node, at: i32): i32 =>
  at < node.children.length && node.children[at].kind !== NodeKind.Empty ? node.children[at].start : node.end

/**
 * Where a field's or constant's signature stops: after its type when one is
 * written, and at its end when it is inferred, since the initializer is then
 * the type.
 */
const afterType = (node: Node): i32 =>
  node.children.length > 1 && node.children[1].kind !== NodeKind.Empty ? node.children[1].end : node.end

/** Whether a class member is private: `private` among the words before its name. */
const isPrivateMember = (text: string, member: Node): boolean => {
  if ((member.kind !== NodeKind.Method && member.kind !== NodeKind.Field) || member.children.length === 0) {
    return false
  }
  return ` ${twinCollapsed(text, member.start, member.children[0].start)} `.indexOf(" private ") >= 0
}

/**
 * A class's signature: its head up to the members, and each public member's
 * own up to its body or initializer, so a method's body may differ and its
 * parameters may not.
 */
const classSignature = (text: string, node: Node): string => {
  const members = node.children[3]
  const parts: string[] = [twinCollapsed(text, node.start, members.start)]
  for (const member of members.children) {
    if (isPrivateMember(text, member)) {
      continue
    }
    let cut = member.end
    if (member.kind === NodeKind.Method) {
      cut = cutAt(member, 3)
    } else if (member.kind === NodeKind.Constructor) {
      cut = cutAt(member, 1)
    } else if (member.kind === NodeKind.Field) {
      cut = afterType(member)
    }
    parts.push(`${twinCollapsed(text, member.start, cut)};`)
  }
  return parts.join(" ")
}

const twinDeclName = (node: Node): string => (node.children.length > 0 ? node.children[0].text : "")

/** The exports of one parsed file, in declaration order, or null when it does not parse. */
const exportsOf = (path: string, text: string): TwinExport[] | null => {
  const parser = new Parser(new SourceFile(path, text))
  const file = parser.parseSourceFile()
  if (parser.diagnostics.length > 0) {
    return null
  }
  const out: TwinExport[] = []
  for (const decl of file.children) {
    if ((decl.flags & FLAG_EXPORTED) === 0) {
      continue
    }
    if (decl.kind === NodeKind.FunctionDecl) {
      // `export const f = (): i32 => 1, g = 2` keeps `g` in a sixth child.
      const rest: Node | null = decl.children.length > 5 ? decl.children[5] : null
      const end = rest !== null && rest.kind === NodeKind.List ? rest.start : decl.end
      const cut = decl.children.length > 2 && decl.children[2].kind !== NodeKind.Empty ? cutAt(decl, 3) : end
      out.push(new TwinExport(twinDeclName(decl), twinCollapsed(text, decl.start, cut)))
      if (rest !== null && rest.kind === NodeKind.List) {
        for (const one of rest.children) {
          out.push(
            new TwinExport(twinDeclName(one), `const ${twinCollapsed(text, one.start, afterType(one))}`)
          )
        }
      }
    } else if (decl.kind === NodeKind.Class) {
      out.push(new TwinExport(twinDeclName(decl), classSignature(text, decl)))
    } else if (decl.kind === NodeKind.ModuleConst) {
      for (const one of decl.children[0].children) {
        out.push(new TwinExport(twinDeclName(one), `const ${twinCollapsed(text, one.start, afterType(one))}`))
      }
    } else if (
      decl.kind === NodeKind.Interface ||
      decl.kind === NodeKind.TypeAlias ||
      decl.kind === NodeKind.Enum
    ) {
      out.push(new TwinExport(twinDeclName(decl), twinCollapsed(text, decl.start, decl.end)))
    }
  }
  return out
}

const findExport = (list: TwinExport[], name: string): TwinExport | null => {
  for (const one of list) {
    if (one.name === name) {
      return one
    }
  }
  return null
}

/**
 * The first way the twin's exports differ from the native module's, in words
 * that finish the NL3063 sentence, or `""` when they agree. A file that does
 * not parse is not compared: the build that compiles it reports why.
 */
export const twinMismatch = (
  nativePath: string,
  nativeText: string,
  twinPath: string,
  twinText: string
): string => {
  const native = exportsOf(nativePath, nativeText)
  const twin = exportsOf(twinPath, twinText)
  if (native === null || twin === null) {
    return ""
  }
  for (const one of native) {
    const other = findExport(twin, one.name)
    if (other === null) {
      return `\`${one.name}\` is exported by \`${nativePath}\` and not by \`${twinPath}\``
    }
    if (other.signature !== one.signature) {
      return `\`${one.name}\` is \`${one.signature}\` in \`${nativePath}\` and \`${other.signature}\` in \`${twinPath}\``
    }
  }
  for (const one of twin) {
    if (findExport(native, one.name) === null) {
      return `\`${one.name}\` is exported by \`${twinPath}\` and not by \`${nativePath}\``
    }
  }
  return ""
}
