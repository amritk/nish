// The parser for the subset (docs/wp14-selfhost.md, milestone S2): recursive
// descent over `self/lexer.ts`, producing the one-class tree of
// `self/nodes.ts`.
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
// **What it accepts is wider than the language.** The parser reads `??`, `?.`,
// `==`, `**` and the rest, and turns them down by name, because a message
// about the operator the programmer wrote beats one about a token they did
// not. Anything it cannot make a node of is an `N_ERROR` with the reason.

import { Diagnostic, SourceFile } from "./diagnostics";
import { Lexer } from "./lexer";
import {
  FLAG_CONST,
  FLAG_EXPORTED,
  FLAG_FOREIGN,
  FLAG_POSTFIX,
  FLAG_PREFIX,
  FLAG_READONLY,
  N_ARRAY,
  N_BIGINT,
  N_BINARY,
  N_BLOCK,
  N_BREAK,
  N_CALL,
  N_CASE,
  N_CLASS,
  N_CONDITIONAL,
  N_CONSTRUCTOR,
  N_CONTINUE,
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
  N_IMPORT_SPEC,
  N_INDEX,
  N_INTERFACE,
  N_LIST,
  N_MEMBER,
  N_METHOD,
  N_MODULE_CONST,
  N_NEW,
  N_NULL,
  N_NUMBER,
  N_OBJECT,
  N_PARAM,
  N_PAREN,
  N_PROPERTY,
  N_RETURN,
  N_SOURCE_FILE,
  N_SUPER,
  N_STRING,
  N_SWITCH,
  N_TEMPLATE,
  N_TEMPLATE_TEXT,
  N_THIS,
  N_THROW,
  N_TRUE,
  N_UNARY,
  N_ENUM,
  N_ENUM_MEMBER,
  N_TYPE_ALIAS,
  N_TYPE_ARRAY,
  N_TYPE_NULL,
  N_TYPE_PAREN,
  N_TYPE_READONLY,
  N_TYPE_REF,
  N_TYPE_UNION,
  N_VAR,
  N_VAR_DECL,
  N_WHILE,
  Node,
} from "./nodes";
import {
  TOK_AMP,
  TOK_AMP_ASSIGN,
  TOK_AND_AND,
  TOK_ARROW,
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
  TOK_ELSE,
  TOK_END,
  TOK_EQ,
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
} from "./tokens";

/**
 * Binding power of a binary operator, or 0 when the token is not one. The
 * levels are JavaScript's, so that a program means here what it means there:
 * `||` binds loosest, then `&&`, then the bitwise trio, equality, relational,
 * shifts, additive, multiplicative.
 */
export function binaryPrecedence(kind: i32): i32 {
  if (kind === TOK_OR_OR) return 1;
  if (kind === TOK_AND_AND) return 2;
  if (kind === TOK_PIPE) return 3;
  if (kind === TOK_CARET) return 4;
  if (kind === TOK_AMP) return 5;
  if (kind === TOK_EQ || kind === TOK_NE) return 6;
  if (kind === TOK_LT || kind === TOK_LE || kind === TOK_GT || kind === TOK_GE) return 7;
  if (kind === TOK_SHL || kind === TOK_SHR || kind === TOK_USHR) return 8;
  if (kind === TOK_PLUS || kind === TOK_MINUS) return 9;
  if (kind === TOK_STAR || kind === TOK_SLASH || kind === TOK_PERCENT) return 10;
  return 0;
}

/** Whether the token assigns: `=` and the compound forms the language has. */
export function isAssignment(kind: i32): boolean {
  return (
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
    kind === TOK_USHR_ASSIGN
  );
}

export class Parser {
  /**
   * The file being parsed. A `SourceFile` rather than a bare string because a
   * diagnostic is anchored to one: the parser's errors and the checker's go
   * into the same report, sorted together, and there is one `Diagnostic`
   * class in `self/` rather than a syntax one and a semantic one.
   */
  file: SourceFile;
  lexer: Lexer;
  diagnostics: Diagnostic[];

  // The current token, copied out of the lexer so that `ahead` can be read
  // without losing it.
  kind: i32;
  start: i32;
  end: i32;
  value: string;

  /**
   * The end of the token consumed most recently, which is where a construct
   * stops: every `node.end` is set from it after the last child is parsed.
   */
  previousEnd: i32;

  // One token of lookahead, filled on demand by `peek()`.
  aheadKind: i32;
  aheadStart: i32;
  aheadEnd: i32;
  aheadValue: string;
  hasAhead: boolean;

  /** How many nodes this parser has made; also the next id it will hand out. */
  nodeCount: i32;

  constructor(file: SourceFile) {
    this.file = file;
    this.lexer = new Lexer(file.text);
    this.diagnostics = [];
    this.nodeCount = 0;
    this.kind = TOK_END;
    this.start = 0;
    this.end = 0;
    this.value = "";
    this.previousEnd = 0;
    this.aheadKind = TOK_END;
    this.aheadStart = 0;
    this.aheadEnd = 0;
    this.aheadValue = "";
    this.hasAhead = false;
    this.advance();
  }

  /** Move to the next token, reporting a lexical error once and skipping past it. */
  advance(): void {
    this.previousEnd = this.end;
    if (this.hasAhead) {
      this.kind = this.aheadKind;
      this.start = this.aheadStart;
      this.end = this.aheadEnd;
      this.value = this.aheadValue;
      this.hasAhead = false;
      return;
    }
    this.lexer.next();
    while (this.lexer.kind === TOK_ERROR) {
      this.report(this.lexer.value, this.lexer.start, this.lexer.end);
      this.lexer.next();
    }
    this.kind = this.lexer.kind;
    this.start = this.lexer.start;
    this.end = this.lexer.end;
    this.value = this.lexer.value;
  }

