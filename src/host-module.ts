// A host module (WP50 §3): the page's own TypeScript, which a wasm module
// imports its host functions from. The page owns the file and may write
// anything TypeScript allows in it, so it is not checked as a program: only
// what it *exports* is read, and only the shapes a host function's signature
// can take.
//
// **The file is read without TypeScript's parser.** The compiler lexes it with
// its own lexer, keeps `export function` signatures, `export enum`s and
// `export type X = HostHandle<"k">` aliases, and blanks everything else to
// spaces, newlines kept, so every offset the parser and the diagnostics see is
// the one the page wrote. A function body and any code not exported is skipped
// as balanced brackets, which is what lets the page write JSX-free TypeScript
// of any kind there. Two things cannot be skipped that way: a regular
// expression literal, which the lexer has no token for and which can hold an
// unbalanced bracket, and text the lexer refuses. Both are NL3049, which says
// to move the code into a module the host file imports, where it is never read.
//
// After the parse, each exported function is made foreign with its body
// emptied: the call is a wasm import from module `host`, and the signature is
// held to what crosses (`hostSignatureProblems`, then `checkHostSignature` in
// `src/declarations.ts` once the types resolve).

import { Lexer } from "./lexer"
import {
  FLAG_ASYNC,
  FLAG_EXPORTED,
  FLAG_FOREIGN,
  N_EMPTY,
  N_ENUM,
  N_FUNCTION,
  N_TYPE_ALIAS,
  N_TYPE_ARRAY,
  N_TYPE_FUNCTION,
  N_TYPE_PAREN,
  N_TYPE_READONLY,
  N_TYPE_REF,
  Node,
} from "./nodes"
import { StringSet } from "./map"
import { Parser } from "./parser"
import { StringBuilder } from "./strings"
import {
  TOK_ARROW,
  TOK_ASSIGN,
  TOK_CASE,
  TOK_COLON,
  TOK_COMMA,
  TOK_CONST,
  TOK_DO,
  TOK_DOT,
  TOK_ELSE,
  TOK_END,
  TOK_ERROR,
  TOK_EXPORT,
  TOK_EXTENDS,
  TOK_FUNCTION,
  TOK_GT,
  TOK_IDENT,
  TOK_LBRACE,
  TOK_LBRACKET,
  TOK_LPAREN,
  TOK_LT,
  TOK_MINUS_MINUS,
  TOK_NEW,
  TOK_PIPE,
  TOK_PLUS,
  TOK_PLUS_PLUS,
  TOK_AMP,
  TOK_QUESTION,
  TOK_QUESTION_QUESTION,
  TOK_OR_OR_ASSIGN,
  TOK_EQ_LOOSE,
  TOK_STAR_STAR_ASSIGN,
  TOK_RBRACE,
  TOK_RBRACKET,
  TOK_RETURN,
  TOK_RPAREN,
  TOK_SEMICOLON,
  TOK_SLASH,
  TOK_SLASH_ASSIGN,
  TOK_STRING,
  TOK_TEMPLATE_HEAD,
  TOK_TEMPLATE_MIDDLE,
  TOK_TEMPLATE_TAIL,
  TOK_THROW,
  TOK_USHR_ASSIGN,
} from "./tokens"

/**
 * One exported host function the build cannot import, and why: reported only
 * when a Nish module imports `name`, since a page's file may export what the
 * page alone calls.
 */
export class HostRefusal {
  name: string
  message: string
  start: i32
  end: i32

  constructor(name: string, message: string, start: i32, end: i32) {
    this.name = name
    this.message = message
    this.start = start
    this.end = end
  }
}

/**
 * What `hostModuleText` read: the blanked text, or an NL3049 message and its
 * span; and the functions it blanked for a signature no import can hold.
 */
export class HostText {
  text: string
  problem: string
  start: i32
  end: i32
  refusals: HostRefusal[]

  constructor(text: string, problem: string, start: i32, end: i32) {
    this.text = text
    this.problem = problem
    this.start = start
    this.end = end
    this.refusals = []
  }
}

/** NL3049: what the reader cannot skip, and where it goes instead. */
const unreadable = (what: string): string =>
  `${what} in a host module: its exports are read without TypeScript's parser, so move that code into a module the host file imports`

