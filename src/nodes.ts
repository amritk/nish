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
//     (`NodeKind.List`, `NodeKind.SourceFile`, `NodeKind.Block`, `NodeKind.Template`, `NodeKind.Array`,
//     `NodeKind.Object`), whose children are their elements. A variable-length group
//     inside a fixed-arity node is therefore always one `NodeKind.List` child.
//   - An absent optional child is `NodeKind.Empty`, never a missing slot, so
//     `children[2]` means the same thing in every node of a kind.

export enum NodeKind {
  Error = 0, // a parse that failed; `text` is the message
  Empty = 1, // an optional child that is not there
  List = 2, // children: the elements

  // ---- Declarations ------------------------------------------------------------------

  SourceFile = 3, // children: the top-level declarations
  // `import { a, b as c } from "./m"`. The refused forms (WP33 R1) are this node
  // too: its one child is the braces' LIST, the IDENT `ns` of `* as ns`
  // (NL2119), or EMPTY where there are neither — a side-effect import (NL2033)
  // or a default import alone (NL2190) — and a default import is a second child,
  // there only when written. `import type` is FLAG_TYPE_ONLY (NL2243), `import
  // defer` FLAG_DEFER (NL1059), a specifier that is not a string literal
  // FLAG_COMPUTED with an empty text (NL2212), attributes after it,
  // `with { ... }`, FLAG_ATTRIBUTES (NL1057), and `export import` FLAG_EXPORTED
  // (NL2226).
  Import = 4, // text: the specifier; children: LIST of IMPORT_SPEC, and see above
  // text: the name after `as`, or the only one; children: the name before it,
  // an IDENT, or a STRING for a module export name written as one (NL1058).
  // In an import that is the local name and the exported one; in an
  // NodeKind.ExportDeclaration the exported name and the local one. `{ type a }` is
  // FLAG_TYPE_ONLY (NL2243).
  ImportSpec = 5,
  FunctionDecl = 6, // not `Function`, a name Phase 0 forbids; children: name, LIST of PARAM, return type, BLOCK, LIST of type parameters (WP18)
  Param = 7, // children: name, type
  Class = 8, // children: name, extends, LIST of implements, LIST of members, LIST of type parameters (WP18 G5)
  Interface = 9, // children: name, LIST of FIELD, LIST of type parameters (WP18 G5)
  Field = 10, // children: name, type, initializer
  Method = 11, // children: name, LIST of PARAM, return type, BLOCK, and a LIST of type parameters only when it has one (WP18 G8)
  Constructor = 12, // children: LIST of PARAM, BLOCK
  ModuleConst = 13, // children: LIST of VAR_DECL

  // ---- Statements --------------------------------------------------------------------

  Block = 14, // children: the statements
  Var = 15, // children: LIST of VAR_DECL
  VarDecl = 16, // children: name, type, initializer
  ExprStmt = 17, // children: the expression
  If = 18, // children: condition, then, else
  While = 19, // children: condition, body
  Do = 20, // children: body, condition
  For = 21, // children: initializer, condition, incrementor, body
  // `for (const x of a)`. The head is the `VAR` it declares, or — only in the
  // refused `for (x of a)` — the expression it assigns, which the checker tells
  // apart by the child's kind (NL2135). `for...in` and `for await` are this node
  // with FLAG_FOR_IN and FLAG_AWAIT.
  ForOf = 22, // children: VAR or the refused expression, iterable, body
  Break = 23, // text: the label it names, or empty
  Continue = 24, // text: the label it names, or empty
  Return = 25, // children: the expression
  Throw = 26, // children: the expression
  Switch = 27, // children: discriminant, LIST of CASE / DEFAULT
  Case = 28, // children: label, BLOCK of the clause's statements
  Default = 29, // children: BLOCK of the clause's statements

  // ---- Expressions -------------------------------------------------------------------

