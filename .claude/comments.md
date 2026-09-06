# Great Comments for All Types

Use comments to explain **why**, not **what**. Most of the time, the code explains what is happening. Comments should clarify why a type or function exists, why you made specific decisions, or why a workaround is necessary.

Write friendly comments that sound human. Comments should be clear and helpful, not robotic or overly formal. Aim for a tone that is friendly and supportive, like you are helping a teammate understand the code later.

**Good:**

```typescript
/**
 * The bounds check reads `length` before the element so that an out-of-range
 * index panics instead of loading past the header. Without this, `--unchecked-indexing`
 * and the default build would differ in more than the check.
 */
```

**Bad:**

```typescript
/**
 * Check bounds.
 */
```

## Comment Guidelines

- Avoid contractions in comments. Use "do not" instead of "don't", "it is" instead of "it's", etc. This makes comments easier to read, especially for non-native speakers.
- If you use contractions, make sure they have proper apostrophes. Sometimes contractions can make a comment more approachable. If you choose to use them, use proper punctuation.
- Comment on types when their purpose is not obvious. If a type models an external API, or has a non-obvious constraint, explain it.
- Explain relationships between types when they are not clear.

**Example:**

```typescript
/**
 * One field of a struct as the emitter lays it out. `offset` and `index` are
 * both kept because a GEP needs the index and the C header needs the offset,
 * and recomputing either from the other means agreeing with clang twice.
 */
export interface FieldInfo {
  name: string;
  type: StaticType;
  index: number;
  offset: number;
}
```

- Document the intent of utility types or generic types.

**Example:**

```typescript
/**
 * A checker handler keyed by `ts.SyntaxKind`. Returns `true` when the statement
 * cannot fall through, which is how definite-return analysis works without a
 * separate pass.
 */
export type StatementChecker = (ctx: CheckContext, stmt: ts.Statement, scope: Scope) => boolean;
```

- For complex function signatures, describe the behavior and usage.

**Example:**

```typescript
/**
 * Emits the call-graph fixpoint for one program.
 *
 * Returns a map from function symbol to its facts:
 * - `effect`: `readnone` / `readonly` / `readwrite`, from the callee closure
 * - `willreturn`: only when every loop in the closure is counted
 * - `escapes`: which parameters flow into a stored pointer
 *
 * Every attribute this map produces must cite a proof in `attributes.ts`;
 * an attribute the checker cannot justify is a miscompile, not an
 * optimisation.
 */
export function analyzeFunctions(units: ModuleUnit[]): Map<symbol, FunctionFacts> {
  /* ... */
}
```

- If the type is temporary or will change later, leave a TODO comment. In this repo a TODO names the work package it belongs to (`TODO(WP8): ...`), because scope that belongs to another package is left for it rather than widened into.

**Example:**

```typescript
/**
 * TODO(WP8): replace with the marshalled layout once typed arrays cross the wasm boundary.
 */
export type ArrayHeader = { length: number; capacity: number };
```

- Use JSDoc style consistently for types and functions that are exported or public. This improves editor support (tooltips, autocompletion) and helps other developers understand your code faster.

**Example:**

```typescript
/**
 * A local variable as the checker recorded it.
 * `param` locals are SSA values and are read directly; `local` locals live in a
 * hoisted alloca and are loaded at each use. The emitter branches on `storage`
 * and nothing else.
 */
export interface LocalVar {
  /** Source name, used only in diagnostics and `-g` debug info. */
  name: string;
  /** Static type; drives `llvmType` at every load and store. */
  type: StaticType;
  /** Whether reads are SSA uses or loads from a stack slot. */
  storage: "param" | "local";
  /** `true` for `const` and `readonly`; assignment is a checker error. */
  readonly: boolean;
}
```

## Comments this repo relies on

Some comments here are load-bearing rather than decorative. Keep them accurate
when you touch the code next to them:

- **Every LLVM attribute cites its proof.** `src/codegen/attributes.ts` writes
  the reason an attribute is sound beside the code that emits it. An attribute
  with no reason is removed, not kept on faith.
- **Module headers explain the phase.** `src/validator.ts`, `src/checker/index.ts`
  and `src/codegen/emitter.ts` open with what the phase decides, what it may
  not look at, and which document holds the full rule list. A new phase or
  family module gets the same.
- **Runtime ABI comments live on both sides.** A layout described in
  `src/codegen/runtime.ts` is described the same way in `runtime/statictsc.h`;
  a change to one without the other is what `tests/run.js` exists to catch.