/**
 * Words after which a `/` begins an operand, so a regular expression, rather
 * than dividing: the operators that take one on the right.
 */
const REGEX_WORDS = (): StringSet => {
  const words = new StringSet()
  for (const word of ["typeof", "void", "delete", "in", "instanceof", "yield", "await", "of"]) {
    words.add(word)
  }
  return words
}

/**
 * Whether a `/` after a token of `kind` (`TOK_END` at the start of the file)
 * begins a regular expression. After an operand — a name, a literal, `)`,
 * `]` or a template's tail — it divides; after anything else it cannot, so
 * the lexer's `/` there is a regex it has no token for.
 */
const regexPosition = (kind: i32, value: string, words: StringSet): boolean => {
  if (kind === TOK_IDENT) {
    return words.has(value)
  }
  if (kind === TOK_PLUS_PLUS || kind === TOK_MINUS_MINUS) {
    return false
  }
  // Every operator, `++` and `--` apart: `+` to `>>>=`, `==` to `**=`, and
  // `??` to `||=` (`src/tokens.ts` numbers them in those three runs).
  if (
    (kind >= TOK_PLUS && kind <= TOK_USHR_ASSIGN) ||
    (kind >= TOK_EQ_LOOSE && kind <= TOK_STAR_STAR_ASSIGN) ||
    (kind >= TOK_QUESTION_QUESTION && kind <= TOK_OR_OR_ASSIGN)
  ) {
    return true
  }
  return (
    kind === TOK_END ||
    kind === TOK_LPAREN ||
    kind === TOK_LBRACKET ||
    kind === TOK_LBRACE ||
    kind === TOK_RBRACE ||
    kind === TOK_COMMA ||
    kind === TOK_SEMICOLON ||
    kind === TOK_COLON ||
    kind === TOK_QUESTION ||
    kind === TOK_ARROW ||
    kind === TOK_RETURN ||
    kind === TOK_CASE ||
    kind === TOK_THROW ||
    kind === TOK_ELSE ||
    kind === TOK_DO ||
    kind === TOK_NEW ||
    kind === TOK_TEMPLATE_HEAD ||
    kind === TOK_TEMPLATE_MIDDLE
  )
}

const opens = (kind: i32): boolean =>
  kind === TOK_LPAREN || kind === TOK_LBRACKET || kind === TOK_LBRACE || kind === TOK_TEMPLATE_HEAD
const closes = (kind: i32): boolean =>
  kind === TOK_RPAREN || kind === TOK_RBRACKET || kind === TOK_RBRACE || kind === TOK_TEMPLATE_TAIL

/**
 * Whether a `{` after a token of `kind` opens an object *type* rather than a
 * function's body: after `:`, `|`, `&`, `<`, `,`, `=>`, `(`, `[`, `?`,
 * `extends` or `=` it is written where a type goes.
 */
const typePosition = (kind: i32): boolean =>
  kind === TOK_EXTENDS ||
  kind === TOK_ASSIGN ||
  kind === TOK_COLON ||
  kind === TOK_PIPE ||
  kind === TOK_AMP ||
  kind === TOK_LT ||
  kind === TOK_COMMA ||
  kind === TOK_ARROW ||
  kind === TOK_LPAREN ||
  kind === TOK_LBRACKET ||
  kind === TOK_QUESTION

/** The tokens of one file, in four parallel arrays. */
class Tokens {
  kinds: i32[]
  starts: i32[]
  ends: i32[]
  values: string[]

  constructor() {
    this.kinds = []
    this.starts = []
    this.ends = []
    this.values = []
  }
}

/**
 * `text` with a leading byte order mark as blanks of the same length, so the
 * offsets stay the page's. An editor may save one and tsc reads past it; the
 * lexer would take it into the first word and lose the first export.
 */
const withoutByteOrderMark = (text: string): string => {
  const mark = "\uFEFF"
  if (!text.startsWith(mark)) {
    return text
  }
  const blanks: string[] = []
  let i = 0
  while (i < mark.length) {
    blanks.push(" ")
    i = i + 1
  }
  return `${blanks.join("")}${text.slice(mark.length)}`
}

