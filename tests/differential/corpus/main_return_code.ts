// The value main returns is the exit status.
function compute(): number {
  let x = 0;
  for (let i = 0; i < 10; i++) {
    x += i;
  }
  return x;
}

export function main(): number {
  const c = compute();
  console.log(c);
  console.log(`returning ${c - 3}`);
  return c - 3;
}