  /** The kind of the token after the current one. */
  peek(): i32 {
    if (!this.hasAhead) {
      this.lexer.next();
      while (this.lexer.kind === TOK_ERROR) {
        this.report(this.lexer.value, this.lexer.start, this.lexer.end);
        this.lexer.next();
      }
      this.aheadKind = this.lexer.kind;
      this.aheadStart = this.lexer.start;
      this.aheadEnd = this.lexer.end;
      this.aheadValue = this.lexer.value;
      this.hasAhead = true;
    }
    return this.aheadKind;
  }

  report(message: string, start: i32, end: i32): void {
    this.diagnostics.push(new Diagnostic(this.file, start, end, "syntax error", message));
  }

  /**
   * Every node of this tree comes from here, which is what lets the ids be
   * dense: `nodeCount` is the size the checker's side tables need.
   */
  node(kind: i32, start: i32, end: i32): Node {
    const made = new Node(kind, start, end);
    made.id = this.nodeCount;
    this.nodeCount = this.nodeCount + 1;
    return made;
  }

  /**
   * The marker for an optional child that is not there. It has no position:
   * an absence is not at a place, and giving it one would make every dump
   * depend on where the parser happened to be looking.
   */
  empty(): Node {
    return this.node(N_EMPTY, 0, 0);
  }

  /** A fresh, still-empty `N_LIST`; `closeList` gives it its span. */
  list(): Node {
    return this.node(N_LIST, 0, 0);
  }

  /**
   * A list spans its elements: from the first's start to the last's end, and
   * nowhere at all when there are none. Derived rather than tracked, so the
   * span does not depend on which brace the parser had reached.
   */
  closeList(list: Node): Node {
    const count = list.children.length;
    if (count > 0) {
      list.start = list.children[0].start;
      list.end = list.children[count - 1].end;
    }
    return list;
  }

  /** An `N_ERROR` node carrying the reason, reported at the current token. */
  fail(message: string): Node {
    this.report(message, this.start, this.end);
    const node = this.node(N_ERROR, this.start, this.end);
    node.text = message;
    return node;
  }

  at(kind: i32): boolean {
    return this.kind === kind;
  }

  /** Consume the token when it is `kind`; answer whether it was. */
  eat(kind: i32): boolean {
    if (this.kind !== kind) return false;
    this.advance();
    return true;
  }

  /**
   * Consume `kind` or report. The token is not skipped on failure: the caller
   * is usually mid-construct and skipping would swallow the next one too.
   */
  expect(kind: i32): boolean {
    if (this.eat(kind)) return true;
    this.report(`expected \`${tokenName(kind)}\`, found \`${tokenName(this.kind)}\``, this.start, this.end);
    return false;
  }

  /** A semicolon, which this grammar requires: the language has no insertion rule. */
  expectSemicolon(): void {
    this.expect(TOK_SEMICOLON);
  }

  // ---- Declarations ------------------------------------------------------------------

  parseSourceFile(): Node {
    const file = this.node(N_SOURCE_FILE, 0, this.file.text.length);
    while (!this.at(TOK_END)) {
      const before = this.start;
      file.children.push(this.parseDeclaration());
      // A declaration that consumed nothing would spin; skip a token so the
      // next error is a new one.
      if (this.start === before && !this.at(TOK_END)) this.advance();
    }
    return file;
  }

  parseDeclaration(): Node {
    const start = this.start;
    let exported = false;
    if (this.at(TOK_EXPORT)) {
      exported = true;
      this.advance();
    }
    if (this.at(TOK_IMPORT)) {
      if (exported) return this.fail("`export` cannot introduce an import");
      return this.parseImport(start);
    }
    if (this.at(TOK_FUNCTION)) return this.exportable(this.parseFunction(start), exported);
    if (this.at(TOK_CLASS)) return this.exportable(this.parseClass(start), exported);
    if (this.at(TOK_INTERFACE)) return this.exportable(this.parseInterface(start), exported);
    if (this.at(TOK_CONST) && this.startsArrowDeclaration()) {
      return this.exportable(this.parseArrowFunction(start), exported);
    }
    // `const enum` is read rather than refused where it stands, so the checker
    // can say why an enum member needs no `const` instead of the parser saying
    // that `enum` is not a variable name (WP23).
    if (this.at(TOK_CONST) && this.startsConstEnum()) {
      this.advance(); // `const`
      const declaration = this.parseEnum(start);
      declaration.flags = declaration.flags | FLAG_CONST;
      return this.exportable(declaration, exported);
    }
    if (this.at(TOK_CONST) || this.at(TOK_LET)) {
      return this.exportable(this.parseModuleConst(start), exported);
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
      this.advance(); // `declare`
      const foreign = this.parseForeignFunction(start);
      return this.exportable(foreign, exported);
    }
    if (this.at(TOK_IDENT) && this.value === "type") {
      return this.exportable(this.parseTypeAlias(start), exported);
    }
    if (this.at(TOK_IDENT) && this.value === "enum") {
      return this.exportable(this.parseEnum(start), exported);
    }
    return this.fail(
      `a module holds only \`function\`, \`class\`, \`interface\`, \`const\`, \`type\`, \`enum\` and \`import\`, found \`${tokenName(this.kind)}\``
    );
  }

  /** Mark a declaration `export`ed, which is a modifier rather than a child. */
  exportable(declaration: Node, exported: boolean): Node {
    if (exported) declaration.flags = declaration.flags | FLAG_EXPORTED;
    return declaration;
  }