  Ident = 30, // text: the name; as a type parameter, its one child is the constraint (WP18 G6)
  Number = 31, // text: the literal as written
  Bigint = 32, // text: the literal as written, `n` and all
  String = 33, // text: the decoded bytes
  True = 34,
  False = 35,
  Null = 36,
  This = 37,
  Template = 38, // children: TEMPLATE_TEXT and expressions, alternating
  TemplateText = 39, // text: the decoded bytes of one span
  Array = 40, // children: the elements
  Object = 41, // children: the PROPERTYs, and a NodeKind.Spread for each `...a`
  Property = 42, // text: the key; children: the value
  Binary = 43, // text: the operator; children: left, right
  Unary = 44, // text: the operator; flags: PREFIX or POSTFIX; children: operand
  Conditional = 45, // children: condition, whenTrue, whenFalse
  Call = 46, // children: callee, LIST of arguments
  New = 47, // children: callee, LIST of type arguments, LIST of arguments
  Member = 48, // text: the property; children: the receiver
  Index = 49, // children: receiver, index
  Paren = 50, // children: the expression

  // ---- Types -------------------------------------------------------------------------

  TypeRef = 51, // text: the name; children: LIST of type arguments
  TypeArray = 52, // children: the element type
  TypeUnion = 53, // children: the members
  TypeNull = 54, // the `null` of `T | null`
  Super = 55, // `super`, as `super(...)` or `super.m(...)`
  TypeParen = 56, // children: the type inside the parentheses
  TypeReadonly = 57, // `readonly T[]`; children: the type the modifier applies to
  // A declaration rather than a type, but numbered here because the numbers are
  // appended and never moved: the member values and a `nodeName` switch read the
  // same either way, and renumbering them would churn every one of them.
  TypeAlias = 58, // `type X = T;`; children: name, the aliased type, and a LIST of type parameters only when it has one (refused, NL1054)
  // `enum X { A = 1 }` (WP23); children: name, LIST of ENUM_MEMBER.
  Enum = 59,
  // One member; children: name, initializer (NodeKind.Empty when it is auto-numbered).
  EnumMember = 60,
  // `(x: T, y: U) => R` as a type (WP29, wp23 §6): children: LIST of PARAM, the
  // return type. Legal only as the annotation of a parameter of a top-level
  // function, where it makes that function a template over its callee; the
  // checker refuses it everywhere else by name.
  TypeFunction = 61,
  // An arrow written in an expression, `(x) => x * 2` or `x => x * 2` (WP29,
  // wp23 §6). Shaped exactly like NodeKind.FunctionDecl so a signature collector and every
  // body walker read it by the same positions: children: name (always EMPTY),
  // LIST of PARAM (whose type is EMPTY when it was omitted), return type (EMPTY
  // when omitted), BLOCK or the concise body's expression, LIST of type
  // parameters (always empty). Legal only as the argument for a function-typed
  // parameter; it is never a value.
  Arrow = 62,
  // A numeric literal written as a type, `255` or `-128` (WP31,
  // docs/wp31-ranged-integers.md §4): text: the literal as written, with the
  // sign when there is one. Parsed wherever a type is parsed, and legal only as
  // a bound of `integer<Lo, Hi>`, which the checker says everywhere else.
  TypeLiteral = 63,

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
  Try = 64,
  // `with (o) body` (NL1038): children: the object, the body.
  With = 65,
  // `outer: body`: text: the label; children: the loop, block or `switch` it labels
  // (on anything else, NL1046).
  Labeled = 66,

  // ---- Refused expressions (WP33 R1) ---------------------------------------------------
  //
  // The expressions that resemble nothing above. Every other forbidden
  // expression is a node that exists: `==`, `!=`, `in`, `instanceof`, `**`,
  // `**=` and the comma operator are a NodeKind.Binary whose text is the operator,
  // `typeof`, `void`, `delete`, `await` and `yield` a NodeKind.Unary whose text is
  // the word, `?.` a NodeKind.Member, NodeKind.Index or NodeKind.Call with FLAG_OPTIONAL, a dynamic
  // `import(...)` a NodeKind.Call whose callee is the IDENT `import` (a keyword, so
  // no program can declare it), `import.meta` a NodeKind.Member whose text is `meta`
  // and whose receiver is that IDENT (NL1060; any other name after the dot
  // stays a syntax error), a hole in an array literal an EMPTY element,
  // and `new` of something other than a name a NodeKind.New whose callee is that
  // expression.

