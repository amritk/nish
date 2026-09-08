// The lexer for the subset `self/` is written in, and itself written in that
// subset (docs/wp14-selfhost.md, milestone S1).
//
// It is the first piece of `self/` that is not a table: `src/` has
// no lexer at all, because the `typescript` package is the scanner there, so
// this is new code rather than a port, and it is the half of the bootstrap
// whose risk the S2 gate exists to measure.
//
// The shape is the usual one: a cursor over the source bytes and a `next()`
// that fills the fields of the lexer itself rather than allocating a token per
// call. A parser reads `kind`, `start`, `end` and `value` after each `next()`;
// there is no token array, so a 14,000-line input costs no allocation here at
// all beyond the strings it interns.
//
// Byte offsets, not code points. `s.length` and `s.charCodeAt(i)` are both
// byte-oriented (docs/LANGUAGE.md, "Arrays and strings as receivers"), and so
// are `start` and `end`, which is what lets a diagnostic slice the line back
// out with one `substring`. A non-ASCII character is therefore several
// positions wide, exactly as it is in the `typescript` scanner's offsets.
//
// Template literals are lexed without help from the parser. A backtick opens a
// scan that ends at the closing backtick (TEMPLATE) or at `${` (TEMPLATE_HEAD);
// the substitution's tokens are then ordinary tokens, and the `}` that closes
// it resumes the template scan (TEMPLATE_MIDDLE, or TEMPLATE_TAIL at the end).
// Telling that `}` from the one that closes a block is what `braceDepth` is
// for: one entry per open substitution, counting the blocks inside it.

import { StringBuilder } from "./strings";
import {
  TOK_AMP,
  TOK_AMP_ASSIGN,
  TOK_AND_AND,
  TOK_AND_AND_ASSIGN,
  TOK_ARROW,
  TOK_ASSIGN,
  TOK_AT,
  TOK_BANG,
  TOK_BIGINT,
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
  TOK_NEW,
  TOK_NE_LOOSE,
  TOK_NULL,
  TOK_NUMBER,
  TOK_OR_OR,
  TOK_OR_OR_ASSIGN,
  TOK_PERCENT,
  TOK_PERCENT_ASSIGN,
  TOK_PIPE,
  TOK_PIPE_ASSIGN,
  TOK_PLUS,
  TOK_PLUS_ASSIGN,
  TOK_PLUS_PLUS,
  TOK_PRIVATE_IDENT,
  TOK_QUESTION,
  TOK_QUESTION_DOT,
  TOK_QUESTION_QUESTION,
  TOK_QUESTION_QUESTION_ASSIGN,
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
} from "./tokens";

// Character codes, named where the digit would not read. `charCodeAt` answers
// a byte, so these are bytes.
const CH_TAB: i32 = 9;
const CH_LF: i32 = 10;
const CH_VT: i32 = 11;
const CH_FF: i32 = 12;
const CH_CR: i32 = 13;
const CH_SPACE: i32 = 32;
const CH_BANG: i32 = 33;
const CH_QUOTE: i32 = 34;
const CH_DOLLAR: i32 = 36;
const CH_PERCENT: i32 = 37;
const CH_AMP: i32 = 38;
const CH_APOS: i32 = 39;
const CH_LPAREN: i32 = 40;
const CH_RPAREN: i32 = 41;
const CH_STAR: i32 = 42;
const CH_PLUS: i32 = 43;
const CH_COMMA: i32 = 44;
const CH_MINUS: i32 = 45;
const CH_DOT: i32 = 46;
const CH_SLASH: i32 = 47;
const CH_0: i32 = 48;
const CH_7: i32 = 55;
const CH_9: i32 = 57;
const CH_COLON: i32 = 58;
const CH_SEMICOLON: i32 = 59;
const CH_LT: i32 = 60;
const CH_ASSIGN: i32 = 61;
const CH_GT: i32 = 62;
const CH_QUESTION: i32 = 63;
const CH_A_UPPER: i32 = 65;
const CH_B_UPPER: i32 = 66;
const CH_E_UPPER: i32 = 69;
const CH_F_UPPER: i32 = 70;
const CH_O_UPPER: i32 = 79;
const CH_X_UPPER: i32 = 88;
const CH_Z_UPPER: i32 = 90;
const CH_LBRACKET: i32 = 91;
const CH_BACKSLASH: i32 = 92;
const CH_RBRACKET: i32 = 93;
const CH_CARET: i32 = 94;
const CH_UNDERSCORE: i32 = 95;
const CH_BACKTICK: i32 = 96;
const CH_A_LOWER: i32 = 97;
const CH_B_LOWER: i32 = 98;
const CH_E_LOWER: i32 = 101;
const CH_F_LOWER: i32 = 102;
const CH_N_LOWER: i32 = 110;
const CH_O_LOWER: i32 = 111;
const CH_R_LOWER: i32 = 114;
const CH_T_LOWER: i32 = 116;
const CH_U_LOWER: i32 = 117;
const CH_V_LOWER: i32 = 118;
const CH_X_LOWER: i32 = 120;
const CH_Z_LOWER: i32 = 122;
const CH_LBRACE: i32 = 123;
const CH_PIPE: i32 = 124;
const CH_RBRACE: i32 = 125;
const CH_TILDE: i32 = 126;
const CH_AT: i32 = 64;
const CH_HASH: i32 = 35;

