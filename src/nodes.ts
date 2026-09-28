// The syntax tree of the subset (docs/wp14-selfhost.md §2.1, milestone S2).
//
// **One `Node` class**, with a `kind` discriminant and the union of the fields
// any node needs. The language has no inheritance at all since WP25, and a
// downcast would mean a runtime tag check, a `T | null` result and a new rule
// in the checker for a cast that can fail; a bootstrap compiler needs none of
// that. Field access is unchecked by the type system and guarded by `kind`
// instead, exactly as `switch (node.kind)` already reads. It costs memory
// nobody here is counting and it removes downcasting from the critical path.
//
// The **child layout is the contract** between the parser and everything
// downstream, so it is written next to each kind below and nowhere else. Two
// conventions keep it small:
//
//   - Every kind has a **fixed arity**, except the *list-shaped* kinds
//     (`N_LIST`, `N_SOURCE_FILE`, `N_BLOCK`, `N_TEMPLATE`, `N_ARRAY`,
//     `N_OBJECT`), whose children are their elements. A variable-length group
//     inside a fixed-arity node is therefore always one `N_LIST` child.
//   - An absent optional child is `N_EMPTY`, never a missing slot, so
//     `children[2]` means the same thing in every node of a kind.

export const N_ERROR: i32 = 0 // a parse that failed; `text` is the message
export const N_EMPTY: i32 = 1 // an optional child that is not there
export const N_LIST: i32 = 2 // children: the elements

// ---- Declarations ------------------------------------------------------------------

export const N_SOURCE_FILE: i32 = 3 // children: the top-level declarations
export const N_IMPORT: i32 = 4 // text: the specifier; children: LIST of IMPORT_SPEC
export const N_IMPORT_SPEC: i32 = 5 // text: local name; children: exported name IDENT
export const N_FUNCTION: i32 = 6 // children: name, LIST of PARAM, return type, BLOCK, LIST of type parameters (WP18)
export const N_PARAM: i32 = 7 // children: name, type
export const N_CLASS: i32 = 8 // children: name, extends, LIST of implements, LIST of members, LIST of type parameters (WP18 G5)
export const N_INTERFACE: i32 = 9 // children: name, LIST of FIELD, LIST of type parameters (WP18 G5)
export const N_FIELD: i32 = 10 // children: name, type, initializer
export const N_METHOD: i32 = 11 // children: name, LIST of PARAM, return type, BLOCK, and a LIST of type parameters only when it has one (WP18 G8)
export const N_CONSTRUCTOR: i32 = 12 // children: LIST of PARAM, BLOCK
export const N_MODULE_CONST: i32 = 13 // children: LIST of VAR_DECL

// ---- Statements --------------------------------------------------------------------

export const N_BLOCK: i32 = 14 // children: the statements
export const N_VAR: i32 = 15 // children: LIST of VAR_DECL
export const N_VAR_DECL: i32 = 16 // children: name, type, initializer
export const N_EXPR_STMT: i32 = 17 // children: the expression
export const N_IF: i32 = 18 // children: condition, then, else
export const N_WHILE: i32 = 19 // children: condition, body
export const N_DO: i32 = 20 // children: body, condition
export const N_FOR: i32 = 21 // children: initializer, condition, incrementor, body
// `for (const x of a)`. The head is the `VAR` it declares, or — only in the
// refused `for (x of a)` — the expression it assigns, which the checker tells
// apart by the child's kind (NL2135). `for...in` and `for await` are this node
// with FLAG_FOR_IN and FLAG_AWAIT.
export const N_FOR_OF: i32 = 22 // children: VAR or the refused expression, iterable, body
export const N_BREAK: i32 = 23 // text: the label, only in a refused labelled statement
export const N_CONTINUE: i32 = 24 // text: the label, only in a refused labelled statement
export const N_RETURN: i32 = 25 // children: the expression
export const N_THROW: i32 = 26 // children: the expression
export const N_SWITCH: i32 = 27 // children: discriminant, LIST of CASE / DEFAULT
export const N_CASE: i32 = 28 // children: label, BLOCK of the clause's statements
export const N_DEFAULT: i32 = 29 // children: BLOCK of the clause's statements

// ---- Expressions -------------------------------------------------------------------