  // `/x/g` (NL1050): text: the literal as written, flags and all.
  Regex = 67,
  // `x as T`, `<T>x` (FLAG_ANGLE) and `x satisfies T` (FLAG_SATISFIES): Phase 0
  // refuses the assertion to `any` or `unknown` (NL1051, NL1052), and pass 1
  // every other one (NL2256). children: the expression, the type.
  As = 68,
  // `...a` in an array literal (NL2237), or among an object literal's
  // properties (`checkObjectLiteral`): children: the expression spread.
  Spread = 69,

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
  Decorator = 70,
  // `namespace N { }`, `module M { }` (NL1027) and `declare global { }`
  // (NL1019): text: the keyword, `namespace`, `module` or `global`; flags:
  // FLAG_FOREIGN when it was `declare`d; children: the name (an IDENT, a dotted
  // MEMBER, or the STRING of `module "m"`), and the body: a BLOCK spanning the
  // braces whose contents are passed over unread — Phase 0 refuses the block
  // whatever it holds, and a declared one holds ambient declarations this
  // grammar does not have — or EMPTY for the body-less `declare module "m";`.
  Namespace = 71,
  // `keyof T` (NL2038), a type operator the language does not have: text: the
  // operator; children: the type it applies to. The checker's annotation
  // resolver has no case for it, which is the rule.
  TypeOperator = 72,

  // ---- Refused bindings (WP33 R1) ------------------------------------------------------
  //
  // The function and binding forms. Most are a node that exists: a default,
  // optional or rest parameter is a NodeKind.Param with FLAG_DEFAULT, FLAG_OPTIONAL
  // or FLAG_REST, a getter or setter a NodeKind.Method with FLAG_ACCESSOR, a method
  // in an interface a NodeKind.Method among its fields, and `export default function
  // ()` a NodeKind.FunctionDecl with FLAG_DEFAULT whose name is EMPTY. A missing return
  // type is an EMPTY return type and a missing body an EMPTY body, as a
  // `declare function`'s is. A top-level `let` bound to an arrow is the module
  // constant whose initialiser is the NodeKind.Arrow, and the names after the first in
  // `const f = (): i32 => 1, g = 2` a sixth child of the NodeKind.FunctionDecl, a LIST of
  // VAR_DECL there only when written.

  // `{ a, b: c }` or `[a, , b]` where a name is bound — a VAR_DECL's or a
  // PARAM's first child; text `{` or `[`. An array pattern's children are its
  // slots: an IDENT, a nested BINDING_PATTERN, or EMPTY for a hole. An object
  // pattern's are a NodeKind.Property per entry, its text the key and its
  // child the IDENT or pattern it binds (FLAG_COMPUTED for a key that is not
  // a plain name). `...r` is FLAG_REST and `a = 1` FLAG_DEFAULT on the slot,
  // kept so the checker can refuse each by name. A local `const`/`let` and a
  // `for...of` head take a flat one (`Parser.lowerPattern`); a parameter's,
  // a module constant's and a `catch` binding's are refused (NL2192, NL2191).
  BindingPattern = 73,

  // ---- Refused class, interface and enum forms (WP33 R1) -------------------------------
  //
  // The class, interface and enum forms. All but one are a node that exists:
  // `abstract` is FLAG_ABSTRACT on the class or the member, `declare class`,
  // `declare interface` and `declare enum` FLAG_FOREIGN on theirs, and a
  // parameter property (`constructor(public x: i32)`) FLAG_PROPERTY on its
  // PARAM. An anonymous class — `export default class { }` (FLAG_DEFAULT), or a
  // class expression, which is a NodeKind.Class where an operand stands — has an
  // EMPTY name. A method or constructor without a body has an EMPTY body, a
  // constructor's return type is a third child of the NodeKind.Constructor, there only
  // when written, and a member named by a string or a number has that NodeKind.String
  // or NodeKind.Number where its IDENT would be. A `static { }` block is the NodeKind.Block
  // among the members, and an interface's call signature `(x: i32): T` an
  // NodeKind.Method among its fields whose name is EMPTY — a construct signature
  // `new (): T` the same with FLAG_CONSTRUCT. `interface I extends A, B` has a
  // fourth child, a LIST of the TYPE_REFs it names, there only when written. In
  // an object literal a key written as a string or a number is a second child
  // of the NodeKind.Property, there only when written, and a method `{ m() { } }`
  // (an accessor, FLAG_ACCESSOR) is the NodeKind.Method that is the property's value.
  // A computed name, `[k]` (NL1041), is the expression between the brackets
  // where the name would be — a NodeKind.Field's or NodeKind.Method's first child, in a
  // class, an interface or an object literal, and a NodeKind.Property's second — and
  // the member carries FLAG_COMPUTED, because the expression's own kind is no
  // tell: `[k]` is an IDENT and `["a"]` a STRING. `[Symbol.dispose]()` is not
  // one: it is the method name WP29 reads (`Parser.parseDisposeMethod`).