/** End of input, and the answer to every read past it. */
const CH_EOF: i32 = -1;

export function isDigit(c: i32): boolean {
  return c >= CH_0 && c <= CH_9;
}

/**
 * The first byte of an identifier. Bytes above 127 are accepted so that a
 * UTF-8 identifier lexes as one token rather than as a run of errors; the
 * checker is where a name is judged, not here.
 */
export function isIdentStart(c: i32): boolean {
  if (c >= CH_A_LOWER && c <= CH_Z_LOWER) return true;
  if (c >= CH_A_UPPER && c <= CH_Z_UPPER) return true;
  return c === CH_UNDERSCORE || c === CH_DOLLAR || c > 127;
}

export function isIdentPart(c: i32): boolean {
  return isIdentStart(c) || isDigit(c);
}

/** The value of a hex digit, or -1. */
export function hexValue(c: i32): i32 {
  if (isDigit(c)) return c - CH_0;
  if (c >= CH_A_LOWER && c <= CH_F_LOWER) return c - CH_A_LOWER + 10;
  if (c >= CH_A_UPPER && c <= CH_F_UPPER) return c - CH_A_UPPER + 10;
  return -1;
}

/**
 * The keyword a name denotes, or `TOK_IDENT`. A `switch` needs an integer, so
 * this is a chain, ordered by first character and then by length: the compare
 * that fails does so on its first byte, which is what a hash would have bought
 * without the table.
 *
 * A word that is a keyword in TypeScript but not in the subset (`try`, `var`,
 * `typeof`, `any`, ...) is an identifier here, deliberately: the parser
 * refuses it where it stands, with a message about the construct rather than
 * about a token nobody wrote. So are the two *contextual* keywords, `from`
 * and `of`, which are only special where the grammar already expects them and
 * are ordinary names anywhere else.
 */
export function keywordKind(word: string): i32 {
  if (word === "function") return TOK_FUNCTION;
  if (word === "return") return TOK_RETURN;
  if (word === "if") return TOK_IF;
  if (word === "else") return TOK_ELSE;
  if (word === "while") return TOK_WHILE;
  if (word === "do") return TOK_DO;
  if (word === "for") return TOK_FOR;
  if (word === "break") return TOK_BREAK;
  if (word === "continue") return TOK_CONTINUE;
  if (word === "let") return TOK_LET;
  if (word === "const") return TOK_CONST;
  if (word === "class") return TOK_CLASS;
  if (word === "interface") return TOK_INTERFACE;
  if (word === "new") return TOK_NEW;
  if (word === "this") return TOK_THIS;
  if (word === "import") return TOK_IMPORT;
  if (word === "export") return TOK_EXPORT;
  if (word === "true") return TOK_TRUE;
  if (word === "false") return TOK_FALSE;
  if (word === "null") return TOK_NULL;
  if (word === "throw") return TOK_THROW;
  if (word === "switch") return TOK_SWITCH;
  if (word === "case") return TOK_CASE;
  if (word === "default") return TOK_DEFAULT;
  if (word === "implements") return TOK_IMPLEMENTS;
  if (word === "extends") return TOK_EXTENDS;
  if (word === "super") return TOK_SUPER;
  return TOK_IDENT;
}

