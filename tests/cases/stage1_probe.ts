// The fixture of the stage1-only register (tests/self/stage1_only.txt).
//
// This case pins nothing about the language. It is here so that the path a
// stage1-only construct takes — build a compiler out of `self/`, compile the
// case with it, hold the IR against a golden and run the binary — is walked on
// every `npm test` rather than being machinery nobody has driven since the day
// it was written. It is deliberately ordinary, so a failure here is the
// machinery and never the program; and because both compilers can do it,
// `tests/run.js` also compiles it with stage0 and requires the same bytes.
const doubled = (n: i32): i32 => n * 2;

export const test = (): number => {
  let total = 0;
  for (let i = 0; i < 4; i++) {
    total += doubled(i);
  }
  console.log(`stage1 probe ${total}`);
  return 0;
};
