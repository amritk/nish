// The parser for the subset (docs/wp14-selfhost.md, milestone S2): recursive
// descent over `src/lexer.ts`, producing the one-class tree of
// `src/nodes.ts`.
//
// **No exceptions.** A `throw` traps and discards its value, so error
// recovery is the error-value threading of §3a D1, in its first real use: a
// failed parse returns an `N_ERROR` node, the message goes on
// `Parser.diagnostics`, and the caller decides whether to skip to a
// synchronising token or hand the sentinel upward. This is the classic
// recursive-descent recovery tax, and it is worse than `try`/`catch`; the
// cost is visible here so that it is measured rather than assumed at the S2
// gate.
//
// **One token of lookahead**, in `token`/`ahead`. The lexer is a cursor rather
// than a token array, so the second token is fetched by lexing it and holding
// it, which is all this grammar ever needs — including the two places
// TypeScript is genuinely ambiguous to one token (`(` after an identifier is a
// call, and `<` after a type name is a type argument list).
//
// **What it accepts is wider than the language.** `??` it builds as an
// operator (WP32), and the checker refuses it wherever its left operand is not
// a `Map.get` result. Anything it cannot make a node of is an `N_ERROR` with
// the reason.
//
// **A forbidden construct is parsed, not refused** (WP33 R1): `var`, `try`,
// `with`, a label, `for...in`, `for await`, `for (x of a)`, a top-level `let`
// and a top-level statement each become a node, and so do `==`, `?.`,
// `typeof`, `in`, `**`, a regex, `as` and the rest of the expressions the
// language forbids, and `async`, `function*`, a decorator, `namespace`,
// `declare global`, a generic alias, `keyof` and a default type argument;
// the phase that owns the rule refuses it by name, because a
// message about the construct the programmer wrote beats one about a token
// they did not. The shape each takes is written down once, beside the flags in
// `src/nodes.ts`. `var`, `try`, `with`, `await`, `in`, `typeof` and the other
// operator words are identifiers to the lexer, so they are matched by text
// where they open a construct, as `of` and `using` are, and only where the
// word could not be a name (`operandAhead`, `operatorPrecedence`,
// `asyncArrowAhead`, `namespaceAhead`, `keyofAhead`).

import { Diagnostic, SourceFile } from "./diagnostics"
import { Lexer, withoutSeparators } from "./lexer"
import { StringMap } from "./map"
import {
  FLAG_ABSTRACT,
  FLAG_ACCESSOR,
  FLAG_ANGLE,
  FLAG_ASYNC,
  FLAG_ATTRIBUTES,
  FLAG_AWAIT,
  FLAG_COMPUTED,
  FLAG_CONST,
  FLAG_CONSTRUCT,
  FLAG_DEFAULT,
  FLAG_DEFER,
  FLAG_FOR_IN,
  FLAG_USING,
  FLAG_VAR,
  FLAG_DEFINITE,
  FLAG_EXPORTED,
  FLAG_FOREIGN,
  FLAG_GENERATOR,
  FLAG_OPTIONAL,
  FLAG_POSTFIX,
  FLAG_PREFIX,
  FLAG_PROPERTY,
  FLAG_READONLY,
  FLAG_REST,
  FLAG_SATISFIES,
  FLAG_STATIC,
  FLAG_STATIC_FIRST,
  FLAG_TYPE_ONLY,
  N_ARRAY,
  N_AS,
  N_ARROW,
  N_BIGINT,
  N_BINARY,
  N_BINDING_PATTERN,
  N_BLOCK,
  N_BREAK,
  N_CALL,
  N_CASE,
  N_CLASS,
  N_CONDITIONAL,
  N_CONSTRUCTOR,
  N_CONTINUE,
  N_DECORATOR,
  N_DEFAULT,
  N_DO,
  N_EMPTY,
  N_ERROR,
  N_EXPR_STMT,
  N_FALSE,
  N_FIELD,
  N_FOR,
  N_FOR_OF,
  N_FUNCTION,
  N_IDENT,
  N_IF,
  N_IMPORT,
  N_IMPORT_EQUALS,
  N_IMPORT_SPEC,
  N_INDEX,
  N_INDEX_SIGNATURE,
  N_INTERFACE,
  N_LABELED,
  N_LIST,
  N_MEMBER,
  N_METHOD,
  N_MODULE_CONST,
  N_NAMESPACE,
  N_NAMESPACE_EXPORT,
  N_NEW,
  N_NULL,
  N_NUMBER,
  N_OBJECT,
  N_PARAM,
  N_PAREN,
  N_PROPERTY,
  N_REGEX,
  N_RETURN,
  N_SOURCE_FILE,
  N_SPREAD,
  N_SUPER,
  N_STRING,
  N_SWITCH,
  N_TEMPLATE,
  N_TEMPLATE_TEXT,
  N_THIS,
  N_THROW,
  N_TRUE,
  N_TRY,
  N_UNARY,
  N_ENUM,
  N_EXPORT_ASSIGNMENT,
  N_EXPORT_DECLARATION,
  N_ENUM_MEMBER,
  N_TYPE_ALIAS,
  N_TYPE_ARRAY,
  N_TYPE_FUNCTION,
  N_TYPE_LITERAL,
  N_TYPE_NULL,
  N_TYPE_OPERATOR,
  N_TYPE_PAREN,
  N_TYPE_READONLY,
  N_TYPE_REF,
  N_TYPE_UNION,
  N_VAR,
  N_VAR_DECL,
  N_WHILE,
  N_WITH,
  Node,
} from "./nodes"
import {
  TOK_AMP,
  TOK_AMP_ASSIGN,
  TOK_AND_AND,
  TOK_ARROW,
  TOK_AT,
  TOK_ASSIGN,
  TOK_BANG,
  TOK_BREAK,
  TOK_CARET,
  TOK_CARET_ASSIGN,
  TOK_CASE,
  TOK_CLASS,
  TOK_COLON,
  TOK_COMMA,
  TOK_CONST,
  TOK_CONTINUE,
  TOK_DEFAULT,
  TOK_DO,
  TOK_DOT,
  TOK_DOT_DOT_DOT,
  TOK_ELSE,
  TOK_END,
  TOK_EQ,
  TOK_EQ_LOOSE,
  TOK_ERROR,
  TOK_EXPORT,
  TOK_EXTENDS,
  TOK_FALSE,
  TOK_FOR,
  TOK_FUNCTION,
  TOK_GE,
  TOK_GT,
  TOK_IDENT,
  TOK_IF,
  TOK_IMPLEMENTS,
  TOK_IMPORT,
  TOK_INTERFACE,
  TOK_LBRACE,
  TOK_LBRACKET,
  TOK_LE,
  TOK_LET,
  TOK_LPAREN,
  TOK_LT,
  TOK_MINUS,
  TOK_MINUS_ASSIGN,
  TOK_MINUS_MINUS,
  TOK_NE,
  TOK_NE_LOOSE,
  TOK_NEW,
  TOK_NULL,
  TOK_NUMBER,
  TOK_BIGINT,
  TOK_OR_OR,
  TOK_PERCENT,
  TOK_PERCENT_ASSIGN,
  TOK_PIPE,
  TOK_PIPE_ASSIGN,
  TOK_PLUS,
  TOK_PLUS_ASSIGN,
  TOK_PLUS_PLUS,
  TOK_QUESTION,
  TOK_QUESTION_DOT,
  TOK_QUESTION_QUESTION,
  TOK_RBRACE,
  TOK_RBRACKET,
  TOK_RETURN,
  TOK_RPAREN,
  TOK_SEMICOLON,
  TOK_SHL,
  TOK_SHL_ASSIGN,
  TOK_SHR,
  TOK_SHR_ASSIGN,
  TOK_SLASH,
  TOK_SLASH_ASSIGN,
  TOK_STAR,
  TOK_STAR_ASSIGN,
  TOK_STAR_STAR,
  TOK_STAR_STAR_ASSIGN,
  TOK_STRING,
  TOK_SUPER,
  TOK_SWITCH,
  TOK_TEMPLATE,
  TOK_TEMPLATE_HEAD,
  TOK_TEMPLATE_MIDDLE,
  TOK_TEMPLATE_TAIL,
  TOK_THIS,
  TOK_THROW,
  TOK_TILDE,
  TOK_TRUE,
  TOK_USHR,
  TOK_USHR_ASSIGN,
  TOK_WHILE,
  tokenName,
} from "./tokens"

/** The line terminators semicolon insertion looks for, spelled as `src/lexer.ts` spells them. */
const CH_LF: i32 = 10
const CH_CR: i32 = 13

/**
 * Binding power of a binary operator, or 0 when the token is not one. The
 * levels are JavaScript's, so that a program means here what it means there:
 * `||` binds loosest, then `&&`, then the bitwise trio, equality, relational,
 * shifts, additive, multiplicative, and `**`, the one right-associative level.
 * `==`, `!=` and `**` are read so that the phase that owns each rule refuses
 * it (WP33 R1); `in`, `instanceof`, `as` and `satisfies` are words, and
 * `Parser.operatorPrecedence` gives them the relational level.
 */
const binaryPrecedence = (kind: i32): i32 => {
  if (kind === TOK_OR_OR) {
    return 1
  }
  if (kind === TOK_AND_AND) {
    return 2
  }
  if (kind === TOK_PIPE) {
    return 3
  }
  if (kind === TOK_CARET) {
    return 4
  }
  if (kind === TOK_AMP) {
    return 5
  }
  if (kind === TOK_EQ || kind === TOK_NE || kind === TOK_EQ_LOOSE || kind === TOK_NE_LOOSE) {
    return 6
  }
  if (kind === TOK_LT || kind === TOK_LE || kind === TOK_GT || kind === TOK_GE) {
    return 7
  }
  if (kind === TOK_SHL || kind === TOK_SHR || kind === TOK_USHR) {
    return 8
  }
  if (kind === TOK_PLUS || kind === TOK_MINUS) {
    return 9
  }
  if (kind === TOK_STAR || kind === TOK_SLASH || kind === TOK_PERCENT) {
    return 10
  }
  if (kind === TOK_STAR_STAR) {
    return 11
  }
  return 0
}

/** The relational level, where `<` and the operator words bind. */
const RELATIONAL: i32 = 7

/**
 * Whether a word after an operand can only be an operator, which is what keeps
 * it from being the operand of a prefix word before it: `typeof in o` is the
 * name `typeof` and the `in` operator, as `for (typeof of xs)` names it too.
 */
const isOperatorWord = (word: string): boolean =>
  word === "in" || word === "of" || word === "instanceof" || word === "as" || word === "satisfies"

/** The words TypeScript reads as a prefix operator: each is forbidden (WP33 R1). */
const isPrefixWord = (word: string): boolean =>
  word === "typeof" || word === "void" || word === "delete" || word === "await" || word === "yield"

/**
 * Whether the token assigns: `=`, the compound forms the language has, and
 * `**=`, which the checker refuses (NL2253).
 */
const isAssignment = (kind: i32): boolean =>
  kind === TOK_ASSIGN ||
  kind === TOK_PLUS_ASSIGN ||
  kind === TOK_MINUS_ASSIGN ||
  kind === TOK_STAR_ASSIGN ||
  kind === TOK_SLASH_ASSIGN ||
  kind === TOK_PERCENT_ASSIGN ||
  kind === TOK_AMP_ASSIGN ||
  kind === TOK_PIPE_ASSIGN ||
  kind === TOK_CARET_ASSIGN ||
  kind === TOK_SHL_ASSIGN ||
  kind === TOK_SHR_ASSIGN ||
  kind === TOK_USHR_ASSIGN ||
  kind === TOK_STAR_STAR_ASSIGN

/**
 * The words TypeScript reserves that the lexer reads as identifiers (the rest
 * of its reserved words are keywords there): never a name an import binds.
 * A different set from `isOperatorWord` and `isPrefixWord`, which are about
 * where a word is an operator rather than whether it may be bound.
 */
const isReservedWord = (word: string): boolean =>
  word === "catch" ||
  word === "debugger" ||
  word === "delete" ||
  word === "enum" ||
  word === "finally" ||
  word === "in" ||
  word === "instanceof" ||
  word === "try" ||
  word === "typeof" ||
  word === "var" ||
  word === "void" ||
  word === "with"

export class Parser {
  /**
   * The file being parsed. A `SourceFile` rather than a bare string because a
   * diagnostic is anchored to one: the parser's errors and the checker's go
   * into the same report, sorted together, and there is one `Diagnostic`
   * class in `src/` rather than a syntax one and a semantic one.
   */
  file: SourceFile
  lexer: Lexer
  diagnostics: Diagnostic[]

  // The current token, copied out of the lexer so that `ahead` can be read
  // without losing it.
  kind: i32
  start: i32
  end: i32

  /**
   * Where the diagnostics of the import or export form being read begin, or
   * -1 outside one (`beginForm`). Inside one only the first syntax error is
   * kept: a form the language refuses has no grammar of its own to recover
   * by, so what follows its first error would be a cascade about the same
   * statement, which the one import form never cost before it was read.
   * Declared here, between the current token's offsets and its text, where
   * an i32 fills the padding the three before it leave.
   */
  formStart: i32

  /** The current token's text. */
  value: string

  /**
   * The end of the token consumed most recently, which is where a construct
   * stops: every `node.end` is set from it after the last child is parsed.
   */
  previousEnd: i32

  // One token of lookahead, filled on demand by `peek()`.
  aheadKind: i32
  aheadStart: i32
  aheadEnd: i32
  aheadValue: string
  hasAhead: boolean

  /**
   * Set while a `for` head's initialiser is read, where `in` opens a
   * `for...in` rather than being the operator, as TypeScript's `disallowIn`
   * context does. Every bracket the ECMAScript grammar reads `[+In]` inside
   * clears it again (`allowIn`): a parenthesis, an array literal, an argument
   * list, an element access, an object literal, a template substitution, a
   * block and the branch between a conditional's `?` and `:`. A concise arrow
   * body and the branch after `:` inherit it, as the grammar's `[?In]` does.
   * TypeScript's parser keeps `in` disallowed inside an array literal, where
   * Node follows the grammar; this parser follows the grammar too
   * (`tests/cases/reject_in_for_head_array`).
   */
  noIn: boolean

  /** How many nodes this parser has made; also the next id it will hand out. */
  nodeCount: i32

  /**
   * The labels of the labelled statements around the current one, innermost
   * last. A `break` or `continue` naming one of them is read, so that the
   * refusal is the labelled statement's (NL1046) and there is only one; a
   * label nothing declares stays a syntax error, as it is in TypeScript.
   */
  labels: string[]

  /**
   * The end of the `}` that closes each `{` a `tryStatementAhead` scan has
   * passed, keyed by the brace's offset. A scan records every brace it walks
   * through, so a `try` block nested in one already scanned is looked up
   * rather than scanned again, and nested blocks cost one scan between them.
   */
  closingBraces: StringMap

  constructor(file: SourceFile) {
    this.file = file
    this.lexer = new Lexer(file.text)
    this.diagnostics = []
    this.nodeCount = 0
    this.labels = []
    this.closingBraces = new StringMap()
    this.formStart = -1
    this.noIn = false
    this.kind = TOK_END
    this.start = 0
    this.end = 0
    this.value = ""
    this.previousEnd = 0
    this.aheadKind = TOK_END
    this.aheadStart = 0
    this.aheadEnd = 0
    this.aheadValue = ""
    this.hasAhead = false
    this.advance()
  }

  /** Move to the next token, reporting a lexical error once and skipping past it. */
  advance(): void {
    this.previousEnd = this.end
    if (this.hasAhead) {
      this.kind = this.aheadKind
      this.start = this.aheadStart
      this.end = this.aheadEnd
      this.value = this.aheadValue
      this.hasAhead = false
      return
    }
    this.lexer.next()
    while (this.lexer.kind === TOK_ERROR) {
      this.report(this.lexer.value, this.lexer.start, this.lexer.end)
      this.lexer.next()
    }
    this.kind = this.lexer.kind
    this.start = this.lexer.start
    this.end = this.lexer.end
    this.value = this.lexer.value
  }

  /** The kind of the token after the current one. */
  peek(): i32 {
    if (!this.hasAhead) {
      this.lexer.next()
      while (this.lexer.kind === TOK_ERROR) {
        this.report(this.lexer.value, this.lexer.start, this.lexer.end)
        this.lexer.next()
      }
      this.aheadKind = this.lexer.kind
      this.aheadStart = this.lexer.start
      this.aheadEnd = this.lexer.end
      this.aheadValue = this.lexer.value
      this.hasAhead = true
    }
    return this.aheadKind
  }

  report(message: string, start: i32, end: i32): void {
    if (this.formStart >= 0 && this.diagnostics.length > this.formStart) {
      return
    }
    this.diagnostics.push(new Diagnostic(this.file, start, end, "syntax error", message))
  }

  /**
   * Every node of this tree comes from here, which is what lets the ids be
   * dense: `nodeCount` is the size the checker's side tables need.
   */
  node(kind: i32, start: i32, end: i32): Node {
    const made = new Node(kind, start, end)
    made.id = this.nodeCount
    this.nodeCount = this.nodeCount + 1
    return made
  }

  /**
   * The marker for an optional child that is not there. It has no position:
   * an absence is not at a place, and giving it one would make every dump
   * depend on where the parser happened to be looking.
   */
  empty(): Node {
    return this.node(N_EMPTY, 0, 0)
  }

  /** A fresh, still-empty `N_LIST`; `closeList` gives it its span. */
  list(): Node {
    return this.node(N_LIST, 0, 0)
  }

  /**
   * A list spans its elements: from the first's start to the last's end, and
   * nowhere at all when there are none. Derived rather than tracked, so the
   * span does not depend on which brace the parser had reached.
   */
  closeList(list: Node): Node {
    const count = list.children.length
    if (count > 0) {
      list.start = list.children[0].start
      list.end = list.children[count - 1].end
    }
    return list
  }

  /** An `N_ERROR` node carrying the reason, reported at the current token. */
  fail(message: string): Node {
    this.report(message, this.start, this.end)
    const node = this.node(N_ERROR, this.start, this.end)
    node.text = message
    return node
  }

  at(kind: i32): boolean {
    return this.kind === kind
  }

  /** Consume the token when it is `kind`; answer whether it was. */
  eat(kind: i32): boolean {
    if (this.kind !== kind) {
      return false
    }
    this.advance()
    return true
  }

  /**
   * Consume `kind` or report. The token is not skipped on failure: the caller
   * is usually mid-construct and skipping would swallow the next one too.
   */
  expect(kind: i32): boolean {
    if (this.eat(kind)) {
      return true
    }
    this.report(`expected \`${tokenName(kind)}\`, found \`${tokenName(this.kind)}\``, this.start, this.end)
    return false
  }

  /**
   * Whether a line break separates the current token from the one before it,
   * which is what TypeScript's automatic semicolon insertion keys on. Only
   * whitespace and comments sit between `previousEnd` and `start`, so a CR or
   * LF found there is a line break, including one inside a block comment,
   * which TypeScript counts as one too.
   */
  newlineBefore(): boolean {
    return this.lineBreakBetween(this.previousEnd, this.start)
  }

  /**
   * The `;` that ends a statement, or the place TypeScript would insert one:
   * before a `}`, at the end of the file, or where the next token starts a new
   * line. The rule is TypeScript's so that a program without semicolons means
   * what it means under Node, which is also why a template on the next line is
   * not a new statement: TypeScript reads it as a tagged template, and so it is
   * the same `expected ';'` it is on one line.
   */
  expectSemicolon(): void {
    if (this.eat(TOK_SEMICOLON)) {
      return
    }
    if (this.at(TOK_RBRACE) || this.at(TOK_END)) {
      return
    }
    const template = this.at(TOK_TEMPLATE) || this.at(TOK_TEMPLATE_HEAD)
    if (!template && this.newlineBefore()) {
      return
    }
    this.expect(TOK_SEMICOLON)
  }

  // ---- Declarations ------------------------------------------------------------------

