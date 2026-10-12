// A string `String.fromBytes` makes is an arena allocation of the function
// that makes it, so what a caller keeps of it survives: pushed onto an outer
// array in a loop, assigned to an outer `let` in a loop, stored in a field,
// or returned through two calls. `churn` then reuses every byte a wrong
// release would have freed, and each kept string is read back intact.
class Holder {
  name: string = "";
}

const word = (bytes: u8[], i: i32): string => String.fromBytes(bytes, i % 3, 3 + (i % 3));

const twice = (bytes: u8[], i: i32): string => word(bytes, i);

const churn = (): i32 => {
  let t = 0;
  for (let i = 0; i < 2000; i++) {
    t = t + `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx${i}`.length;
  }
  return t;
};

export const main = (): number => {
  const bytes: u8[] = [97, 98, 99, 100, 101, 102];
  const kept: string[] = [];
  let last = "";
  const h = new Holder();
  for (let i = 0; i < 5; i++) {
    kept.push(String.fromBytes(bytes, i % 4, 2 + (i % 4)));
    last = word(bytes, i);
    h.name = twice(bytes, i + 1);
  }
  const t = churn();
  console.log(`${kept.join(",")} ${last} ${h.name} ${t > 0}`);
  return 0;
};