  // `[key: string]: T` in a class or an interface (NL2213, NL2214): flags: the
  // member's modifiers; children: the key's PARAM, the value's type.
  IndexSignature = 74,

  // ---- Refused import and export forms (WP33 R1) ----------------------------------------
  //
  // The module forms. Most are a NodeKind.Import (see beside it) or a declaration
  // with a flag: `export default function f` a NodeKind.FunctionDecl and `export default
  // class C` / `export default interface I` a NodeKind.Class or NodeKind.Interface with
  // FLAG_DEFAULT (NL2130, NL2131). A `function` or an `import` written where a
  // statement stands is the NodeKind.FunctionDecl, NodeKind.Import or NodeKind.ImportEquals it would be
  // at the top level (NL2260). The rest resemble nothing, and each is refused by
  // pass 1 whatever it holds.

  // `export default <value>` and `export = <value>` (NL2129): text: `default` or
  // `=`; children: the expression.
  ExportAssignment = 75,
  // `export { a, b as c }`, `export { a } from "./m"`, `export * from "./m"` and
  // `export * as ns from "./m"` (NL2128): text: the specifier, empty without a
  // `from`; flags: FLAG_TYPE_ONLY for `export type`, FLAG_COMPUTED for a
  // specifier that is not a string literal; children: the braces' LIST
  // of IMPORT_SPEC, the name after `* as` (an IDENT or a STRING), or EMPTY for a
  // bare `*`. Attributes after the specifier are passed over unread.
  ExportDeclaration = 76,
  // `import x = require("./m")` and `import x = A.B` (NL2230; NL2226 with
  // FLAG_EXPORTED): flags: FLAG_TYPE_ONLY for `import type x = ...`; children:
  // the name, and what it names — the STRING (or the expression) inside
  // `require(...)`, or the IDENT or dotted MEMBER of an entity name.
  ImportEquals = 77,
  // `export as namespace X` (NL2230): children: the name.
  NamespaceExport = 78,
}

// `flags` on NodeKind.Unary: which side the operator was written on.
export const FLAG_PREFIX: i32 = 0
export const FLAG_POSTFIX: i32 = 1

