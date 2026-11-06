// A labelled loop at the top level of a module that declares `main`: a label
// is accepted on a loop, so the refusal is the checker's, that such a module
// has no top-level code.
outer: while (true) {
  break outer;
}

export const main = (): void => {}
