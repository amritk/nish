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
// `import { a, b as c } from "./m"`. The refused forms (WP33 R1) are this node
// too: its one child is the braces' LIST, the IDENT `ns` of `* as ns`
// (NL2119), or EMPTY where there are neither — a side-effect import (NL2033)
// or a default import alone (NL2190) — and a default import is a second child,
// there only when written. `import type` is FLAG_TYPE_ONLY (NL2243), `import
// defer` FLAG_DEFER (NL1059), a specifier that is not a string literal
// FLAG_COMPUTED with an empty text (NL2212), attributes after it,
// `with { ... }`, FLAG_ATTRIBUTES (NL1057), and `export import` FLAG_EXPORTED
// (NL2226).
export const N_IMPORT: i32 = 4 // text: the specifier; children: LIST of IMPORT_SPEC, and see above
// text: the name after `as`, or the only one; children: the name before it,
// an IDENT, or a STRING for a module export name written as one (NL1058).
// In an import that is the local name and the exported one; in an
// N_EXPORT_DECLARATION the exported name and the local one. `{ type a }` is
// FLAG_TYPE_ONLY (NL2243).
export const N_IMPORT_SPEC: i32 = 5
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
export const N_TYPE_ALIAS: i32 = 58 // `type X = T;`; children: name, the aliased type, and a LIST of type parameters only when it has one (refused, NL1054)
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

// ---- Refused expressions (WP33 R1) ---------------------------------------------------
//
// The expressions that resemble nothing above. Every other forbidden
// expression is a node that exists: `==`, `!=`, `in`, `instanceof`, `**`,
// `**=` and the comma operator are an N_BINARY whose text is the operator,
// `typeof`, `void`, `delete`, `await` and `yield` an N_UNARY whose text is
// the word, `?.` an N_MEMBER, N_INDEX or N_CALL with FLAG_OPTIONAL, a dynamic
// `import(...)` an N_CALL whose callee is the IDENT `import` (a keyword, so
// no program can declare it), `import.meta` an N_MEMBER whose text is `meta`
// and whose receiver is that IDENT (NL1060; any other name after the dot
// stays a syntax error), a hole in an array literal an EMPTY element,
// and `new` of something other than a name an N_NEW whose callee is that
// expression.

// `/x/g` (NL1050): text: the literal as written, flags and all.
export const N_REGEX: i32 = 67
// `x as T`, `<T>x` (FLAG_ANGLE) and `x satisfies T` (FLAG_SATISFIES): Phase 0
// refuses the assertion to `any` or `unknown` (NL1051, NL1052), and pass 1
// every other one (NL2256). children: the expression, the type.
export const N_AS: i32 = 68
// `...a` in an array literal (NL2237): children: the expression spread.
export const N_SPREAD: i32 = 69

// ---- Refused declarations (WP33 R1) --------------------------------------------------
//
// The declarations that resemble nothing above. `async` and `function*` are a
// function, method or arrow with FLAG_ASYNC or FLAG_GENERATOR, type parameters
// on an alias are the alias with a third child, and a default type argument is
// the type parameter with FLAG_DEFAULT.

// `@dec` (NL1006), in front of a class, a member, a parameter or another
// decorator: children: the decorator's expression, the thing it decorates.
// Phase 0 refuses it before anything else reads the tree, so no later phase
// finds one where it expects the declaration inside.
export const N_DECORATOR: i32 = 70
// `namespace N { }`, `module M { }` (NL1027) and `declare global { }`
// (NL1019): text: the keyword, `namespace`, `module` or `global`; flags:
// FLAG_FOREIGN when it was `declare`d; children: the name (an IDENT, a dotted
// MEMBER, or the STRING of `module "m"`), and the body: a BLOCK spanning the
// braces whose contents are passed over unread — Phase 0 refuses the block
// whatever it holds, and a declared one holds ambient declarations this
// grammar does not have — or EMPTY for the body-less `declare module "m";`.
export const N_NAMESPACE: i32 = 71
// `keyof T` (NL2038), a type operator the language does not have: text: the
// operator; children: the type it applies to. The checker's annotation
// resolver has no case for it, which is the rule.
export const N_TYPE_OPERATOR: i32 = 72