/** The UTF-8 bytes of one code point, as a string. */
export function utf8Encode(cp: i32): string {
  if (cp < 0x80) return String.fromCharCode(cp);
  if (cp < 0x800) {
    return String.fromCharCode(0xc0 | (cp >> 6)) + String.fromCharCode(0x80 | (cp & 0x3f));
  }
  if (cp < 0x10000) {
    return (
      String.fromCharCode(0xe0 | (cp >> 12)) +
      String.fromCharCode(0x80 | ((cp >> 6) & 0x3f)) +
      String.fromCharCode(0x80 | (cp & 0x3f))
    );
  }
  return (
    String.fromCharCode(0xf0 | (cp >> 18)) +
    String.fromCharCode(0x80 | ((cp >> 12) & 0x3f)) +
    String.fromCharCode(0x80 | ((cp >> 6) & 0x3f)) +
    String.fromCharCode(0x80 | (cp & 0x3f))
  );
}

export class Lexer {
  source: string;
  /** Read cursor, a byte offset. */
  pos: i32;

  // The current token, valid after `next()`.
  kind: i32;
  start: i32;
  end: i32;
  /**
   * The token's meaning where the source text is not it: an identifier's or a
   * number's characters, a string's or a template part's *decoded* bytes, and
   * an error's message. Empty for punctuation.
   */
  value: string;

  /**
   * One entry per template substitution being scanned, holding the number of
   * `{` opened inside it. A `}` with a zero on top closes the substitution and
   * resumes the template; anything else is an ordinary closing brace.
   */
  braceDepth: i32[];

  /**
   * Where the escape `scanEscape` just read ends, or -1 when it was
   * malformed: its second return value, which the language has no tuple for.
   * Written and read in the same three lines, at both call sites.
   */
  escapeEnd: i32;

  /**
   * The pieces of the literal being scanned, for the literals that have an
   * escape in them. One builder for the whole lexer rather than one per
   * literal: `scanString` and `scanTemplate` never overlap, and a literal
   * with no escape never touches it at all.
   */
  literal: StringBuilder;

  constructor(source: string) {
    this.source = source;
    this.pos = 0;
    this.kind = TOK_END;
    this.start = 0;
    this.end = 0;
    this.value = "";
    this.braceDepth = [];
    this.escapeEnd = 0;
    this.literal = new StringBuilder();
  }

  /** The byte at `i`, or -1 past the end. Every read goes through here. */
  at(i: i32): i32 {
    if (i < 0 || i >= this.source.length) return CH_EOF;
    return this.source.charCodeAt(i);
  }

  /** Skip whitespace and comments. An unterminated block comment stops at the end. */
  skipTrivia(): void {
    while (this.pos < this.source.length) {
      const c = this.at(this.pos);
      if (c === CH_SPACE || c === CH_TAB || c === CH_CR || c === CH_LF || c === CH_VT || c === CH_FF) {
        this.pos = this.pos + 1;
      } else if (c === CH_SLASH && this.at(this.pos + 1) === CH_SLASH) {
        this.pos = this.pos + 2;
        while (this.pos < this.source.length && this.at(this.pos) !== CH_LF) this.pos = this.pos + 1;
      } else if (c === CH_SLASH && this.at(this.pos + 1) === CH_STAR) {
        this.pos = this.pos + 2;
        while (this.pos < this.source.length) {
          if (this.at(this.pos) === CH_STAR && this.at(this.pos + 1) === CH_SLASH) {
            this.pos = this.pos + 2;
            break;
          }
          this.pos = this.pos + 1;
        }
      } else {
        return;
      }
    }
  }

  /** Record the current token and leave the cursor after it. */
  emit(kind: i32, end: i32, value: string): void {
    this.kind = kind;
    this.end = end;
    this.value = value;
    this.pos = end;
  }

  /** A token whose text is its meaning: punctuation and keywords. */
  emitPlain(kind: i32, width: i32): void {
    this.emit(kind, this.start + width, "");
  }

  error(message: string, end: i32): void {
    this.emit(TOK_ERROR, end, message);
  }

  /**
   * Advance to the next token. At the end of input the kind is `TOK_END` and
   * calling again is harmless, which is what lets a parser loop without
   * counting.
   */
  next(): void {
    this.skipTrivia();
    this.start = this.pos;
    if (this.pos >= this.source.length) {
      this.emit(TOK_END, this.pos, "");
      return;
    }
    const c = this.at(this.pos);
    if (isIdentStart(c)) {
      this.scanName();
      return;
    }
    if (isDigit(c) || (c === CH_DOT && isDigit(this.at(this.pos + 1)))) {
      this.scanNumber();
      return;
    }
    if (c === CH_QUOTE || c === CH_APOS) {
      this.scanString(c);
      return;
    }
    if (c === CH_BACKTICK) {
      this.scanTemplate(this.pos + 1, TOK_TEMPLATE, TOK_TEMPLATE_HEAD);
      return;
    }
    this.scanPunctuation(c);
  }

