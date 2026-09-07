// The token kinds of StaticTS-0, the subset the self-hosted compiler is
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
export const TOK_TEMPLATE: i32 = 5;

// Keywords, contiguous so `isKeyword` is one range check.
export const TOK_KEYWORD_FIRST: i32 = 6;
export const TOK_FUNCTION: i32 = 6;
export const TOK_RETURN: i32 = 7;
export const TOK_IF: i32 = 8;
export const TOK_ELSE: i32 = 9;
export const TOK_WHILE: i32 = 10;
export const TOK_DO: i32 = 11;
export const TOK_FOR: i32 = 12;
export const TOK_BREAK: i32 = 13;
export const TOK_CONTINUE: i32 = 14;
export const TOK_LET: i32 = 15;
export const TOK_CONST: i32 = 16;
export const TOK_CLASS: i32 = 17;
export const TOK_INTERFACE: i32 = 18;
export const TOK_NEW: i32 = 19;
export const TOK_THIS: i32 = 20;
export const TOK_IMPORT: i32 = 21;
export const TOK_FROM: i32 = 22;
export const TOK_EXPORT: i32 = 23;
export const TOK_TRUE: i32 = 24;
export const TOK_FALSE: i32 = 25;
export const TOK_NULL: i32 = 26;
export const TOK_THROW: i32 = 27;
export const TOK_SWITCH: i32 = 28;
export const TOK_CASE: i32 = 29;
export const TOK_DEFAULT: i32 = 30;
export const TOK_IMPLEMENTS: i32 = 31;
export const TOK_EXTENDS: i32 = 32;
export const TOK_KEYWORD_LAST: i32 = 32;

// Punctuation and operators.
export const TOK_LPAREN: i32 = 33;
export const TOK_RPAREN: i32 = 34;
export const TOK_LBRACE: i32 = 35;
export const TOK_RBRACE: i32 = 36;
export const TOK_LBRACKET: i32 = 37;
export const TOK_RBRACKET: i32 = 38;
export const TOK_COMMA: i32 = 39;
export const TOK_SEMICOLON: i32 = 40;
export const TOK_COLON: i32 = 41;
export const TOK_DOT: i32 = 42;
export const TOK_QUESTION: i32 = 43;
export const TOK_ARROW: i32 = 44;

export const TOK_PLUS: i32 = 45;
export const TOK_MINUS: i32 = 46;
export const TOK_STAR: i32 = 47;
export const TOK_SLASH: i32 = 48;
export const TOK_PERCENT: i32 = 49;
export const TOK_ASSIGN: i32 = 50;
export const TOK_PLUS_ASSIGN: i32 = 51;
export const TOK_MINUS_ASSIGN: i32 = 52;
export const TOK_STAR_ASSIGN: i32 = 53;
export const TOK_SLASH_ASSIGN: i32 = 54;
export const TOK_PERCENT_ASSIGN: i32 = 55;
export const TOK_PLUS_PLUS: i32 = 56;
export const TOK_MINUS_MINUS: i32 = 57;
export const TOK_EQ: i32 = 58;
export const TOK_NE: i32 = 59;
export const TOK_LT: i32 = 60;
export const TOK_LE: i32 = 61;
export const TOK_GT: i32 = 62;
export const TOK_GE: i32 = 63;
export const TOK_AND_AND: i32 = 64;
export const TOK_OR_OR: i32 = 65;
export const TOK_BANG: i32 = 66;
export const TOK_AMP: i32 = 67;
export const TOK_PIPE: i32 = 68;
export const TOK_CARET: i32 = 69;
export const TOK_TILDE: i32 = 70;
export const TOK_SHL: i32 = 71;
export const TOK_SHR: i32 = 72;
export const TOK_USHR: i32 = 73;

export const TOK_COUNT: i32 = 74;

export function isKeyword(kind: i32): boolean {
  return kind >= TOK_KEYWORD_FIRST && kind <= TOK_KEYWORD_LAST;
}
