// The token kinds of the subset the self-hosted compiler is
// written in (docs/wp14-selfhost.md §2). They live here as module constants so
// that the lexer, the parser and the diagnostics all name the same numbers;
// the language has no `enum`, and a magic number repeated at forty use sites
// is how a bootstrap compiler starts to rot.
//
// The values are contiguous from 0, which lets a later dispatch switch on them
// densely, and grouped so that a range check answers "is this a keyword?"
// without a table.

export const TOK_END: i32 = 0;
export const TOK_ERROR: i32 = 1;

// Literals and names.
export const TOK_IDENT: i32 = 2;
export const TOK_NUMBER: i32 = 3;
export const TOK_STRING: i32 = 4;

// Template literals, split the way the grammar reads them: a template with no
// substitution is one token, and one with substitutions is head, then the
// tokens of each expression, then a middle or the tail.
//
//   `a`            TEMPLATE
//   `a${x}b${y}c`  TEMPLATE_HEAD x TEMPLATE_MIDDLE y TEMPLATE_TAIL
export const TOK_TEMPLATE: i32 = 5;
export const TOK_TEMPLATE_HEAD: i32 = 6;
export const TOK_TEMPLATE_MIDDLE: i32 = 7;
export const TOK_TEMPLATE_TAIL: i32 = 8;

// Keywords, contiguous so `isKeyword` is one range check.
export const TOK_KEYWORD_FIRST: i32 = 9;
export const TOK_FUNCTION: i32 = 9;
export const TOK_RETURN: i32 = 10;
export const TOK_IF: i32 = 11;
export const TOK_ELSE: i32 = 12;
export const TOK_WHILE: i32 = 13;
export const TOK_DO: i32 = 14;
export const TOK_FOR: i32 = 15;
export const TOK_BREAK: i32 = 16;
export const TOK_CONTINUE: i32 = 17;
export const TOK_LET: i32 = 18;
export const TOK_CONST: i32 = 19;
export const TOK_CLASS: i32 = 20;
export const TOK_INTERFACE: i32 = 21;
export const TOK_NEW: i32 = 22;
export const TOK_THIS: i32 = 23;
export const TOK_IMPORT: i32 = 24;
// 25 and 36 are not used: `from` and `of` are *contextual* keywords, words
// that are only special where the grammar is already expecting them
// (`import ... from`, `for (const x of ...)`) and are ordinary identifiers
// everywhere else — `tests/cases/cls_nested.ts` has a field called `from`.
// The parser matches them by text at the two places that want them, and the
// numbering keeps the holes rather than renumbering forty constants to close
// them.
export const TOK_EXPORT: i32 = 26;
export const TOK_TRUE: i32 = 27;
export const TOK_FALSE: i32 = 28;
export const TOK_NULL: i32 = 29;
export const TOK_THROW: i32 = 30;
export const TOK_SWITCH: i32 = 31;
export const TOK_CASE: i32 = 32;
export const TOK_DEFAULT: i32 = 33;
export const TOK_IMPLEMENTS: i32 = 34;
export const TOK_EXTENDS: i32 = 35;
export const TOK_SUPER: i32 = 37;
export const TOK_KEYWORD_LAST: i32 = 37;

// Punctuation and operators.
export const TOK_LPAREN: i32 = 38;
export const TOK_RPAREN: i32 = 39;
export const TOK_LBRACE: i32 = 40;
export const TOK_RBRACE: i32 = 41;
export const TOK_LBRACKET: i32 = 42;
export const TOK_RBRACKET: i32 = 43;
export const TOK_COMMA: i32 = 44;
export const TOK_SEMICOLON: i32 = 45;
export const TOK_COLON: i32 = 46;
export const TOK_DOT: i32 = 47;
export const TOK_QUESTION: i32 = 48;
export const TOK_ARROW: i32 = 49;

