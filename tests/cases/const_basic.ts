// A module constant is a name for a value, not a global: every use folds to
// the literal, so the IR holds no symbol and no load.
const LIMIT: i32 = 10;
const READY: boolean = true;
const LABEL: string = "limit";

function test(): number {
  console.log(LABEL);
  console.log(READY);
  return LIMIT;
}