  parseSourceFile(): Node {
    const file = this.node(N_SOURCE_FILE, 0, this.file.text.length)
    while (!this.at(TOK_END)) {
      const before = this.start
      file.children.push(this.parseDeclaration())
      // A declaration that consumed nothing would spin; skip a token so the
      // next error is a new one.
      if (this.start === before && !this.at(TOK_END)) {
        this.advance()
      }
    }
    return file
  }

  parseDeclaration(): Node {
    const start = this.start
    let exported = false
    if (this.at(TOK_EXPORT)) {
      exported = true
      this.advance()
    }
    // `@dec class C { }`, for Phase 0 to refuse (NL1006). `@` is a token of
    // its own that nothing else in the language spells, so it is always this.
    if (this.at(TOK_AT)) {
      return this.parseDecorated(start, exported ? FLAG_EXPORTED : 0)
    }
    // The export forms that are not a modifier on a declaration, each read
    // for pass 1 to refuse: `export default`, `export =`, an export list or
    // `*`, and `export as namespace` (NL2128-NL2131, NL2230). `export type`
    // is an alias unless braces or `*` follow it, which is TypeScript's rule.
    if (exported && this.at(TOK_DEFAULT)) {
      return this.parseExportDefault(start)
    }
    if (exported && this.at(TOK_ASSIGN)) {
      const previous = this.beginForm()
      return this.endForm(this.parseExportAssignment(start), previous, false)
    }
    if (exported && (this.at(TOK_LBRACE) || this.at(TOK_STAR) || this.exportTypeListAhead())) {
      const previous = this.beginForm()
      return this.endForm(this.parseExportDeclaration(start), previous, false)
    }
    if (exported && this.at(TOK_IDENT) && this.value === "as") {
      const previous = this.beginForm()
      return this.endForm(this.parseNamespaceExport(start), previous, false)
    }
    if (this.at(TOK_IMPORT) && this.peek() !== TOK_LPAREN) {
      if (this.importDeclarationAhead()) {
        const previous = this.beginForm()
        return this.exportable(this.endForm(this.parseImport(start), previous, false), exported)
      }
      // Neither an import nor `import(...)`: the syntax error it always was.
      if (exported) {
        return this.fail("`export` cannot introduce an import")
      }
      return this.parseMalformedImport(start)
    }
    if (this.at(TOK_FUNCTION)) {
      return this.exportable(this.parseFunction(start, false), exported)
    }
    // `async function`, a modifier only with no line break before `function`,
    // which is TypeScript's rule; Phase 0 refuses it (NL1015).
    if (
      this.at(TOK_IDENT) &&
      this.value === "async" &&
      this.peek() === TOK_FUNCTION &&
      this.aheadOnSameLine()
    ) {
      this.advance() // `async`
      const declaration = this.parseFunction(start, false)
      declaration.flags = declaration.flags | FLAG_ASYNC
      return this.exportable(declaration, exported)
    }
    if (this.at(TOK_CLASS)) {
      return this.exportable(this.parseClass(start), exported)
    }
    // `abstract class`, for the checker to refuse (NL2168): a modifier only
    // with `class` after it on its line, which is TypeScript's rule.
    if (
      this.at(TOK_IDENT) &&
      this.value === "abstract" &&
      this.peek() === TOK_CLASS &&
      this.aheadOnSameLine()
    ) {
      this.advance() // `abstract`
      return this.exportable(this.flagged(this.parseClass(start), FLAG_ABSTRACT), exported)
    }
    if (this.at(TOK_INTERFACE)) {
      return this.exportable(this.parseInterface(start), exported)
    }
    if (this.at(TOK_CONST) && this.startsArrowDeclaration()) {
      return this.exportable(this.parseArrowFunction(start), exported)
    }
    // `const enum` is read rather than refused where it stands, so the checker
    // can say why an enum member needs no `const` instead of the parser saying
    // that `enum` is not a variable name (WP23).
    if (this.at(TOK_CONST) && this.startsConstEnum()) {
      this.advance() // `const`
      const declaration = this.parseEnum(start)
      declaration.flags = declaration.flags | FLAG_CONST
      return this.exportable(declaration, exported)
    }
    if (this.at(TOK_CONST) || this.at(TOK_LET) || this.varAhead()) {
      return this.exportable(this.parseModuleConst(start), exported)
    }
    // `type` and `enum` are contextual keywords, ordinary identifiers
    // everywhere else, so they are matched by text here exactly as `from` and
    // `of` are — which is what leaves the lexer and its oracle untouched.
    // `declare` is contextual too, and needs the one token of lookahead to tell
    // `declare function f(): i32;` from a variable that happens to be called
    // `declare` (WP27 S1). `export` is refused by the checker rather than here,
    // so the message can say what a foreign declaration is instead of what the
    // grammar wanted.
    if (this.at(TOK_IDENT) && this.value === "declare" && this.peek() === TOK_FUNCTION) {
      this.advance() // `declare`
      const foreign = this.parseForeignFunction(start)
      return this.exportable(foreign, exported)
    }
    if (this.declaredTypeAhead()) {
      return this.exportable(this.parseDeclaredType(start), exported)
    }
    if (this.namespaceAhead()) {
      return this.exportable(this.parseNamespace(start, 0), exported)
    }
    if (
      this.at(TOK_IDENT) &&
      this.value === "declare" &&
      this.aheadOnSameLine() &&
      this.peek() === TOK_IDENT
    ) {
      const scan = this.scanAfterAhead()
      if (this.declaredNamespaceAhead(scan)) {
        this.advance() // `declare`
        return this.exportable(this.parseNamespace(start, FLAG_FOREIGN), exported)
      }
    }
    if (this.at(TOK_IDENT) && this.value === "type") {
      return this.exportable(this.parseTypeAlias(start), exported)
    }
    if (this.at(TOK_IDENT) && this.value === "enum") {
      return this.exportable(this.parseEnum(start), exported)
    }
    // A statement is read where a declaration was expected, and it is the
    // checker that says a module has no top-level code (NL2230).
    if (!exported && this.startsTopLevelStatement()) {
      return this.parseStatement()
    }
    return this.fail(
      `a module holds only \`function\`, \`class\`, \`interface\`, \`const\`, \`type\`, \`enum\` and \`import\`, found \`${tokenName(this.kind)}\``
    )
  }

  /**
   * Whether the token in hand opens a statement rather than a declaration: a
   * statement keyword, `import` before `(` (`import("./m")`, for Phase 0 to
   * refuse, NL1002), or a name that is not
   * followed by another name or a keyword. That last half leaves the
   * modifiers the language does not have — `async function`, `declare
   * class`, `abstract class`, `namespace N` — to the refusal below, which is
   * their own and not a statement's.
   */
  startsTopLevelStatement(): boolean {
    switch (this.kind) {
      case TOK_IMPORT:
        return this.peek() === TOK_LPAREN
      case TOK_IF:
      case TOK_WHILE:
      case TOK_DO:
      case TOK_FOR:
      case TOK_SWITCH:
      case TOK_RETURN:
      case TOK_THROW:
      case TOK_BREAK:
      case TOK_CONTINUE:
        return true
      case TOK_IDENT: {
        const next = this.peek()
        return next !== TOK_IDENT && (next < TOK_FUNCTION || next > TOK_SUPER)
      }
      default:
        return false
    }
  }

  /**
   * Whether `declare` opens a declared class, interface or enum (NL2083,
   * NL2286): `class`, `abstract class`, `interface`, `enum` or `const enum`
   * after it, each word on the line of the one before, which is TypeScript's
   * rule for a modifier. Anywhere else `declare` is the name it always was.
   */
  declaredTypeAhead(): boolean {
    if (!this.at(TOK_IDENT) || this.value !== "declare" || !this.aheadOnSameLine()) {
      return false
    }
    const next = this.peek()
    if (next === TOK_CLASS || next === TOK_INTERFACE) {
      return true
    }
    if (next === TOK_IDENT && this.aheadValue === "enum") {
      return true
    }
    if (next !== TOK_CONST && !(next === TOK_IDENT && this.aheadValue === "abstract")) {
      return false
    }
    const scan = this.scanAfterAhead()
    const sameLine = !this.lineBreakBetween(this.aheadEnd, scan.start)
    if (next === TOK_IDENT && this.aheadValue === "abstract") {
      return scan.kind === TOK_CLASS && sameLine
    }
    return next === TOK_CONST && scan.kind === TOK_IDENT && scan.value === "enum" && sameLine
  }

  /** The declaration `declaredTypeAhead` found, with FLAG_FOREIGN for `declare`. */
  parseDeclaredType(start: i32): Node {
    this.advance() // `declare`
    if (this.at(TOK_IDENT) && this.value === "abstract") {
      this.advance()
      return this.flagged(this.parseClass(start), FLAG_FOREIGN | FLAG_ABSTRACT)
    }
    if (this.at(TOK_CLASS)) {
      return this.flagged(this.parseClass(start), FLAG_FOREIGN)
    }
    if (this.at(TOK_INTERFACE)) {
      return this.flagged(this.parseInterface(start), FLAG_FOREIGN)
    }
    if (this.eat(TOK_CONST)) {
      return this.flagged(this.parseEnum(start), FLAG_FOREIGN | FLAG_CONST)
    }
    return this.flagged(this.parseEnum(start), FLAG_FOREIGN)
  }

  /** `declaration`, with `flags` added to its own. */
  flagged(declaration: Node, flags: i32): Node {
    declaration.flags = declaration.flags | flags
    return declaration
  }

  /**
   * A scratch lexer standing on the token after the one `peek` holds, for the
   * two words of lookahead `declare global` and `namespace N` need.
   */
  scanAfterAhead(): Lexer {
    const scan = new Lexer(this.file.text)
    scan.pos = this.aheadEnd
    scan.next()
    return scan
  }

  /** Whether a line break sits between two offsets of the source. */
  lineBreakBetween(from: i32, to: i32): boolean {
    for (let i: i32 = from; i < to; i++) {
      const c = this.lexer.at(i)
      if (c === CH_LF || c === CH_CR) {
        return true
      }
    }
    return false
  }

  /**
   * Whether `namespace` or `module` opens a block (NL1027) rather than naming
   * a variable. TypeScript's rule, and the only place the words could not be
   * a name: a name or a string follows on the same line (`namespace N`,
   * `module "m"`), which two operands in a row never compiled as. Everywhere
   * else — `namespace * module`, `module(x)`, the word alone on its line —
   * each is the name it always was (`tests/parser/names-declarations.ts`,
   * `names-declaration-calls.ts`).
   */
  namespaceAhead(): boolean {
    if (!this.at(TOK_IDENT) || (this.value !== "namespace" && this.value !== "module")) {
      return false
    }
    const next = this.peek()
    return (next === TOK_IDENT || next === TOK_STRING) && this.aheadOnSameLine()
  }

  /**
   * After `declare` and a word on its line, held by `peek`: whether the two
   * open `declare global { }` (NL1019), or a declared `namespace` or `module`
   * (NL1027), by the rule `namespaceAhead` states. `scan` stands on the token
   * after the word.
   */
  declaredNamespaceAhead(scan: Lexer): boolean {
    const word = this.aheadValue
    if (word === "global") {
      return scan.kind === TOK_LBRACE
    }
    if (word !== "namespace" && word !== "module") {
      return false
    }
    return (
      (scan.kind === TOK_IDENT || scan.kind === TOK_STRING) &&
      !this.lineBreakBetween(this.aheadEnd, scan.start)
    )
  }

  /**
   * `namespace A.B { ... }`, `module "m" { ... }` and `declare global { ... }`
   * as one N_NAMESPACE whose text is the keyword, for Phase 0 to refuse. The
   * body is a BLOCK passed over unread (`src/nodes.ts`); a body-less
   * `declare module "m";` has an EMPTY one, and anything else without a body
   * is the syntax error it is in TypeScript.
   */
  parseNamespace(start: i32, flags: i32): Node {
    const node = this.node(N_NAMESPACE, start, this.end)
    node.text = this.value
    node.flags = flags
    if (node.text === "global") {
      node.children.push(this.parseIdentifier())
    } else {
      this.advance() // `namespace` or `module`
      if (this.at(TOK_STRING)) {
        const name = this.node(N_STRING, this.start, this.end)
        name.text = this.value
        this.advance()
        node.children.push(name)
      } else {
        node.children.push(this.parseQualifiedName())
      }
    }
    // Only a module named by a string may go without a body, as in TypeScript.
    if (!this.at(TOK_LBRACE) && node.children[0].kind === N_STRING) {
      node.children.push(this.empty())
      this.expectSemicolon()
      node.end = this.previousEnd
      return node
    }
    // The body is passed over rather than read: Phase 0 refuses the block
    // whatever it holds, and a declared one holds ambient declarations —
    // functions without bodies, `export =` — that this grammar does not have.
    const body = this.node(N_BLOCK, this.start, this.end)
    this.skipBraces()
    body.end = this.previousEnd
    node.children.push(body)
    node.end = this.previousEnd
    return node
  }

  /**
   * `@expr`, the head of a decorator (NL1006): an N_DECORATOR holding the
   * expression, to which the caller adds what it decorates. The expression is
   * a name, a member access or a call, as TypeScript reads one.
   */
  parseDecoratorHead(start: i32): Node {
    const node = this.node(N_DECORATOR, start, this.end)
    this.advance() // `@`
    const expressionStart = this.start
    node.children.push(this.parseCallOrMember(this.parsePrimary(), expressionStart))
    return node
  }

  /** `var` followed by a name: the one place the word opens a declaration. */
  varAhead(): boolean {
    return this.at(TOK_IDENT) && this.value === "var" && this.peek() === TOK_IDENT && this.aheadOnSameLine()
  }

  /**
   * Whether the token after the current one starts on the same line. `var`
   * and `with` are identifiers to the lexer, and a program may use them as
   * names: `var` then `x` on the next line is two expression statements under
   * TypeScript's semicolon insertion, and compiled as that before these words
   * opened a construct, so a construct is read only where the words stand on
   * one line (WP33 R1). A line break inside a block comment counts, as it does
   * for semicolon insertion. `try` has a rule of its own (`tryStatementAhead`).
   */
  aheadOnSameLine(): boolean {
    this.peek()
    return !this.lineBreakBetween(this.end, this.aheadStart)
  }

  /**
   * Whether `try` opens a `try` statement rather than naming a variable. It
   * does when a block follows it on the same line, and, whatever line breaks
   * and comments sit between, when a block follows it and a *handler* follows
   * that block: `catch {`, `catch (e) {` or `finally {`. An Allman-style `try`
   * is therefore a statement. What stays a name is `try` alone on a line
   * before a block nothing handles, and `catch` and `finally` stay names too
   * where no handler's shape follows them (`finally();`, `catch(1);`), each
   * the shape that compiled before `try` opened a statement
   * (`tests/parser/names.ts`).
   */
  tryStatementAhead(): boolean {
    if (!this.at(TOK_IDENT) || this.value !== "try" || this.peek() !== TOK_LBRACE) {
      return false
    }
    if (this.aheadOnSameLine()) {
      return true
    }
    const close = this.closingBrace(this.aheadStart)
    if (close < 0) {
      return false
    }
    const scan = new Lexer(this.file.text)
    scan.pos = close
    scan.next()
    if (scan.kind !== TOK_IDENT || (scan.value !== "catch" && scan.value !== "finally")) {
      return false
    }
    const handler = scan.value
    scan.next()
    if (scan.kind === TOK_LBRACE) {
      return true
    }
    // `catch (e) {`, `catch (e: unknown) {` and a destructured `catch ({ message }) {`
    // or `catch ([a]) {`. A call's argument that is not a binding — `catch(1)`,
    // `catch([1, 2])`, `catch({ first: 1 })` — makes it the call it was.
    if (handler !== "catch" || scan.kind !== TOK_LPAREN) {
      return false
    }
    scan.next()
    if (!this.scanBinding(scan)) {
      return false
    }
    if (scan.kind === TOK_COLON) {
      // The annotation, to the parenthesis that closes the binding.
      scan.next()
      let depth = 0
      while (depth > 0 || scan.kind !== TOK_RPAREN) {
        if (scan.kind === TOK_END || scan.kind === TOK_SEMICOLON) {
          return false
        }
        if (scan.kind === TOK_LPAREN) {
          depth = depth + 1
        } else if (scan.kind === TOK_RPAREN) {
          depth = depth - 1
        }
        scan.next()
      }
    }
    if (scan.kind !== TOK_RPAREN) {
      return false
    }
    scan.next()
    return scan.kind === TOK_LBRACE
  }

  /**
   * Step `scan` over one binding TypeScript allows in a `catch`, from its first
   * token to the token after it, and answer whether it was one: a name, or an
   * object or array pattern whose leaves are names, with `key: pattern`,
   * `= default`, `...rest` and array holes. A literal is not a binding, which
   * is what tells a handler from a call of a function named `catch`.
   */
  scanBinding(scan: Lexer): boolean {
    if (scan.kind === TOK_IDENT) {
      scan.next()
      return true
    }
    if (scan.kind === TOK_LBRACKET) {
      scan.next()
      while (scan.kind !== TOK_RBRACKET) {
        if (scan.kind === TOK_COMMA) {
          scan.next() // a hole
          continue
        }
        if (scan.kind === TOK_DOT_DOT_DOT) {
          scan.next()
        }
        if (!this.scanBinding(scan) || !this.scanDefault(scan)) {
          return false
        }
        if (scan.kind === TOK_COMMA) {
          scan.next()
        } else if (scan.kind !== TOK_RBRACKET) {
          return false
        }
      }
      scan.next()
      return true
    }
    if (scan.kind === TOK_LBRACE) {
      scan.next()
      while (scan.kind !== TOK_RBRACE) {
        if (scan.kind === TOK_DOT_DOT_DOT) {
          scan.next()
          if (scan.kind !== TOK_IDENT) {
            return false
          }
          scan.next()
        } else {
          if (scan.kind !== TOK_IDENT && scan.kind !== TOK_STRING && scan.kind !== TOK_NUMBER) {
            return false
          }
          const shorthand = scan.kind === TOK_IDENT
          scan.next()
          if (scan.kind === TOK_COLON) {
            scan.next()
            if (!this.scanBinding(scan)) {
              return false
            }
          } else if (!shorthand) {
            return false
          }
          if (!this.scanDefault(scan)) {
            return false
          }
        }
        if (scan.kind === TOK_COMMA) {
          scan.next()
        } else if (scan.kind !== TOK_RBRACE) {
          return false
        }
      }
      scan.next()
      return true
    }
    return false
  }

  /** Step over a binding's `= default`, if it has one, to the `,` or bracket after it. */
  scanDefault(scan: Lexer): boolean {
    if (scan.kind !== TOK_ASSIGN) {
      return true
    }
    scan.next()
    let depth = 0
    while (true) {
      if (scan.kind === TOK_END || scan.kind === TOK_SEMICOLON) {
        return false
      }
      const closes = scan.kind === TOK_RPAREN || scan.kind === TOK_RBRACE || scan.kind === TOK_RBRACKET
      if (depth === 0 && (closes || scan.kind === TOK_COMMA)) {
        return true
      }
      if (scan.kind === TOK_LPAREN || scan.kind === TOK_LBRACE || scan.kind === TOK_LBRACKET) {
        depth = depth + 1
      } else if (closes) {
        depth = depth - 1
      }
      scan.next()
    }
  }

  /**
   * The end of the `}` that closes the `{` at `open`, or -1 when the file
   * ends first. Every brace the scan passes is recorded in `closingBraces`.
   */
  closingBrace(open: i32): i32 {
    const known = this.closingBraces.get(`${open}`, -1)
    if (known >= 0) {
      return known
    }
    const scan = new Lexer(this.file.text)
    scan.pos = open
    const opens: i32[] = []
    while (true) {
      scan.next()
      if (scan.kind === TOK_END) {
        return -1
      }
      if (scan.kind === TOK_LBRACE) {
        opens.push(scan.start)
      } else if (scan.kind === TOK_RBRACE) {
        const matched = opens.pop()
        this.closingBraces.set(`${matched}`, scan.end)
        if (opens.length === 0) {
          return scan.end
        }
      }
    }
  }