// ---- Refused bindings (WP33 R1) ------------------------------------------------------
//
// The function and binding forms. Most are a node that exists: a default,
// optional or rest parameter is an N_PARAM with FLAG_DEFAULT, FLAG_OPTIONAL
// or FLAG_REST, a getter or setter an N_METHOD with FLAG_ACCESSOR, a method
// in an interface an N_METHOD among its fields, and `export default function
// ()` an N_FUNCTION with FLAG_DEFAULT whose name is EMPTY. A missing return
// type is an EMPTY return type and a missing body an EMPTY body, as a
// `declare function`'s is. A top-level `let` bound to an arrow is the module
// constant whose initialiser is the N_ARROW, and the names after the first in
// `const f = (): i32 => 1, g = 2` a sixth child of the N_FUNCTION, a LIST of
// VAR_DECL there only when written.

// `{ a, b }` or `[a, b]` where a name is bound — a VAR_DECL's or a PARAM's
// first child (NL2191, NL2192, NL2193): no children; the pattern between the
// brackets is passed over unread, as a namespace body is, because every
// declaration that holds one is refused whatever it binds.
export const N_BINDING_PATTERN: i32 = 73

// ---- Refused class, interface and enum forms (WP33 R1) -------------------------------
//
// The class, interface and enum forms. All but one are a node that exists:
// `abstract` is FLAG_ABSTRACT on the class or the member, `declare class`,
// `declare interface` and `declare enum` FLAG_FOREIGN on theirs, and a
// parameter property (`constructor(public x: i32)`) FLAG_PROPERTY on its
// PARAM. An anonymous class — `export default class { }` (FLAG_DEFAULT), or a
// class expression, which is an N_CLASS where an operand stands — has an
// EMPTY name. A method or constructor without a body has an EMPTY body, a
// constructor's return type is a third child of the N_CONSTRUCTOR, there only
// when written, and a member named by a string or a number has that N_STRING
// or N_NUMBER where its IDENT would be. A `static { }` block is the N_BLOCK
// among the members, and an interface's call signature `(x: i32): T` an
// N_METHOD among its fields whose name is EMPTY — a construct signature
// `new (): T` the same with FLAG_CONSTRUCT. `interface I extends A, B` has a
// fourth child, a LIST of the TYPE_REFs it names, there only when written. In
// an object literal a key written as a string or a number is a second child
// of the N_PROPERTY, there only when written, and a method `{ m() { } }`
// (an accessor, FLAG_ACCESSOR) is the N_METHOD that is the property's value.

// `[key: string]: T` in a class or an interface (NL2213, NL2214): flags: the
// member's modifiers; children: the key's PARAM, the value's type.
export const N_INDEX_SIGNATURE: i32 = 74

// ---- Refused import and export forms (WP33 R1) ----------------------------------------
//
// The module forms. Most are an N_IMPORT (see beside it) or a declaration
// with a flag: `export default function f` an N_FUNCTION and `export default
// class C` / `export default interface I` an N_CLASS or N_INTERFACE with
// FLAG_DEFAULT (NL2130, NL2131). A `function` or an `import` written where a
// statement stands is the N_FUNCTION, N_IMPORT or N_IMPORT_EQUALS it would be
// at the top level (NL2260). The rest resemble nothing, and each is refused by
// pass 1 whatever it holds.

