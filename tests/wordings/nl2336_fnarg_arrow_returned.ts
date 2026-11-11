// NL2336: an arrow anywhere but as a function argument, here returned. It
// captures nothing, so the advice is the one stage 1 of function references
// takes: name it as a top-level function.
const make = (): ((x: i32) => i32) => {
  return (x: i32): i32 => x + 1;
};

export const main = (): i32 => make()(1);
