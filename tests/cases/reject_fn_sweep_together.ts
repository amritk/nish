// The function and binding forms are refused by the checker's pass 1 sweep,
// which recovers per declaration: each declaration that holds one reports it
// once and nothing else, the first in source order. `tests/run.js` pins the
// seven through `--json`.
//
// `rest` reports its rest parameter rather than the pattern after it; `later`
// its missing return type rather than the `**` in its body; `pair` the `**`
// in its first initialiser rather than the pattern in its second; `order` the
// default rather than the `keyof` in the parameter after it; `signature` its
// missing return type rather than its missing body; `two` the `**` before its
// second name; and `counter` its `let` rather than its pattern.
interface Point {
  x: i32
}

export const rest = (...[a, b]: i32[]): i32 => 0

export const later = (x: i32) => x ** 2

const pair = 2 ** 3, [first] = [1]

export const order = (a: i32 = 1, b: keyof Point): i32 => 0

function signature(p: Point);

const two = (): i32 => 2 ** 3, three = 3

let { counter } = { counter: 0 }