// `export default <value>` and `export = <value>` (NL2129): text: `default` or
// `=`; children: the expression.
export const N_EXPORT_ASSIGNMENT: i32 = 75
// `export { a, b as c }`, `export { a } from "./m"`, `export * from "./m"` and
// `export * as ns from "./m"` (NL2128): text: the specifier, empty without a
// `from`; flags: FLAG_TYPE_ONLY for `export type`, FLAG_COMPUTED for a
// specifier that is not a string literal; children: the braces' LIST
// of IMPORT_SPEC, the name after `* as` (an IDENT or a STRING), or EMPTY for a
// bare `*`. Attributes after the specifier are passed over unread.
export const N_EXPORT_DECLARATION: i32 = 76
// `import x = require("./m")` and `import x = A.B` (NL2230; NL2226 with
// FLAG_EXPORTED): flags: FLAG_TYPE_ONLY for `import type x = ...`; children:
// the name, and what it names — the STRING (or the expression) inside
// `require(...)`, or the IDENT or dotted MEMBER of an entity name.
export const N_IMPORT_EQUALS: i32 = 77
// `export as namespace X` (NL2230): children: the name.
export const N_NAMESPACE_EXPORT: i32 = 78

/** @public One past the last node kind: the size of a table indexed by kind. */
export const N_COUNT: i32 = 79

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
export const FLAG_OPTIONAL: i32 = 16 // and `?.` on N_MEMBER, N_INDEX and N_CALL (NL1049)
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
//     constant without FLAG_CONST, the member headers above are fields
//     and methods, `?.` is a member, element or call (FLAG_OPTIONAL), `async`
//     and `function*` a function, method or arrow (FLAG_ASYNC,
//     FLAG_GENERATOR), and a default type argument its type parameter
//     (FLAG_DEFAULT); a default, optional or rest parameter is its PARAM
//     (FLAG_DEFAULT, FLAG_OPTIONAL, FLAG_REST) and a getter or setter a
//     method (FLAG_ACCESSOR); `abstract` is its class or member
//     (FLAG_ABSTRACT), `declare class`, `declare interface` and `declare enum`
//     theirs (FLAG_FOREIGN), and a parameter property its PARAM
//     (FLAG_PROPERTY). An operator is the N_BINARY or N_UNARY whose text it
//     is.
//   - When it resembles nothing, it is a kind of its own, with its child
//     layout written beside it like every other kind's: N_TRY, N_WITH,
//     N_LABELED, N_REGEX, N_AS, N_SPREAD, N_DECORATOR, N_NAMESPACE,
//     N_TYPE_OPERATOR, N_BINDING_PATTERN, N_INDEX_SIGNATURE,
//     N_EXPORT_ASSIGNMENT, N_EXPORT_DECLARATION, N_IMPORT_EQUALS and
//     N_NAMESPACE_EXPORT.
//   - A variant that differs only in what one child is keeps the node and
//     puts the other thing in that child, when the child's own kind is the
//     tell: `for (x of a)` is a FOR_OF whose head is an expression rather
//     than a VAR, a top-level statement is the statement itself, sitting
//     in the SOURCE_FILE where a declaration would, type parameters on an
//     alias are an N_TYPE_ALIAS's third child, there only when written, a
//     missing name, return type or body is an EMPTY child, a method in an
//     interface an N_METHOD among its fields, a `let` bound to an arrow
//     a module constant whose initialiser is the N_ARROW, the class,
//     interface and enum forms listed beside N_INDEX_SIGNATURE, and the
//     import forms listed beside N_IMPORT.
//
// Every one is refused with exactly one diagnostic, and the refusal comes
// before anything else looks at the node, so no later rule has to know the
// shape exists. A checker rule that needs no type is a sweep over the whole
// module in pass 1 (`refuseUnsupportedForms`), not a rule in the body check: pass 2
// checks a template's body once per instantiation, so a template nothing
// instantiates is never checked, and a refusal stated there would let it
// compile (`tests/cases/reject_for_await_template`). `src/ast-text.ts` prints each flag, so `--emit-ast` and
// `tests/parser-oracle.js` compare them.