/**
 * The text a host module is parsed as: `text` with everything but its exported
 * signatures blanked, offsets unchanged. `problem` is NL3049's or NL2661's
 * message when the file holds what the reader cannot skip, and the text is
 * then the original.
 */
export const hostModuleText = (page: string): HostText => {
  const text = withoutByteOrderMark(page)
  const tokens = new Tokens()
  const lexer = new Lexer(text)
  const words = REGEX_WORDS()
  let previous = TOK_END
  let previousValue = ""
  lexer.next()
  while (lexer.kind !== TOK_END) {
    if (lexer.kind === TOK_ERROR) {
      return new HostText(text, unreadable(`Text that does not lex (${lexer.value})`), lexer.start, lexer.end)
    }
    if (
      (lexer.kind === TOK_SLASH || lexer.kind === TOK_SLASH_ASSIGN) &&
      regexPosition(previous, previousValue, words)
    ) {
      // `</` is JSX's closing tag, which the reader cannot skip either.
      const what = previous === TOK_LT ? "JSX" : "A regular expression literal"
      return new HostText(text, unreadable(what), lexer.start, lexer.end)
    }
    tokens.kinds.push(lexer.kind)
    tokens.starts.push(lexer.start)
    tokens.ends.push(lexer.end)
    tokens.values.push(lexer.kind === TOK_IDENT ? lexer.value : "")
    previous = lexer.kind
    previousValue = lexer.kind === TOK_IDENT ? lexer.value : ""
    lexer.next()
  }
  return keepExports(text, tokens)
}

/** The index of the token that closes the bracket opened at `i`, or the last token when it never closes. */
const closing = (tokens: Tokens, i: i32): i32 => {
  let depth = 0
  let k = i
  while (k < tokens.kinds.length) {
    if (opens(tokens.kinds[k])) {
      depth = depth + 1
    } else if (closes(tokens.kinds[k])) {
      depth = depth - 1
      if (depth === 0) {
        return k
      }
    }
    k = k + 1
  }
  return tokens.kinds.length - 1
}

/** The ranges of `text` kept, as pairs of token indices, first and last inclusive. */
class Kept {
  firsts: i32[]
  lasts: i32[]
  refusals: HostRefusal[]

  constructor() {
    this.firsts = []
    this.lasts = []
    this.refusals = []
  }

  keep(first: i32, last: i32): void {
    this.firsts.push(first)
    this.lasts.push(last)
  }
}

const isWord = (tokens: Tokens, i: i32, word: string): boolean =>
  i < tokens.kinds.length && tokens.kinds[i] === TOK_IDENT && tokens.values[i] === word

/**
 * An `export [async] function` at token `i`: keep its signature and the
 * braces of its body, and answer the token after the body. An overload, a
 * signature ended by `;`, is left blank. A `{` written where a type goes is an
 * object type, which no host function's signature can hold: the function is
 * left blank too, and its first one recorded as its refusal.
 */
const keepFunction = (tokens: Tokens, i: i32, kept: Kept): i32 => {
  let depth = 0
  let params = false
  let refused = false
  let k = i
  while (k < tokens.kinds.length) {
    const kind = tokens.kinds[k]
    if (kind === TOK_LBRACE && !params && typePosition(tokens.kinds[k - 1])) {
      // A type parameter's constraint or default, `<T extends { id: i32 }>`:
      // kept whole, for the checker to refuse the generic function (NL2662).
      k = closing(tokens, k) + 1
      continue
    }
    if (kind === TOK_LBRACE) {
      if (depth > 0 || typePosition(tokens.kinds[k - 1])) {
        const last = closing(tokens, k)
        if (!refused) {
          const name = isWord(tokens, i + 1, "async") ? tokens.values[i + 3] : tokens.values[i + 2]
          const where = depth > 0 ? "A parameter" : "The result"
          const message = hostTypeProblem(where, name, "an object type")
          kept.refusals.push(new HostRefusal(name, message, tokens.starts[k], tokens.ends[last]))
          refused = true
        }
        k = last + 1
        continue
      }
      const body = closing(tokens, k)
      if (!refused) {
        kept.keep(i, k)
        kept.keep(body, body)
      }
      return body + 1
    }
    if (kind === TOK_SEMICOLON && depth === 0) {
      return k + 1
    }
    if (kind === TOK_LPAREN || kind === TOK_LBRACKET) {
      params = params || kind === TOK_LPAREN
      depth = depth + 1
    } else if (kind === TOK_RPAREN || kind === TOK_RBRACKET) {
      depth = depth - 1
    }
    k = k + 1
  }
  return k
}

