// Folding is lazy, so a cycle has to be caught rather than recursed into.
const A: i32 = B + 1;
const B: i32 = A + 1;
