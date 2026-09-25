// NL2344: an arrow with more parameters than its function type.
const fold = (xs: i32[], f: (acc: i32, x: i32) => i32): i32 => 0;

export const main = (): i32 => fold([1], (acc, x, i) => acc + x + i);