  /** `import { a, b as c } from "./m";` — the only import form there is. */
  parseImport(start: i32): Node {
    this.advance(); // `import`
    const node = this.node(N_IMPORT, start, this.end);
    const list = this.list();
    if (!this.expect(TOK_LBRACE)) return this.finish(node, this.closeList(list));
    while (!this.at(TOK_RBRACE) && !this.at(TOK_END)) {
      const specStart = this.start;
      const exported = this.parseIdentifier();
      const spec = this.node(N_IMPORT_SPEC, specStart, exported.end);
      spec.text = exported.text;
      spec.children.push(exported);
      // `as` is not a keyword to this lexer; it is the identifier `as`.
      if (this.at(TOK_IDENT) && this.value === "as") {
        this.advance();
        const local = this.parseIdentifier();
        spec.text = local.text;
        spec.end = local.end;
      }
      list.children.push(spec);
      if (!this.eat(TOK_COMMA)) break;
    }
    this.expect(TOK_RBRACE);
    if (this.at(TOK_IDENT) && this.value === "from") this.advance();
    else this.report(`expected \`from\`, found \`${tokenName(this.kind)}\``, this.start, this.end);
    if (this.at(TOK_STRING)) {
      node.text = this.value;
      this.advance();
    } else {
      this.report("a module specifier must be a string literal", this.start, this.end);
    }
    this.expectSemicolon();
    return this.finish(node, this.closeList(list));
  }

  /** Attach `list` and close `node` at the token just consumed. */
  finish(node: Node, list: Node): Node {
    node.children.push(list);
    node.end = this.previousEnd;
    return node;
  }

  parseFunction(start: i32): Node {
    this.advance(); // `function`
    const node = this.node(N_FUNCTION, start, this.end);
    node.children.push(this.parseIdentifier());
    node.children.push(this.parseParameters());
    node.children.push(this.parseReturnType());
    node.children.push(this.parseBlock());
    node.end = this.previousEnd;
    return node;
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
    this.advance(); // `function`
    const node = this.node(N_FUNCTION, start, this.end);
    node.children.push(this.parseIdentifier());
    node.children.push(this.parseParameters());
    node.children.push(this.parseReturnType());
    // A `;` ends the declaration. A `{` is a body, which is a mistake the
    // *checker* reports — so it is parsed into the body slot rather than left
    // for the next `parseDeclaration` to trip over, which is what lets stage1
    // say what stage0 says instead of complaining about a brace.
    if (this.at(TOK_LBRACE)) {
      node.children.push(this.parseBlock());
    } else {
      node.children.push(this.empty());
      this.eat(TOK_SEMICOLON);
    }
    node.flags = node.flags | FLAG_FOREIGN;
    node.end = this.previousEnd;
    return node;
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
    const scan = new Lexer(this.file.text);
    scan.pos = this.start;
    scan.next(); // `const`
    scan.next();
    if (scan.kind !== TOK_IDENT) return false;
    scan.next();
    if (scan.kind !== TOK_ASSIGN) return false;
    scan.next();
    if (scan.kind !== TOK_LPAREN) return false;
    let depth = 1;
    while (depth > 0) {
      scan.next();
      if (scan.kind === TOK_END) return false;
      if (scan.kind === TOK_LPAREN) depth = depth + 1;
      else if (scan.kind === TOK_RPAREN) depth = depth - 1;
    }
    scan.next();
    return scan.kind === TOK_ARROW || scan.kind === TOK_COLON;
  }

  /**
   * `const double = (n: i32): i32 => n * 2;` -- the same `N_FUNCTION` the
   * `function` spelling builds, so every pass after this one is unchanged. The
   * body child is the `BLOCK` when there is one and the returned expression
   * when the body is concise.
   */
  parseArrowFunction(start: i32): Node {
    this.advance(); // `const`
    const node = this.node(N_FUNCTION, start, this.end);
    node.children.push(this.parseIdentifier());
    this.expect(TOK_ASSIGN);
    node.children.push(this.parseParameters());
    node.children.push(this.parseReturnType());
    this.expect(TOK_ARROW);
    node.children.push(this.at(TOK_LBRACE) ? this.parseBlock() : this.parseExpression());
    this.expectSemicolon();
    node.end = this.previousEnd;
    return node;
  }

  parseParameters(): Node {
    const list = this.list();
    if (!this.expect(TOK_LPAREN)) return list;
    while (!this.at(TOK_RPAREN) && !this.at(TOK_END)) {
      const start = this.start;
      const param = this.node(N_PARAM, start, this.end);
      param.children.push(this.parseIdentifier());
      if (this.at(TOK_QUESTION)) {
        this.report("optional parameters are not supported", this.start, this.end);
        this.advance();
      }
      param.children.push(this.parseTypeAnnotation());
      param.end = this.previousEnd;
      list.children.push(param);
      if (!this.eat(TOK_COMMA)) break;
    }
    this.expect(TOK_RPAREN);
    return this.closeList(list);
  }

  /** `: T` after a signature; a missing one is an error the checker also wants named. */
  parseReturnType(): Node {
    if (this.eat(TOK_COLON)) return this.parseType();
    this.report("a return type annotation is required", this.start, this.end);
    return this.empty();
  }

  /** `: T`, required on every parameter, field and annotated declaration. */
  parseTypeAnnotation(): Node {
    if (this.eat(TOK_COLON)) return this.parseType();
    this.report("a type annotation is required", this.start, this.end);
    return this.empty();
  }

  parseClass(start: i32): Node {
    this.advance(); // `class`
    const node = this.node(N_CLASS, start, this.end);
    node.children.push(this.parseIdentifier());
    node.children.push(this.at(TOK_EXTENDS) ? this.parseHeritageName() : this.empty());
    const implemented = this.list();
    if (this.at(TOK_IMPLEMENTS)) {
      this.advance();
      while (true) {
        implemented.children.push(this.parseIdentifier());
        if (!this.eat(TOK_COMMA)) break;
      }
    }
    node.children.push(this.closeList(implemented));
    node.children.push(this.parseClassBody());
    node.end = this.previousEnd;
    return node;
  }