  /** `#name`, a private class member: one token, which the parser then refuses. */
  scanPrivateName(): void {
    let end = this.pos + 1;
    while (end < this.source.length && isIdentPart(this.at(end))) end = end + 1;
    this.emit(TOK_PRIVATE_IDENT, end, this.source.substring(this.start, end));
  }

  scanName(): void {
    let end = this.pos + 1;
    while (end < this.source.length && isIdentPart(this.at(end))) end = end + 1;
    const word = this.source.substring(this.start, end);
    const keyword = keywordKind(word);
    this.emit(keyword, end, keyword === TOK_IDENT ? word : "");
  }

  /**
   * A numeric literal. The text is kept as written — `0x10` stays `0x10` — and
   * the parser converts it, because the conversion needs the type the context
   * demands and the lexer has no context. Digit separators are part of the
   * token and the parser drops them.
   */
  scanNumber(): void {
    let end = this.pos;
    const second = this.at(end + 1);
    if (
      this.at(end) === CH_0 &&
      (second === CH_X_LOWER ||
        second === CH_X_UPPER ||
        second === CH_B_LOWER ||
        second === CH_B_UPPER ||
        second === CH_O_LOWER ||
        second === CH_O_UPPER)
    ) {
      end = end + 2;
      while (end < this.source.length && (isIdentPart(this.at(end)) || this.at(end) === CH_UNDERSCORE)) {
        end = end + 1;
      }
      if (this.at(end - 1) === CH_N_LOWER) {
        this.emit(TOK_BIGINT, end, this.source.substring(this.start, end));
        return;
      }
      this.emit(TOK_NUMBER, end, this.source.substring(this.start, end));
      return;
    }
    while (end < this.source.length && (isDigit(this.at(end)) || this.at(end) === CH_UNDERSCORE)) {
      end = end + 1;
    }
    if (this.at(end) === CH_DOT) {
      end = end + 1;
      while (end < this.source.length && (isDigit(this.at(end)) || this.at(end) === CH_UNDERSCORE)) {
        end = end + 1;
      }
    }
    const exponent = this.at(end);
    if (exponent === CH_E_LOWER || exponent === CH_E_UPPER) {
      let after = end + 1;
      if (this.at(after) === CH_PLUS || this.at(after) === CH_MINUS) after = after + 1;
      if (isDigit(this.at(after))) {
        end = after;
        while (end < this.source.length && isDigit(this.at(end))) end = end + 1;
      }
    }
    // `123n` is one BigInt token, as it is in TypeScript; the language has no
    // `bigint`, and the parser says so about the literal rather than about a
    // stray `n` after it.
    if (this.at(end) === CH_N_LOWER) {
      this.emit(TOK_BIGINT, end + 1, this.source.substring(this.start, end + 1));
      return;
    }
    this.emit(TOK_NUMBER, end, this.source.substring(this.start, end));
  }

  /**
   * `"..."` or `'...'`, with the escapes decoded: `value` holds the bytes the
   * program means, so the parser interns it and the emitter writes it out
   * without a second pass. A newline inside is an error, as it is in
   * TypeScript.
   *
   * `chunk` is where the run of bytes not yet taken begins: an escape flushes
   * the run before it in one `substring` and the closing quote flushes the
   * rest, so a literal with no escape costs one `substring` and nothing else.
   * See `literalText` for why that matters.
   */
  scanString(quote: i32): void {
    let at = this.pos + 1;
    let chunk = at;
    this.literal.reset();
    while (true) {
      if (at >= this.source.length) {
        this.error("unterminated string literal", at);
        return;
      }
      const c = this.at(at);
      if (c === quote) {
        this.emit(TOK_STRING, at + 1, this.literalText(chunk, at));
        return;
      }
      if (c === CH_LF) {
        this.error("unterminated string literal", at);
        return;
      }
      if (c === CH_BACKSLASH) {
        at = this.takeEscape(chunk, at);
        if (at < 0) return;
        chunk = at;
      } else {
        at = at + 1;
      }
    }
  }

