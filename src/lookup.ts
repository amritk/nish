/**
 * Reading a dispatch table with a key that came from user source.
 *
 * The validator, checker and emitter are each a table keyed by name
 * (`FORBIDDEN_VALUE_IDENTIFIERS`, `builtinFunctions`, `newCheckers`, ...), and
 * the key is an identifier out of the program being compiled. A plain object
 * literal inherits from `Object.prototype`, so a program that declares
 * `function valueOf()` or `class toString` finds a native function sitting in
 * the table and uses it as a handler — which is how `function valueOf() {
 * [native code] }` came to be reported as a compile error.
 *
 * `Object.hasOwn` is the whole fix. It is a function rather than a comment on
 * each site so that a new table cannot quietly reintroduce the bug: the rule is
 * "a table indexed by user text is read through `lookup`".
 */
export const lookup = <T>(table: Record<string, T>, key: string): T | undefined =>
  Object.hasOwn(table, key) ? table[key] : undefined;
