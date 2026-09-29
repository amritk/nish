// `try` at the top level of a module: Phase 0 refuses it by its own rule
// (NL1033) before the checker could say a module has no top-level code.
try {
} finally {
}