// `flags` on N_VAR and N_MODULE_CONST: bit 9 is `var` rather than `let`
// (NL1036).
export const FLAG_VAR: i32 = 512
// `flags` on N_FOR_OF: bit 10 is `for await` (NL2133) and bit 11 `in` rather
// than `of` (NL1056).
export const FLAG_AWAIT: i32 = 1024
export const FLAG_FOR_IN: i32 = 2048
// `flags` on N_AS: bit 12 is the `<T>x` spelling and bit 13 `satisfies`
// rather than `as`, each the TypeScript construct NL2256 names.
export const FLAG_ANGLE: i32 = 4096
export const FLAG_SATISFIES: i32 = 8192
// `flags` on N_FUNCTION, N_METHOD and N_ARROW: bit 14 is `async` (NL1015) and
// bit 15 the `*` of a generator (NL1044). `async` is a member modifier, so a
// field or a constructor that writes it carries the bit too.
export const FLAG_ASYNC: i32 = 16384
export const FLAG_GENERATOR: i32 = 32768
// `flags` on a type parameter's IDENT: bit 16 is a default, `<T = i32>`
// (NL2292). The default type is read and dropped, as a `catch` binding's
// annotation is: the declaration is refused whatever it names.
export const FLAG_DEFAULT: i32 = 65536 // and on N_PARAM, `x = 1` (NL2233); on N_FUNCTION, N_CLASS and N_INTERFACE, `export default` (NL2203, NL2018, NL2130, NL2131)
// `flags` on N_PARAM: bit 17 is `...xs` (NL2235). `x?: T` is FLAG_OPTIONAL and
// a default FLAG_DEFAULT, whose value is read and dropped.
export const FLAG_REST: i32 = 131072
// `flags` on N_METHOD: bit 18 is `get` or `set` in front of its name (NL2209).
export const FLAG_ACCESSOR: i32 = 262144
// `flags` on N_CLASS, N_FIELD, N_METHOD and N_CONSTRUCTOR: bit 19 is
// `abstract` (NL2168). A member's `static abstract` leaves it off: `static` is
// written first, and it is the refusal (`Parser.parseMemberModifiers`).
export const FLAG_ABSTRACT: i32 = 524288
// `flags` on N_PARAM: bit 20 is an accessibility or `readonly` modifier in
// front of it, a parameter property (NL2234).
export const FLAG_PROPERTY: i32 = 1048576
// `flags` on an interface's N_METHOD with an EMPTY name: bit 21 is `new`, a
// construct signature rather than a call signature (NL2257).
export const FLAG_CONSTRUCT: i32 = 2097152
// `flags` on N_IMPORT, N_IMPORT_SPEC, N_IMPORT_EQUALS and N_EXPORT_DECLARATION:
// bit 22 is `type` in front of what it imports or exports (NL2243).
export const FLAG_TYPE_ONLY: i32 = 4194304
// `flags` on N_IMPORT: bit 23 is a specifier that is not a string literal,
// read as the expression it is and dropped (NL2212; on an
// N_EXPORT_DECLARATION too, which is refused whatever it holds); bit 24 import
// attributes after the specifier, `with { ... }` or `assert { ... }`,
// passed over unread (NL1057); and bit 25 `import defer` (NL1059).
export const FLAG_COMPUTED: i32 = 8388608
export const FLAG_ATTRIBUTES: i32 = 16777216
export const FLAG_DEFER: i32 = 33554432

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
    case N_REGEX:
      return "REGEX"
    case N_AS:
      return "AS"
    case N_SPREAD:
      return "SPREAD"
    case N_DECORATOR:
      return "DECORATOR"
    case N_NAMESPACE:
      return "NAMESPACE"
    case N_TYPE_OPERATOR:
      return "TYPE_OPERATOR"
    case N_BINDING_PATTERN:
      return "BINDING_PATTERN"
    case N_INDEX_SIGNATURE:
      return "INDEX_SIGNATURE"
    case N_EXPORT_ASSIGNMENT:
      return "EXPORT_ASSIGNMENT"
    case N_EXPORT_DECLARATION:
      return "EXPORT_DECLARATION"
    case N_IMPORT_EQUALS:
      return "IMPORT_EQUALS"
    case N_NAMESPACE_EXPORT:
      return "NAMESPACE_EXPORT"
    default:
      return "?"
  }
}