export const TOK_PLUS: i32 = 50;
export const TOK_MINUS: i32 = 51;
export const TOK_STAR: i32 = 52;
export const TOK_SLASH: i32 = 53;
export const TOK_PERCENT: i32 = 54;
export const TOK_ASSIGN: i32 = 55;
export const TOK_PLUS_ASSIGN: i32 = 56;
export const TOK_MINUS_ASSIGN: i32 = 57;
export const TOK_STAR_ASSIGN: i32 = 58;
export const TOK_SLASH_ASSIGN: i32 = 59;
export const TOK_PERCENT_ASSIGN: i32 = 60;
export const TOK_PLUS_PLUS: i32 = 61;
export const TOK_MINUS_MINUS: i32 = 62;
export const TOK_EQ: i32 = 63;
export const TOK_NE: i32 = 64;
export const TOK_LT: i32 = 65;
export const TOK_LE: i32 = 66;
export const TOK_GT: i32 = 67;
export const TOK_GE: i32 = 68;
export const TOK_AND_AND: i32 = 69;
export const TOK_OR_OR: i32 = 70;
export const TOK_BANG: i32 = 71;
export const TOK_AMP: i32 = 72;
export const TOK_PIPE: i32 = 73;
export const TOK_CARET: i32 = 74;
export const TOK_TILDE: i32 = 75;
export const TOK_SHL: i32 = 76;
export const TOK_SHR: i32 = 77;
export const TOK_USHR: i32 = 78;
export const TOK_AMP_ASSIGN: i32 = 79;
export const TOK_PIPE_ASSIGN: i32 = 80;
export const TOK_CARET_ASSIGN: i32 = 81;
export const TOK_SHL_ASSIGN: i32 = 82;
export const TOK_SHR_ASSIGN: i32 = 83;
export const TOK_USHR_ASSIGN: i32 = 84;

// Tokens the subset has no use for, lexed anyway. The lexer's job is to say
// what is written, not what is allowed: `a ?? b` is one `??`, which the parser
// builds as an operator and the checker refuses by name wherever its left
// operand is not a `Map.get` result (WP32), instead of the parser complaining
// about a stray `?`. It is also what lets the lexer be diffed
// against the `typescript` scanner token for token (tests/lexer_oracle.js).
export const TOK_EQ_LOOSE: i32 = 85; // ==
export const TOK_NE_LOOSE: i32 = 86; // !=
export const TOK_STAR_STAR: i32 = 87; // **
export const TOK_STAR_STAR_ASSIGN: i32 = 88; // **=
export const TOK_QUESTION_DOT: i32 = 89; // ?.
export const TOK_QUESTION_QUESTION: i32 = 90; // ??
export const TOK_QUESTION_QUESTION_ASSIGN: i32 = 91; // ??=
export const TOK_AND_AND_ASSIGN: i32 = 92; // &&=
export const TOK_OR_OR_ASSIGN: i32 = 93; // ||=
export const TOK_DOT_DOT_DOT: i32 = 94; // ...
export const TOK_AT: i32 = 95; // @, a decorator
export const TOK_PRIVATE_IDENT: i32 = 96; // #name
export const TOK_BIGINT: i32 = 97; // 1n

export const TOK_COUNT: i32 = 98;

export const isKeyword = (kind: i32): boolean => kind >= TOK_KEYWORD_FIRST && kind <= TOK_KEYWORD_LAST;