// `flags` on NodeKind.FunctionDecl, NodeKind.Class, NodeKind.Interface, NodeKind.ModuleConst, NodeKind.TypeAlias,
// NodeKind.Enum: bit 0 is
// `export`. A bitfield rather than a field per modifier, because the checker
// asks about them one at a time and the parser sets them in one place.
export const FLAG_EXPORTED: i32 = 1
// `flags` on NodeKind.Var and NodeKind.ModuleConst: bit 1 is `const` rather than `let`.
export const FLAG_CONST: i32 = 2
// `flags` on NodeKind.Field: bit 2 is `readonly`. `public`, `private` and `protected`
// are accepted and ignored (docs/LANGUAGE.md, Classes), so they are parsed and
// then not recorded — there is nothing downstream that could ask.
export const FLAG_READONLY: i32 = 4
// `flags` on NodeKind.FunctionDecl: bit 3 is `declare` — a C function this program calls
// but does not define (WP27 S1). The body child is the empty node, because a
// foreign declaration has no body and the child positions are fixed.
export const FLAG_FOREIGN: i32 = 8
// `flags` on NodeKind.Field, NodeKind.Method and NodeKind.Constructor: bits 4, 5 and 6 record three
// member headers the language refuses — `x?: T`, `x!: T` and `static`. They are
// *parsed* and flagged rather than turned down where they are written, which is
// the exception to the habit in `.claude/selfhost.md` ("refuse in the phase that
// owns the rule") and is the point: the rule belongs to the checker, because
// only the checker knows whether this is a field or a method and which class
// it is in, and stage0's sentence names all three. Refusing them in the parser
// is what put these cases in `tests/wordings/parser_refusals.txt`
// (docs/wp19-stage0-retirement.md R3).
export const FLAG_OPTIONAL: i32 = 16 // and `?.` on NodeKind.Member, NodeKind.Index and NodeKind.Call (NL1049)
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
// `flags` on NodeKind.Var: bit 8 is `using` (WP29 P2), set together with `FLAG_CONST`
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
//     theirs (FLAG_FOREIGN), a parameter property its PARAM
//     (FLAG_PROPERTY), and a computed name `[k]` its field, method or
//     property (FLAG_COMPUTED). An operator is the NodeKind.Binary or NodeKind.Unary whose
//     text it is.
//   - When it resembles nothing, it is a kind of its own, with its child
//     layout written beside it like every other kind's: NodeKind.Try, NodeKind.With,
//     NodeKind.Labeled, NodeKind.Regex, NodeKind.As, NodeKind.Spread, NodeKind.Decorator, NodeKind.Namespace,
//     NodeKind.TypeOperator, NodeKind.BindingPattern, NodeKind.IndexSignature,
//     NodeKind.ExportAssignment, NodeKind.ExportDeclaration, NodeKind.ImportEquals and
//     NodeKind.NamespaceExport.
//   - A variant that differs only in what one child is keeps the node and
//     puts the other thing in that child, when the child's own kind is the
//     tell: `for (x of a)` is a FOR_OF whose head is an expression rather
//     than a VAR, a top-level statement is the statement itself, sitting
//     in the SOURCE_FILE where a declaration would, type parameters on an
//     alias are a NodeKind.TypeAlias's third child, there only when written, a
//     missing name, return type or body is an EMPTY child, a method in an
//     interface a NodeKind.Method among its fields, a `let` bound to an arrow
//     a module constant whose initialiser is the NodeKind.Arrow, the class,
//     interface and enum forms listed beside NodeKind.IndexSignature, and the
//     import forms listed beside NodeKind.Import.
//
// Every one is refused with exactly one diagnostic, and the refusal comes
// before anything else looks at the node, so no later rule has to know the
// shape exists. A checker rule that needs no type is a sweep over the whole
// module in pass 1 (`refuseUnsupportedForms`), not a rule in the body check: pass 2
// checks a template's body once per instantiation, so a template nothing
// instantiates is never checked, and a refusal stated there would let it
// compile (`tests/cases/reject_for_await_template`). `src/ast-text.ts` prints each flag, so `--emit-ast` and
// `tests/parser-oracle.js` compare them.