export const N_IDENT: i32 = 30 // text: the name; as a type parameter, its one child is the constraint (WP18 G6)
export const N_NUMBER: i32 = 31 // text: the literal as written
export const N_BIGINT: i32 = 32 // text: the literal as written, `n` and all
export const N_STRING: i32 = 33 // text: the decoded bytes
export const N_TRUE: i32 = 34
export const N_FALSE: i32 = 35
export const N_NULL: i32 = 36
export const N_THIS: i32 = 37
export const N_TEMPLATE: i32 = 38 // children: TEMPLATE_TEXT and expressions, alternating
export const N_TEMPLATE_TEXT: i32 = 39 // text: the decoded bytes of one span
export const N_ARRAY: i32 = 40 // children: the elements
export const N_OBJECT: i32 = 41 // children: the PROPERTYs
export const N_PROPERTY: i32 = 42 // text: the key; children: the value
export const N_BINARY: i32 = 43 // text: the operator; children: left, right
export const N_UNARY: i32 = 44 // text: the operator; flags: PREFIX or POSTFIX; children: operand
export const N_CONDITIONAL: i32 = 45 // children: condition, whenTrue, whenFalse
export const N_CALL: i32 = 46 // children: callee, LIST of arguments
export const N_NEW: i32 = 47 // children: callee, LIST of type arguments, LIST of arguments
export const N_MEMBER: i32 = 48 // text: the property; children: the receiver
export const N_INDEX: i32 = 49 // children: receiver, index
export const N_PAREN: i32 = 50 // children: the expression

// ---- Types -------------------------------------------------------------------------

export const N_TYPE_REF: i32 = 51 // text: the name; children: LIST of type arguments
export const N_TYPE_ARRAY: i32 = 52 // children: the element type
export const N_TYPE_UNION: i32 = 53 // children: the members
export const N_TYPE_NULL: i32 = 54 // the `null` of `T | null`
export const N_SUPER: i32 = 55 // `super`, as `super(...)` or `super.m(...)`
export const N_TYPE_PAREN: i32 = 56 // children: the type inside the parentheses
export const N_TYPE_READONLY: i32 = 57 // `readonly T[]`; children: the type the modifier applies to
// A declaration rather than a type, but numbered here because the numbers are
// appended and never moved: forty constants and a `nodeName` switch read the
// same either way, and renumbering them would churn every one of them.
export const N_TYPE_ALIAS: i32 = 58 // `type X = T;`; children: name, the aliased type
// `enum X { A = 1 }` (WP23); children: name, LIST of ENUM_MEMBER.
export const N_ENUM: i32 = 59
// One member; children: name, initializer (N_EMPTY when it is auto-numbered).
export const N_ENUM_MEMBER: i32 = 60
// `(x: T, y: U) => R` as a type (WP29, wp23 §6): children: LIST of PARAM, the
// return type. Legal only as the annotation of a parameter of a top-level
// function, where it makes that function a template over its callee; the
// checker refuses it everywhere else by name.
export const N_TYPE_FUNCTION: i32 = 61
// An arrow written in an expression, `(x) => x * 2` or `x => x * 2` (WP29,
// wp23 §6). Shaped exactly like N_FUNCTION so a signature collector and every
// body walker read it by the same positions: children: name (always EMPTY),
// LIST of PARAM (whose type is EMPTY when it was omitted), return type (EMPTY
// when omitted), BLOCK or the concise body's expression, LIST of type
// parameters (always empty). Legal only as the argument for a function-typed
// parameter; it is never a value.
export const N_ARROW: i32 = 62
// A numeric literal written as a type, `255` or `-128` (WP31,
// docs/wp31-ranged-integers.md §4): text: the literal as written, with the
// sign when there is one. Parsed wherever a type is parsed, and legal only as
// a bound of `integer<Lo, Hi>`, which the checker says everywhere else.
export const N_TYPE_LITERAL: i32 = 63

// ---- Refused statements (WP33 R1) ----------------------------------------------------
//
// Three statements the language forbids and nothing else resembles. They are
// parsed so that Phase 0 can refuse each by its rule (`src/validator.ts`),
// and no phase after Phase 0 ever sees one: a module Phase 0 refuses is not
// checked. The convention every refused construct follows is at the foot of
// this list, beside the flags.

// `try { } catch (e) { } finally { }` (NL1033): children: the BLOCK, the catch
// binding (IDENT, or EMPTY for `catch { }` and for no `catch`), the catch
// BLOCK or EMPTY, the finally BLOCK or EMPTY.
export const N_TRY: i32 = 64
// `with (o) body` (NL1038): children: the object, the body.
export const N_WITH: i32 = 65
// `outer: body` (NL1046): text: the label; children: the statement it labels.
export const N_LABELED: i32 = 66

/** @public One past the last node kind: the size of a table indexed by kind. */
export const N_COUNT: i32 = 67

// `flags` on N_UNARY: which side the operator was written on.
export const FLAG_PREFIX: i32 = 0
export const FLAG_POSTFIX: i32 = 1

