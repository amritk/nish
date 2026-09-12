// WP19 G1: `-g` measures a function from where its *declaration* starts, and
// for the arrow form that is the `const`, not the arrow. stage0 read the
// position off the `ArrowFunction`, whose own start is its parameter list, so
// it put `add` at column 20 where stage1 put it at column 1 — three
// `!DILocation` columns that left `node tests/run.js --parity` red. No `-g`
// case could ask the question, because every one of them was written in the
// `function` spelling.
//
// `span` is the half that pins the *line* rather than the column: its arrow
// sits a line below its `const`, so a compiler measuring from the arrow names
// line 19 in the `DISubprogram`, in `scopeLine` and in both parameters'
// `DILocalVariable`s, where the declaration a reader sees begins on line 18.
// `scaled` carries the `llvm.dbg.declare` of a slot, and `main` the artificial
// wrapper, which takes the user `main`'s position too.

export const add = (a: i32, b: i32): i32 => a + b;

const span =
  (lo: i32, hi: i32): i32 => hi - lo;

const scaled = (n: i32): i32 => {
  let acc = 0;
  for (const v of [1, 2, 3]) {
    acc += v * n;
  }
  return acc;
};

export const main = (): number => {
  console.log(`${add(2, 3)}`);
  console.log(`${span(1, 9)}`);
  console.log(`${scaled(2)}`);
  return 0;
};
