// NL2274: An arrow bound to a `const` declares one function, so a second name in the same declaration is refused.
const one = (): i32 => 1,
  two = (): i32 => 2;