  /**
   * Whether `with` opens a `with` statement rather than calling a function
   * named `with`, which a program may declare and call (`with(5);`). The two
   * share `with (…)`, so a scratch lexer, as in `startsArrowDeclaration`, runs
   * to the parenthesis that closes it and looks at what follows: a statement
   * on the same line — a block, a name or a statement keyword — makes it the
   * statement, and anything else the call it has always been. Everything read
   * as the statement here was a syntax error as a call.
   */
  withStatementAhead(): boolean {
    if (!this.at(TOK_IDENT) || this.value !== "with" || this.peek() !== TOK_LPAREN) {
      return false
    }
    const scan = new Lexer(this.file.text)
    scan.pos = this.aheadEnd
    let depth = 1
    while (depth > 0) {
      scan.next()
      if (scan.kind === TOK_END) {
        return false
      }
      if (scan.kind === TOK_LPAREN) {
        depth = depth + 1
      } else if (scan.kind === TOK_RPAREN) {
        depth = depth - 1
      }
    }
    const close = scan.end
    scan.next()
    for (let i: i32 = close; i < scan.start; i++) {
      const c = this.lexer.at(i)
      if (c === CH_LF || c === CH_CR) {
        return false
      }
    }
    switch (scan.kind) {
      case TOK_LBRACE:
      case TOK_IF:
      case TOK_WHILE:
      case TOK_DO:
      case TOK_FOR:
      case TOK_SWITCH:
      case TOK_RETURN:
      case TOK_THROW:
      case TOK_BREAK:
      case TOK_CONTINUE:
      case TOK_LET:
      case TOK_CONST:
        return true
      case TOK_IDENT:
        // A word that continues an expression after a call.
        return (
          scan.value !== "as" &&
          scan.value !== "satisfies" &&
          scan.value !== "in" &&
          scan.value !== "instanceof"
        )
      default:
        return false
    }
  }

  /**
   * Whether the `function` after the `default` in hand has no name: a `(`, a
   * `<` or the `*` of a generator and then one of those follows it, as
   * nothing can after a named one.
   */
  anonymousFunctionAhead(): boolean {
    const scan = this.scanAfterAhead()
    if (scan.kind === TOK_STAR) {
      scan.next()
    }
    return scan.kind === TOK_LPAREN || scan.kind === TOK_LT
  }

  /** Mark a declaration `export`ed, which is a modifier rather than a child. */
  exportable(declaration: Node, exported: boolean): Node {
    if (exported) {
      declaration.flags = declaration.flags | FLAG_EXPORTED
    }
    return declaration
  }

  /**
   * `@dec` in front of a declaration (NL1006): a DECORATOR around what it
   * decorates, the next decorator or the declaration, and `flags` —
   * `export`, and `default` after `export default @dec` — go on that
   * declaration, under every decorator (`export @a @b class C`).
   */
  parseDecorated(start: i32, flags: i32): Node {
    const decorator = this.parseDecoratorHead(start)
    const decorated = this.parseDeclaration()
    let declaration = decorated
    while (declaration.kind === N_DECORATOR && declaration.children.length > 1) {
      declaration = declaration.children[1]
    }
    declaration.flags = declaration.flags | flags
    decorator.children.push(decorated)
    decorator.end = this.previousEnd
    return decorator
  }

  /**
   * After `export`, on `default`. A function, a class, an interface or a
   * decorated declaration is that declaration with FLAG_DEFAULT, named or
   * not (NL2130, NL2131; an anonymous one NL2203, NL2018); anything else is
   * the value `export default` exports (NL2129). The words TypeScript reads
   * as modifiers here are its own: `async` before `function` and `abstract`
   * before `class`, each on the line of the word after it.
   */
  parseExportDefault(start: i32): Node {
    const next = this.peek()
    const flags = FLAG_EXPORTED | FLAG_DEFAULT
    if (next === TOK_FUNCTION) {
      const anonymous = this.anonymousFunctionAhead()
      this.advance() // `default`
      return this.flagged(this.parseFunction(start, anonymous), flags)
    }
    if (next === TOK_CLASS || this.defaultAbstractClassAhead()) {
      this.advance() // `default`
      let classFlags = flags
      if (this.at(TOK_IDENT)) {
        this.advance() // `abstract`
        classFlags = classFlags | FLAG_ABSTRACT
      }
      return this.flagged(this.parseClass(start), classFlags)
    }
    if (next === TOK_INTERFACE) {
      this.advance() // `default`
      return this.flagged(this.parseInterface(start), flags)
    }
    if (next === TOK_AT) {
      this.advance() // `default`
      return this.parseDecorated(start, flags)
    }
    this.advance() // `default`
    if (
      this.at(TOK_IDENT) &&
      this.value === "async" &&
      this.peek() === TOK_FUNCTION &&
      this.aheadOnSameLine()
    ) {
      const anonymous = this.anonymousFunctionAhead()
      this.advance() // `async`
      return this.flagged(this.parseFunction(start, anonymous), flags | FLAG_ASYNC)
    }
    const previous = this.beginForm()
    return this.endForm(this.finishExportAssignment(start, "default"), previous, false)
  }

  /** After `export`, on `default`: whether `abstract class` follows, the two on one line. */
  defaultAbstractClassAhead(): boolean {
    if (this.peek() !== TOK_IDENT || this.aheadValue !== "abstract") {
      return false
    }
    const scan = this.scanAfterAhead()
    return scan.kind === TOK_CLASS && !this.lineBreakBetween(this.aheadEnd, scan.start)
  }

  /** `export = <value>;` (NL2129), on `=`. */
  parseExportAssignment(start: i32): Node {
    this.advance() // `=`
    return this.finishExportAssignment(start, "=")
  }

  /** The value after `export default` or `export =` (NL2129), whose word, `default` or `=`, is consumed. */
  finishExportAssignment(start: i32, word: string): Node {
    const node = this.node(N_EXPORT_ASSIGNMENT, start, this.previousEnd)
    node.text = word
    node.children.push(this.parseExpression())
    this.expectSemicolon()
    node.end = this.previousEnd
    return node
  }

  /**
   * After `export`, on `type`: whether it opens `export type { A }` or
   * `export type * from "./m"` rather than an exported alias, whose name
   * cannot be `{` or `*`.
   */
  exportTypeListAhead(): boolean {
    if (!this.at(TOK_IDENT) || this.value !== "type") {
      return false
    }
    const next = this.peek()
    return next === TOK_LBRACE || next === TOK_STAR
  }

  /**
   * `export { a, b as c }`, with or without `from "./m"`, `export * from "./m"`
   * and `export * as ns from "./m"`, after `export` (NL2128). Attributes after
   * the specifier are passed over: the declaration is refused whatever it
   * holds.
   */
  parseExportDeclaration(start: i32): Node {
    const node = this.node(N_EXPORT_DECLARATION, start, this.end)
    if (this.at(TOK_IDENT)) {
      this.advance() // `type`
      node.flags = FLAG_TYPE_ONLY
    }
    let from = false
    if (this.eat(TOK_STAR)) {
      if (this.at(TOK_IDENT) && this.value === "as") {
        this.advance()
        node.children.push(this.parseModuleExportName())
      } else {
        node.children.push(this.empty())
      }
      this.expectFrom()
      from = true
    } else {
      node.children.push(this.parseSpecifiers(false))
      if (this.at(TOK_IDENT) && this.value === "from") {
        this.advance()
        from = true
      }
    }
    if (from) {
      this.parseModuleSpecifier(node)
      if (this.attributesAhead()) {
        this.skipAttributes()
      }
    }
    this.expectSemicolon()
    node.end = this.previousEnd
    return node
  }

  /** `export as namespace X;` (NL2230), after `export`, on `as`. */
  parseNamespaceExport(start: i32): Node {
    const node = this.node(N_NAMESPACE_EXPORT, start, this.end)
    this.advance() // `as`
    if (this.at(TOK_IDENT) && this.value === "namespace") {
      this.advance()
    } else {
      this.report(`expected \`namespace\`, found \`${tokenName(this.kind)}\``, this.start, this.end)
    }
    node.children.push(this.parseIdentifier())
    this.expectSemicolon()
    node.end = this.previousEnd
    return node
  }

  /**
   * Whether `import` opens an import declaration rather than an expression,
   * `import("./m")` or `import.meta`: TypeScript's test, a string, `*`, `{`,
   * a name or a keyword after it.
   */
  importDeclarationAhead(): boolean {
    const next = this.peek()
    return (
      next === TOK_STRING ||
      next === TOK_STAR ||
      next === TOK_LBRACE ||
      next === TOK_IDENT ||
      (next >= TOK_FUNCTION && next <= TOK_SUPER)
    )
  }

  /**
   * `import { a, b as c } from "./m";` — the only import form there is — and
   * every other form TypeScript reads, each the N_IMPORT `src/nodes.ts`
   * describes, for the phase that owns its rule to refuse: a default or a
   * namespace import, a side-effect import, `import type`, `import defer`, a
   * specifier that is not a string literal and attributes after it. `import
   * x = require("./m")` is an N_IMPORT_EQUALS.
   *
   * `type` and `defer` are modifiers where TypeScript reads them as one, and
   * names everywhere else: `import type from "./m"` imports a default called
   * `type` (`typeModifierAhead`, `deferModifierAhead`).
   */
  parseImport(start: i32): Node {
    this.advance() // `import`
    const node = this.node(N_IMPORT, start, this.end)
    const list = this.list()
    if (this.typeModifierAhead()) {
      this.advance()
      node.flags = FLAG_TYPE_ONLY
    } else if (this.deferModifierAhead()) {
      this.advance()
      node.flags = FLAG_DEFER
    }
    let defaultName: Node | null = null
    if (this.bindingNameAhead()) {
      const name = this.parseIdentifier()
      const clause = this.at(TOK_COMMA) || (this.at(TOK_IDENT) && this.value === "from")
      if (!clause && (node.flags & FLAG_DEFER) === 0) {
        return this.parseImportEquals(node, name)
      }
      defaultName = name
    }
    let bindings = list
    if (defaultName !== null && !this.eat(TOK_COMMA)) {
      bindings = this.empty()
    } else if (this.at(TOK_STAR)) {
      this.advance()
      if (this.at(TOK_IDENT) && this.value === "as") {
        this.advance()
      } else {
        this.report(`expected \`as\`, found \`${tokenName(this.kind)}\``, this.start, this.end)
      }
      bindings = this.parseImportedName()
    } else if (this.at(TOK_LBRACE) || defaultName !== null) {
      if (!this.expect(TOK_LBRACE)) {
        return this.finish(node, this.closeList(list))
      }
      this.readSpecifiers(list, true)
    } else {
      // A side-effect import, `import "./m"`: no bindings and no `from`.
      bindings = this.empty()
    }
    node.children.push(bindings === list ? this.closeList(list) : bindings)
    if (defaultName !== null) {
      node.children.push(defaultName)
    }
    if (bindings.kind !== N_EMPTY || defaultName !== null) {
      this.expectFrom()
    }
    this.parseModuleSpecifier(node)
    if (this.attributesAhead()) {
      this.skipAttributes()
      node.flags = node.flags | FLAG_ATTRIBUTES
    }
    this.expectSemicolon()
    node.end = this.previousEnd
    return node
  }

  /**
   * On `type` after `import`: whether it is the modifier of `import type`
   * rather than a default import called `type`. TypeScript's rule: `{`, `*`
   * or a name follows it, and when that name is `from`, the word after it is
   * `from` or `=` — `import type from "./m"` is the default import, `import
   * type from from "./m"` the type-only one.
   */
  typeModifierAhead(): boolean {
    if (!this.at(TOK_IDENT) || this.value !== "type") {
      return false
    }
    const next = this.peek()
    if (next === TOK_LBRACE || next === TOK_STAR) {
      return true
    }
    if (next !== TOK_IDENT || isReservedWord(this.aheadValue)) {
      return false
    }
    if (this.aheadValue !== "from") {
      return true
    }
    const scan = this.scanAfterAhead()
    return (scan.kind === TOK_IDENT && scan.value === "from") || scan.kind === TOK_ASSIGN
  }

  /**
   * On `defer` after `import`: whether it is the modifier of `import defer`
   * (NL1059) rather than a default import called `defer`. TypeScript's rule:
   * anything but `,` or `=` follows it, and `from` only when no string comes
   * after that `from`.
   */
  deferModifierAhead(): boolean {
    if (!this.at(TOK_IDENT) || this.value !== "defer") {
      return false
    }
    const next = this.peek()
    if (next === TOK_COMMA || next === TOK_ASSIGN) {
      return false
    }
    if (next !== TOK_IDENT || this.aheadValue !== "from") {
      return true
    }
    return this.scanAfterAhead().kind !== TOK_STRING
  }

  /**
   * `import x = require("./m");` or `import x = A.B;`, on `=` after the name
   * (NL2230, or NL2226 when exported). `node` is the N_IMPORT already made,
   * which becomes the N_IMPORT_EQUALS, keeping `import type`'s flag.
   */
  parseImportEquals(node: Node, name: Node): Node {
    node.kind = N_IMPORT_EQUALS
    node.children.push(name)
    this.expect(TOK_ASSIGN)
    if (this.at(TOK_IDENT) && this.value === "require" && this.peek() === TOK_LPAREN) {
      this.advance() // `require`
      this.advance() // `(`
      if (this.at(TOK_STRING)) {
        const specifier = this.node(N_STRING, this.start, this.end)
        specifier.text = this.value
        this.advance()
        node.children.push(specifier)
      } else {
        node.children.push(this.parseExpression())
      }
      this.expect(TOK_RPAREN)
    } else {
      node.children.push(this.parseQualifiedName())
    }
    this.expectSemicolon()
    node.end = this.previousEnd
    return node
  }

  /** `A.B.C`, a namespace's name or what `import x =` names: an IDENT, or a MEMBER for each dot. */
  parseQualifiedName(): Node {
    const start = this.start
    let name = this.parseIdentifier()
    while (this.eat(TOK_DOT)) {
      name = this.parseMemberName(name, start)
    }
    return name
  }

  /** Start reading an import or export form (`formStart`); answers the mark `endForm` restores. */
  beginForm(): i32 {
    const previous = this.formStart
    this.formStart = this.diagnostics.length
    return previous
  }

  /**
   * Finish the form `beginForm` started. When it reported a syntax error, the
   * rest of its statement is passed over — up to a `;`, which is consumed,
   * a line break or the end of the file, or, in a body, the `}` that closes
   * it. A declaration on the next line therefore starts clean; anything later
   * on the same line, a declaration included, is part of the statement passed
   * over (`import x = 5 export const y = ...` is one syntax error and nothing
   * about `y`), which reports no more than refusing the form at its first
   * token did.
   */
  endForm(node: Node, previous: i32, nested: boolean): Node {
    if (this.diagnostics.length > this.formStart) {
      // The token the error named, when the parser still stands on it and it
      // could not open the next declaration, is part of this statement too,
      // on whatever line it stands — and so is a `;` after it.
      const keyword = this.kind >= TOK_FUNCTION && this.kind <= TOK_SUPER
      if (this.diagnostics[this.formStart].start === this.start && !keyword && !this.at(TOK_END)) {
        this.advance()
        if (this.eat(TOK_SEMICOLON)) {
          this.formStart = previous
          node.end = this.previousEnd
          return node
        }
      }
      while (!this.at(TOK_END) && !this.newlineBefore() && !(nested && this.at(TOK_RBRACE))) {
        if (this.eat(TOK_SEMICOLON)) {
          break
        }
        this.advance()
      }
      node.end = this.previousEnd
    }
    this.formStart = previous
    return node
  }

  /**
   * `import` followed by nothing an import or `import(...)` could open —
   * `import;`, `import 5`, `import.meta` — reported as it always was, the `{`
   * the one import form wants, so a malformed import costs no more
   * diagnostics than it did.
   */
  parseMalformedImport(start: i32): Node {
    this.advance() // `import`
    const node = this.node(N_IMPORT, start, this.end)
    const list = this.list()
    this.expect(TOK_LBRACE)
    return this.finish(node, this.closeList(list))
  }

  /** `from`, or the syntax error that it is missing. */
  expectFrom(): void {
    if (this.at(TOK_IDENT) && this.value === "from") {
      this.advance()
    } else {
      this.report(`expected \`from\`, found \`${tokenName(this.kind)}\``, this.start, this.end)
    }
  }

  /**
   * The specifier of an import or an export: a string literal, whose value is
   * `node`'s text, or anything else TypeScript reads there, which is an
   * expression — read and dropped, with FLAG_COMPUTED for the refusal
   * (NL2212).
   */
  parseModuleSpecifier(node: Node): void {
    if (this.at(TOK_STRING)) {
      node.text = this.value
      this.advance()
      return
    }
    // A reserved word that cannot open an expression, `import with from`,
    // is the syntax error TypeScript reports there too; `typeof`, `void` and
    // `delete` open one.
    if (this.at(TOK_IDENT) && isReservedWord(this.value) && !isPrefixWord(this.value)) {
      this.report(`expected a module specifier, found \`${this.value}\``, this.start, this.end)
      return
    }
    node.flags = node.flags | FLAG_COMPUTED
    this.parseExpression()
  }

  /**
   * Whether a name that can be bound stands here: an identifier that is not a
   * word TypeScript reserves. The lexer reads `with`, `var`, `in` and the rest
   * as identifiers, so that each construct can be refused by its rule; where
   * an import binds a name, TypeScript refuses them as syntax, and so does
   * this parser.
   */
  bindingNameAhead(): boolean {
    return this.at(TOK_IDENT) && !isReservedWord(this.value)
  }

  /** A name an import binds, `bindingNameAhead`'s, or the syntax error that it is not one. */
  parseImportedName(): Node {
    if (this.at(TOK_IDENT) && isReservedWord(this.value)) {
      return this.fail(`expected a name, found the reserved word \`${this.value}\``)
    }
    return this.parseIdentifier()
  }

  /** `with` or `assert` after a specifier, on its line: import attributes. */
  attributesAhead(): boolean {
    return this.at(TOK_IDENT) && (this.value === "with" || this.value === "assert") && !this.newlineBefore()
  }

  /**
   * `with { type: "json" }`, passed over unread as a namespace body is: the
   * import is refused whatever the attributes say (NL1057).
   */
  skipAttributes(): void {
    this.advance() // `with` or `assert`
    this.skipBraces()
  }

  /**
   * `{ ... }` passed over unread, from its `{` past the `}` that closes it —
   * a namespace body, import attributes — or the syntax error that the `{`
   * or its `}` is missing.
   */
  skipBraces(): void {
    if (!this.at(TOK_LBRACE)) {
      this.expect(TOK_LBRACE)
      return
    }
    const close = this.closingBrace(this.start)
    while ((close < 0 || this.start < close) && !this.at(TOK_END)) {
      this.advance()
    }
    if (close < 0) {
      this.expect(TOK_RBRACE)
    }
  }

  /** `{ a, b as c }`, from its `{`, as a LIST of IMPORT_SPEC. */
  parseSpecifiers(isImport: boolean): Node {
    const list = this.list()
    if (this.expect(TOK_LBRACE)) {
      this.readSpecifiers(list, isImport)
    }
    return this.closeList(list)
  }

  /** The specifiers between braces whose `{` is consumed, into `list`, and the `}`. */
  readSpecifiers(list: Node, isImport: boolean): void {
    while (!this.at(TOK_RBRACE) && !this.at(TOK_END)) {
      list.children.push(this.parseSpecifier(isImport))
      if (!this.eat(TOK_COMMA)) {
        break
      }
    }
    this.expect(TOK_RBRACE)
  }

