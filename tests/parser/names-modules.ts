// `type`, `as`, `from`, `require`, `namespace`, `assert` and `defer` are
// identifiers to the lexer, and an import may name a function by any of them.
// WP33 R1 reads the import and export forms the language forbids — `import
// type`, `import defer`, `{ type x }`, `import x = require(...)`, `export as
// namespace`, attributes after `with` or `assert` — each only where
// TypeScript reads the word as that form, so every import below compiles as it
// did before, to the same bytes: each word imported under its own name and
// under another, `{ type as as }` and `{ type as t }` (a name `type`, renamed,
// not a type-only import), the words split across lines and between comments,
// and each called from a body.
import { type, from } from "./names-modules-lib"
import { as as asWord, require, namespace } from "./names-modules-lib"
import { type as as } from "./names-modules-lib"
import { type as typeWord, assert, defer } from "./names-modules-lib"
import {
  type
    as
      typeLine,
  from as
  fromLine,
} from "./names-modules-lib"
import { /* a */ type /* b */ as /* c */ typeComment } from /* d */ "./names-modules-lib"
import { Word } from "./names-modules-lib"

export const words = (): Word =>
  type() + from() + asWord() + require() + namespace() + as() + typeWord() + assert() + defer()

export const lines = (): i32 => typeLine() + fromLine() + typeComment()

export const main = (): i32 => words() + lines() - 35