/**
 * The spans of `text` the parser reads: each `export function`'s signature,
 * each `export enum` and each `export type X = HostHandle<"k">`, found at the
 * top level by skipping every bracketed group whole.
 */
const keepExports = (text: string, tokens: Tokens): HostText => {
  const kept = new Kept()
  let i = 0
  const n = tokens.kinds.length
  while (i < n) {
    const kind = tokens.kinds[i]
    const exported = kind === TOK_EXPORT && (i === 0 || tokens.kinds[i - 1] !== TOK_DOT)
    if (exported && i + 1 < n) {
      const after = isWord(tokens, i + 1, "async") ? i + 2 : i + 1
      if (after < n && tokens.kinds[after] === TOK_FUNCTION) {
        i = keepFunction(tokens, i, kept)
        continue
      }
      const enumAt = i + 1 < n && tokens.kinds[i + 1] === TOK_CONST ? i + 2 : i + 1
      if (isWord(tokens, enumAt, "enum") && enumAt + 2 < n && tokens.kinds[enumAt + 2] === TOK_LBRACE) {
        const last = closing(tokens, enumAt + 2)
        if (enumAt === i + 2) {
          // `export const enum`'s `const` blanked: a host enum is an ordinary
          // enum to the program, and the parser reads it as one.
          kept.keep(i, i)
          kept.keep(enumAt, last)
        } else {
          kept.keep(i, last)
        }
        i = last + 1
        continue
      }
      if (
        isWord(tokens, i + 1, "type") &&
        i + 7 < n &&
        tokens.kinds[i + 2] === TOK_IDENT &&
        tokens.kinds[i + 3] === TOK_ASSIGN &&
        isWord(tokens, i + 4, "HostHandle") &&
        tokens.kinds[i + 5] === TOK_LT &&
        tokens.kinds[i + 6] === TOK_STRING &&
        tokens.kinds[i + 7] === TOK_GT
      ) {
        // Followed by `;`, the end of the file or a new line; anything else
        // (`| null`, `& X`) makes it a different type, and it is not read.
        const next = i + 8
        const lineEnds =
          next >= n || text.substring(tokens.ends[i + 7], tokens.starts[next]).indexOf("\n") >= 0
        if (next < n && tokens.kinds[next] === TOK_SEMICOLON) {
          kept.keep(i, next)
          i = next + 1
          continue
        }
        if (lineEnds) {
          kept.keep(i, i + 7)
          i = next
          continue
        }
      }
    }
    i = opens(kind) ? closing(tokens, i) + 1 : i + 1
  }
  const out = new StringBuilder()
  let at = 0
  let k = 0
  while (k < kept.firsts.length) {
    const from = tokens.starts[kept.firsts[k]]
    const to = tokens.ends[kept.lasts[k]]
    out.add(blank(text, at, from))
    out.add(text.slice(from, to))
    at = to
    k = k + 1
  }
  out.add(blank(text, at, text.length))
  const read = new HostText(out.toText(), "", 0, 0)
  read.refusals = kept.refusals
  return read
}

/** `text[from, to)` as spaces, each line break kept, so every offset after it is unchanged. */
const blank = (text: string, from: i32, to: i32): string => {
  const out = new StringBuilder()
  let run = 0
  let k = from
  // The offsets are tokens' own, inside `text`: the first two tests change
  // nothing but what the bounds check can prove.
  while (k >= 0 && k < text.length && k < to) {
    const c = text.charCodeAt(k)
    if (c === 10 || c === 13) {
      out.add(blankRun(run))
      run = 0
      out.addChar(c)
    } else {
      run = run + 1
    }
    k = k + 1
  }
  out.add(blankRun(run))
  return out.toText()
}

const SPACES: string = "                                                                "

const blankRun = (count: i32): string => {
  if (count <= SPACES.length) {
    return SPACES.substring(0, count)
  }
  const out = new StringBuilder()
  let left = count
  while (left > SPACES.length) {
    out.add(SPACES)
    left = left - SPACES.length
  }
  out.add(SPACES.substring(0, left))
  return out.toText()
}

