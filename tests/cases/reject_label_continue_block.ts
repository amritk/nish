// A `continue` names a loop to run again; a labelled block is not one.
export function test(): number {
  let n = 0;
  for (let i = 0; i < 3; i++) {
    body: {
      n += i;
      continue body;
    }
  }
  return n;
}
