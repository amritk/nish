// NL2286: `declare enum` describes an enum some other translation unit holds,
// and there is no other translation unit to hold one — an enum member is folded
// to its integer where it is written, so there would be nothing to link to.
declare enum Kind {
  If = 1,
}