  /**
   * Take the escape whose backslash is at `at`, together with the plain bytes
   * waiting since `chunk`, and answer where the escape ends — or -1, with the
   * malformed-escape error already reported. Shared by the two literal scans,
   * which differ only in what ends them.
   */
  takeEscape(chunk: i32, at: i32): i32 {
    const decoded = this.scanEscape(at + 1);
    if (this.escapeEnd < 0) {
      this.error("invalid escape sequence", at + 2);
      return -1;
    }
    if (at > chunk) this.literal.add(this.source.substring(chunk, at));
    this.literal.add(decoded);
    return this.escapeEnd;
  }

  /**
   * The decoded text of a literal that ends at `at` with the bytes since
   * `chunk` still to take.
   *
   * A literal with no escape in it — nearly every one — never touched the
   * builder, so it costs exactly one `substring` of the whole span. That is
   * the point of `chunk`: the old shape appended one byte at a time, and
   * `text = text + one byte` copies the whole accumulator on every pass, which
   * is quadratic in time *and* in arena bytes because the arena never
   * reclaims (.claude/selfhost.md, "String building goes through
   * `StringBuilder`"). This loop reads every byte of every file the compiler
   * compiles, so it is the one place in `self/` where that shape cost the most.
   */
  literalText(chunk: i32, at: i32): string {
    if (this.literal.isEmpty()) return this.source.substring(chunk, at);
    if (at > chunk) this.literal.add(this.source.substring(chunk, at));
    return this.literal.toText();
  }

  scanEscape(at: i32): string {
    this.escapeEnd = at + 1;
    const c = this.at(at);
    if (c === CH_N_LOWER) return "\n";
    if (c === CH_T_LOWER) return "\t";
    if (c === CH_R_LOWER) return "\r";
    if (c === CH_0) return String.fromCharCode(0);
    if (c === CH_B_LOWER) return String.fromCharCode(8);
    if (c === CH_F_LOWER) return String.fromCharCode(CH_FF);
    if (c === CH_V_LOWER) return String.fromCharCode(CH_VT);
    if (c === CH_X_LOWER) {
      const value = this.scanHex(at + 1, 2);
      if (value < 0) {
        this.escapeEnd = -1;
        return "";
      }
      this.escapeEnd = at + 3;
      return utf8Encode(value);
    }
    if (c === CH_U_LOWER) {
      if (this.at(at + 1) === CH_LBRACE) {
        let end = at + 2;
        let value = 0;
        while (end < this.source.length && hexValue(this.at(end)) >= 0) {
          value = value * 16 + hexValue(this.at(end));
          end = end + 1;
        }
        if (end === at + 2 || this.at(end) !== CH_RBRACE) {
          this.escapeEnd = -1;
          return "";
        }
        this.escapeEnd = end + 1;
        return utf8Encode(value);
      }
      const value = this.scanHex(at + 1, 4);
      if (value < 0) {
        this.escapeEnd = -1;
        return "";
      }
      this.escapeEnd = at + 5;
      return utf8Encode(value);
    }
    if (c === CH_LF) return ""; // a line continuation contributes nothing
    if (c === CH_EOF) {
      this.escapeEnd = -1;
      return "";
    }
    // `\\`, `\"`, `\'`, `` \` ``, `\$` and anything else: the character itself.
    return this.source.substring(at, at + 1);
  }

  /** The value of exactly `count` hex digits at `at`, or -1. */
  scanHex(at: i32, count: i32): i32 {
    let value = 0;
    let i = 0;
    while (i < count) {
      const digit = hexValue(this.at(at + i));
      if (digit < 0) return -1;
      value = value * 16 + digit;
      i = i + 1;
    }
    return value;
  }

  /**
   * A template part, from `at` (just past the backtick or the `}`) to the
   * closing backtick — `whole` when there is no substitution before it — or to
   * a `${`, which is `opening` and pushes a substitution. `chunk` works as it
   * does in `scanString`, and through the same two helpers.
   */
  scanTemplate(at: i32, whole: i32, opening: i32): void {
    let i = at;
    let chunk = at;
    this.literal.reset();
    while (true) {
      if (i >= this.source.length) {
        this.error("unterminated template literal", i);
        return;
      }
      const c = this.at(i);
      if (c === CH_BACKTICK) {
        this.emit(whole, i + 1, this.literalText(chunk, i));
        return;
      }
      if (c === CH_DOLLAR && this.at(i + 1) === CH_LBRACE) {
        this.braceDepth.push(0);
        this.emit(opening, i + 2, this.literalText(chunk, i));
        return;
      }
      if (c === CH_BACKSLASH) {
        i = this.takeEscape(chunk, i);
        if (i < 0) return;
        chunk = i;
      } else {
        i = i + 1;
      }
    }
  }