// `flags` on NodeKind.Var and NodeKind.ModuleConst: bit 9 is `var` rather than `let`
// (NL1036).
export const FLAG_VAR: i32 = 512
// `flags` on NodeKind.ForOf: bit 10 is `for await` (NL2133) and bit 11 `in` rather
// than `of` (NL1056).
export const FLAG_AWAIT: i32 = 1024
export const FLAG_FOR_IN: i32 = 2048
// `flags` on NodeKind.As: bit 12 is the `<T>x` spelling and bit 13 `satisfies`
// rather than `as`, each the TypeScript construct NL2256 names.
export const FLAG_ANGLE: i32 = 4096
export const FLAG_SATISFIES: i32 = 8192
// `flags` on NodeKind.FunctionDecl, NodeKind.Method and NodeKind.Arrow: bit 14 is `async` (WP49) and
// bit 15 the `*` of a generator (NL1044). `async` is a member modifier, so a
// field or a constructor that writes it carries the bit too.
export const FLAG_ASYNC: i32 = 16384
export const FLAG_GENERATOR: i32 = 32768
// `flags` on a type parameter's IDENT: bit 16 is a default, `<T = i32>`
// (NL2292). The default type is read and dropped, as a `catch` binding's
// annotation is: the declaration is refused whatever it names.
export const FLAG_DEFAULT: i32 = 65536 // and on NodeKind.Param, `x = 1` (NL2233); on NodeKind.FunctionDecl, NodeKind.Class and NodeKind.Interface, `export default` (NL2203, NL2018, NL2130, NL2131)
// `flags` on NodeKind.Param: bit 17 is `...xs` (NL2235). `x?: T` is FLAG_OPTIONAL and
// a default FLAG_DEFAULT, whose value is read and dropped.
export const FLAG_REST: i32 = 131072
// `flags` on NodeKind.Method: bit 18 is `get` or `set` in front of its name (NL2209).
export const FLAG_ACCESSOR: i32 = 262144
// `flags` on NodeKind.Class, NodeKind.Field, NodeKind.Method and NodeKind.Constructor: bit 19 is
// `abstract` (NL2168). A member's `static abstract` leaves it off: `static` is
// written first, and it is the refusal (`Parser.parseMemberModifiers`).
export const FLAG_ABSTRACT: i32 = 524288
// `flags` on NodeKind.Param: bit 20 is an accessibility or `readonly` modifier in
// front of it, a parameter property (NL2234).
export const FLAG_PROPERTY: i32 = 1048576
// `flags` on an interface's NodeKind.Method with an EMPTY name: bit 21 is `new`, a
// construct signature rather than a call signature (NL2257).
export const FLAG_CONSTRUCT: i32 = 2097152
// `flags` on NodeKind.Import, NodeKind.ImportSpec, NodeKind.ImportEquals and NodeKind.ExportDeclaration:
// bit 22 is `type` in front of what it imports or exports (NL2243).
export const FLAG_TYPE_ONLY: i32 = 4194304
// `flags` on NodeKind.Import: bit 23 is a specifier that is not a string literal,
// read as the expression it is and dropped (NL2212; on an
// NodeKind.ExportDeclaration too, which is refused whatever it holds), and on
// NodeKind.Field, NodeKind.Method and NodeKind.Property a computed name, `[k]` (NL1041); bit 24 import
// attributes after the specifier, `with { ... }` or `assert { ... }`,
// passed over unread (NL1057); and bit 25 `import defer` (NL1059).
export const FLAG_COMPUTED: i32 = 8388608
export const FLAG_ATTRIBUTES: i32 = 16777216
export const FLAG_DEFER: i32 = 33554432

// `flags` on NodeKind.Param: bit 26 marks a parameter of a declaration whose
// signature may give a parameter a default or end in a rest parameter — a
// function, a function bound to a top-level `const`, a method that is not an
// accessor, and a constructor. Anywhere else (an arrow expression, a function
// type, an interface or object-literal method, a `declare function`) both
// stay refused.
export const FLAG_SIGNATURE: i32 = 67108864
// `flags` on NodeKind.Array: bit 26 marks the array literal the checker gathers a
// rest parameter's arguments into (`gatherRest` in `src/declarations.ts`).
// It has no brackets in the source, so a printer writes its elements where
// the call wrote them.
export const FLAG_GATHERED: i32 = 67108864

/** The array literal a rest parameter's arguments were gathered into (`FLAG_GATHERED`). */
export const isGatheredRest = (node: Node): boolean =>
  node.kind === NodeKind.Array && (node.flags & FLAG_GATHERED) !== 0
// NodeKind.Spread: a call's argument, `f(...xs)`, which the checker refuses with
// its own message rather than the array literal's.
export const FLAG_SPREAD_ARGUMENT: i32 = 67108864
// NodeKind.Arrow: bit 26 marks the arrow the checker writes for a function reference
// passed for a function-typed parameter (WP51 stage 2, `referenceArgument` in
// `src/generics.ts`). It reads the reference where the call wrote it, so the
// value it captures at the call is the one passed, whether a `let` or `this`
// holds it.
export const FLAG_REFERENCE_ARROW: i32 = 67108864
// NodeKind.FunctionDecl: bit 27 marks the `main` `src/script.ts` builds around an entry
// module's top-level code. Nobody wrote it, so the TypeScript the program is
// written back out as (`src/emit-ts-edits.ts`) moves the statements rather
// than the function, and the checker's rules about that code read it here.
export const FLAG_SCRIPT: i32 = 134217728
// NodeKind.Spread: bit 28 marks one of an object literal's entries, `{ ...s }`,
// which the checker lowers to field copies (`checkObjectLiteral`) rather than
// refusing as the array literal's spread.
export const FLAG_OBJECT_SPREAD: i32 = 268435456
// NodeKind.VarDecl: bit 29 marks a declarator `Parser.lowerPattern` wrote for
// one name of a destructuring pattern, `x = p.x`, which the source spells
// only inside the pattern; on a NodeKind.Var, the declaration it moved such
// names into at the top of a `for...of` body. The TypeScript written back
// out (`src/emit-ts-edits.ts`) spells neither.
export const FLAG_PATTERN_NAME: i32 = 536870912