  /**
   * One specifier between an import's or an export's braces, read the way
   * TypeScript reads it (`parseImportOrExportSpecifier`). `type` in front is
   * the modifier of a type-only specifier (NL2243) only where a name follows
   * it that could not be its alias — `{ type }`, `{ type as t }` and
   * `{ type as as }` each import a name `type` — and the name before `as`
   * may be a keyword or a string (NL1058) where a local name may be neither:
   * a keyword or a string there is the syntax error it is in TypeScript.
   */
  parseSpecifier(isImport: boolean): Node {
    const specStart = this.start
    let reserved = this.keywordHere()
    let name = this.parseModuleExportName()
    // Made here, after the first name, so a specifier that compiles numbers
    // its nodes as it always did.
    const spec = this.node(N_IMPORT_SPEC, specStart, name.end)
    let property = name
    let alias = true
    if (name.kind === N_IDENT && name.text === "type" && !reserved) {
      if (this.at(TOK_IDENT) && this.value === "as") {
        const firstAs = this.parseModuleExportName()
        if (this.at(TOK_IDENT) && this.value === "as") {
          const secondAs = this.parseModuleExportName()
          if (this.moduleExportNameAhead()) {
            // `{ type as as x }`: a type-only `as`, renamed.
            spec.flags = FLAG_TYPE_ONLY
            property = firstAs
            reserved = this.keywordHere()
            name = this.parseModuleExportName()
          } else {
            // `{ type as as }`: `type`, renamed `as`.
            name = secondAs
          }
          alias = false
        } else if (this.moduleExportNameAhead()) {
          // `{ type as x }`: `type`, renamed.
          reserved = this.keywordHere()
          name = this.parseModuleExportName()
          alias = false
        } else {
          // `{ type as }`: a type-only `as`.
          spec.flags = FLAG_TYPE_ONLY
          property = firstAs
          name = firstAs
        }
      } else if (this.moduleExportNameAhead()) {
        // `{ type x }`: a type-only `x`.
        spec.flags = FLAG_TYPE_ONLY
        reserved = this.keywordHere()
        name = this.parseModuleExportName()
        property = name
      }
    }
    if (alias && this.at(TOK_IDENT) && this.value === "as") {
      this.advance()
      reserved = this.keywordHere()
      name = this.parseModuleExportName()
    }
    if (isImport && (reserved || name.kind !== N_IDENT)) {
      this.report("expected a name, found a keyword or a string", name.start, name.end)
    }
    spec.text = name.text
    spec.children.push(property)
    spec.end = name.end
    return spec
  }

  /** Whether the name about to be read is a keyword rather than an identifier or a string. */
  keywordHere(): boolean {
    return this.kind !== TOK_IDENT && this.kind !== TOK_STRING
  }

  /** Whether a module export name stands here: a name, a keyword or a string. */
  moduleExportNameAhead(): boolean {
    return this.at(TOK_IDENT) || this.at(TOK_STRING) || (this.kind >= TOK_FUNCTION && this.kind <= TOK_SUPER)
  }

  /**
   * A name in an import or export list: an IDENT, a keyword read as the name
   * it spells (`{ default as d }`), or the STRING a module export name may be
   * written as (NL1058).
   */
  parseModuleExportName(): Node {
    if (this.at(TOK_STRING)) {
      const name = this.node(N_STRING, this.start, this.end)
      name.text = this.value
      this.advance()
      return name
    }
    if (this.kind >= TOK_FUNCTION && this.kind <= TOK_SUPER) {
      const name = this.node(N_IDENT, this.start, this.end)
      name.text = tokenName(this.kind)
      this.advance()
      return name
    }
    return this.parseIdentifier()
  }

  /** Attach `list` and close `node` at the token just consumed. */
  finish(node: Node, list: Node): Node {
    node.children.push(list)
    node.end = this.previousEnd
    return node
  }

  /**
   * `function f(...)`, with its name unless `anonymous`: only `export default`
   * may leave it out, and TypeScript says so as syntax everywhere else.
   */
  parseFunction(start: i32, anonymous: boolean): Node {
    this.advance() // `function`
    const node = this.node(N_FUNCTION, start, this.end)
    // `function*`, for Phase 0 to refuse (NL1044): `*` cannot follow
    // `function` in anything else.
    if (this.eat(TOK_STAR)) {
      node.flags = FLAG_GENERATOR
    }
    // No name only after `export default`, which has looked for the `(`; the
    // checker refuses it (NL2203).
    node.children.push(anonymous ? this.empty() : this.parseIdentifier())
    // The type parameters are read here, where they are written, and pushed
    // last, where `nodes.ts` puts them: the first four children of an
    // `N_FUNCTION` mean what they have always meant, so nothing downstream
    // that indexes them moves (WP18).
    const typeParams = this.parseTypeParameters()
    node.children.push(this.parseParameters(true))
    node.children.push(this.parseReturnType())
    // `function f(): void;` is an overload signature, a function with no body
    // that the checker refuses (NL2204). It ends where a statement would,
    // which is TypeScript's rule too, so `{` on the next line is still the
    // body.
    if (this.at(TOK_LBRACE)) {
      node.children.push(this.parseBlock())
    } else {
      node.children.push(this.empty())
      this.expectSemicolon()
    }
    node.children.push(typeParams)
    node.end = this.previousEnd
    return node
  }

  /**
   * `declare function name(params): T;` — a C function this program calls but
   * does not define (WP27 S1).
   *
   * The same four children as `parseFunction` in the same positions, with the
   * empty node where the block goes: everything downstream indexes a function's
   * children positionally, so a foreign declaration is shaped like a function
   * with no body rather than a different kind of node. `FLAG_FOREIGN` is what
   * tells them apart, and the checker is what refuses a body here.
   */
  parseForeignFunction(start: i32): Node {
    this.advance() // `function`
    const node = this.node(N_FUNCTION, start, this.end)
    node.children.push(this.parseIdentifier())
    const typeParams = this.parseTypeParameters()
    node.children.push(this.parseParameters(true))
    node.children.push(this.parseReturnType())
    // A `;` ends the declaration. A `{` is a body, which is a mistake the
    // *checker* reports — so it is parsed into the body slot rather than left
    // for the next `parseDeclaration` to trip over, which is what lets stage1
    // say what stage0 says instead of complaining about a brace.
    if (this.at(TOK_LBRACE)) {
      node.children.push(this.parseBlock())
    } else {
      node.children.push(this.empty())
      this.eat(TOK_SEMICOLON)
    }
    // WP18 pushes the type-parameter list as the fifth child so the first four
    // keep their meaning. A foreign declaration pushes one too — parsed rather
    // than assumed empty, so `declare function f<T>(): i32` reaches the
    // checker's refusal instead of a syntax error, and so nothing that indexes
    // `children[4]` reads past the end of a foreign declaration.
    node.children.push(typeParams)
    node.flags = node.flags | FLAG_FOREIGN
    node.end = this.previousEnd
    return node
  }

  /**
   * `<T, U>` on a function, class or interface declaration (WP18), or an empty
   * list when there is none. Each parameter is its `IDENT`, so every reader
   * that wants the names keeps reading `.text` at the position it always did;
   * a constraint (`<T extends Shape>`, WP18 G6) is that identifier's one child.
   * The checker, not the parser, decides what a constraint may name, and it
   * refuses a default (`<T = string>`, FLAG_DEFAULT), because a type argument
   * is inferred from the arguments and a default would have no position to
   * fill.
   *
   * `<` here is unambiguous — a declaration cannot start with a comparison —
   * which is exactly why type arguments are written in an annotation and after
   * `new`, and nowhere else: one token of lookahead cannot tell `f<i32>(x)`
   * from `(f < i32) > (x)` (§2a).
   */
  parseTypeParameters(): Node {
    const list = this.list()
    if (!this.at(TOK_LT)) {
      return list
    }
    this.advance()
    while (!this.at(TOK_GT) && !this.at(TOK_END)) {
      const param = this.parseIdentifier()
      list.children.push(param)
      if (this.at(TOK_EXTENDS)) {
        this.advance()
        param.children.push(this.parseType())
      }
      // A default is read and flagged, and the checker refuses it (NL2292).
      if (this.eat(TOK_ASSIGN)) {
        this.parseType()
        param.flags = param.flags | FLAG_DEFAULT
      }
      if (!this.eat(TOK_COMMA)) {
        break
      }
    }
    this.expectTypeArgumentEnd()
    return this.closeList(list)
  }

  /**
   * Whether the `const` about to be parsed declares a function rather than a
   * value — `const double = (n: i32): i32 => n * 2`
   * (docs/wp22-arrow-functions.md).
   *
   * The parenthesis that opens a parameter list also opens a parenthesised
   * expression, so `const x = (a + b) * c` and `const f = (a: i32): i32 => a`
   * cannot be told apart by the one token of lookahead this parser keeps. A
   * scratch lexer runs ahead over the same source instead, counts to the
   * parenthesis that closes this one, and looks at what follows: `=>`, or the
   * `:` of a return type. Nothing else can follow a parameter list, and at the
   * head of an initialiser nothing else puts a `:` after a parenthesis — a
   * ternary's `:` belongs to a condition that started earlier.
   */
  startsArrowDeclaration(): boolean {
    const scan = new Lexer(this.file.text)
    scan.pos = this.start
    scan.next() // `const`
    scan.next()
    if (scan.kind !== TOK_IDENT) {
      return false
    }
    scan.next()
    if (scan.kind !== TOK_ASSIGN) {
      return false
    }
    scan.next()
    // `const f = async (x: i32): i32 => x`, whose `async` Phase 0 refuses
    // (NL1015). It is the modifier only with no line break before the
    // parameters, as in TypeScript; otherwise it is a name, and a call of it
    // is still a call.
    if (scan.kind === TOK_IDENT && scan.value === "async") {
      const wordEnd = scan.end
      scan.next()
      if ((scan.kind !== TOK_LPAREN && scan.kind !== TOK_LT) || this.lineBreakBetween(wordEnd, scan.start)) {
        return false
      }
    }
    // WP18: `const identity = <T>(x: T): T => x` puts a type parameter list
    // between the `=` and the parameters. It is skipped by matching `>` against
    // `<`. A constraint (G6) can nest one type argument list in another, and
    // the lexer merges the closers of `<T extends Box<Box<i32>>>` into `>>`
    // and `>>>`, so those count as two and three closers here exactly as
    // `expectTypeArgumentEnd` splits them.
    if (scan.kind === TOK_LT) {
      let angles = 1
      while (angles > 0) {
        scan.next()
        if (scan.kind === TOK_END) {
          return false
        }
        if (scan.kind === TOK_LT) {
          angles = angles + 1
        } else if (scan.kind === TOK_GT) {
          angles = angles - 1
        } else if (scan.kind === TOK_SHR) {
          angles = angles - 2
        } else if (scan.kind === TOK_USHR) {
          angles = angles - 3
        }
      }
      if (angles < 0) {
        return false
      }
      scan.next()
    }
    if (scan.kind !== TOK_LPAREN) {
      return false
    }
    let depth = 1
    while (depth > 0) {
      scan.next()
      if (scan.kind === TOK_END) {
        return false
      }
      if (scan.kind === TOK_LPAREN) {
        depth = depth + 1
      } else if (scan.kind === TOK_RPAREN) {
        depth = depth - 1
      }
    }
    scan.next()
    return scan.kind === TOK_ARROW || scan.kind === TOK_COLON
  }

  /**
   * `const double = (n: i32): i32 => n * 2;` -- the same `N_FUNCTION` the
   * `function` spelling builds, so every pass after this one is unchanged. The
   * body child is the `BLOCK` when there is one and the returned expression
   * when the body is concise.
   */
  parseArrowFunction(start: i32): Node {
    this.advance() // `const`
    const node = this.node(N_FUNCTION, start, this.end)
    node.children.push(this.parseIdentifier())
    this.expect(TOK_ASSIGN)
    // `startsArrowDeclaration` has already told the modifier from a name.
    if (this.at(TOK_IDENT) && this.value === "async") {
      this.advance()
      node.flags = FLAG_ASYNC
    }
    const typeParams = this.parseTypeParameters()
    node.children.push(this.parseParameters(true))
    node.children.push(this.parseReturnType())
    this.expect(TOK_ARROW)
    node.children.push(this.at(TOK_LBRACE) ? this.parseBlock() : this.parseExpression())
    node.children.push(typeParams)
    // `const f = (): i32 => 1, g = 2`: the names after the first, a sixth
    // child only when written, for the checker to refuse (NL2274).
    if (this.eat(TOK_COMMA)) {
      node.children.push(this.parseVariableDeclarations())
    }
    this.expectSemicolon()
    node.end = this.previousEnd
    return node
  }

  /**
   * `(a: T, b: U)`. An arrow in expression position may leave a parameter's
   * type out (`typed` false), because the function type it is passed for
   * supplies it.
   */
  parseParameters(typed: boolean): Node {
    const list = this.list()
    if (!this.expect(TOK_LPAREN)) {
      return list
    }
    // A default is an expression, and the list is a bracket that reads `in`
    // as the operator again.
    const outerNoIn = this.allowIn()
    while (!this.at(TOK_RPAREN) && !this.at(TOK_END)) {
      list.children.push(this.parseParameter(typed))
      if (!this.eat(TOK_COMMA)) {
        break
      }
    }
    this.noIn = outerNoIn
    this.expect(TOK_RPAREN)
    return this.closeList(list)
  }

  /**
   * `x: T`, or a decorator in front of one (NL1006). A rest parameter, a
   * destructuring pattern, `x?` and a default `x = 1` are read for the
   * checker to refuse (NL2235, NL2192, NL2233) — the default's value is read
   * and dropped — and none of the four needs its annotation to reach that
   * refusal, as none does in TypeScript.
   */
  parseParameter(typed: boolean): Node {
    const start = this.start
    if (this.at(TOK_AT)) {
      const decorator = this.parseDecoratorHead(start)
      decorator.children.push(this.parseParameter(typed))
      decorator.end = this.previousEnd
      return decorator
    }
    const param = this.node(N_PARAM, start, this.end)
    // `public x: i32`, a parameter property, for the checker to refuse
    // (NL2234): the word is a modifier only before a name, a pattern or `...`
    // on its line, which is TypeScript's rule, so `public: i32` is a
    // parameter called `public`.
    while (this.parameterModifierAhead()) {
      this.advance()
      param.flags = FLAG_PROPERTY
    }
    if (this.eat(TOK_DOT_DOT_DOT)) {
      param.flags = param.flags | FLAG_REST
    }
    param.children.push(this.parseBindingName())
    if (this.eat(TOK_QUESTION)) {
      param.flags = param.flags | FLAG_OPTIONAL
    }
    const refused = param.flags !== 0 || param.children[0].kind === N_BINDING_PATTERN || this.at(TOK_ASSIGN)
    if (this.at(TOK_COLON) || (typed && !refused)) {
      param.children.push(this.parseTypeAnnotation())
    } else {
      param.children.push(this.empty())
    }
    if (this.eat(TOK_ASSIGN)) {
      this.parseExpression()
      param.flags = param.flags | FLAG_DEFAULT
    }
    param.end = this.previousEnd
    return param
  }

  /** Whether the word in hand is an accessibility or `readonly` modifier on a parameter. */
  parameterModifierAhead(): boolean {
    if (!this.at(TOK_IDENT)) {
      return false
    }
    const word = this.value
    if (
      word !== "public" &&
      word !== "private" &&
      word !== "protected" &&
      word !== "readonly" &&
      word !== "override"
    ) {
      return false
    }
    const next = this.peek()
    return (
      (next === TOK_IDENT || next === TOK_LBRACE || next === TOK_LBRACKET || next === TOK_DOT_DOT_DOT) &&
      this.aheadOnSameLine()
    )
  }

  /**
   * The name a parameter or a declaration binds, or the destructuring
   * pattern in its place (`src/nodes.ts`, N_BINDING_PATTERN).
   */
  parseBindingName(): Node {
    if (!this.at(TOK_LBRACE) && !this.at(TOK_LBRACKET)) {
      return this.parseIdentifier()
    }
    const pattern = this.node(N_BINDING_PATTERN, this.start, this.end)
    this.skipBindingPattern()
    pattern.end = this.previousEnd
    return pattern
  }

  /**
   * `: T` after a signature. A missing one is EMPTY, and the checker names
   * the function it is missing from (NL2096).
   */
  parseReturnType(): Node {
    if (this.eat(TOK_COLON)) {
      return this.parseType()
    }
    return this.empty()
  }

  /** `: T`, required on every parameter, field and annotated declaration. */
  parseTypeAnnotation(): Node {
    if (this.eat(TOK_COLON)) {
      return this.parseType()
    }
    this.report("a type annotation is required", this.start, this.end)
    return this.empty()
  }

  /**
   * A class declaration, or a class expression where an operand stands. A
   * class with no name — `export default class { }`, or an expression — has
   * an EMPTY one, for the checker to refuse (NL2018): `extends` and
   * `implements` are keywords, so a name is exactly an identifier here.
   */
  parseClass(start: i32): Node {
    this.advance() // `class`
    const node = this.node(N_CLASS, start, this.end)
    node.children.push(this.at(TOK_IDENT) ? this.parseIdentifier() : this.empty())
    // Read where they are written and pushed last, where `nodes.ts` puts them:
    // the first four children of an `N_CLASS` mean what they have always meant,
    // so nothing downstream that indexes them moves (WP18 G5).
    const typeParams = this.parseTypeParameters()
    node.children.push(this.at(TOK_EXTENDS) ? this.parseHeritageName() : this.empty())
    const implemented = this.list()
    if (this.at(TOK_IMPLEMENTS)) {
      this.advance()
      while (true) {
        // A type reference rather than a bare identifier, because WP18 G5 lets
        // an implemented interface be an instantiation (`implements Container<T>`)
        // and `parseType` already reads exactly that shape.
        implemented.children.push(this.parseType())
        if (!this.eat(TOK_COMMA)) {
          break
        }
      }
    }
    node.children.push(this.closeList(implemented))
    node.children.push(this.parseClassBody())
    node.children.push(typeParams)
    node.end = this.previousEnd
    return node
  }

  parseHeritageName(): Node {
    this.advance() // `extends`
    return this.parseIdentifier()
  }

  parseClassBody(): Node {
    const members = this.list()
    if (!this.expect(TOK_LBRACE)) {
      return members
    }
    while (!this.at(TOK_RBRACE) && !this.at(TOK_END)) {
      const before = this.start
      members.children.push(this.parseMember())
      if (this.start === before && !this.at(TOK_RBRACE) && !this.at(TOK_END)) {
        this.advance()
      }
    }
    this.expect(TOK_RBRACE)
    return this.closeList(members)
  }