// `flags` on N_FUNCTION, N_CLASS, N_INTERFACE, N_MODULE_CONST, N_TYPE_ALIAS,
// N_ENUM: bit 0 is
// `export`. A bitfield rather than a field per modifier, because the checker
// asks about them one at a time and the parser sets them in one place.
export const FLAG_EXPORTED: i32 = 1
// `flags` on N_VAR and N_MODULE_CONST: bit 1 is `const` rather than `let`.
export const FLAG_CONST: i32 = 2
// `flags` on N_FIELD: bit 2 is `readonly`. `public`, `private` and `protected`
// are accepted and ignored (docs/LANGUAGE.md, Classes), so they are parsed and
// then not recorded — there is nothing downstream that could ask.
export const FLAG_READONLY: i32 = 4
// `flags` on N_FUNCTION: bit 3 is `declare` — a C function this program calls
// but does not define (WP27 S1). The body child is the empty node, because a
// foreign declaration has no body and the child positions are fixed.
export const FLAG_FOREIGN: i32 = 8
// `flags` on N_FIELD, N_METHOD and N_CONSTRUCTOR: bits 4, 5 and 6 record three
// member headers the language refuses — `x?: T`, `x!: T` and `static`. They are
// *parsed* and flagged rather than turned down where they are written, which is
// the exception to the habit in `.claude/selfhost.md` ("refuse in the phase that
// owns the rule") and is the point: the rule belongs to the checker, because
// only the checker knows whether this is a field or a method and which class
// it is in, and stage0's sentence names all three. Refusing them in the parser
// is what put these cases in `tests/wordings/parser_refusals.txt`
// (docs/wp19-stage0-retirement.md R3).
export const FLAG_OPTIONAL: i32 = 16
export const FLAG_DEFINITE: i32 = 32
export const FLAG_STATIC: i32 = 64
// Bit 7 is the one piece of *order* the checker needs: set when `static` was
// written before `readonly`, and meaningless unless both are present. stage0
// walks a member's modifier list in source order and reports the first one that
// member cannot carry, and a method can carry neither — so `static readonly m()`
// is stage0's `static` sentence and `readonly static m()` its `readonly` one,
// from the same two bits. A field carries `readonly` legitimately, so only a
// method and a constructor read this.
export const FLAG_STATIC_FIRST: i32 = 128
// `flags` on N_VAR: bit 8 is `using` (WP29 P2), set together with `FLAG_CONST`
// because a `using` binding cannot be reassigned either. The declaration is
// the same node as a `let` or a `const`, so nothing that walks declarations
// needs a new kind to find it.
export const FLAG_USING: i32 = 256

// **Parse, then refuse (WP33 R1).** A construct the language forbids is
// *parsed*, and refused by the phase that owns its rule — Phase 0 for an NL1xxx
// code, the checker for an NL2xxx one — never by the parser, which could only
// say what token it expected. Its shape in this tree is decided once:
//
//   - When it resembles a node that exists, it is that node with a flag: the
//     tree a later phase walks stays one it knows, and the refusal is a test
//     of one bit. `var` is a `let` (FLAG_VAR), `for...in` and `for await` are
//     a `for...of` (FLAG_FOR_IN, FLAG_AWAIT), a top-level `let` is a module
//     constant without FLAG_CONST, and the member headers above are fields
//     and methods.
//   - When it resembles nothing, it is a kind of its own, with its child
//     layout written beside it like every other kind's: N_TRY, N_WITH,
//     N_LABELED.
//   - A variant that differs only in what one child is keeps the node and
//     puts the other thing in that child, when the child's own kind is the
//     tell: `for (x of a)` is a FOR_OF whose head is an expression rather
//     than a VAR, and a top-level statement is the statement itself, sitting
//     in the SOURCE_FILE where a declaration would.
//
// Every one is refused with exactly one diagnostic, and the refusal comes
// before anything else looks at the node, so no later rule has to know the
// shape exists. `src/ast-text.ts` prints each flag, so `--emit-ast` and
// `tests/parser-oracle.js` compare them.

// `flags` on N_VAR and N_MODULE_CONST: bit 9 is `var` rather than `let`
// (NL1036).
export const FLAG_VAR: i32 = 512
// `flags` on N_FOR_OF: bit 10 is `for await` (NL2133) and bit 11 `in` rather
// than `of` (NL1056).
export const FLAG_AWAIT: i32 = 1024
export const FLAG_FOR_IN: i32 = 2048

/**
 * One node of the tree. Every field is meaningful for some kinds and ignored
 * by the rest; which is which is the comment beside each kind above.
 */