/**
 * One node of the tree. Every field is meaningful for some kinds and ignored
 * by the rest; which is which is the comment beside each kind above.
 */
export class Node {
  kind: NodeKind
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

  constructor(kind: NodeKind, start: i32, end: i32) {
    this.kind = kind
    this.id = -1
    this.start = start
    this.end = end
    this.text = ""
    this.flags = 0
    this.children = []
  }
}

export const nodeName = (kind: NodeKind): string => {
  switch (kind) {
    case NodeKind.Error:
      return "ERROR"
    case NodeKind.Empty:
      return "EMPTY"
    case NodeKind.List:
      return "LIST"
    case NodeKind.SourceFile:
      return "SOURCE_FILE"
    case NodeKind.Import:
      return "IMPORT"
    case NodeKind.ImportSpec:
      return "IMPORT_SPEC"
    case NodeKind.FunctionDecl:
      return "FUNCTION"
    case NodeKind.Param:
      return "PARAM"
    case NodeKind.Class:
      return "CLASS"
    case NodeKind.Interface:
      return "INTERFACE"
    case NodeKind.Field:
      return "FIELD"
    case NodeKind.Method:
      return "METHOD"
    case NodeKind.Constructor:
      return "CONSTRUCTOR"
    case NodeKind.ModuleConst:
      return "MODULE_CONST"
    case NodeKind.Block:
      return "BLOCK"
    case NodeKind.Var:
      return "VAR"
    case NodeKind.VarDecl:
      return "VAR_DECL"
    case NodeKind.ExprStmt:
      return "EXPR_STMT"
    case NodeKind.If:
      return "IF"
    case NodeKind.While:
      return "WHILE"
    case NodeKind.Do:
      return "DO"
    case NodeKind.For:
      return "FOR"
    case NodeKind.ForOf:
      return "FOR_OF"
    case NodeKind.Break:
      return "BREAK"
    case NodeKind.Continue:
      return "CONTINUE"
    case NodeKind.Return:
      return "RETURN"
    case NodeKind.Throw:
      return "THROW"
    case NodeKind.Switch:
      return "SWITCH"
    case NodeKind.Case:
      return "CASE"
    case NodeKind.Default:
      return "DEFAULT"
    case NodeKind.Ident:
      return "IDENT"
    case NodeKind.Number:
      return "NUMBER"
    case NodeKind.Bigint:
      return "BIGINT"
    case NodeKind.String:
      return "STRING"
    case NodeKind.True:
      return "TRUE"
    case NodeKind.False:
      return "FALSE"
    case NodeKind.Null:
      return "NULL"
    case NodeKind.This:
      return "THIS"
    case NodeKind.Template:
      return "TEMPLATE"
    case NodeKind.TemplateText:
      return "TEMPLATE_TEXT"
    case NodeKind.Array:
      return "ARRAY"
    case NodeKind.Object:
      return "OBJECT"
    case NodeKind.Property:
      return "PROPERTY"
    case NodeKind.Binary:
      return "BINARY"
    case NodeKind.Unary:
      return "UNARY"
    case NodeKind.Conditional:
      return "CONDITIONAL"
    case NodeKind.Call:
      return "CALL"
    case NodeKind.New:
      return "NEW"
    case NodeKind.Member:
      return "MEMBER"
    case NodeKind.Index:
      return "INDEX"
    case NodeKind.Paren:
      return "PAREN"
    case NodeKind.TypeRef:
      return "TYPE_REF"
    case NodeKind.TypeArray:
      return "TYPE_ARRAY"
    case NodeKind.TypeUnion:
      return "TYPE_UNION"
    case NodeKind.TypeNull:
      return "TYPE_NULL"
    case NodeKind.Super:
      return "SUPER"
    case NodeKind.TypeParen:
      return "TYPE_PAREN"
    case NodeKind.TypeReadonly:
      return "TYPE_READONLY"
    case NodeKind.TypeAlias:
      return "TYPE_ALIAS"
    case NodeKind.Enum:
      return "ENUM"
    case NodeKind.EnumMember:
      return "ENUM_MEMBER"
    case NodeKind.TypeFunction:
      return "TYPE_FUNCTION"
    case NodeKind.Arrow:
      return "ARROW"
    case NodeKind.TypeLiteral:
      return "TYPE_LITERAL"
    case NodeKind.Try:
      return "TRY"
    case NodeKind.With:
      return "WITH"
    case NodeKind.Labeled:
      return "LABELED"
    case NodeKind.Regex:
      return "REGEX"
    case NodeKind.As:
      return "AS"
    case NodeKind.Spread:
      return "SPREAD"
    case NodeKind.Decorator:
      return "DECORATOR"
    case NodeKind.Namespace:
      return "NAMESPACE"
    case NodeKind.TypeOperator:
      return "TYPE_OPERATOR"
    case NodeKind.BindingPattern:
      return "BINDING_PATTERN"
    case NodeKind.IndexSignature:
      return "INDEX_SIGNATURE"
    case NodeKind.ExportAssignment:
      return "EXPORT_ASSIGNMENT"
    case NodeKind.ExportDeclaration:
      return "EXPORT_DECLARATION"
    case NodeKind.ImportEquals:
      return "IMPORT_EQUALS"
    case NodeKind.NamespaceExport:
      return "NAMESPACE_EXPORT"
    default:
      return "?"
  }
}

