// `with` at the top level of a module: Phase 0 refuses it by its own rule
// (NL1038) before the checker could say a module has no top-level code.
with (Math) {
}
