// A script tests/run.js's `host-import` section reads with --emit-ts: no import
// and no export, so to tsc the reading is a script whose `HostHandle` alias
// would be global, unless the reading marks it a module with `export {}`.
const empty = (c: HostHandle<"canvas">): boolean => c === 0
console.log(empty(0) ? "empty" : "held")
