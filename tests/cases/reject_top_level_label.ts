// A labelled loop at the top level of a module: a label is accepted on a
// loop, so the refusal is the checker's, that a module has no top-level code.
outer: while (true) {
  break outer;
}