  parseHeritageName(): Node {
    this.advance(); // `extends`
    return this.parseIdentifier();
  }

  parseClassBody(): Node {
    const members = this.list();
    if (!this.expect(TOK_LBRACE)) return members;
    while (!this.at(TOK_RBRACE) && !this.at(TOK_END)) {
      const before = this.start;
      members.children.push(this.parseMember());
      if (this.start === before && !this.at(TOK_RBRACE) && !this.at(TOK_END)) this.advance();
    }
    this.expect(TOK_RBRACE);
    return this.closeList(members);
  }

  /**
   * `readonly`, `public`, `private`, `protected` and `static` in front of a
   * member. Only `readonly` is recorded, because it is the only one the
   * checker asks about; the accessibility three are accepted and ignored
   * (docs/LANGUAGE.md, Classes), and `static` is refused where it stands.
   */
  parseMemberModifiers(): i32 {
    let flags = 0;
    while (this.at(TOK_IDENT) && this.peek() !== TOK_LPAREN && this.peek() !== TOK_COLON) {
      const word = this.value;
      if (word === "readonly") flags = flags | FLAG_READONLY;
      else if (word === "static") this.report("`static` members are not supported", this.start, this.end);
      else if (word !== "public" && word !== "private" && word !== "protected") return flags;
      this.advance();
    }
    return flags;
  }

  /** A field, a method, or the constructor. `constructor` is an identifier to the lexer. */
  parseMember(): Node {
    const start = this.start;
    const modifiers = this.parseMemberModifiers();
    if (this.at(TOK_IDENT) && this.value === "constructor" && this.peek() === TOK_LPAREN) {
      this.advance();
      const ctor = this.node(N_CONSTRUCTOR, start, this.end);
      ctor.children.push(this.parseParameters());
      ctor.children.push(this.parseBlock());
      ctor.end = this.previousEnd;
      return ctor;
    }
    if (!this.at(TOK_IDENT)) {
      return this.fail(
        `a class member is a field, a method or a constructor, found \`${tokenName(this.kind)}\``
      );
    }
    if (this.peek() === TOK_LPAREN) {
      const method = this.node(N_METHOD, start, this.end);
      method.children.push(this.parseIdentifier());
      method.children.push(this.parseParameters());
      method.children.push(this.parseReturnType());
      method.children.push(this.parseBlock());
      method.end = this.previousEnd;
      return method;
    }
    const field = this.node(N_FIELD, start, this.end);
    field.flags = modifiers;
    field.children.push(this.parseIdentifier());
    field.children.push(this.parseTypeAnnotation());
    field.children.push(this.eat(TOK_ASSIGN) ? this.parseExpression() : this.empty());
    this.expectSemicolon();
    field.end = this.previousEnd;
    return field;
  }

  parseInterface(start: i32): Node {
    this.advance(); // `interface`
    const node = this.node(N_INTERFACE, start, this.end);
    node.children.push(this.parseIdentifier());
    const fields = this.list();
    if (this.expect(TOK_LBRACE)) {
      while (!this.at(TOK_RBRACE) && !this.at(TOK_END)) {
        const before = this.start;
        const fieldStart = this.start;
        if (!this.at(TOK_IDENT)) {
          fields.children.push(this.fail("an interface holds only annotated fields"));
        } else {
          const field = this.node(N_FIELD, fieldStart, this.end);
          field.children.push(this.parseIdentifier());
          field.children.push(this.parseTypeAnnotation());
          field.children.push(this.empty());
          if (!this.eat(TOK_SEMICOLON)) this.eat(TOK_COMMA);
          field.end = this.previousEnd;
          fields.children.push(field);
        }
        if (this.start === before && !this.at(TOK_RBRACE) && !this.at(TOK_END)) this.advance();
      }
      this.expect(TOK_RBRACE);
    }
    node.children.push(this.closeList(fields));
    node.end = this.previousEnd;
    return node;
  }

  /**
   * `type X = T;` — a second name for a type that already exists, never a type
   * of its own (docs/LANGUAGE.md, Type aliases). A type parameter list is not
   * accepted: `type Box<T>` stops at the `=` this expects, which is where the
   * language has always turned generics down.
   */
  parseTypeAlias(start: i32): Node {
    this.advance(); // `type`
    const node = this.node(N_TYPE_ALIAS, start, this.end);
    node.children.push(this.parseIdentifier());
    this.expect(TOK_ASSIGN);
    node.children.push(this.parseType());
    this.expectSemicolon();
    node.end = this.previousEnd;
    return node;
  }

  /**
   * Whether the `const` about to be parsed introduces a `const enum` rather
   * than a value. `enum` is a contextual keyword, so this is one token of
   * lookahead over the same source, the shape `startsArrowDeclaration` uses.
   */
  startsConstEnum(): boolean {
    const scan = new Lexer(this.file.text);
    scan.pos = this.start;
    scan.next(); // `const`
    scan.next();
    return scan.kind === TOK_IDENT && scan.value === "enum";
  }

  /**
   * `enum X { A = 1, B }` — a distinct type with `i32` representation (WP23).
   * The grammar is deliberately narrower than TypeScript's: the checker wants
   * to say *why* a member is not a literal, so anything is parsed here as an
   * expression and Phase 0 is what turns `B = A + 1` down by name.
   */
  parseEnum(start: i32): Node {
    this.advance(); // `enum`
    const node = this.node(N_ENUM, start, this.end);
    node.children.push(this.parseIdentifier());
    const members = this.list();
    if (this.expect(TOK_LBRACE)) {
      while (!this.at(TOK_RBRACE) && !this.at(TOK_END)) {
        const before = this.start;
        members.children.push(this.parseEnumMember());
        if (!this.eat(TOK_COMMA)) break;
        if (this.start === before && !this.at(TOK_RBRACE) && !this.at(TOK_END)) this.advance();
      }
      this.expect(TOK_RBRACE);
    }
    node.children.push(this.closeList(members));
    node.end = this.previousEnd;
    return node;
  }

