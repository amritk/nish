// A clause with statements must not fall out of its bottom: AmritScript has no
// implicit fallthrough, only the empty-clause grouping.
function f(n: number): number {
  switch (n) {
    case 1:
      n += 1;
    case 2:
      return n;
    default:
      return 0;
  }
}