export class Node {
  kind: i32
  /**
   * Dense index into the side tables the checker fills (`src/program.ts`),
   * assigned by the parser as it builds the tree. stage0's `src/` keys those tables by
   * `WeakMap<ts.Node, ...>`; the language has no `WeakMap` and this is the faster
   * shape anyway — an array index rather than a hash of a pointer — and it
   * keeps the rule that the checker records and the emitter reads, with the
   * AST itself holding nothing but syntax. -1 until a parser assigns one.
   */
  id: i32
  /** Byte offsets into the source, the first inclusive and the second not. */
  start: i32
  end: i32
  /** A name, an operator, a literal's text or an error's message; else empty. */
  text: string
  /** The bitfield above, or 0. */
  flags: i32
  children: Node[]

  constructor(kind: i32, start: i32, end: i32) {
    this.kind = kind
    this.id = -1
    this.start = start
    this.end = end
    this.text = ""
    this.flags = 0
    this.children = []
  }
}

export const nodeName = (kind: i32): string => {
  switch (kind) {
    case N_ERROR:
      return "ERROR"
    case N_EMPTY:
      return "EMPTY"
    case N_LIST:
      return "LIST"
    case N_SOURCE_FILE:
      return "SOURCE_FILE"
    case N_IMPORT:
      return "IMPORT"
    case N_IMPORT_SPEC:
      return "IMPORT_SPEC"
    case N_FUNCTION:
      return "FUNCTION"
    case N_PARAM:
      return "PARAM"
    case N_CLASS:
      return "CLASS"
    case N_INTERFACE:
      return "INTERFACE"
    case N_FIELD:
      return "FIELD"
    case N_METHOD:
      return "METHOD"
    case N_CONSTRUCTOR:
      return "CONSTRUCTOR"
    case N_MODULE_CONST:
      return "MODULE_CONST"
    case N_BLOCK:
      return "BLOCK"
    case N_VAR:
      return "VAR"
    case N_VAR_DECL:
      return "VAR_DECL"
    case N_EXPR_STMT:
      return "EXPR_STMT"
    case N_IF:
      return "IF"
    case N_WHILE:
      return "WHILE"
    case N_DO:
      return "DO"
    case N_FOR:
      return "FOR"
    case N_FOR_OF:
      return "FOR_OF"
    case N_BREAK:
      return "BREAK"
    case N_CONTINUE:
      return "CONTINUE"
    case N_RETURN:
      return "RETURN"
    case N_THROW:
      return "THROW"
    case N_SWITCH:
      return "SWITCH"
    case N_CASE:
      return "CASE"
    case N_DEFAULT:
      return "DEFAULT"
    case N_IDENT:
      return "IDENT"
    case N_NUMBER:
      return "NUMBER"
    case N_BIGINT:
      return "BIGINT"
    case N_STRING:
      return "STRING"
    case N_TRUE:
      return "TRUE"
    case N_FALSE:
      return "FALSE"
    case N_NULL:
      return "NULL"
    case N_THIS:
      return "THIS"
    case N_TEMPLATE:
      return "TEMPLATE"
    case N_TEMPLATE_TEXT:
      return "TEMPLATE_TEXT"
    case N_ARRAY:
      return "ARRAY"
    case N_OBJECT:
      return "OBJECT"
    case N_PROPERTY:
      return "PROPERTY"
    case N_BINARY:
      return "BINARY"
    case N_UNARY:
      return "UNARY"
    case N_CONDITIONAL:
      return "CONDITIONAL"
    case N_CALL:
      return "CALL"
    case N_NEW:
      return "NEW"
    case N_MEMBER:
      return "MEMBER"
    case N_INDEX:
      return "INDEX"
    case N_PAREN:
      return "PAREN"
    case N_TYPE_REF:
      return "TYPE_REF"
    case N_TYPE_ARRAY:
      return "TYPE_ARRAY"
    case N_TYPE_UNION:
      return "TYPE_UNION"
    case N_TYPE_NULL:
      return "TYPE_NULL"
    case N_SUPER:
      return "SUPER"
    case N_TYPE_PAREN:
      return "TYPE_PAREN"
    case N_TYPE_READONLY:
      return "TYPE_READONLY"
    case N_TYPE_ALIAS:
      return "TYPE_ALIAS"
    case N_ENUM:
      return "ENUM"
    case N_ENUM_MEMBER:
      return "ENUM_MEMBER"
    case N_TYPE_FUNCTION:
      return "TYPE_FUNCTION"
    case N_ARROW:
      return "ARROW"
    case N_TYPE_LITERAL:
      return "TYPE_LITERAL"
    case N_TRY:
      return "TRY"
    case N_WITH:
      return "WITH"
    case N_LABELED:
      return "LABELED"
    default:
      return "?"
  }
}