  /** `A` or `A = 1`; an absent initialiser is `N_EMPTY` and means "one more than the last". */
  parseEnumMember(): Node {
    const start = this.start;
    const member = this.node(N_ENUM_MEMBER, start, this.end);
    member.children.push(this.parseIdentifier());
    member.children.push(this.eat(TOK_ASSIGN) ? this.parseExpression() : this.empty());
    member.end = this.previousEnd;
    return member;
  }

  parseModuleConst(start: i32): Node {
    const node = this.node(N_MODULE_CONST, start, this.end);
    if (this.at(TOK_CONST)) node.flags = node.flags | FLAG_CONST;
    else this.report("a module holds no top-level `let`; use `const`", this.start, this.end);
    this.advance();
    node.children.push(this.parseVariableDeclarations());
    this.expectSemicolon();
    node.end = this.previousEnd;
    return node;
  }

  /** The `a = 1, b = 2` of a `let`/`const`, without the keyword or the semicolon. */
  parseVariableDeclarations(): Node {
    const list = this.list();
    while (true) {
      const start = this.start;
      const declaration = this.node(N_VAR_DECL, start, this.end);
      declaration.children.push(this.parseIdentifier());
      declaration.children.push(this.at(TOK_COLON) ? this.parseTypeAnnotation() : this.empty());
      declaration.children.push(this.eat(TOK_ASSIGN) ? this.parseExpression() : this.empty());
      declaration.end = this.previousEnd;
      list.children.push(declaration);
      if (!this.eat(TOK_COMMA)) break;
    }
    return this.closeList(list);
  }

  // ---- Types -------------------------------------------------------------------------

  /** `T`, `T[]`, `Array<T>`, `T | null`. Unions are flat: `A | B | C` is one node. */
  parseType(): Node {
    const start = this.start;
    let type = this.parsePostfixType();
    if (!this.at(TOK_PIPE)) return type;
    const union = this.node(N_TYPE_UNION, start, type.end);
    union.children.push(type);
    while (this.eat(TOK_PIPE)) {
      union.children.push(this.parsePostfixType());
    }
    union.end = this.previousEnd;
    return union;
  }

  parsePostfixType(): Node {
    const start = this.start;
    // `readonly T[]`. It binds looser than the `[]` suffix and tighter than
    // `|`, which is why it sits here and not in `parseType`: `readonly T[] |
    // null` is a nullable readonly array, the way the `typescript` parser
    // reads it. Whether the operand is actually an array is the checker's
    // question, so a `readonly` on anything parses and is refused there with
    // a message that names the rule.
    if (this.at(TOK_IDENT) && this.value === "readonly") {
      this.advance();
      const node = this.node(N_TYPE_READONLY, start, this.end);
      node.children.push(this.parsePostfixType());
      node.end = this.previousEnd;
      return node;
    }
    let type = this.parsePrimaryType();
    while (this.at(TOK_LBRACKET) && this.peek() === TOK_RBRACKET) {
      this.advance();
      this.advance();
      const array = this.node(N_TYPE_ARRAY, start, this.previousEnd);
      array.children.push(type);
      type = array;
    }
    return type;
  }

  parsePrimaryType(): Node {
    const start = this.start;
    if (this.at(TOK_LPAREN)) {
      // `(T | null)[]`: the parentheses are not decoration, because `T | null[]`
      // is `T | (null[])`. The node is kept rather than unwrapped so the tree
      // is the `typescript` parser's, span for span; `resolveType` reads
      // through it exactly as stage0's `ParenthesizedType` case does.
      this.advance();
      const node = this.node(N_TYPE_PAREN, start, this.end);
      node.children.push(this.parseType());
      this.expect(TOK_RPAREN);
      node.end = this.previousEnd;
      return node;
    }
    if (this.at(TOK_NULL)) {
      this.advance();
      return this.node(N_TYPE_NULL, start, this.previousEnd);
    }
    if (!this.at(TOK_IDENT)) {
      return this.fail(`expected a type name, found \`${tokenName(this.kind)}\``);
    }
    const node = this.node(N_TYPE_REF, start, this.end);
    node.text = this.value;
    this.advance();
    const args = this.list();
    if (this.at(TOK_LT)) {
      this.advance();
      while (!this.at(TOK_GT) && !this.at(TOK_END)) {
        args.children.push(this.parseType());
        if (!this.eat(TOK_COMMA)) break;
      }
      // `>>` closes two argument lists at once; the lexer merged them, so
      // split the token here rather than making the lexer guess (S1's one
      // documented divergence from the `typescript` scanner).
      this.expectTypeArgumentEnd();
    }
    node.children.push(this.closeList(args));
    node.end = this.previousEnd;
    return node;
  }

  /**
   * Close a type argument list. A `>>` or `>>>` here is two or three closers
   * the lexer merged; consume one and leave the rest by rewriting the current
   * token in place.
   */
  expectTypeArgumentEnd(): void {
    if (this.eat(TOK_GT)) return;
    if (this.at(TOK_SHR)) {
      this.kind = TOK_GT;
      this.start = this.start + 1;
      this.previousEnd = this.start;
      return;
    }
    if (this.at(TOK_USHR)) {
      this.kind = TOK_SHR;
      this.start = this.start + 1;
      this.previousEnd = this.start;
      return;
    }
    this.expect(TOK_GT);
  }

  // ---- Statements --------------------------------------------------------------------