/**
 * The name of the hidden `const` a destructuring declarator binds its
 * receiver to where its names cannot read the initializer itself
 * (`Parser.lowerPattern`): one per pattern, by where it starts, spelled with a
 * `.` no program can write, so it shadows nothing and nothing can name it.
 */
export const patternReceiverName = (pattern: Node): string => `pattern.${pattern.start}`

/**
 * The destructuring pattern a declarator stands for, or null: the fourth
 * child of the first declarator `Parser.lowerPattern` wrote for it (the
 * pattern's head), or the first child of one it left whole (a module
 * constant, or WP49's `= await awaitAll(...)`).
 */
export const patternOf = (decl: Node): Node | null => {
  if (decl.children.length > 3) {
    return decl.children[3]
  }
  return decl.children[0].kind === NodeKind.BindingPattern ? decl.children[0] : null
}

/**
 * Whether `decl` binds a pattern's hidden receiver (`patternReceiverName`),
 * which a debugger is not shown.
 */
export const bindsHiddenReceiver = (decl: Node): boolean =>
  decl.children.length > 3 && (decl.flags & FLAG_PATTERN_NAME) === 0

/** Whether `decl` is one of the name declarators `Parser.lowerPattern` wrote. */
export const isPatternName = (decl: Node): boolean => (decl.flags & FLAG_PATTERN_NAME) !== 0

/** What a pattern slot binds: an object entry's child, or an array slot itself. */
export const patternSlotName = (slot: Node): Node =>
  slot.kind === NodeKind.Property ? slot.children[0] : slot

/**
 * Whether a pattern slot binds a plain name, with no default, rest or
 * computed key: the slots `Parser.lowerPattern` gives a declarator.
 */
export const isPlainSlot = (slot: Node): boolean => {
  const name = patternSlotName(slot)
  return name.kind === NodeKind.Ident && slot.flags === 0 && name.flags === 0
}

/**
 * Whether a declarator's initializer is an `await`, parenthesised or not: a
 * pattern over one is WP49's `awaitAll` or refused (NL2193), and
 * `Parser.lowerPattern` gives it no names.
 */
export const awaitsInitializer = (decl: Node): boolean => {
  let init = decl.children[2]
  while (init.kind === NodeKind.Paren) {
    init = init.children[0]
  }
  return init.kind === NodeKind.Unary && init.text === "await"
}