  /**
   * `readonly`, `public`, `private`, `protected` and `static` in front of a
   * member. `readonly` and `static` are recorded; the accessibility three are
   * accepted and ignored (docs/LANGUAGE.md, Classes).
   *
   * `static` used to be refused here, with a sentence of the parser's own.
   * The checker states it now, because the checker is the phase that knows
   * whether this is a field or a method and which class it is in, and stage0's
   * message names all three — so refusing it here is what kept
   * `nl2116_static_method` in `tests/wordings/parser_refusals.txt` rather than
   * letting the two compilers say the same thing
   * (docs/wp19-stage0-retirement.md R3).
   *
   * **What that move costs, deliberately.** A rule the checker owns is a rule a
   * member has to *parse* to reach, and five shapes do not: `static x;` (no
   * annotation), `static` alone, `static m(): i32;` (no body), `static m() { }`
   * (no return type) and `static { }` (a static block). A sixth,
   * `static x: i32 = 0` with no `;` before the `}`, parses since semicolon
   * insertion, and so it reaches the rule. Each used to hear
   * `static` from this function and now hears the syntax error about its other
   * defect instead, while stage0 names the static member — and the same is true
   * of `m?()` with no return type and `x? = 5` with no annotation, which never
   * reach the marker's rule either. Both compilers still refuse every one of
   * those programs, and the difference is §A3's declared class — stage1's first
   * diagnostic is a syntax error — which `--parity` declares and
   * `tests/self/reject-oracle.js` counts rather than fails
   * (`tests/cases/reject_cls_static_field_untyped`, `reject_cls_static_block`,
   * `reject_cls_method_optional_untyped`, `reject_cls_field_optional_untyped`).
   * Keeping a copy of the rule here would put the sentence back, uncoded and in
   * a phase that cannot name the member, which is the duplication this change
   * exists to remove.
   *
   * **That bucket counts; it does not gate.** `parser_refusals.txt` and
   * `stage1_divergence.txt` are shrink-only under `--strict-refusals`, but the
   * reject oracle's parser bucket is a tally in a summary line with no ceiling
   * beside it, so a later change that moves one more rule out of this parser's
   * reach migrates its case into the bucket without failing anything. Whoever
   * moves the next rule should read the bucket's number before and after.
   *
   * A word is a modifier only while the token after it is not the start of
   * what a member's *name* is followed by, because `static` is a name as well
   * as a modifier: `static: i32` and `static(): i32` are a field and a method
   * called `static`, and so are `static?: i32` and `static!: i32`, which is
   * what stage0 calls them (``Field `static` of class `C` cannot be
   * optional``).
   */
  parseMemberModifiers(): i32 {
    let flags = 0
    while (this.at(TOK_IDENT) && !this.startsMemberName()) {
      const word = this.value
      if (word === "static" && this.peek() === TOK_LBRACE) {
        // `static { }`, a static block, whatever line the brace is on.
        return flags
      }
      if (word === "readonly") {
        flags = flags | FLAG_READONLY
      } else if (word === "abstract") {
        // The checker's (NL2168), and a modifier only where TypeScript reads
        // one: on the line of a name, a `[` or a `*` after it. After `static`
        // it is left off, because `static` is written first and is the
        // refusal (`collectField`, `collectMethod`).
        if (!this.abstractModifierAhead()) {
          return flags
        }
        if ((flags & FLAG_STATIC) === 0) {
          flags = flags | FLAG_ABSTRACT
        }
      } else if (word === "static") {
        // `static` before `readonly` is the one ordering the checker needs; see
        // FLAG_STATIC_FIRST in `src/nodes.ts`.
        if ((flags & FLAG_READONLY) === 0) {
          flags = flags | FLAG_STATIC_FIRST
        }
        flags = flags | FLAG_STATIC
      } else if (word === "async") {
        // Phase 0's (NL1015), and a modifier only where TypeScript reads one:
        // on the line of what follows it, and in front of a name, a `[` or the
        // `*` of a generator.
        if (!this.asyncModifierAhead()) {
          return flags
        }
        flags = flags | FLAG_ASYNC
      } else if (word !== "public" && word !== "private" && word !== "protected") {
        return flags
      }
      this.advance()
    }
    return flags
  }

  /** Whether the `abstract` in hand is followed, on its line, by what a modifier can be. */
  abstractModifierAhead(): boolean {
    const next = this.peek()
    return (
      (next === TOK_IDENT ||
        next === TOK_STRING ||
        next === TOK_NUMBER ||
        next === TOK_LBRACKET ||
        next === TOK_STAR) &&
      this.aheadOnSameLine()
    )
  }

  /** Whether the `async` in hand is followed, on its line, by what a modifier can be. */
  asyncModifierAhead(): boolean {
    const next = this.peek()
    return (
      (next === TOK_IDENT || next === TOK_LBRACKET || next === TOK_STAR || next === TOK_STRING) &&
      this.aheadOnSameLine()
    )
  }

  /**
   * Whether the identifier in hand is a member's name rather than a modifier in
   * front of one: a name is followed by `(`, `<` (a generic method, WP18 G8),
   * `:`, `?`, `!`, `=` or `;`, and a modifier by the next word. The last two are the malformed members —
   * `static = 5;` and `static;` have no annotation and neither compiles — and
   * they are here because `static` is a name there too, which is what stage0
   * calls them (``Field `static` of class `C` needs a type annotation``): the
   * rule this function states is "the next token is not a name's follower", so
   * it had better be the rule it applies.
   */
  startsMemberName(): boolean {
    const next = this.peek()
    return (
      next === TOK_LPAREN ||
      next === TOK_LT ||
      next === TOK_COLON ||
      next === TOK_QUESTION ||
      next === TOK_BANG ||
      next === TOK_ASSIGN ||
      next === TOK_SEMICOLON
    )
  }

  /**
   * The `?` or `!` that may follow a member's name, as a flag rather than as a
   * refusal. Both are forbidden and the checker is what says so, in the words
   * that name the member and its class.
   */
  parseMemberMarker(): i32 {
    if (this.eat(TOK_QUESTION)) {
      return FLAG_OPTIONAL
    }
    if (this.eat(TOK_BANG)) {
      return FLAG_DEFINITE
    }
    return 0
  }

  /**
   * Whether the member about to be parsed is `m?(...)` — a method whose name
   * carries the optional marker. That needs one token more lookahead than
   * `peek` has, so it is a scan over the same source, the shape
   * `startsConstEnum` uses. `m!(...)` is not a spelling TypeScript has, so
   * only `?` is looked for, before the parameters or a generic method's `<`.
   */
  markedMethodAhead(): boolean {
    if (this.peek() !== TOK_QUESTION) {
      return false
    }
    const scan = new Lexer(this.file.text)
    scan.pos = this.start
    scan.next() // the name
    scan.next() // `?`
    scan.next()
    return scan.kind === TOK_LPAREN || scan.kind === TOK_LT
  }

  /**
   * Whether the member in hand is named `[Symbol.dispose]` and is a method: the
   * one computed name the grammar reads (WP29 P2). It is what TypeScript and
   * Node look for on the value of a `using` declaration, so `nish/threads`'s
   * scope declares one; which classes may is the validator's rule.
   */
  disposeNameAhead(): boolean {
    const scan = new Lexer(this.file.text)
    scan.pos = this.start
    scan.next() // `[`
    const words: string[] = []
    const kinds: i32[] = []
    for (let i: i32 = 0; i < 5; i++) {
      scan.next()
      kinds.push(scan.kind)
      words.push(scan.value)
    }
    return (
      kinds[0] === TOK_IDENT &&
      words[0] === "Symbol" &&
      kinds[1] === TOK_DOT &&
      kinds[2] === TOK_IDENT &&
      words[2] === "dispose" &&
      kinds[3] === TOK_RBRACKET &&
      kinds[4] === TOK_LPAREN
    )
  }

  /**
   * `[Symbol.dispose](): void { ... }`, as a method whose name is the text
   * `[Symbol.dispose]`: no declared name can spell it, so it cannot collide
   * with one, and the tree keeps the method's shape for everything that walks
   * members.
   */
  parseDisposeMethod(start: i32, modifiers: i32): Node {
    const method = this.node(N_METHOD, start, this.end)
    const name = this.node(N_IDENT, start, this.end)
    name.text = "[Symbol.dispose]"
    while (!this.at(TOK_RBRACKET)) {
      this.advance()
    }
    name.end = this.end
    this.advance() // `]`
    method.children.push(name)
    method.flags = modifiers
    method.children.push(this.parseParameters(true))
    method.children.push(this.parseReturnType())
    method.children.push(this.parseBlock())
    method.end = this.previousEnd
    return method
  }

  /**
   * A field, a method, or the constructor. `constructor` is an identifier to
   * the lexer, and only `constructor(` is one: a member called `constructor`
   * with a `:` after it takes the field path.
   *
   * That last part is a divergence older than this function's flags and is
   * recorded rather than fixed: `class C { constructor: i32 = 0; }` **compiles**
   * here and is a syntax error to the `typescript` package, which is the
   * direction `tests/wordings/stage1_divergence.txt` calls the serious one —
   * stage0 refuses a program stage1 accepts. No corpus program has the shape,
   * so nothing measures it (docs/wp19-stage0-retirement.md §2B).
   */
  parseMember(): Node {
    const start = this.start
    if (this.at(TOK_AT)) {
      const decorator = this.parseDecoratorHead(start)
      decorator.children.push(this.parseMember())
      decorator.end = this.previousEnd
      return decorator
    }
    let modifiers = this.parseMemberModifiers()
    // `static { }`, a static block, for the checker to refuse (NL2255): the
    // BLOCK among the members, spanning the word.
    if (this.at(TOK_IDENT) && this.value === "static" && this.peek() === TOK_LBRACE) {
      this.advance() // `static`
      const block = this.parseBlock()
      block.start = start
      return block
    }
    // `*m()`, a generator method, for Phase 0 to refuse (NL1044): a member
    // never opened with `*` before, so it cannot be anything else.
    if (this.eat(TOK_STAR)) {
      modifiers = modifiers | FLAG_GENERATOR
    }
    if (
      this.at(TOK_IDENT) &&
      this.value === "constructor" &&
      (this.peek() === TOK_LPAREN || this.peek() === TOK_LT)
    ) {
      this.advance()
      const ctor = this.node(N_CONSTRUCTOR, start, this.end)
      // WP18 G8: a constructor takes its class's type arguments, written after
      // `new`, and has none of its own — TypeScript says the same. The list is
      // read and refused here rather than carried to the checker because the
      // `typescript` package parses it and leaves the refusal to its own
      // checker, so a list kept on this node would be a tree
      // `tests/parser-oracle.js` cannot print (docs/wp18-generics.md §15.8).
      if (this.at(TOK_LT)) {
        const listStart = this.start
        this.parseTypeParameters()
        this.report(
          "a constructor cannot have type parameters: it takes its class's, which are written after `new` " +
            "(`new Box<i32>(v)`)",
          listStart,
          this.previousEnd
        )
      }
      // The constructor carries its modifiers too, and for the same reason the
      // field and the method do: `static constructor()` is a rule the checker
      // states. Dropping them here is how a `static` constructor came to be
      // compiled *and run* as the instance constructor once the parser stopped
      // refusing the word (docs/wp19-stage0-retirement.md R3).
      ctor.flags = modifiers
      ctor.children.push(this.parseParameters(true))
      // A return type (NL2189) is a third child, there only when written, and
      // a missing body (NL2091) an EMPTY one: the checker refuses both.
      const returnType: Node | null = this.eat(TOK_COLON) ? this.parseType() : null
      ctor.children.push(this.parseBody())
      if (returnType !== null) {
        ctor.children.push(returnType)
      }
      ctor.end = this.previousEnd
      return ctor
    }
    if (this.at(TOK_LBRACKET) && this.disposeNameAhead()) {
      return this.parseDisposeMethod(start, modifiers)
    }
    if (this.at(TOK_LBRACKET) && this.indexSignatureAhead()) {
      return this.parseIndexSignature(start, modifiers)
    }
    // `get x()` and `set x(v)`, for the checker to refuse (NL2209). A member
    // called `get` is followed by what follows a name, never by another name,
    // so the word is the accessor's wherever one follows it, a line break
    // between them included, as TypeScript reads it.
    if (this.accessorAhead()) {
      this.advance()
      modifiers = modifiers | FLAG_ACCESSOR
    }
    // `[k]: i32` and `[Symbol.iterator]() { }`, a computed name, for Phase 0
    // to refuse (NL1041): read before the method-or-field question, which
    // is then asked of the token after the `]`.
    const computed: Node | null = this.at(TOK_LBRACKET) ? this.parseComputedName() : null
    if (computed === null && !this.atMemberName()) {
      return this.fail(
        `a class member is a field, a method or a constructor, found \`${tokenName(this.kind)}\``
      )
    }
    if (computed !== null) {
      modifiers = modifiers | FLAG_COMPUTED
    }
    // `m?(): void` is a method with a marker, not a field: the `?` sits
    // between the name and the parameter list, so the one token of lookahead
    // that tells a method from a field has to look past it.
    //
    // `m<U>(...)` is a generic method (WP18 G8): a field is always followed by
    // `:`, `?`, `!`, `=` or `;`, so a `<` after a member's name can only open a
    // type parameter list.
    if (
      (modifiers & (FLAG_GENERATOR | FLAG_ACCESSOR)) !== 0 ||
      (computed === null
        ? this.peek() === TOK_LPAREN || this.peek() === TOK_LT || this.markedMethodAhead()
        : this.methodAfterComputedName())
    ) {
      const method = this.node(N_METHOD, start, this.end)
      method.children.push(computed === null ? this.parseMemberNameNode() : computed)
      // `m?<T>()`: the marker is written before the type parameters. An
      // accessor is refused whole, so its parameter needs no annotation to
      // reach the refusal, as `set x(v)` needs none in TypeScript.
      method.flags = modifiers | this.parseMemberMarker()
      const typeParams = this.parseTypeParameters()
      method.children.push(this.parseParameters((modifiers & FLAG_ACCESSOR) === 0))
      method.children.push(this.parseReturnType())
      method.children.push(this.parseBody())
      // The fifth child, where an `N_FUNCTION` keeps its list, and only when
      // there is one: a method without type parameters keeps exactly the tree
      // it always had, so `--emit-ast` and the parser oracle move for none.
      if (typeParams.children.length > 0) {
        method.children.push(typeParams)
      }
      method.end = this.previousEnd
      return method
    }
    const field = this.node(N_FIELD, start, this.end)
    field.children.push(computed === null ? this.parseMemberNameNode() : computed)
    field.flags = modifiers | this.parseMemberMarker()
    field.children.push(this.parseTypeAnnotation())
    field.children.push(this.eat(TOK_ASSIGN) ? this.parseExpression() : this.empty())
    this.expectSemicolon()
    field.end = this.previousEnd
    return field
  }

  /**
   * Whether `get` or `set` is in hand before a member's name — an identifier,
   * a string, a number or a computed `[k]` — which makes it an accessor's word
   * (NL2209). A member called `get` is followed by what follows a name, never
   * by another name, so the word is the accessor's wherever one follows it, a
   * line break between them included, as TypeScript reads it.
   */
  accessorAhead(): boolean {
    if (!this.at(TOK_IDENT) || (this.value !== "get" && this.value !== "set")) {
      return false
    }
    const next = this.peek()
    return next === TOK_IDENT || next === TOK_STRING || next === TOK_NUMBER || next === TOK_LBRACKET
  }

  /**
   * `[expr]`, a computed member name or object-literal key: the expression
   * between the brackets, where the member's name would be, and the member
   * carries FLAG_COMPUTED for Phase 0 to refuse (NL1041). `in` is an
   * operator here, as it is inside any bracket.
   */
  parseComputedName(): Node {
    this.advance() // `[`
    const outerNoIn = this.allowIn()
    const key = this.parseExpression()
    this.noIn = outerNoIn
    this.expect(TOK_RBRACKET)
    return key
  }

  /**
   * After a computed name: whether a method follows rather than a field — a
   * `(` or a `<`, or the `?` of `[k]?()` before one.
   */
  methodAfterComputedName(): boolean {
    if (this.at(TOK_QUESTION)) {
      return this.peek() === TOK_LPAREN || this.peek() === TOK_LT
    }
    return this.at(TOK_LPAREN) || this.at(TOK_LT)
  }

  /** Whether a member's name is in hand: an identifier, or a string or a number (NL2092). */
  atMemberName(): boolean {
    return this.at(TOK_IDENT) || this.at(TOK_STRING) || this.at(TOK_NUMBER)
  }

  /**
   * A member's name: its IDENT, or the STRING or NUMBER a member named
   * `"a b"` or `0` has in its place, for the checker to refuse (NL2092).
   */
  parseMemberNameNode(): Node {
    if (this.at(TOK_STRING)) {
      const name = this.node(N_STRING, this.start, this.end)
      name.text = this.value
      this.advance()
      return name
    }
    if (this.at(TOK_NUMBER)) {
      const name = this.node(N_NUMBER, this.start, this.end)
      name.text = withoutSeparators(this.value)
      this.advance()
      return name
    }
    return this.parseIdentifier()
  }

  /**
   * A method's or a constructor's body, or an EMPTY one where TypeScript
   * reads a signature — a `;`, or the place it would insert one — for the
   * checker to refuse (NL2090, NL2091). A `{` on the next line is the body.
   */
  parseBody(): Node {
    if (!this.at(TOK_LBRACE) && (this.at(TOK_SEMICOLON) || this.at(TOK_RBRACE) || this.newlineBefore())) {
      this.eat(TOK_SEMICOLON)
      return this.empty()
    }
    return this.parseBlock()
  }

  /**
   * Whether the `[` in hand opens an index signature, `[key: string]: T`,
   * rather than a computed name: a name and then `:` inside it.
   */
  indexSignatureAhead(): boolean {
    return this.peek() === TOK_IDENT && this.scanAfterAhead().kind === TOK_COLON
  }

  /** The `;` or `,` that may end an interface member or an index signature. */
  eatMemberSeparator(): void {
    if (!this.eat(TOK_SEMICOLON)) {
      this.eat(TOK_COMMA)
    }
  }

  /**
   * `[key: string]: T` in a class or an interface, for the checker to refuse
   * (NL2213, NL2214), with whatever modifiers were in front of it.
   */
  parseIndexSignature(start: i32, modifiers: i32): Node {
    const node = this.node(N_INDEX_SIGNATURE, start, this.end)
    node.flags = modifiers
    this.advance() // `[`
    const key = this.node(N_PARAM, this.start, this.end)
    key.children.push(this.parseIdentifier())
    key.children.push(this.parseTypeAnnotation())
    key.end = this.previousEnd
    node.children.push(key)
    this.expect(TOK_RBRACKET)
    node.children.push(this.parseTypeAnnotation())
    this.eatMemberSeparator()
    node.end = this.previousEnd
    return node
  }

  parseInterface(start: i32): Node {
    this.advance() // `interface`
    const node = this.node(N_INTERFACE, start, this.end)
    node.children.push(this.parseIdentifier())
    // Pushed last, like a class's and a function's, so the field list keeps
    // being child 1 for everything that already reads it (WP18 G5).
    const typeParams = this.parseTypeParameters()
    // `extends A, B`, for the checker to refuse (NL2215): a fourth child,
    // spanning the clause, there only when written.
    let heritage: Node | null = null
    if (this.at(TOK_EXTENDS)) {
      const clauseStart = this.start
      this.advance()
      const clause = this.list()
      while (true) {
        clause.children.push(this.parseType())
        if (!this.eat(TOK_COMMA)) {
          break
        }
      }
      this.closeList(clause)
      clause.start = clauseStart
      heritage = clause
    }
    const fields = this.list()
    if (this.expect(TOK_LBRACE)) {
      while (!this.at(TOK_RBRACE) && !this.at(TOK_END)) {
        const before = this.start
        fields.children.push(this.parseInterfaceMember())
        if (this.start === before && !this.at(TOK_RBRACE) && !this.at(TOK_END)) {
          this.advance()
        }
      }
      this.expect(TOK_RBRACE)
    }
    node.children.push(this.closeList(fields))
    node.children.push(typeParams)
    if (heritage !== null) {
      node.children.push(heritage)
    }
    node.end = this.previousEnd
    return node
  }

  /**
   * One member of an interface. A field is what the language has; a method or
   * an accessor signature (NL2048), an index signature (NL2214), a call or
   * construct signature (NL2257) and a member named by a string or a number
   * (NL2092) are read for the checker to refuse, and a computed name (NL1041)
   * for Phase 0.
   */
  parseInterfaceMember(): Node {
    const start = this.start
    // `(x: i32): T` and `new (): T`, a call and a construct signature: `new`
    // is a keyword, so before `(` or `<` it is always this.
    const construct = this.at(TOK_NEW) && (this.peek() === TOK_LPAREN || this.peek() === TOK_LT)
    if (construct || this.at(TOK_LPAREN) || this.at(TOK_LT)) {
      if (construct) {
        this.advance() // `new`
      }
      return this.parseMethodSignature(start, construct ? FLAG_CONSTRUCT : 0, false, null)
    }
    if (this.at(TOK_LBRACKET) && this.indexSignatureAhead()) {
      return this.parseIndexSignature(start, 0)
    }
    if (!this.atMemberName() && !this.at(TOK_LBRACKET)) {
      return this.fail("an interface holds only annotated fields")
    }
    // The same modifiers a class member takes, because `collectField` is
    // the same function for both: `readonly x: i32` is a real interface
    // field on either compiler, and `static x: i32` is refused with the
    // sentence that says `of interface \`I\``. Reading `?` here and not
    // these would be an arbitrary split in one grammar rule.
    let modifiers = this.parseMemberModifiers()
    if (this.at(TOK_LBRACKET) && this.indexSignatureAhead()) {
      return this.parseIndexSignature(start, modifiers)
    }
    // `get x(): T;` and `set x(v: T);`, accessor signatures, read as a
    // class reads the word (`parseMember`): before another name only, so
    // `get: i32` is still a field called `get`.
    const accessor = this.accessorAhead()
    if (accessor) {
      this.advance()
      modifiers = modifiers | FLAG_ACCESSOR
    }
    // `[k]: T` and `[k](): T`, a computed name, for Phase 0 to refuse
    // (NL1041), as a class member's is (`parseMember`).
    const computed: Node | null = this.at(TOK_LBRACKET) ? this.parseComputedName() : null
    if (computed !== null) {
      modifiers = modifiers | FLAG_COMPUTED
    } else if (!this.atMemberName()) {
      return this.fail("an interface holds only annotated fields")
    }
    // `m(): T;`, a method signature, for the checker to refuse (NL2048):
    // a method with no body, among the fields. An accessor is one too.
    if (
      accessor ||
      (computed === null
        ? this.peek() === TOK_LPAREN || this.peek() === TOK_LT || this.markedMethodAhead()
        : this.methodAfterComputedName())
    ) {
      return this.parseMethodSignature(start, modifiers, true, computed)
    }
    const field = this.node(N_FIELD, start, this.end)
    field.children.push(computed === null ? this.parseMemberNameNode() : computed)
    // `?` only, and not `!`: a definite-assignment assertion is not a
    // spelling TypeScript allows on a property signature at all, so
    // there is no stage0 sentence to agree with and the syntax error
    // stays the right answer.
    field.flags = modifiers
    if (this.eat(TOK_QUESTION)) {
      field.flags = field.flags | FLAG_OPTIONAL
    }
    field.children.push(this.parseTypeAnnotation())
    field.children.push(this.empty())
    this.eatMemberSeparator()
    field.end = this.previousEnd
    return field
  }