  parseBlock(): Node {
    const start = this.start;
    const block = this.node(N_BLOCK, start, this.end);
    if (!this.expect(TOK_LBRACE)) {
      block.end = this.previousEnd;
      return block;
    }
    while (!this.at(TOK_RBRACE) && !this.at(TOK_END)) {
      const before = this.start;
      block.children.push(this.parseStatement());
      if (this.start === before && !this.at(TOK_RBRACE) && !this.at(TOK_END)) this.advance();
    }
    this.expect(TOK_RBRACE);
    block.end = this.previousEnd;
    return block;
  }

  parseStatement(): Node {
    const start = this.start;
    switch (this.kind) {
      case TOK_LBRACE:
        return this.parseBlock();
      case TOK_LET:
      case TOK_CONST:
        return this.parseVariableStatement(start);
      case TOK_IF:
        return this.parseIf(start);
      case TOK_WHILE:
        return this.parseWhile(start);
      case TOK_DO:
        return this.parseDo(start);
      case TOK_FOR:
        return this.parseFor(start);
      case TOK_SWITCH:
        return this.parseSwitch(start);
      case TOK_RETURN:
        return this.parseReturn(start);
      case TOK_THROW:
        return this.parseThrow(start);
      case TOK_BREAK:
        return this.parseJump(start, N_BREAK);
      case TOK_CONTINUE:
        return this.parseJump(start, N_CONTINUE);
      case TOK_SEMICOLON:
        this.advance();
        return this.node(N_EMPTY, start, this.previousEnd);
      default:
        return this.parseExpressionStatement(start);
    }
  }

  parseVariableStatement(start: i32): Node {
    const node = this.node(N_VAR, start, this.end);
    if (this.at(TOK_CONST)) node.flags = node.flags | FLAG_CONST;
    this.advance();
    node.children.push(this.parseVariableDeclarations());
    this.expectSemicolon();
    node.end = this.previousEnd;
    return node;
  }

  parseIf(start: i32): Node {
    this.advance();
    const node = this.node(N_IF, start, this.end);
    this.expect(TOK_LPAREN);
    node.children.push(this.parseExpression());
    this.expect(TOK_RPAREN);
    node.children.push(this.parseStatement());
    node.children.push(this.eat(TOK_ELSE) ? this.parseStatement() : this.empty());
    node.end = this.previousEnd;
    return node;
  }

  parseWhile(start: i32): Node {
    this.advance();
    const node = this.node(N_WHILE, start, this.end);
    this.expect(TOK_LPAREN);
    node.children.push(this.parseExpression());
    this.expect(TOK_RPAREN);
    node.children.push(this.parseStatement());
    node.end = this.previousEnd;
    return node;
  }

  parseDo(start: i32): Node {
    this.advance();
    const node = this.node(N_DO, start, this.end);
    node.children.push(this.parseStatement());
    this.expect(TOK_WHILE);
    this.expect(TOK_LPAREN);
    node.children.push(this.parseExpression());
    this.expect(TOK_RPAREN);
    this.eat(TOK_SEMICOLON);
    node.end = this.previousEnd;
    return node;
  }

  /**
   * `for (init; cond; inc)` and `for (const x of a)`, told apart after the
   * declaration by whether `of` follows.
   */
  parseFor(start: i32): Node {
    this.advance();
    this.expect(TOK_LPAREN);
    if ((this.at(TOK_CONST) || this.at(TOK_LET)) && this.peek() === TOK_IDENT) {
      const declStart = this.start;
      const declaration = this.node(N_VAR, declStart, this.end);
      if (this.at(TOK_CONST)) declaration.flags = declaration.flags | FLAG_CONST;
      this.advance();
      declaration.children.push(this.parseVariableDeclarations());
      declaration.end = this.previousEnd;
      if (this.at(TOK_IDENT) && this.value === "of") {
        this.advance();
        const forOf = this.node(N_FOR_OF, start, this.end);
        forOf.children.push(declaration);
        forOf.children.push(this.parseExpression());
        this.expect(TOK_RPAREN);
        forOf.children.push(this.parseStatement());
        forOf.end = this.previousEnd;
        return forOf;
      }
      return this.parseForRest(start, declaration);
    }
    const initializer = this.at(TOK_SEMICOLON) ? this.empty() : this.parseExpression();
    return this.parseForRest(start, initializer);
  }

  /** The `; cond; inc) body` of a classic `for`, with the initializer already parsed. */
  parseForRest(start: i32, initializer: Node): Node {
    const node = this.node(N_FOR, start, this.end);
    node.children.push(initializer);
    this.expectSemicolon();
    node.children.push(this.at(TOK_SEMICOLON) ? this.empty() : this.parseExpression());
    this.expectSemicolon();
    node.children.push(this.at(TOK_RPAREN) ? this.empty() : this.parseExpression());
    this.expect(TOK_RPAREN);
    node.children.push(this.parseStatement());
    node.end = this.previousEnd;
    return node;
  }

  parseSwitch(start: i32): Node {
    this.advance();
    const node = this.node(N_SWITCH, start, this.end);
    this.expect(TOK_LPAREN);
    node.children.push(this.parseExpression());
    this.expect(TOK_RPAREN);
    const clauses = this.list();
    if (this.expect(TOK_LBRACE)) {
      while (!this.at(TOK_RBRACE) && !this.at(TOK_END)) {
        const before = this.start;
        clauses.children.push(this.parseClause());
        if (this.start === before && !this.at(TOK_RBRACE) && !this.at(TOK_END)) this.advance();
      }
      this.expect(TOK_RBRACE);
    }
    node.children.push(this.closeList(clauses));
    node.end = this.previousEnd;
    return node;
  }