/**
 * Each exported function of the parsed host module made foreign, its body the
 * empty node: a wasm import from module `host`, which the checker reads as a
 * declaration and the emitter as an import (WP50 §3).
 */
export const markHostFunctions = (file: Node): void => {
  for (const stmt of file.children) {
    if (stmt.kind === N_FUNCTION && (stmt.flags & FLAG_EXPORTED) !== 0) {
      stmt.flags = stmt.flags | FLAG_FOREIGN
      const body = stmt.children[3]
      body.kind = N_EMPTY
      body.children = []
    }
  }
}

/**
 * `file` without the exported functions `refusals` names, so the checker binds
 * only what the build can import, and an import of a refused one is answered
 * with its refusal rather than as a missing export.
 */
export const dropRefused = (file: Node, refusals: HostRefusal[]): void => {
  if (refusals.length === 0) {
    return
  }
  const names = new StringSet()
  for (const refusal of refusals) {
    names.add(refusal.name)
  }
  const kept: Node[] = []
  for (const stmt of file.children) {
    if (stmt.kind !== N_FUNCTION || !names.has(stmt.children[0].text)) {
      kept.push(stmt)
    }
  }
  file.children = kept
}

/** NL2661: a position holding what no host function's signature can hold. */
export const hostTypeProblem = (where: string, name: string, spelled: string): string =>
  `${where} of host function \`${name}\` is ${spelled}, and only a scalar, an enum or a \`HostHandle\` crosses between the page and wasm: write it into module storage and pass its index`

/** The element types of a typed array: a buffer the page would lend wasm (stage 3). */
const TYPED_ARRAYS = (): StringSet => {
  const names = new StringSet()
  for (const prefix of [
    "Int8",
    "Uint8",
    "Uint8Clamped",
    "Int16",
    "Uint16",
    "Int32",
    "Uint32",
    "Float32",
    "Float64",
    "BigInt64",
    "BigUint64",
  ]) {
    names.add(`${prefix}Array`)
  }
  return names
}

/** The names a host signature may spell as a type before the checker resolves it. */
const SCALAR_NAMES = (): StringSet => {
  const names = new StringSet()
  for (const name of [
    "i32",
    "i64",
    "u8",
    "u16",
    "u32",
    "u64",
    "f32",
    "f64",
    "boolean",
    "number",
    "void",
    "HostHandle",
    "integer",
  ]) {
    names.add(name)
  }
  return names
}

/** One refusal the sweep found: the function, its message and the node it points at. */
export class HostProblem {
  name: string
  message: string
  node: Node

  constructor(name: string, message: string, node: Node) {
    this.name = name
    this.message = message
    this.node = node
  }
}

/**
 * The refusals a host module's exported signatures earn before any type is
 * resolved (WP50 §12): what the checker would otherwise refuse in words about
 * Nish code the page never wrote as Nish. A generic function is not one
 * import (NL2662), a `Promise` cannot be waited for (NL2663) and a `string`
 * result cannot be received (NL2667); every other non-scalar is NL2661. A
 * `string` parameter crosses from stage 4 as its bytes' address and count,
 * which the loader decodes; NL2665, which refused it until then, is retired. A buffer
 * is a window (§5.3, stage 3): one of six elements (NL2681), followed by
 * `at: u32, n: u32` (NL2682), never a wider index (NL2683); a typed array is
 * rewritten here as the array the checker resolves. NL2664, which refused
 * every buffer until stage 3, is retired. A name the module declares — an enum or a
 * `HostHandle` alias — is left for the checker.
 */