  /**
   * An interface's `m<T>(x: T): R;`, shaped as a class's method is, with an
   * EMPTY body: the checker refuses it before anything reads it (NL2048), so
   * a parameter needs no annotation to get there. A call signature
   * `(x: i32): T` is the same with an EMPTY name (`named` false), and a
   * construct signature `new (): T` that with FLAG_CONSTRUCT (NL2257). A
   * computed name the caller has read already is `computed`.
   */
  parseMethodSignature(start: i32, modifiers: i32, named: boolean, computed: Node | null): Node {
    const method = this.node(N_METHOD, start, this.end)
    if (computed !== null) {
      method.children.push(computed)
    } else {
      method.children.push(named ? this.parseMemberNameNode() : this.empty())
    }
    method.flags = named ? modifiers | this.parseMemberMarker() : modifiers
    const typeParams = this.parseTypeParameters()
    method.children.push(this.parseParameters(false))
    method.children.push(this.parseReturnType())
    method.children.push(this.empty())
    if (typeParams.children.length > 0) {
      method.children.push(typeParams)
    }
    this.eatMemberSeparator()
    method.end = this.previousEnd
    return method
  }

  /**
   * `type X = T;` — a second name for a type that already exists, never a type
   * of its own (docs/LANGUAGE.md, Type aliases). A type parameter list is read
   * and kept as a third child, only when there is one, for Phase 0 to refuse
   * (NL1054): an alias has nothing for a type argument to specialise.
   */
  parseTypeAlias(start: i32): Node {
    this.advance() // `type`
    const node = this.node(N_TYPE_ALIAS, start, this.end)
    node.children.push(this.parseIdentifier())
    const typeParams = this.parseTypeParameters()
    this.expect(TOK_ASSIGN)
    node.children.push(this.parseType())
    this.expectSemicolon()
    if (typeParams.children.length > 0) {
      node.children.push(typeParams)
    }
    node.end = this.previousEnd
    return node
  }

  /**
   * Whether the `const` about to be parsed introduces a `const enum` rather
   * than a value. `enum` is a contextual keyword, so this is one token of
   * lookahead over the same source, the shape `startsArrowDeclaration` uses.
   */
  startsConstEnum(): boolean {
    const scan = new Lexer(this.file.text)
    scan.pos = this.start
    scan.next() // `const`
    scan.next()
    return scan.kind === TOK_IDENT && scan.value === "enum"
  }

  /**
   * `enum X { A = 1, B }` — a distinct type with `i32` representation (WP23).
   * The grammar is deliberately narrower than TypeScript's: the checker wants
   * to say *why* a member is not a literal, so anything is parsed here as an
   * expression and Phase 0 is what turns `B = A + 1` down by name.
   */
  parseEnum(start: i32): Node {
    this.advance() // `enum`
    const node = this.node(N_ENUM, start, this.end)
    node.children.push(this.parseIdentifier())
    const members = this.list()
    if (this.expect(TOK_LBRACE)) {
      while (!this.at(TOK_RBRACE) && !this.at(TOK_END)) {
        const before = this.start
        members.children.push(this.parseEnumMember())
        if (!this.eat(TOK_COMMA)) {
          break
        }
        if (this.start === before && !this.at(TOK_RBRACE) && !this.at(TOK_END)) {
          this.advance()
        }
      }
      this.expect(TOK_RBRACE)
    }
    node.children.push(this.closeList(members))
    node.end = this.previousEnd
    return node
  }

  /** `A` or `A = 1`; an absent initialiser is `N_EMPTY` and means "one more than the last". */
  parseEnumMember(): Node {
    const start = this.start
    const member = this.node(N_ENUM_MEMBER, start, this.end)
    member.children.push(this.parseIdentifier())
    member.children.push(this.eat(TOK_ASSIGN) ? this.parseExpression() : this.empty())
    member.end = this.previousEnd
    return member
  }

  parseModuleConst(start: i32): Node {
    const node = this.node(N_MODULE_CONST, start, this.end)
    if (this.at(TOK_CONST)) {
      node.flags = node.flags | FLAG_CONST
    } else if (this.at(TOK_IDENT)) {
      node.flags = node.flags | FLAG_VAR // Phase 0's (NL1036)
    }
    // Otherwise a top-level `let`, which the checker refuses (NL2084), or
    // (NL2272) when it binds an arrow: the arrow is its initialiser.
    this.advance()
    node.children.push(this.parseVariableDeclarations())
    this.expectSemicolon()
    node.end = this.previousEnd
    return node
  }

  /** The `a = 1, b = 2` of a `let`/`const`, without the keyword or the semicolon. */
  parseVariableDeclarations(): Node {
    const list = this.list()
    while (true) {
      const start = this.start
      const declaration = this.node(N_VAR_DECL, start, this.end)
      declaration.children.push(this.parseBindingName())
      declaration.children.push(this.at(TOK_COLON) ? this.parseTypeAnnotation() : this.empty())
      declaration.children.push(this.eat(TOK_ASSIGN) ? this.parseExpression() : this.empty())
      declaration.end = this.previousEnd
      list.children.push(declaration)
      if (!this.eat(TOK_COMMA)) {
        break
      }
    }
    return this.closeList(list)
  }

  // ---- Types -------------------------------------------------------------------------

  /** `T`, `T[]`, `Array<T>`, `T | null`. Unions are flat: `A | B | C` is one node. */
  parseType(): Node {
    const start = this.start
    const type = this.parsePostfixType()
    if (!this.at(TOK_PIPE)) {
      return type
    }
    const union = this.node(N_TYPE_UNION, start, type.end)
    union.children.push(type)
    while (this.eat(TOK_PIPE)) {
      union.children.push(this.parsePostfixType())
    }
    union.end = this.previousEnd
    return union
  }

  parsePostfixType(): Node {
    const start = this.start
    // `readonly T[]`. It binds looser than the `[]` suffix and tighter than
    // `|`, which is why it sits here and not in `parseType`: `readonly T[] |
    // null` is a nullable readonly array, the way the `typescript` parser
    // reads it. Whether the operand is actually an array is the checker's
    // question, so a `readonly` on anything parses and is refused there with
    // a message that names the rule.
    if (this.at(TOK_IDENT) && this.value === "readonly") {
      this.advance()
      const node = this.node(N_TYPE_READONLY, start, this.end)
      node.children.push(this.parsePostfixType())
      node.end = this.previousEnd
      return node
    }
    // `keyof T`, for the checker to refuse (NL2038). It binds as `readonly`
    // does, and is the operator only where the name could not be (`keyofAhead`).
    if (this.keyofAhead()) {
      const operator = this.node(N_TYPE_OPERATOR, start, this.end)
      operator.text = this.value
      this.advance()
      operator.children.push(this.parsePostfixType())
      operator.end = this.previousEnd
      return operator
    }
    let type = this.parsePrimaryType()
    while (this.at(TOK_LBRACKET) && this.peek() === TOK_RBRACKET) {
      this.advance()
      this.advance()
      const array = this.node(N_TYPE_ARRAY, start, this.previousEnd)
      array.children.push(type)
      type = array
    }
    return type
  }

  /**
   * Whether the `keyof` in hand is the type operator rather than a type named
   * `keyof`, which a program may declare: it is when a type follows it on its
   * line — a name that is not an operator word, `(`, `null`, or a number
   * with or without a `-`, as `parsePrimaryType` reads one —
   * because a type name never had one of those after it there. `keyof[]`,
   * `keyof | null`, `keyof {` (a body after a return type) and the word at
   * the end of its line stay the name (`tests/parser/names-declarations.ts`).
   */
  keyofAhead(): boolean {
    if (!this.at(TOK_IDENT) || this.value !== "keyof") {
      return false
    }
    const next = this.peek()
    if (!this.aheadOnSameLine()) {
      return false
    }
    if (next === TOK_IDENT) {
      return !isOperatorWord(this.aheadValue)
    }
    if (next === TOK_MINUS) {
      return this.scanAfterAhead().kind === TOK_NUMBER
    }
    return next === TOK_LPAREN || next === TOK_NULL || next === TOK_NUMBER
  }

  parsePrimaryType(): Node {
    const start = this.start
    if (this.at(TOK_LPAREN) && this.startsFunctionType()) {
      return this.parseFunctionType(start)
    }
    if (this.at(TOK_LPAREN)) {
      // `(T | null)[]`: the parentheses are not decoration, because `T | null[]`
      // is `T | (null[])`. The node is kept rather than unwrapped so the tree
      // is the `typescript` parser's, span for span; `resolveType` reads
      // through it exactly as stage0's `ParenthesizedType` case does.
      this.advance()
      const node = this.node(N_TYPE_PAREN, start, this.end)
      node.children.push(this.parseType())
      this.expect(TOK_RPAREN)
      node.end = this.previousEnd
      return node
    }
    if (this.at(TOK_NULL)) {
      this.advance()
      return this.node(N_TYPE_NULL, start, this.previousEnd)
    }
    // WP31 §4: a numeric literal type, `255` or `-128`. It is read wherever a
    // type is, because a number cannot start a type otherwise, and the checker
    // refuses it everywhere but as a bound of `integer<Lo, Hi>`.
    if (this.at(TOK_NUMBER) || (this.at(TOK_MINUS) && this.peek() === TOK_NUMBER)) {
      const negative = this.at(TOK_MINUS)
      if (negative) {
        this.advance()
      }
      const literal = this.node(N_TYPE_LITERAL, start, this.end)
      literal.text = negative ? `-${this.value}` : this.value
      this.advance()
      literal.end = this.previousEnd
      return literal
    }
    if (!this.at(TOK_IDENT)) {
      return this.fail(`expected a type name, found \`${tokenName(this.kind)}\``)
    }
    const node = this.node(N_TYPE_REF, start, this.end)
    node.text = this.value
    this.advance()
    const args = this.list()
    if (this.at(TOK_LT)) {
      this.advance()
      while (!this.at(TOK_GT) && !this.at(TOK_END)) {
        args.children.push(this.parseType())
        if (!this.eat(TOK_COMMA)) {
          break
        }
      }
      // `>>` closes two argument lists at once; the lexer merged them, so
      // split the token here rather than making the lexer guess (S1's one
      // documented divergence from the `typescript` scanner).
      this.expectTypeArgumentEnd()
    }
    node.children.push(this.closeList(args))
    node.end = this.previousEnd
    return node
  }

  /**
   * Whether the `(` about to be read opens a function type's parameter list,
   * `(x: i32) => i32`, rather than a parenthesised type, `(T | null)[]`. The
   * two share their first token, so a scratch lexer looks at the next ones the
   * way the `typescript` parser does (`isUnambiguouslyStartOfFunctionType`): an
   * empty list, or a name followed by what only a parameter puts after one —
   * `:`, `,`, `?`, `=`, or `)` and then `=>`. Looking for `=>` after the
   * closing parenthesis alone would misread an arrow's parenthesised return
   * type, `(x: T): (T | null) => x`, where the `=>` is the arrow's own.
   */
  startsFunctionType(): boolean {
    const scan = new Lexer(this.file.text)
    scan.pos = this.start
    scan.next() // `(`
    scan.next()
    if (scan.kind === TOK_RPAREN || scan.kind === TOK_DOT_DOT_DOT) {
      return true
    }
    // A destructured parameter (NL2192): a parenthesised type cannot open
    // with `{` or `[` in this grammar, so the list is a function type's when
    // `=>` follows the `)` that closes it.
    if (scan.kind === TOK_LBRACE || scan.kind === TOK_LBRACKET) {
      let depth = 1
      while (depth > 0) {
        scan.next()
        if (scan.kind === TOK_END) {
          return false
        }
        if (scan.kind === TOK_LPAREN) {
          depth = depth + 1
        } else if (scan.kind === TOK_RPAREN) {
          depth = depth - 1
        }
      }
      scan.next()
      return scan.kind === TOK_ARROW
    }
    if (scan.kind !== TOK_IDENT && scan.kind !== TOK_THIS) {
      return false
    }
    scan.next()
    if (
      scan.kind === TOK_COLON ||
      scan.kind === TOK_COMMA ||
      scan.kind === TOK_QUESTION ||
      scan.kind === TOK_ASSIGN
    ) {
      return true
    }
    if (scan.kind !== TOK_RPAREN) {
      return false
    }
    scan.next()
    return scan.kind === TOK_ARROW
  }

  /**
   * `(x: T, y: U) => R` (WP29, wp23 §6). Parsed wherever a type may be
   * written, because where one is *legal* — only on a parameter of a top-level
   * function — is the checker's rule, and a refusal that names the position
   * reads better than a syntax error about a colon. Every parameter keeps its
   * name, as TypeScript requires, and its annotation, which the checker needs
   * to know the callee's signature.
   */
  parseFunctionType(start: i32): Node {
    const node = this.node(N_TYPE_FUNCTION, start, this.end)
    node.children.push(this.parseParameters(true))
    this.expect(TOK_ARROW)
    node.children.push(this.parseType())
    node.end = this.previousEnd
    return node
  }

  /**
   * Close a type argument list. A `>>` or `>>>` here is two or three closers
   * the lexer merged; consume one and leave the rest by rewriting the current
   * token in place.
   */
  expectTypeArgumentEnd(): void {
    if (this.eat(TOK_GT)) {
      return
    }
    if (this.at(TOK_SHR)) {
      this.kind = TOK_GT
      this.start = this.start + 1
      this.previousEnd = this.start
      return
    }
    if (this.at(TOK_USHR)) {
      this.kind = TOK_SHR
      this.start = this.start + 1
      this.previousEnd = this.start
      return
    }
    this.expect(TOK_GT)
  }

  // ---- Statements --------------------------------------------------------------------

  parseBlock(): Node {
    const start = this.start
    const block = this.node(N_BLOCK, start, this.end)
    if (!this.expect(TOK_LBRACE)) {
      block.end = this.previousEnd
      return block
    }
    const outerNoIn = this.allowIn()
    while (!this.at(TOK_RBRACE) && !this.at(TOK_END)) {
      const before = this.start
      block.children.push(this.parseStatement())
      if (this.start === before && !this.at(TOK_RBRACE) && !this.at(TOK_END)) {
        this.advance()
      }
    }
    this.noIn = outerNoIn
    this.expect(TOK_RBRACE)
    block.end = this.previousEnd
    return block
  }

  parseStatement(): Node {
    const start = this.start
    switch (this.kind) {
      case TOK_LBRACE:
        return this.parseBlock()
      case TOK_LET:
      case TOK_CONST:
        return this.parseVariableStatement(start)
      case TOK_IDENT:
        if (this.usingAhead() || this.varAhead()) {
          return this.parseVariableStatement(start)
        }
        // `async function` in a body: the nested function below, which
        // Phase 0 refuses first for its modifier (NL1015).
        if (this.value === "async" && this.peek() === TOK_FUNCTION && this.aheadOnSameLine()) {
          this.advance() // `async`
          return this.flagged(this.parseFunction(start, false), FLAG_ASYNC)
        }
        if (this.tryStatementAhead()) {
          return this.parseTry(start)
        }
        if (this.withStatementAhead()) {
          return this.parseWith(start)
        }
        if (this.peek() === TOK_COLON) {
          return this.parseLabeled(start)
        }
        return this.parseExpressionStatement(start)
      case TOK_IF:
        return this.parseIf(start)
      case TOK_WHILE:
        return this.parseWhile(start)
      case TOK_DO:
        return this.parseDo(start)
      case TOK_FOR:
        return this.parseFor(start)
      case TOK_SWITCH:
        return this.parseSwitch(start)
      case TOK_RETURN:
        return this.parseReturn(start)
      case TOK_THROW:
        return this.parseThrow(start)
      case TOK_BREAK:
        return this.parseJump(start, N_BREAK)
      case TOK_CONTINUE:
        return this.parseJump(start, N_CONTINUE)
      case TOK_SEMICOLON:
        this.advance()
        return this.node(N_EMPTY, start, this.previousEnd)
      // A function or an import declaration inside a body is the node it is
      // at the top level, for the pass 1 sweep to refuse as a statement
      // (NL2260): a nested function would be a closure, and a module's
      // imports are its own, not a block's.
      case TOK_FUNCTION:
        return this.parseFunction(start, false)
      case TOK_IMPORT:
        if (this.importDeclarationAhead()) {
          const previous = this.beginForm()
          return this.endForm(this.parseImport(start), previous, true)
        }
        return this.parseExpressionStatement(start)
      case TOK_CLASS: {
        // A class declaration inside a body is not an expression statement,
        // and TypeScript does not read one as a class expression either: it
        // stays the syntax error it was.
        const node = this.node(N_EXPR_STMT, start, this.end)
        node.children.push(this.fail(`expected an expression, found \`${tokenName(this.kind)}\``))
        this.expectSemicolon()
        node.end = this.previousEnd
        return node
      }
      default:
        return this.parseExpressionStatement(start)
    }
  }

  /**
   * Whether the identifier in hand opens a `using` declaration (WP29 P2):
   * `using` is a word TypeScript reads as a keyword only when a binding name
   * follows it on the same line, and as an ordinary identifier everywhere
   * else, so `using(x)` and `using = 1` stay the expressions they are.
   */
  usingAhead(): boolean {
    return this.at(TOK_IDENT) && this.value === "using" && this.peek() === TOK_IDENT && this.aheadOnSameLine()
  }

  parseVariableStatement(start: i32): Node {
    const node = this.node(N_VAR, start, this.end)
    // A `using` binding is a `const` the scope rules then hold to more
    // (`src/parallel.ts`): it cannot be reassigned either.
    if (this.varAhead()) {
      node.flags = node.flags | FLAG_VAR
    } else if (this.at(TOK_CONST) || this.at(TOK_IDENT)) {
      node.flags = node.flags | FLAG_CONST
      if (this.at(TOK_IDENT)) {
        node.flags = node.flags | FLAG_USING
      }
    }
    this.advance()
    node.children.push(this.parseVariableDeclarations())
    this.expectSemicolon()
    node.end = this.previousEnd
    return node
  }

