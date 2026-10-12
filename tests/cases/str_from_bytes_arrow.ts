// `String.fromBytes` inside an arrow written as an argument: the arrow is
// lifted into a function of its own, and the string it returns leaves it
// through the call that took it. The caller keeps every such string across a
// loop, `churn` reuses every byte a wrong release would have freed, and each
// kept string is read back intact.
const make = (f: (n: i32) => string, n: i32): string => f(n);

const churn = (): i32 => {
  let t = 0;
  for (let i = 0; i < 2000; i++) {
    t = t + `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx${i}`.length;
  }
  return t;
};

export const main = (): number => {
  const kept: string[] = [];
  for (let i = 1; i <= 4; i++) {
    kept.push(
      make((n) => {
        const bytes: u8[] = [97, 98, 99, 100];
        return String.fromBytes(bytes, 0, n);
      }, i)
    );
  }
  const t = churn();
  console.log(`${kept.join(",")} ${t > 0}`);
  return 0;
};