  parseClause(): Node {
    const start = this.start;
    const isCase = this.at(TOK_CASE);
    if (!isCase && !this.at(TOK_DEFAULT)) {
      return this.fail("a `switch` body holds only `case` and `default` clauses");
    }
    this.advance();
    const clause = this.node(isCase ? N_CASE : N_DEFAULT, start, this.end);
    if (isCase) clause.children.push(this.parseExpression());
    this.expect(TOK_COLON);
    const body = this.list();
    while (!this.at(TOK_CASE) && !this.at(TOK_DEFAULT) && !this.at(TOK_RBRACE) && !this.at(TOK_END)) {
      const before = this.start;
      body.children.push(this.parseStatement());
      if (this.start === before) this.advance();
    }
    clause.children.push(this.closeList(body));
    clause.end = this.previousEnd;
    return clause;
  }

  parseReturn(start: i32): Node {
    this.advance();
    const node = this.node(N_RETURN, start, this.end);
    node.children.push(this.at(TOK_SEMICOLON) ? this.empty() : this.parseExpression());
    this.expectSemicolon();
    node.end = this.previousEnd;
    return node;
  }

  parseThrow(start: i32): Node {
    this.advance();
    const node = this.node(N_THROW, start, this.end);
    node.children.push(this.parseExpression());
    this.expectSemicolon();
    node.end = this.previousEnd;
    return node;
  }

  parseJump(start: i32, kind: i32): Node {
    this.advance();
    if (this.at(TOK_IDENT)) {
      this.report("a label is not supported", this.start, this.end);
      this.advance();
    }
    this.expectSemicolon();
    return this.node(kind, start, this.previousEnd);
  }

  parseExpressionStatement(start: i32): Node {
    const node = this.node(N_EXPR_STMT, start, this.end);
    node.children.push(this.parseExpression());
    this.expectSemicolon();
    node.end = this.previousEnd;
    return node;
  }

  // ---- Expressions -------------------------------------------------------------------

  /** Assignment, the loosest expression. Right-associative, as in JavaScript. */
  parseExpression(): Node {
    const start = this.start;
    const left = this.parseConditional();
    if (!isAssignment(this.kind)) return left;
    const operator = tokenName(this.kind);
    this.advance();
    const node = this.node(N_BINARY, start, this.end);
    node.text = operator;
    node.children.push(left);
    node.children.push(this.parseExpression());
    node.end = this.previousEnd;
    return node;
  }

  parseConditional(): Node {
    const start = this.start;
    const condition = this.parseBinary(1);
    if (!this.at(TOK_QUESTION)) return condition;
    this.advance();
    const node = this.node(N_CONDITIONAL, start, this.end);
    node.children.push(condition);
    node.children.push(this.parseExpression());
    this.expect(TOK_COLON);
    node.children.push(this.parseExpression());
    node.end = this.previousEnd;
    return node;
  }

  /** Precedence climbing; every operator here is left-associative. */
  parseBinary(minimum: i32): Node {
    const start = this.start;
    let left = this.parseUnary();
    while (true) {
      const precedence = binaryPrecedence(this.kind);
      if (precedence === 0 || precedence < minimum) return left;
      const operator = tokenName(this.kind);
      this.advance();
      const right = this.parseBinary(precedence + 1);
      const node = this.node(N_BINARY, start, right.end);
      node.text = operator;
      node.children.push(left);
      node.children.push(right);
      left = node;
    }
  }

  parseUnary(): Node {
    const start = this.start;
    if (this.at(TOK_BANG) || this.at(TOK_MINUS) || this.at(TOK_PLUS) || this.at(TOK_TILDE)) {
      const operator = tokenName(this.kind);
      this.advance();
      const node = this.node(N_UNARY, start, this.end);
      node.text = operator;
      node.flags = FLAG_PREFIX;
      node.children.push(this.parseUnary());
      node.end = this.previousEnd;
      return node;
    }
    if (this.at(TOK_PLUS_PLUS) || this.at(TOK_MINUS_MINUS)) {
      const operator = tokenName(this.kind);
      this.advance();
      const node = this.node(N_UNARY, start, this.end);
      node.text = operator;
      node.flags = FLAG_PREFIX;
      node.children.push(this.parseUnary());
      node.end = this.previousEnd;
      return node;
    }
    return this.parsePostfix();
  }

  parsePostfix(): Node {
    const start = this.start;
    const operand = this.parseCallOrMember(this.parsePrimary(), start);
    if (this.at(TOK_PLUS_PLUS) || this.at(TOK_MINUS_MINUS)) {
      const operator = tokenName(this.kind);
      this.advance();
      const node = this.node(N_UNARY, start, this.previousEnd);
      node.text = operator;
      node.flags = FLAG_POSTFIX;
      node.children.push(operand);
      return node;
    }
    return operand;
  }

  /** `.f`, `[i]` and `(args)`, applied left to right for as long as they come. */
  parseCallOrMember(target: Node, start: i32): Node {
    let node = target;
    while (true) {
      if (this.at(TOK_DOT)) {
        this.advance();
        const member = this.node(N_MEMBER, start, this.end);
        if (this.at(TOK_IDENT) || this.kind >= 0) {
          member.text = this.at(TOK_IDENT) ? this.value : tokenName(this.kind);
          this.advance();
        }
        member.children.push(node);
        member.end = this.previousEnd;
        node = member;
      } else if (this.at(TOK_LBRACKET)) {
        this.advance();
        const index = this.node(N_INDEX, start, this.end);
        index.children.push(node);
        index.children.push(this.parseExpression());
        this.expect(TOK_RBRACKET);
        index.end = this.previousEnd;
        node = index;
      } else if (this.at(TOK_LPAREN)) {
        const call = this.node(N_CALL, start, this.end);
        call.children.push(node);
        call.children.push(this.parseArguments());
        call.end = this.previousEnd;
        node = call;
      } else {
        return node;
      }
    }
  }

  parseArguments(): Node {
    const list = this.list();
    if (!this.expect(TOK_LPAREN)) return list;
    while (!this.at(TOK_RPAREN) && !this.at(TOK_END)) {
      list.children.push(this.parseExpression());
      if (!this.eat(TOK_COMMA)) break;
    }
    this.expect(TOK_RPAREN);
    return this.closeList(list);
  }