  /**
   * `try { } catch (e) { } finally { }`, for Phase 0 to refuse (NL1033). A
   * catch binding's annotation, `catch (e: unknown)`, and a destructuring
   * binding, `catch ({ message })` or `catch ([a])`, are read and dropped (the
   * binding child is EMPTY for a pattern): the statement is refused whatever
   * it binds.
   */
  parseTry(start: i32): Node {
    this.advance() // `try`
    const node = this.node(N_TRY, start, this.end)
    node.children.push(this.parseBlock())
    let binding = this.empty()
    let handler = this.empty()
    let finalizer = this.empty()
    if (this.at(TOK_IDENT) && this.value === "catch") {
      this.advance()
      if (this.eat(TOK_LPAREN)) {
        if (this.at(TOK_LBRACE) || this.at(TOK_LBRACKET)) {
          this.skipBindingPattern()
        } else {
          binding = this.parseIdentifier()
        }
        if (this.at(TOK_COLON)) {
          this.parseTypeAnnotation()
        }
        this.expect(TOK_RPAREN)
      }
      handler = this.parseBlock()
    }
    if (this.at(TOK_IDENT) && this.value === "finally") {
      this.advance()
      finalizer = this.parseBlock()
    }
    if (handler.kind === N_EMPTY && finalizer.kind === N_EMPTY) {
      this.report(
        `expected \`catch\` or \`finally\`, found \`${tokenName(this.kind)}\``,
        this.start,
        this.end
      )
    }
    node.children.push(binding)
    node.children.push(handler)
    node.children.push(finalizer)
    node.end = this.previousEnd
    return node
  }

  /**
   * Step over a destructuring pattern, from its `{` or `[` to the bracket that
   * closes it. Only a refused form reads one — a `catch` binding, or the
   * N_BINDING_PATTERN of `parseBindingName` — so nothing is built from it.
   */
  skipBindingPattern(): void {
    let depth = 0
    while (!this.at(TOK_END)) {
      if (this.at(TOK_LBRACE) || this.at(TOK_LBRACKET)) {
        depth = depth + 1
      } else if (this.at(TOK_RBRACE) || this.at(TOK_RBRACKET)) {
        depth = depth - 1
      }
      this.advance()
      if (depth === 0) {
        return
      }
    }
  }

  /** `with (o) body`, for Phase 0 to refuse (NL1038). */
  parseWith(start: i32): Node {
    this.advance() // `with`
    const node = this.node(N_WITH, start, this.end)
    this.expect(TOK_LPAREN)
    node.children.push(this.parseExpression())
    this.expect(TOK_RPAREN)
    node.children.push(this.parseStatement())
    node.end = this.previousEnd
    return node
  }

  /** `outer: body`, for Phase 0 to refuse (NL1046). */
  parseLabeled(start: i32): Node {
    const node = this.node(N_LABELED, start, this.end)
    node.text = this.value
    this.advance() // the label
    this.advance() // `:`
    this.labels.push(node.text)
    node.children.push(this.parseStatement())
    this.labels.pop()
    node.end = this.previousEnd
    return node
  }

  parseIf(start: i32): Node {
    this.advance()
    const node = this.node(N_IF, start, this.end)
    this.expect(TOK_LPAREN)
    node.children.push(this.parseSequence())
    this.expect(TOK_RPAREN)
    node.children.push(this.parseStatement())
    node.children.push(this.eat(TOK_ELSE) ? this.parseStatement() : this.empty())
    node.end = this.previousEnd
    return node
  }

  parseWhile(start: i32): Node {
    this.advance()
    const node = this.node(N_WHILE, start, this.end)
    this.expect(TOK_LPAREN)
    node.children.push(this.parseSequence())
    this.expect(TOK_RPAREN)
    node.children.push(this.parseStatement())
    node.end = this.previousEnd
    return node
  }

  parseDo(start: i32): Node {
    this.advance()
    const node = this.node(N_DO, start, this.end)
    node.children.push(this.parseStatement())
    this.expect(TOK_WHILE)
    this.expect(TOK_LPAREN)
    node.children.push(this.parseSequence())
    this.expect(TOK_RPAREN)
    this.eat(TOK_SEMICOLON)
    node.end = this.previousEnd
    return node
  }

  /**
   * `for (init; cond; inc)` and `for (const x of a)`, told apart after the
   * head by whether `of` follows. `for await`, `for...in`, a `var` head and a
   * head that is an expression rather than a declaration are read too, for
   * the phase that owns each rule to refuse (`src/nodes.ts`, FLAG_AWAIT).
   */
  parseFor(start: i32): Node {
    this.advance()
    let flags = 0
    if (this.at(TOK_IDENT) && this.value === "await") {
      flags = FLAG_AWAIT
      this.advance()
    }
    this.expect(TOK_LPAREN)
    const outerNoIn = this.noIn
    this.noIn = true
    if (((this.at(TOK_CONST) || this.at(TOK_LET)) && this.bindingAhead()) || this.varAhead()) {
      const declStart = this.start
      const declaration = this.node(N_VAR, declStart, this.end)
      if (this.at(TOK_CONST)) {
        declaration.flags = declaration.flags | FLAG_CONST
      } else if (this.at(TOK_IDENT)) {
        declaration.flags = declaration.flags | FLAG_VAR
      }
      this.advance()
      declaration.children.push(this.parseVariableDeclarations())
      declaration.end = this.previousEnd
      this.noIn = outerNoIn
      if (this.atForOfKeyword()) {
        return this.parseForOfRest(start, declaration, flags)
      }
      return this.parseForRest(start, declaration, flags)
    }
    const initializer = this.at(TOK_SEMICOLON) ? this.empty() : this.parseSequence()
    this.noIn = outerNoIn
    if (initializer.kind !== N_EMPTY && this.atForOfKeyword()) {
      return this.parseForOfRest(start, initializer, flags)
    }
    return this.parseForRest(start, initializer, flags)
  }

  /**
   * Whether the `let` or `const` in hand declares: a name follows it, or the
   * `{` or `[` of a destructuring pattern, which the checker refuses
   * (NL2193).
   */
  bindingAhead(): boolean {
    const next = this.peek()
    return next === TOK_IDENT || next === TOK_LBRACE || next === TOK_LBRACKET
  }

  /** The `of` of a `for...of`, or the `in` of a `for...in`. */
  atForOfKeyword(): boolean {
    return this.at(TOK_IDENT) && (this.value === "of" || this.value === "in")
  }

  /** The `of a) body` of a `for...of`, or `in a) body`, with the head already parsed. */
  parseForOfRest(start: i32, head: Node, flags: i32): Node {
    const forOf = this.node(N_FOR_OF, start, this.end)
    forOf.flags = this.value === "in" ? flags | FLAG_FOR_IN : flags
    this.advance()
    forOf.children.push(head)
    forOf.children.push(this.parseExpression())
    this.expect(TOK_RPAREN)
    forOf.children.push(this.parseStatement())
    forOf.end = this.previousEnd
    return forOf
  }

  /**
   * The `; cond; inc) body` of a classic `for`, with the initializer already
   * parsed. `await` belongs to a `for...of` only, and TypeScript says so as
   * syntax.
   */
  parseForRest(start: i32, initializer: Node, flags: i32): Node {
    if ((flags & FLAG_AWAIT) !== 0) {
      this.report(`expected \`of\`, found \`${tokenName(this.kind)}\``, this.start, this.end)
    }
    const node = this.node(N_FOR, start, this.end)
    node.children.push(initializer)
    this.expect(TOK_SEMICOLON)
    node.children.push(this.at(TOK_SEMICOLON) ? this.empty() : this.parseSequence())
    this.expect(TOK_SEMICOLON)
    node.children.push(this.at(TOK_RPAREN) ? this.empty() : this.parseSequence())
    this.expect(TOK_RPAREN)
    node.children.push(this.parseStatement())
    node.end = this.previousEnd
    return node
  }

  parseSwitch(start: i32): Node {
    this.advance()
    const node = this.node(N_SWITCH, start, this.end)
    this.expect(TOK_LPAREN)
    node.children.push(this.parseSequence())
    this.expect(TOK_RPAREN)
    const clauses = this.list()
    if (this.expect(TOK_LBRACE)) {
      while (!this.at(TOK_RBRACE) && !this.at(TOK_END)) {
        const before = this.start
        clauses.children.push(this.parseClause())
        if (this.start === before && !this.at(TOK_RBRACE) && !this.at(TOK_END)) {
          this.advance()
        }
      }
      this.expect(TOK_RBRACE)
    }
    node.children.push(this.closeList(clauses))
    node.end = this.previousEnd
    return node
  }

  parseClause(): Node {
    const start = this.start
    const isCase = this.at(TOK_CASE)
    if (!isCase && !this.at(TOK_DEFAULT)) {
      return this.fail("a `switch` body holds only `case` and `default` clauses")
    }
    this.advance()
    const clause = this.node(isCase ? N_CASE : N_DEFAULT, start, this.end)
    if (isCase) {
      clause.children.push(this.parseExpression())
    }
    this.expect(TOK_COLON)
    const body = this.list()
    while (!this.at(TOK_CASE) && !this.at(TOK_DEFAULT) && !this.at(TOK_RBRACE) && !this.at(TOK_END)) {
      const before = this.start
      body.children.push(this.parseStatement())
      if (this.start === before) {
        this.advance()
      }
    }
    clause.children.push(this.closeList(body))
    clause.end = this.previousEnd
    return clause
  }

  parseReturn(start: i32): Node {
    this.advance()
    const node = this.node(N_RETURN, start, this.end)
    // `return` then a line break returns nothing, as it does in TypeScript; the
    // value on the next line is then unreachable code, which the checker refuses.
    const bare = this.at(TOK_SEMICOLON) || this.at(TOK_RBRACE) || this.at(TOK_END) || this.newlineBefore()
    node.children.push(bare ? this.empty() : this.parseSequence())
    this.expectSemicolon()
    node.end = this.previousEnd
    return node
  }

  parseThrow(start: i32): Node {
    this.advance()
    const node = this.node(N_THROW, start, this.end)
    node.children.push(this.parseSequence())
    this.expectSemicolon()
    node.end = this.previousEnd
    return node
  }

  parseJump(start: i32, kind: i32): Node {
    this.advance()
    let label = ""
    if (this.at(TOK_IDENT) && !this.newlineBefore()) {
      if (this.labels.indexOf(this.value) >= 0) {
        label = this.value
      } else {
        this.report("a label is not supported", this.start, this.end)
      }
      this.advance()
    }
    this.expectSemicolon()
    const node = this.node(kind, start, this.previousEnd)
    node.text = label
    return node
  }

  parseExpressionStatement(start: i32): Node {
    const node = this.node(N_EXPR_STMT, start, this.end)
    node.children.push(this.parseSequence())
    this.expectSemicolon()
    node.end = this.previousEnd
    return node
  }

  // ---- Expressions -------------------------------------------------------------------

  /**
   * `a, b`: the comma operator, read where TypeScript reads a whole
   * expression that a `,` cannot otherwise follow — an expression statement,
   * a condition, a `for` clause, a `return`, a `throw`, a `switch` and a
   * parenthesis — for Phase 0 to refuse (NL1040). An argument list and an
   * array literal keep their commas.
   */
  parseSequence(): Node {
    const start = this.start
    let left = this.parseExpression()
    while (this.at(TOK_COMMA)) {
      this.advance()
      const right = this.parseExpression()
      const node = this.node(N_BINARY, start, right.end)
      node.text = ","
      node.children.push(left)
      node.children.push(right)
      left = node
    }
    return left
  }

  /**
   * Clear `noIn` for a bracket that reads `in` as the operator again, and
   * answer what it was, for the caller to put back when the bracket closes.
   */
  allowIn(): boolean {
    const outer = this.noIn
    this.noIn = false
    return outer
  }

  /** Assignment, the loosest expression. Right-associative, as in JavaScript. */
  parseExpression(): Node {
    const start = this.start
    const left = this.parseConditional()
    if (!isAssignment(this.kind)) {
      return left
    }
    const operator = tokenName(this.kind)
    this.advance()
    const node = this.node(N_BINARY, start, this.end)
    node.text = operator
    node.children.push(left)
    node.children.push(this.parseExpression())
    node.end = this.previousEnd
    return node
  }

  parseConditional(): Node {
    const start = this.start
    const condition = this.parseCoalesce()
    if (!this.at(TOK_QUESTION)) {
      return condition
    }
    this.advance()
    const node = this.node(N_CONDITIONAL, start, this.end)
    node.children.push(condition)
    // The branch between `?` and `:` reads `in` again, as the grammar's
    // `[+In]` does; the one after `:` keeps the context's (`noIn`).
    const outerNoIn = this.allowIn()
    node.children.push(this.parseExpression())
    this.noIn = outerNoIn
    this.expect(TOK_COLON)
    node.children.push(this.parseExpression())
    node.end = this.previousEnd
    return node
  }

  /**
   * `a ?? b`, with TypeScript's grammar (WP32, docs/wp32-map.md §3.2): it sits
   * at the level of `||`, each operand binds as tightly as `|`, and it is left
   * associative. It does not mix with `||` or `&&` without parentheses, as
   * `tsc` reports TS5076, because which of them runs first is exactly what a
   * reader cannot tell. The mix is reported and then read on as written, so
   * the statement after it is not blamed for it too.
   */
  parseCoalesce(): Node {
    const start = this.start
    let left = this.parseBinary(1)
    if (!this.at(TOK_QUESTION_QUESTION)) {
      return left
    }
    // One report per expression, however many times it mixes, and every
    // operand read on, whichever of the three operators joins it.
    let mixed = left.kind === N_BINARY && (left.text === "||" || left.text === "&&")
    if (mixed) {
      this.reportMixedCoalesce(left.text)
    }
    while (this.at(TOK_QUESTION_QUESTION) || this.at(TOK_OR_OR) || this.at(TOK_AND_AND)) {
      const operator = tokenName(this.kind)
      if (operator !== "??" && !mixed) {
        this.reportMixedCoalesce(operator)
        mixed = true
      }
      this.advance()
      const right = this.parseBinary(binaryPrecedence(TOK_PIPE))
      const node = this.node(N_BINARY, start, right.end)
      node.text = operator
      node.children.push(left)
      node.children.push(right)
      left = node
    }
    return left
  }

  reportMixedCoalesce(operator: string): void {
    this.report(
      `\`${operator}\` and \`??\` cannot be mixed without parentheses: parenthesise the one that is to run first`,
      this.start,
      this.end
    )
  }

  /**
   * Precedence climbing. Every operator here is left-associative but `**`,
   * whose right operand is read at its own level, as TypeScript reads it. `as`
   * and `satisfies` take a type rather than an operand, and are an `N_AS`.
   */
  parseBinary(minimum: i32): Node {
    const start = this.start
    let left = this.parseUnary()
    while (true) {
      const precedence = this.operatorPrecedence()
      if (precedence === 0 || precedence < minimum) {
        return left
      }
      const word = this.at(TOK_IDENT)
      const operator = word ? this.value : tokenName(this.kind)
      this.advance()
      if (operator === "as" || operator === "satisfies") {
        const assertion = this.node(N_AS, start, this.end)
        if (operator === "satisfies") {
          assertion.flags = FLAG_SATISFIES
        }
        assertion.children.push(left)
        assertion.children.push(this.parseType())
        assertion.end = this.previousEnd
        left = assertion
        continue
      }
      const right = this.parseBinary(operator === "**" ? precedence : precedence + 1)
      const node = this.node(N_BINARY, start, right.end)
      node.text = operator
      node.children.push(left)
      node.children.push(right)
      left = node
    }
  }

  /**
   * The binding power of the token in hand as a binary operator, or 0. `in`,
   * `instanceof`, `as` and `satisfies` are identifiers to the lexer, and a
   * program may use them as names, so each is an operator only where a name
   * could not stand (WP33 R1): on the line of the operand before it, where
   * TypeScript's `as` and `satisfies` must be and where a name could only be
   * a syntax error, or — for `in` and `instanceof` — at the start of a line
   * when an operand follows on that line, which a statement opening with the
   * name could not have either. A `for` head's `in` is the loop's
   * (`noIn`).
   */
  operatorPrecedence(): i32 {
    if (!this.at(TOK_IDENT)) {
      return binaryPrecedence(this.kind)
    }
    const word = this.value
    if (word === "as" || word === "satisfies") {
      return this.newlineBefore() ? 0 : RELATIONAL
    }
    if ((word === "in" && !this.noIn) || word === "instanceof") {
      return !this.newlineBefore() || this.operandAhead() ? RELATIONAL : 0
    }
    return 0
  }

  /**
   * Whether the token after the one in hand begins an operand, on the same
   * line: a name that is not an operator word, a literal, `this`, `super`,
   * `new`, `!` or `~`. A word before such a token cannot be a name — two
   * operands in a row on one line are a syntax error — so it can only be the
   * operator TypeScript reads it as. The tokens a name *can* be followed by
   * are not here: `(` makes it a call, `[` an element, `+` and `-` a binary
   * operator, `++` and `--` a postfix one, `/` a division and `<` a
   * comparison, and every one of those compiled before these words were read
   * (`tests/parser/names-operators.ts`).
   */
  operandAhead(): boolean {
    const next = this.peek()
    if (!this.aheadOnSameLine()) {
      return false
    }
    switch (next) {
      case TOK_IDENT:
        return !isOperatorWord(this.aheadValue)
      case TOK_NUMBER:
      case TOK_BIGINT:
      case TOK_STRING:
      case TOK_TEMPLATE:
      case TOK_TEMPLATE_HEAD:
      case TOK_TRUE:
      case TOK_FALSE:
      case TOK_NULL:
      case TOK_THIS:
      case TOK_SUPER:
      case TOK_NEW:
      case TOK_BANG:
      case TOK_TILDE:
        return true
      default:
        return false
    }
  }

  parseUnary(): Node {
    const start = this.start
    // `typeof x`, `void 0`, `delete o.x`, `await p` and `yield v`, for Phase 0
    // to refuse. Each word is a name to the lexer, and is the operator only
    // where an operand follows it on its line (`operandAhead`).
    if (this.at(TOK_IDENT) && isPrefixWord(this.value) && this.operandAhead()) {
      const operator = this.value
      this.advance()
      const node = this.node(N_UNARY, start, this.end)
      node.text = operator
      node.flags = FLAG_PREFIX
      node.children.push(this.parseUnary())
      node.end = this.previousEnd
      return node
    }
    // `<T>x`, the older spelling of `x as T`, which binds as a prefix operator.
    if (this.at(TOK_LT)) {
      this.advance()
      const assertion = this.node(N_AS, start, this.end)
      assertion.flags = FLAG_ANGLE
      const type = this.parseType()
      this.expectTypeArgumentEnd()
      assertion.children.push(this.parseUnary())
      assertion.children.push(type)
      assertion.end = this.previousEnd
      return assertion
    }
    if (this.at(TOK_BANG) || this.at(TOK_MINUS) || this.at(TOK_PLUS) || this.at(TOK_TILDE)) {
      const operator = tokenName(this.kind)
      this.advance()
      const node = this.node(N_UNARY, start, this.end)
      node.text = operator
      node.flags = FLAG_PREFIX
      node.children.push(this.parseUnary())
      node.end = this.previousEnd
      return node
    }
    if (this.at(TOK_PLUS_PLUS) || this.at(TOK_MINUS_MINUS)) {
      const operator = tokenName(this.kind)
      this.advance()
      const node = this.node(N_UNARY, start, this.end)
      node.text = operator
      node.flags = FLAG_PREFIX
      node.children.push(this.parseUnary())
      node.end = this.previousEnd
      return node
    }
    return this.parsePostfix()
  }

  parsePostfix(): Node {
    const start = this.start
    const operand = this.parseCallOrMember(this.parsePrimary(), start)
    // A `++` or `--` on the next line is a prefix operator of a new statement.
    if ((this.at(TOK_PLUS_PLUS) || this.at(TOK_MINUS_MINUS)) && !this.newlineBefore()) {
      const operator = tokenName(this.kind)
      this.advance()
      const node = this.node(N_UNARY, start, this.previousEnd)
      node.text = operator
      node.flags = FLAG_POSTFIX
      node.children.push(operand)
      return node
    }
    return operand
  }