  /** `{` and `}` also move the template state; everything else is one token. */
  scanBrace(c: i32): void {
    const open = this.braceDepth.length;
    if (c === CH_LBRACE) {
      if (open > 0) this.braceDepth[open - 1] = this.braceDepth[open - 1] + 1;
      this.emitPlain(TOK_LBRACE, 1);
      return;
    }
    if (open > 0) {
      const depth = this.braceDepth[open - 1];
      if (depth === 0) {
        this.braceDepth.pop();
        this.scanTemplate(this.pos + 1, TOK_TEMPLATE_TAIL, TOK_TEMPLATE_MIDDLE);
        return;
      }
      this.braceDepth[open - 1] = depth - 1;
    }
    this.emitPlain(TOK_RBRACE, 1);
  }

  scanPunctuation(c: i32): void {
    const next1 = this.at(this.pos + 1);
    const next2 = this.at(this.pos + 2);
    const next3 = this.at(this.pos + 3);
    if (c === CH_LBRACE || c === CH_RBRACE) {
      this.scanBrace(c);
      return;
    }
    switch (c) {
      case CH_LPAREN:
        this.emitPlain(TOK_LPAREN, 1);
        return;
      case CH_RPAREN:
        this.emitPlain(TOK_RPAREN, 1);
        return;
      case CH_LBRACKET:
        this.emitPlain(TOK_LBRACKET, 1);
        return;
      case CH_RBRACKET:
        this.emitPlain(TOK_RBRACKET, 1);
        return;
      case CH_COMMA:
        this.emitPlain(TOK_COMMA, 1);
        return;
      case CH_SEMICOLON:
        this.emitPlain(TOK_SEMICOLON, 1);
        return;
      case CH_COLON:
        this.emitPlain(TOK_COLON, 1);
        return;

      case CH_TILDE:
        this.emitPlain(TOK_TILDE, 1);
        return;

      default:
        break;
    }
    if (c === CH_PLUS) {
      if (next1 === CH_PLUS) this.emitPlain(TOK_PLUS_PLUS, 2);
      else if (next1 === CH_ASSIGN) this.emitPlain(TOK_PLUS_ASSIGN, 2);
      else this.emitPlain(TOK_PLUS, 1);
      return;
    }
    if (c === CH_MINUS) {
      if (next1 === CH_MINUS) this.emitPlain(TOK_MINUS_MINUS, 2);
      else if (next1 === CH_ASSIGN) this.emitPlain(TOK_MINUS_ASSIGN, 2);
      else this.emitPlain(TOK_MINUS, 1);
      return;
    }
    if (c === CH_DOT) {
      if (next1 === CH_DOT && next2 === CH_DOT) this.emitPlain(TOK_DOT_DOT_DOT, 3);
      else this.emitPlain(TOK_DOT, 1);
      return;
    }
    if (c === CH_QUESTION) {
      // `?.` only when a digit does not follow: `a ? .5 : b` is a conditional,
      // which is the rule the TypeScript scanner uses too.
      if (next1 === CH_DOT && !isDigit(next2)) this.emitPlain(TOK_QUESTION_DOT, 2);
      else if (next1 === CH_QUESTION && next2 === CH_ASSIGN) this.emitPlain(TOK_QUESTION_QUESTION_ASSIGN, 3);
      else if (next1 === CH_QUESTION) this.emitPlain(TOK_QUESTION_QUESTION, 2);
      else this.emitPlain(TOK_QUESTION, 1);
      return;
    }
    if (c === CH_AT) {
      this.emitPlain(TOK_AT, 1);
      return;
    }
    if (c === CH_HASH) {
      this.scanPrivateName();
      return;
    }
    if (c === CH_STAR) {
      if (next1 === CH_STAR && next2 === CH_ASSIGN) this.emitPlain(TOK_STAR_STAR_ASSIGN, 3);
      else if (next1 === CH_STAR) this.emitPlain(TOK_STAR_STAR, 2);
      else if (next1 === CH_ASSIGN) this.emitPlain(TOK_STAR_ASSIGN, 2);
      else this.emitPlain(TOK_STAR, 1);
      return;
    }
    if (c === CH_SLASH) {
      if (next1 === CH_ASSIGN) this.emitPlain(TOK_SLASH_ASSIGN, 2);
      else this.emitPlain(TOK_SLASH, 1);
      return;
    }
    if (c === CH_PERCENT) {
      if (next1 === CH_ASSIGN) this.emitPlain(TOK_PERCENT_ASSIGN, 2);
      else this.emitPlain(TOK_PERCENT, 1);
      return;
    }
    if (c === CH_ASSIGN) {
      if (next1 === CH_ASSIGN && next2 === CH_ASSIGN) this.emitPlain(TOK_EQ, 3);
      else if (next1 === CH_GT) this.emitPlain(TOK_ARROW, 2);
      else if (next1 === CH_ASSIGN) this.emitPlain(TOK_EQ_LOOSE, 2);
      else this.emitPlain(TOK_ASSIGN, 1);
      return;
    }
    if (c === CH_BANG) {
      if (next1 === CH_ASSIGN && next2 === CH_ASSIGN) this.emitPlain(TOK_NE, 3);
      else if (next1 === CH_ASSIGN) this.emitPlain(TOK_NE_LOOSE, 2);
      else this.emitPlain(TOK_BANG, 1);
      return;
    }
    if (c === CH_LT) {
      if (next1 === CH_LT && next2 === CH_ASSIGN) this.emitPlain(TOK_SHL_ASSIGN, 3);
      else if (next1 === CH_LT) this.emitPlain(TOK_SHL, 2);
      else if (next1 === CH_ASSIGN) this.emitPlain(TOK_LE, 2);
      else this.emitPlain(TOK_LT, 1);
      return;
    }
    if (c === CH_GT) {
      // `>>` and `>>>` are one token: the language has no generic type argument
      // list, so nothing ever needs them split back apart.
      if (next1 === CH_GT && next2 === CH_GT && next3 === CH_ASSIGN) this.emitPlain(TOK_USHR_ASSIGN, 4);
      else if (next1 === CH_GT && next2 === CH_GT) this.emitPlain(TOK_USHR, 3);
      else if (next1 === CH_GT && next2 === CH_ASSIGN) this.emitPlain(TOK_SHR_ASSIGN, 3);
      else if (next1 === CH_GT) this.emitPlain(TOK_SHR, 2);
      else if (next1 === CH_ASSIGN) this.emitPlain(TOK_GE, 2);
      else this.emitPlain(TOK_GT, 1);
      return;
    }
    if (c === CH_AMP) {
      if (next1 === CH_AMP && next2 === CH_ASSIGN) this.emitPlain(TOK_AND_AND_ASSIGN, 3);
      else if (next1 === CH_AMP) this.emitPlain(TOK_AND_AND, 2);
      else if (next1 === CH_ASSIGN) this.emitPlain(TOK_AMP_ASSIGN, 2);
      else this.emitPlain(TOK_AMP, 1);
      return;
    }
    if (c === CH_PIPE) {
      if (next1 === CH_PIPE && next2 === CH_ASSIGN) this.emitPlain(TOK_OR_OR_ASSIGN, 3);
      else if (next1 === CH_PIPE) this.emitPlain(TOK_OR_OR, 2);
      else if (next1 === CH_ASSIGN) this.emitPlain(TOK_PIPE_ASSIGN, 2);
      else this.emitPlain(TOK_PIPE, 1);
      return;
    }
    if (c === CH_CARET) {
      if (next1 === CH_ASSIGN) this.emitPlain(TOK_CARET_ASSIGN, 2);
      else this.emitPlain(TOK_CARET, 1);
      return;
    }
    this.error(`unexpected character \`${this.source.substring(this.pos, this.pos + 1)}\``, this.pos + 1);
  }
}

/** The 1-based line and column of a byte offset, counted in bytes. */
export function lineOf(source: string, offset: i32): i32 {
  let line = 1;
  let i = 0;
  while (i < offset && i < source.length) {
    if (source.charCodeAt(i) === CH_LF) line = line + 1;
    i = i + 1;
  }
  return line;
}

export function columnOf(source: string, offset: i32): i32 {
  let start = 0;
  let i = 0;
  while (i < offset && i < source.length) {
    if (source.charCodeAt(i) === CH_LF) start = i + 1;
    i = i + 1;
  }
  return offset - start + 1;
}
