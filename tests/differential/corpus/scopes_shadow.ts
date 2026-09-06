// Block scoping: shadowing in nested blocks and loops, `let` in for initializers.
export function main(): number {
  let x = 1;
  {
    let x = 2;
    x++;
    console.log(x);
    {
      const x = "inner";
      console.log(x);
    }
    console.log(x);
  }
  console.log(x);
  for (let x = 10; x < 13; x++) {
    console.log(x);
  }
  console.log(x);
  let total = 0;
  for (let i = 0; i < 3; i++) {
    let i2 = i * i;
    for (let j = 0; j < 2; j++) {
      const i2 = j + 100;
      total += i2;
    }
    total += i2;
  }
  console.log(total);
  if (x === 1) {
    const x = 50;
    console.log(x * 2);
  } else {
    const x = 60;
    console.log(x * 3);
  }
  let s = "outer";
  while (x < 3) {
    const s = `loop${x}`;
    console.log(s);
    x++;
  }
  console.log(s);
  console.log(x);
  return 0;
}