  parsePrimary(): Node {
    const start = this.start;
    switch (this.kind) {
      case TOK_IDENT: {
        const node = this.node(N_IDENT, start, this.end);
        node.text = this.value;
        this.advance();
        return node;
      }
      case TOK_NUMBER: {
        const node = this.node(N_NUMBER, start, this.end);
        node.text = this.value;
        this.advance();
        return node;
      }
      case TOK_BIGINT: {
        const node = this.node(N_BIGINT, start, this.end);
        node.text = this.value;
        this.advance();
        return node;
      }
      case TOK_STRING: {
        const node = this.node(N_STRING, start, this.end);
        node.text = this.value;
        this.advance();
        return node;
      }
      case TOK_TRUE:
        this.advance();
        return this.node(N_TRUE, start, this.previousEnd);
      case TOK_FALSE:
        this.advance();
        return this.node(N_FALSE, start, this.previousEnd);
      case TOK_NULL:
        this.advance();
        return this.node(N_NULL, start, this.previousEnd);
      case TOK_THIS:
        this.advance();
        return this.node(N_THIS, start, this.previousEnd);
      case TOK_SUPER:
        this.advance();
        return this.node(N_SUPER, start, this.previousEnd);
      case TOK_TEMPLATE:
      case TOK_TEMPLATE_HEAD:
        return this.parseTemplate(start);
      case TOK_LBRACKET:
        return this.parseArrayLiteral(start);
      case TOK_LBRACE:
        return this.parseObjectLiteral(start);
      case TOK_LPAREN: {
        this.advance();
        const node = this.node(N_PAREN, start, this.end);
        node.children.push(this.parseExpression());
        this.expect(TOK_RPAREN);
        node.end = this.previousEnd;
        return node;
      }
      case TOK_NEW:
        return this.parseNew(start);
      default:
        return this.fail(`expected an expression, found \`${tokenName(this.kind)}\``);
    }
  }

  /**
   * `` `a${x}b` ``: the parts in order, text and expression alternating. A
   * template with no substitution is one `TEMPLATE_TEXT` child, so the shape
   * does not depend on how the programmer wrote it.
   */
  parseTemplate(start: i32): Node {
    const node = this.node(N_TEMPLATE, start, this.end);
    const head = this.node(N_TEMPLATE_TEXT, this.start, this.end);
    head.text = this.value;
    node.children.push(head);
    const whole = this.at(TOK_TEMPLATE);
    this.advance();
    if (whole) {
      node.end = this.previousEnd;
      return node;
    }
    while (true) {
      node.children.push(this.parseExpression());
      if (this.at(TOK_TEMPLATE_MIDDLE) || this.at(TOK_TEMPLATE_TAIL)) {
        const part = this.node(N_TEMPLATE_TEXT, this.start, this.end);
        part.text = this.value;
        node.children.push(part);
        const last = this.at(TOK_TEMPLATE_TAIL);
        this.advance();
        if (last) break;
      } else {
        node.children.push(this.fail("expected the rest of the template literal"));
        break;
      }
    }
    node.end = this.previousEnd;
    return node;
  }

  parseArrayLiteral(start: i32): Node {
    this.advance();
    const node = this.node(N_ARRAY, start, this.end);
    while (!this.at(TOK_RBRACKET) && !this.at(TOK_END)) {
      node.children.push(this.parseExpression());
      if (!this.eat(TOK_COMMA)) break;
    }
    this.expect(TOK_RBRACKET);
    node.end = this.previousEnd;
    return node;
  }

  parseObjectLiteral(start: i32): Node {
    this.advance();
    const node = this.node(N_OBJECT, start, this.end);
    while (!this.at(TOK_RBRACE) && !this.at(TOK_END)) {
      const propertyStart = this.start;
      const property = this.node(N_PROPERTY, propertyStart, this.end);
      if (this.at(TOK_IDENT)) {
        property.text = this.value;
        this.advance();
      } else {
        this.report("an object literal key must be a plain identifier", this.start, this.end);
        this.advance();
      }
      if (this.eat(TOK_COLON)) property.children.push(this.parseExpression());
      else {
        // Shorthand `{ x }`: the value is the identifier the key names.
        const shorthand = this.node(N_IDENT, propertyStart, this.previousEnd);
        shorthand.text = property.text;
        property.children.push(shorthand);
      }
      property.end = this.previousEnd;
      node.children.push(property);
      if (!this.eat(TOK_COMMA)) break;
    }
    this.expect(TOK_RBRACE);
    node.end = this.previousEnd;
    return node;
  }

  parseNew(start: i32): Node {
    this.advance();
    const node = this.node(N_NEW, start, this.end);
    node.children.push(this.parseIdentifier());
    const typeArguments = this.list();
    if (this.at(TOK_LT)) {
      this.advance();
      while (!this.at(TOK_GT) && !this.at(TOK_END)) {
        typeArguments.children.push(this.parseType());
        if (!this.eat(TOK_COMMA)) break;
      }
      this.expectTypeArgumentEnd();
    }
    node.children.push(this.closeList(typeArguments));
    node.children.push(this.parseArguments());
    node.end = this.previousEnd;
    return node;
  }

  parseIdentifier(): Node {
    const start = this.start;
    if (!this.at(TOK_IDENT)) {
      return this.fail(`expected a name, found \`${tokenName(this.kind)}\``);
    }
    const node = this.node(N_IDENT, start, this.end);
    node.text = this.value;
    this.advance();
    return node;
  }
}

/** Parse `source`; the diagnostics are on the parser, which the caller keeps. */
export function parse(parser: Parser): Node {
  return parser.parseSourceFile();
}
