// A labelled statement at the top level of a module: Phase 0 refuses it by
// its own rule (NL1046) before the checker could say a module has no
// top-level code.
outer: while (true) {
  break outer;
}