  /**
   * `.f`, `[i]` and `(args)`, applied left to right for as long as they come,
   * and each of them after `?.`, which is the same node with FLAG_OPTIONAL
   * for Phase 0 to refuse (NL1049).
   */
  parseCallOrMember(target: Node, start: i32): Node {
    let node = target
    while (true) {
      let flags = 0
      if (this.at(TOK_QUESTION_DOT)) {
        flags = FLAG_OPTIONAL
        this.advance()
        if (!this.at(TOK_LBRACKET) && !this.at(TOK_LPAREN)) {
          node = this.parseMemberName(node, start)
          node.flags = flags
          continue
        }
      }
      if (this.at(TOK_DOT) && flags === 0) {
        this.advance()
        node = this.parseMemberName(node, start)
      } else if (this.at(TOK_LBRACKET)) {
        node = this.parseElement(node, start)
        node.flags = flags
      } else if (this.at(TOK_LPAREN)) {
        const call = this.node(N_CALL, start, this.end)
        call.flags = flags
        call.children.push(node)
        call.children.push(this.parseArguments())
        call.end = this.previousEnd
        node = call
      } else {
        return node
      }
    }
  }

  /** The name after a `.` or a `?.`, and the `N_MEMBER` it makes of `receiver`. */
  parseMemberName(receiver: Node, start: i32): Node {
    const member = this.node(N_MEMBER, start, this.end)
    if (this.at(TOK_IDENT) || this.kind >= 0) {
      member.text = this.at(TOK_IDENT) ? this.value : tokenName(this.kind)
      this.advance()
    }
    member.children.push(receiver)
    member.end = this.previousEnd
    return member
  }

  /** `[i]` after `receiver`, as an `N_INDEX`. */
  parseElement(receiver: Node, start: i32): Node {
    this.advance()
    const index = this.node(N_INDEX, start, this.end)
    index.children.push(receiver)
    const outerNoIn = this.allowIn()
    index.children.push(this.parseExpression())
    this.noIn = outerNoIn
    this.expect(TOK_RBRACKET)
    index.end = this.previousEnd
    return index
  }

  parseArguments(): Node {
    const list = this.list()
    if (!this.expect(TOK_LPAREN)) {
      return list
    }
    const outerNoIn = this.allowIn()
    while (!this.at(TOK_RPAREN) && !this.at(TOK_END)) {
      list.children.push(this.parseExpression())
      if (!this.eat(TOK_COMMA)) {
        break
      }
    }
    this.noIn = outerNoIn
    this.expect(TOK_RPAREN)
    return this.closeList(list)
  }

  parsePrimary(): Node {
    const start = this.start
    switch (this.kind) {
      case TOK_IDENT: {
        // `x => x * 2`: one token of lookahead is enough for the bare form.
        if (this.peek() === TOK_ARROW) {
          return this.parseArrowExpression(start)
        }
        // `async (x) => x` and `async x => x`, for Phase 0 to refuse (NL1015).
        if (this.asyncArrowAhead()) {
          this.advance() // `async`
          const arrow = this.parseArrowExpression(start)
          arrow.flags = FLAG_ASYNC
          return arrow
        }
        const node = this.node(N_IDENT, start, this.end)
        node.text = this.value
        this.advance()
        return node
      }
      case TOK_NUMBER: {
        const node = this.node(N_NUMBER, start, this.end)
        node.text = withoutSeparators(this.value)
        this.advance()
        return node
      }
      case TOK_BIGINT: {
        const node = this.node(N_BIGINT, start, this.end)
        node.text = this.value
        this.advance()
        return node
      }
      case TOK_STRING: {
        const node = this.node(N_STRING, start, this.end)
        node.text = this.value
        this.advance()
        return node
      }
      case TOK_TRUE:
        this.advance()
        return this.node(N_TRUE, start, this.previousEnd)
      case TOK_FALSE:
        this.advance()
        return this.node(N_FALSE, start, this.previousEnd)
      case TOK_NULL:
        this.advance()
        return this.node(N_NULL, start, this.previousEnd)
      case TOK_THIS:
        this.advance()
        return this.node(N_THIS, start, this.previousEnd)
      case TOK_SUPER:
        this.advance()
        return this.node(N_SUPER, start, this.previousEnd)
      case TOK_TEMPLATE:
      case TOK_TEMPLATE_HEAD:
        return this.parseTemplate(start)
      case TOK_LBRACKET:
        return this.parseArrayLiteral(start)
      case TOK_LBRACE:
        return this.parseObjectLiteral(start)
      case TOK_LPAREN: {
        if (this.startsArrowExpression()) {
          return this.parseArrowExpression(start)
        }
        this.advance()
        const node = this.node(N_PAREN, start, this.end)
        const outerNoIn = this.allowIn()
        node.children.push(this.parseSequence())
        this.noIn = outerNoIn
        this.expect(TOK_RPAREN)
        node.end = this.previousEnd
        return node
      }
      case TOK_NEW:
        return this.parseNew(start)
      // A class expression, for the checker to refuse: an anonymous one
      // (NL2018) and a named one alike, since a class is never a value.
      case TOK_CLASS:
        return this.parseClass(start)
      case TOK_SLASH:
      case TOK_SLASH_ASSIGN:
        return this.parseRegex(start)
      case TOK_IMPORT: {
        // `import("./m")`: the keyword as the callee of the call that follows,
        // for Phase 0 to refuse (NL1002). Nothing else can name it.
        if (this.peek() !== TOK_LPAREN) {
          return this.fail(`expected an expression, found \`${tokenName(this.kind)}\``)
        }
        const node = this.node(N_IDENT, start, this.end)
        node.text = "import"
        this.advance()
        return node
      }
      default:
        return this.fail(`expected an expression, found \`${tokenName(this.kind)}\``)
    }
  }

  /**
   * Whether the `(` about to be read opens an arrow's parameter list rather
   * than a parenthesised expression (WP29). The scratch lexer of
   * `startsArrowDeclaration` again, with one difference that expression
   * position forces: after the closing parenthesis a `:` is not enough,
   * because `c ? (a) : b` puts one there too. So a `:` has to be followed by
   * tokens that can spell a type and then `=>` at the same depth; anything
   * else makes it a parenthesised expression.
   */
  startsArrowExpression(): boolean {
    // An arrow's list opens with a name or closes at once; anything else after
    // the `(` is an expression, known without scanning to its end, which keeps
    // nested parentheses from being rescanned at every level.
    // `...`, `{` and `[` open a rest parameter and the two destructuring
    // patterns, which the checker refuses (NL2235, NL2192); a `(` before a
    // spread opens nothing else, and one before an object or array literal is
    // told from them by the same scan.
    const next = this.peek()
    if (
      next !== TOK_IDENT &&
      next !== TOK_RPAREN &&
      next !== TOK_DOT_DOT_DOT &&
      next !== TOK_LBRACE &&
      next !== TOK_LBRACKET
    ) {
      return false
    }
    return this.arrowParametersAt(this.start)
  }

  /**
   * Whether the `async` in hand is the modifier of an arrow rather than a
   * name: it is when an arrow's parameters follow it on its line — a name and
   * `=>`, or a parenthesised list `startsArrowExpression` would take — as
   * TypeScript reads it. `async(x)`, `async (x)` with no `=>` after it,
   * `async => x`, `async.f` and the word at the end of its line are the name
   * (`tests/parser/names-declaration-calls.ts`).
   */
  asyncArrowAhead(): boolean {
    if (this.value !== "async") {
      return false
    }
    const next = this.peek()
    if ((next !== TOK_IDENT && next !== TOK_LPAREN) || !this.aheadOnSameLine()) {
      return false
    }
    const scan = this.scanAfterAhead()
    if (next === TOK_IDENT) {
      return scan.kind === TOK_ARROW
    }
    if (scan.kind !== TOK_IDENT && scan.kind !== TOK_RPAREN) {
      return false
    }
    return this.arrowParametersAt(this.aheadStart)
  }

  /** The scan of `startsArrowExpression`, from the `(` at `open`. */
  arrowParametersAt(open: i32): boolean {
    const scan = new Lexer(this.file.text)
    scan.pos = open
    scan.next() // `(`
    let depth = 1
    while (depth > 0) {
      scan.next()
      if (scan.kind === TOK_END) {
        return false
      }
      if (scan.kind === TOK_LPAREN) {
        depth = depth + 1
      } else if (scan.kind === TOK_RPAREN) {
        depth = depth - 1
      }
    }
    scan.next()
    if (scan.kind === TOK_ARROW) {
      return true
    }
    if (scan.kind !== TOK_COLON) {
      return false
    }
    let nesting = 0
    while (true) {
      scan.next()
      const kind = scan.kind
      if (kind === TOK_ARROW && nesting === 0) {
        return true
      }
      if (kind === TOK_LPAREN || kind === TOK_LBRACKET || kind === TOK_LT) {
        nesting = nesting + 1
      } else if (kind === TOK_RPAREN || kind === TOK_RBRACKET || kind === TOK_GT) {
        nesting = nesting - 1
      } else if (kind === TOK_SHR) {
        nesting = nesting - 2
      } else if (kind === TOK_USHR) {
        nesting = nesting - 3
      } else if (kind === TOK_ARROW || kind === TOK_COLON || kind === TOK_COMMA) {
        // Inside a nested function type's parameter list, where these belong.
        if (nesting === 0) {
          return false
        }
      } else if (kind !== TOK_IDENT && kind !== TOK_NULL && kind !== TOK_PIPE) {
        return false
      }
      if (nesting < 0) {
        return false
      }
    }
  }

  /**
   * An arrow in expression position, `(x) => x * 2`, `(x: i32): i32 => { ... }`
   * or `x => x * 2` (WP29, wp23 §6), as the `N_ARROW` that `nodes.ts` shapes
   * like an `N_FUNCTION`. A parameter's annotation and the return type may be
   * omitted: the checker takes both from the function type of the parameter
   * the arrow is the argument for, which is the only place an arrow is legal.
   */
  parseArrowExpression(start: i32): Node {
    const node = this.node(N_ARROW, start, this.end)
    node.children.push(this.empty())
    const params = this.list()
    if (this.at(TOK_IDENT)) {
      const param = this.node(N_PARAM, this.start, this.end)
      param.children.push(this.parseIdentifier())
      param.children.push(this.empty())
      param.end = this.previousEnd
      params.children.push(param)
      node.children.push(this.closeList(params))
    } else {
      node.children.push(this.parseParameters(false))
    }
    node.children.push(this.eat(TOK_COLON) ? this.parseType() : this.empty())
    this.expect(TOK_ARROW)
    node.children.push(this.at(TOK_LBRACE) ? this.parseBlock() : this.parseExpression())
    node.children.push(this.list())
    node.end = this.previousEnd
    return node
  }

  /**
   * `` `a${x}b` ``: the parts in order, text and expression alternating. A
   * template with no substitution is one `TEMPLATE_TEXT` child, so the shape
   * does not depend on how the programmer wrote it.
   */
  parseTemplate(start: i32): Node {
    const node = this.node(N_TEMPLATE, start, this.end)
    const head = this.node(N_TEMPLATE_TEXT, this.start, this.end)
    head.text = this.value
    node.children.push(head)
    const whole = this.at(TOK_TEMPLATE)
    this.advance()
    if (whole) {
      node.end = this.previousEnd
      return node
    }
    const outerNoIn = this.allowIn()
    while (true) {
      node.children.push(this.parseExpression())
      if (this.at(TOK_TEMPLATE_MIDDLE) || this.at(TOK_TEMPLATE_TAIL)) {
        const part = this.node(N_TEMPLATE_TEXT, this.start, this.end)
        part.text = this.value
        node.children.push(part)
        const last = this.at(TOK_TEMPLATE_TAIL)
        this.advance()
        if (last) {
          break
        }
      } else {
        node.children.push(this.fail("expected the rest of the template literal"))
        break
      }
    }
    this.noIn = outerNoIn
    node.end = this.previousEnd
    return node
  }

  /**
   * A regular expression literal, where an operand is due and the lexer saw a
   * `/` or a `/=` (`Lexer.scanRegex`), for Phase 0 to refuse (NL1050).
   */
  parseRegex(start: i32): Node {
    const end = this.lexer.scanRegex(start)
    // The lexer has moved past the literal, or to the end of its line when it
    // has no closing `/`, so a token held for lookahead is not the next one.
    this.hasAhead = false
    this.end = this.lexer.pos
    if (end < 0) {
      this.report("unterminated regular expression literal", start, this.end)
      const unterminated = this.node(N_ERROR, start, this.end)
      unterminated.text = "unterminated regular expression literal"
      this.advance()
      return unterminated
    }
    const node = this.node(N_REGEX, start, end)
    node.text = this.file.text.substring(start, end)
    this.advance()
    return node
  }

  /**
   * `[a, b]`. A hole, `[a, , b]`, is an EMPTY element, and `...a` an
   * N_SPREAD, for the checker to refuse (NL2210, NL2237).
   */
  parseArrayLiteral(start: i32): Node {
    this.advance()
    const node = this.node(N_ARRAY, start, this.end)
    const outerNoIn = this.allowIn()
    while (!this.at(TOK_RBRACKET) && !this.at(TOK_END)) {
      if (this.eat(TOK_COMMA)) {
        node.children.push(this.empty())
        continue
      }
      if (this.at(TOK_DOT_DOT_DOT)) {
        const spread = this.node(N_SPREAD, this.start, this.end)
        this.advance()
        spread.children.push(this.parseExpression())
        spread.end = this.previousEnd
        node.children.push(spread)
      } else {
        node.children.push(this.parseExpression())
      }
      if (!this.eat(TOK_COMMA)) {
        break
      }
    }
    this.noIn = outerNoIn
    this.expect(TOK_RBRACKET)
    node.end = this.previousEnd
    return node
  }

  parseObjectLiteral(start: i32): Node {
    this.advance()
    const node = this.node(N_OBJECT, start, this.end)
    const outerNoIn = this.allowIn()
    while (!this.at(TOK_RBRACE) && !this.at(TOK_END)) {
      const propertyStart = this.start
      // `{ ...a }`, object spread, for Phase 0 to refuse (NL1061): the
      // N_SPREAD an array literal's `...a` is, among the properties.
      if (this.at(TOK_DOT_DOT_DOT)) {
        const spread = this.node(N_SPREAD, propertyStart, this.end)
        this.advance()
        spread.children.push(this.parseExpression())
        spread.end = this.previousEnd
        node.children.push(spread)
        if (!this.eat(TOK_COMMA)) {
          break
        }
        continue
      }
      const property = this.node(N_PROPERTY, propertyStart, this.end)
      // `[k]`, a computed key, for Phase 0 to refuse (NL1041): read first,
      // because whether a method follows is a question about the token
      // after its `]`.
      const computed: Node | null = this.at(TOK_LBRACKET) ? this.parseComputedName() : null
      // `{ m() { } }`, a method (or an accessor), for the checker to refuse
      // (NL2258): the property's value is the N_METHOD.
      if (computed === null ? this.objectMethodAhead() : this.methodAfterComputedName()) {
        const method = this.parseObjectMethod(propertyStart, computed)
        property.text = (method.flags & FLAG_COMPUTED) === 0 ? method.children[0].text : ""
        property.children.push(method)
        property.end = this.previousEnd
        node.children.push(property)
        if (!this.eat(TOK_COMMA)) {
          break
        }
        continue
      }
      // `{ "a": 1 }` and `{ 0: 1 }`: the key is a second child, for the
      // checker to refuse (NL2223), and so is a computed key, with
      // FLAG_COMPUTED. Read only when written, so an ordinary property
      // allocates no node it would drop.
      let key: Node | null = null
      if (computed !== null) {
        key = computed
        property.flags = FLAG_COMPUTED
      } else if (this.at(TOK_IDENT)) {
        property.text = this.value
        this.advance()
      } else if ((this.at(TOK_STRING) || this.at(TOK_NUMBER)) && this.peek() === TOK_COLON) {
        key = this.parseMemberNameNode()
      } else {
        this.report("an object literal key must be a plain identifier", this.start, this.end)
        this.advance()
      }
      if (computed !== null) {
        // A computed key has no shorthand: `{ [k] }` is not a property.
        this.expect(TOK_COLON)
        property.children.push(this.parseExpression())
      } else if (this.eat(TOK_COLON)) {
        property.children.push(this.parseExpression())
      } else {
        // Shorthand `{ x }`: the value is the identifier the key names.
        const shorthand = this.node(N_IDENT, propertyStart, this.previousEnd)
        shorthand.text = property.text
        property.children.push(shorthand)
      }
      if (key !== null) {
        property.children.push(key)
      }
      property.end = this.previousEnd
      node.children.push(property)
      if (!this.eat(TOK_COMMA)) {
        break
      }
    }
    this.noIn = outerNoIn
    this.expect(TOK_RBRACE)
    node.end = this.previousEnd
    return node
  }

  /**
   * Whether an object literal's member in hand is a method: a key followed by
   * `(` or `<`, `get` or `set` before a key, `async` before a key or a `*` on
   * its line, or a `*`, where a key may be a computed `[k]`. `{ get: 1 }`,
   * `{ get }` and `{ async }` stay the properties they are.
   */
  objectMethodAhead(): boolean {
    if (this.at(TOK_STAR)) {
      return true
    }
    if (!this.atMemberName()) {
      return false
    }
    const next = this.peek()
    if (next === TOK_LPAREN || next === TOK_LT) {
      return true
    }
    if (this.accessorAhead()) {
      return true
    }
    return this.at(TOK_IDENT) && this.value === "async" && this.asyncModifierAhead()
  }

  /**
   * `m(): T { }` in an object literal, with `async`, `*`, `get` or `set` in
   * front of it: an N_METHOD shaped as a class's is. It is refused whole, so a
   * parameter needs no annotation to get there. A computed name, `computed`
   * when the caller has read it already, carries FLAG_COMPUTED (NL1041).
   */
  parseObjectMethod(start: i32, computed: Node | null): Node {
    const method = this.node(N_METHOD, start, this.end)
    let name: Node | null = computed
    if (name === null) {
      if (this.at(TOK_IDENT) && this.value === "async" && this.asyncModifierAhead()) {
        this.advance()
        method.flags = FLAG_ASYNC
      }
      if (this.eat(TOK_STAR)) {
        method.flags = method.flags | FLAG_GENERATOR
      }
      if (this.accessorAhead()) {
        this.advance()
        method.flags = method.flags | FLAG_ACCESSOR
      }
      name = this.at(TOK_LBRACKET) ? this.parseComputedName() : null
    }
    if (name !== null) {
      method.flags = method.flags | FLAG_COMPUTED
      method.children.push(name)
    } else {
      method.children.push(this.parseMemberNameNode())
    }
    const typeParams = this.parseTypeParameters()
    method.children.push(this.parseParameters(false))
    method.children.push(this.parseReturnType())
    method.children.push(this.parseBlock())
    if (typeParams.children.length > 0) {
      method.children.push(typeParams)
    }
    method.end = this.previousEnd
    return method
  }

  /**
   * `new C<T>(args)`. The class is a name, and anything else a program writes
   * there — `new a.B()`, `new classes[0]()` — is read as the member or element
   * access it is, for the checker to refuse (NL2144).
   */
  parseNew(start: i32): Node {
    this.advance()
    const node = this.node(N_NEW, start, this.end)
    const calleeStart = this.start
    let callee = this.at(TOK_IDENT) ? this.parseIdentifier() : this.parsePrimary()
    while (this.at(TOK_DOT) || this.at(TOK_LBRACKET)) {
      if (this.eat(TOK_DOT)) {
        callee = this.parseMemberName(callee, calleeStart)
      } else {
        callee = this.parseElement(callee, calleeStart)
      }
    }
    node.children.push(callee)
    const typeArguments = this.list()
    if (this.at(TOK_LT)) {
      this.advance()
      while (!this.at(TOK_GT) && !this.at(TOK_END)) {
        typeArguments.children.push(this.parseType())
        if (!this.eat(TOK_COMMA)) {
          break
        }
      }
      this.expectTypeArgumentEnd()
    }
    node.children.push(this.closeList(typeArguments))
    node.children.push(this.parseArguments())
    node.end = this.previousEnd
    return node
  }

  parseIdentifier(): Node {
    const start = this.start
    if (!this.at(TOK_IDENT)) {
      return this.fail(`expected a name, found \`${tokenName(this.kind)}\``)
    }
    const node = this.node(N_IDENT, start, this.end)
    node.text = this.value
    this.advance()
    return node
  }
}