export const hostSignatureProblems = (file: Node, parser: Parser): HostProblem[] => {
  const problems: HostProblem[] = []
  const local = new StringSet()
  for (const stmt of file.children) {
    if (stmt.kind === N_ENUM || stmt.kind === N_TYPE_ALIAS) {
      local.add(stmt.children[0].text)
    }
  }
  const typed = TYPED_ARRAYS()
  const scalars = SCALAR_NAMES()
  for (const stmt of file.children) {
    if (stmt.kind !== N_FUNCTION || (stmt.flags & FLAG_EXPORTED) === 0) {
      continue
    }
    const name = stmt.children[0].text
    if (stmt.children.length > 4 && stmt.children[4].children.length > 0) {
      problems.push(
        new HostProblem(
          name,
          `Host function \`${name}\` is generic, and a wasm import is one function with one signature: write it once per type it takes`,
          stmt.children[4]
        )
      )
      continue
    }
    const result = stmt.children[2]
    if ((stmt.flags & FLAG_ASYNC) !== 0 || isTypeNamed(result, "Promise")) {
      problems.push(
        new HostProblem(
          name,
          `Host function \`${name}\` returns a \`Promise\`, which wasm cannot wait for: await it in the page and call an export with the result`,
          result.kind === N_EMPTY ? stmt.children[0] : result
        )
      )
      continue
    }
    const params = stmt.children[1].children
    let k = 0
    while (k < params.length) {
      const param = params[k]
      k = k + 1
      const type = unparen(param.children[1])
      const p = param.children[0].text
      if (type.kind === N_EMPTY) {
        continue // the checker's own refusal: a parameter needs a type
      }
      if (isTypeNamed(type, "string")) {
        continue // WP50 S4: the bytes' address and count, decoded by the loader
      }
      if (isBuffer(type, typed, scalars)) {
        if (windowElement(type) === "") {
          problems.push(windowElementProblem(p, name, type))
          continue
        }
        const pair = windowPairProblem(params, k, p, name)
        if (pair !== null) {
          problems.push(pair)
          continue
        }
        asWindow(type, parser)
        k = k + 2 // `at` and `n`, each a `u32` the pair check read
      } else if (!crosses(type, scalars, local)) {
        problems.push(typeProblem(`Parameter \`${p}\``, name, type))
      }
    }
    const answer = unparen(result)
    if (answer.kind === N_EMPTY) {
      continue
    }
    if (isTypeNamed(answer, "string")) {
      problems.push(
        new HostProblem(
          name,
          `Host function \`${name}\` returns a \`string\`, which wasm cannot receive: return the text by writing it into a module-storage u8[] the module names, and return its length`,
          answer
        )
      )
    } else if (!crosses(answer, scalars, local)) {
      problems.push(typeProblem("The result", name, answer))
    }
  }
  return problems
}

/**
 * The element of a buffer window (WP50 §5.3): `u8`, `u16`, `u32`, `i32`, `f32`
 * or `f64`, each the element of one of the loader's whole-memory views, or ""
 * for a buffer of anything else. A typed array names its element in its own
 * name; an array of scalars, readonly or not, names it in its element type.
 */
const windowElement = (type: Node): string => {
  if (type.kind === N_TYPE_READONLY) {
    return windowElement(unparen(type.children[0]))
  }
  let element = type
  if (type.kind === N_TYPE_ARRAY) {
    element = unparen(type.children[0])
  } else if (type.text === "Array" || type.text === "ReadonlyArray") {
    element = unparen(type.children[0].children[0])
  } else {
    return typedElement(type.text)
  }
  const t = element.text
  return t === "u8" || t === "u16" || t === "u32" || t === "i32" || t === "f32" || t === "f64" ? t : ""
}

/** The window element a typed array's name spells, or "" for one no window lends. */
const typedElement = (name: string): string => {
  if (name === "Uint8Array") {
    return "u8"
  }
  if (name === "Uint16Array") {
    return "u16"
  }
  if (name === "Uint32Array") {
    return "u32"
  }
  if (name === "Int32Array") {
    return "i32"
  }
  if (name === "Float32Array") {
    return "f32"
  }
  return name === "Float64Array" ? "f64" : ""
}

/**
 * The refusal of a window whose `at: u32, n: u32` is not the two parameters
 * after it (`next` is the first), or null. A `u64` or `i64` there is refused in
 * its own words: the page's index is a wasm32 address's width, and a wider one
 * would be one more conversion that can lose bits on every call.
 */
