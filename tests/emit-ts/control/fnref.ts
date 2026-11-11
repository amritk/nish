// WP51 stage 1 written back out: a reference to a top-level function is the
// function itself under Node, so a field, an array element, a local and a
// return hold the function and a call through one is a plain call.
type Op = (x: i32) => i32;

const inc = (x: i32): i32 => x + 1;
const double = (x: i32): i32 => x * 2;

class Stage {
  op: Op;

  constructor(op: Op) {
    this.op = op;
  }
}

const pick = (big: boolean): Op => (big ? double : inc);

export const main = (): void => {
  const ops: Op[] = [inc, double];
  ops.push(inc);
  let total = 0;
  for (const op of ops) {
    total = total + op(10);
  }
  const s = new Stage(pick(true));
  const local: Op = s.op;
  // A callee whose index is rewritten is written with the reference as the
  // callee, as it was written.
  let step = 0;
  for (let i = 0; i < 3; i++) {
    step = ops[(i + 1) % 3](step);
  }
  console.log(`${total} ${s.op(4)} ${local(5)} ${ops[0] === ops[2]} ${pick(false) === double} ${step}`);
};