// The name of each kind, for the token dump and for diagnostics. A `switch` on
// a dense range is a jump table, which is why the kinds are numbered the way
// they are; a `string[]` indexed by kind would cost a heap array and a load.
export const tokenName = (kind: i32): string => {
  switch (kind) {
    case TOK_END:
      return "END";
    case TOK_ERROR:
      return "ERROR";
    case TOK_IDENT:
      return "IDENT";
    case TOK_NUMBER:
      return "NUMBER";
    case TOK_STRING:
      return "STRING";
    case TOK_TEMPLATE:
      return "TEMPLATE";
    case TOK_TEMPLATE_HEAD:
      return "TEMPLATE_HEAD";
    case TOK_TEMPLATE_MIDDLE:
      return "TEMPLATE_MIDDLE";
    case TOK_TEMPLATE_TAIL:
      return "TEMPLATE_TAIL";
    case TOK_FUNCTION:
      return "function";
    case TOK_RETURN:
      return "return";
    case TOK_IF:
      return "if";
    case TOK_ELSE:
      return "else";
    case TOK_WHILE:
      return "while";
    case TOK_DO:
      return "do";
    case TOK_FOR:
      return "for";
    case TOK_BREAK:
      return "break";
    case TOK_CONTINUE:
      return "continue";
    case TOK_LET:
      return "let";
    case TOK_CONST:
      return "const";
    case TOK_CLASS:
      return "class";
    case TOK_INTERFACE:
      return "interface";
    case TOK_NEW:
      return "new";
    case TOK_THIS:
      return "this";
    case TOK_IMPORT:
      return "import";
    case TOK_EXPORT:
      return "export";
    case TOK_TRUE:
      return "true";
    case TOK_FALSE:
      return "false";
    case TOK_NULL:
      return "null";
    case TOK_THROW:
      return "throw";
    case TOK_SWITCH:
      return "switch";
    case TOK_CASE:
      return "case";
    case TOK_DEFAULT:
      return "default";
    case TOK_IMPLEMENTS:
      return "implements";
    case TOK_EXTENDS:
      return "extends";
    case TOK_SUPER:
      return "super";
    case TOK_LPAREN:
      return "(";
    case TOK_RPAREN:
      return ")";
    case TOK_LBRACE:
      return "{";
    case TOK_RBRACE:
      return "}";
    case TOK_LBRACKET:
      return "[";
    case TOK_RBRACKET:
      return "]";
    case TOK_COMMA:
      return ",";
    case TOK_SEMICOLON:
      return ";";
    case TOK_COLON:
      return ":";
    case TOK_DOT:
      return ".";
    case TOK_QUESTION:
      return "?";
    case TOK_ARROW:
      return "=>";
    case TOK_PLUS:
      return "+";
    case TOK_MINUS:
      return "-";
    case TOK_STAR:
      return "*";
    case TOK_SLASH:
      return "/";
    case TOK_PERCENT:
      return "%";
    case TOK_ASSIGN:
      return "=";
    case TOK_PLUS_ASSIGN:
      return "+=";
    case TOK_MINUS_ASSIGN:
      return "-=";
    case TOK_STAR_ASSIGN:
      return "*=";
    case TOK_SLASH_ASSIGN:
      return "/=";
    case TOK_PERCENT_ASSIGN:
      return "%=";
    case TOK_PLUS_PLUS:
      return "++";
    case TOK_MINUS_MINUS:
      return "--";
    case TOK_EQ:
      return "===";
    case TOK_NE:
      return "!==";
    case TOK_LT:
      return "<";
    case TOK_LE:
      return "<=";
    case TOK_GT:
      return ">";
    case TOK_GE:
      return ">=";
    case TOK_AND_AND:
      return "&&";
    case TOK_OR_OR:
      return "||";
    case TOK_BANG:
      return "!";
    case TOK_AMP:
      return "&";
    case TOK_PIPE:
      return "|";
    case TOK_CARET:
      return "^";
    case TOK_TILDE:
      return "~";
    case TOK_SHL:
      return "<<";
    case TOK_SHR:
      return ">>";
    case TOK_USHR:
      return ">>>";
    case TOK_AMP_ASSIGN:
      return "&=";
    case TOK_PIPE_ASSIGN:
      return "|=";
    case TOK_CARET_ASSIGN:
      return "^=";
    case TOK_SHL_ASSIGN:
      return "<<=";
    case TOK_SHR_ASSIGN:
      return ">>=";
    case TOK_USHR_ASSIGN:
      return ">>>=";
    case TOK_EQ_LOOSE:
      return "==";
    case TOK_NE_LOOSE:
      return "!=";
    case TOK_STAR_STAR:
      return "**";
    case TOK_STAR_STAR_ASSIGN:
      return "**=";
    case TOK_QUESTION_DOT:
      return "?.";
    case TOK_QUESTION_QUESTION:
      return "??";
    case TOK_QUESTION_QUESTION_ASSIGN:
      return "??=";
    case TOK_AND_AND_ASSIGN:
      return "&&=";
    case TOK_OR_OR_ASSIGN:
      return "||=";
    case TOK_DOT_DOT_DOT:
      return "...";
    case TOK_AT:
      return "@";
    case TOK_PRIVATE_IDENT:
      return "PRIVATE_IDENT";
    case TOK_BIGINT:
      return "BIGINT";
    default:
      return "?";
  }
};