const windowPairProblem = (params: Node[], next: i32, p: string, name: string): HostProblem | null => {
  let i = next
  while (i < next + 2) {
    if (i >= params.length) {
      return windowMissing(p, name, params[next - 1])
    }
    const type = unparen(params[i].children[1])
    if (isTypeNamed(type, "u64") || isTypeNamed(type, "i64")) {
      const role = i === next ? "first element" : "element count"
      return new HostProblem(
        name,
        `Parameter \`${params[i].children[0].text}\` of host function \`${name}\` is \`${type.text}\`, the ${role} of the window \`${p}\`: a window's index and count are \`u32\`, the width of a wasm32 address`,
        type
      )
    }
    if (!isTypeNamed(type, "u32")) {
      return windowMissing(p, name, params[next - 1])
    }
    i = i + 1
  }
  return null
}

const windowMissing = (p: string, name: string, param: Node): HostProblem =>
  new HostProblem(
    name,
    `Parameter \`${p}\` of host function \`${name}\` is a buffer window with no \`at: u32, n: u32\` after it: a window is the buffer followed by the first element the page may touch and how many`,
    param
  )

/**
 * A typed array's type node rewritten in place as the array of its element,
 * which is the type the checker resolves: `Float32Array` is an `f32[]` the
 * page may write, as it is in the page's own reading. Every other spelling
 * already names its element and is left as written.
 */
const asWindow = (type: Node, parser: Parser): void => {
  if (type.kind !== N_TYPE_REF || type.text === "Array" || type.text === "ReadonlyArray") {
    return
  }
  // From the parser, so the element has an id inside the checker's tables.
  const element = parser.node(N_TYPE_REF, type.start, type.end)
  element.text = typedElement(type.text)
  element.children = [parser.list()] // a reference's type arguments, none here
  type.kind = N_TYPE_ARRAY
  type.text = ""
  type.children = [element]
}

/** A buffer parameter whose element no window lends. */
const windowElementProblem = (p: string, name: string, type: Node): HostProblem =>
  new HostProblem(
    name,
    `Parameter \`${p}\` of host function \`${name}\` is ${spell(type)}, and a buffer window lends only \`u8[]\`, \`u16[]\`, \`u32[]\`, \`i32[]\`, \`f32[]\` or \`f64[]\` (or the typed array of each): copy the values into one of those`,
    type
  )

/** A parameter or result whose type is none a wasm import carries. */
const typeProblem = (where: string, name: string, type: Node): HostProblem =>
  new HostProblem(name, hostTypeProblem(where, name, spell(type)), type)

const unparen = (type: Node): Node => (type.kind === N_TYPE_PAREN ? unparen(type.children[0]) : type)

const isTypeNamed = (type: Node, name: string): boolean => type.kind === N_TYPE_REF && type.text === name

/** A typed array, or an array of scalars spelled `T[]`, `readonly T[]` or `Array<T>`. */
const isBuffer = (type: Node, typed: StringSet, scalars: StringSet): boolean => {
  if (type.kind === N_TYPE_READONLY) {
    return isBuffer(unparen(type.children[0]), typed, scalars)
  }
  if (type.kind === N_TYPE_REF) {
    if (typed.has(type.text)) {
      return true
    }
    if (type.text === "Array" || type.text === "ReadonlyArray") {
      const args = type.children.length > 0 ? type.children[0].children.length : 0
      return args === 1 && isScalarRef(unparen(type.children[0].children[0]), scalars)
    }
    return false
  }
  return type.kind === N_TYPE_ARRAY && isScalarRef(unparen(type.children[0]), scalars)
}

const isScalarRef = (type: Node, scalars: StringSet): boolean =>
  type.kind === N_TYPE_REF && scalars.has(type.text) && type.text !== "void" && type.text !== "HostHandle"

/** Whether the type is one a host signature may name: a scalar, `HostHandle<…>`, or a name the module declares. */
const crosses = (type: Node, scalars: StringSet, local: StringSet): boolean =>
  type.kind === N_TYPE_REF && (scalars.has(type.text) || local.has(type.text))

/** A type as the page wrote it, for a message: `string[]`, `Uint8Array`, `object`. */
const spell = (type: Node): string => {
  if (type.kind === N_TYPE_REF) {
    return `\`${type.text}\``
  }
  if (type.kind === N_TYPE_ARRAY) {
    return "an array"
  }
  if (type.kind === N_TYPE_READONLY) {
    return "a readonly array"
  }
  if (type.kind === N_TYPE_FUNCTION) {
    return "a function type"
  }
  return "a type that is no scalar"
}
