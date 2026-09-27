// #235: in an `&&` chain, an operand that assigns a narrowed variable ends its
// narrowing for every operand after it. `p = null` runs after `p !== null`
// was tested, so `p.v` reads a `Node2 | null`. Before the fix the chain
// compiled, and the program read a field of `null`.
class Node2 {
  v: number = 1;
}

const g = (b: boolean): boolean => b;

export const main = (): void => {
  let p: Node2 | null = new Node2();
  if (p !== null && g((p = null) === null) && p.v > 0) {
    console.log("x");
  }
};
