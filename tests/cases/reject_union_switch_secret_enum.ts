// A `switch` on a plain enum is never complete, whatever its labels: a value no
// label names reaches the `return` after it with the `Secret` unwiped. The same
// `switch` on a union's tag is accepted (`union_switch_secret`).
import { Secret, expose, secret, wipe } from "nish:secret";

enum Kind {
  Circle,
  Square,
}

const key = (): u8[] => [3, 1, 4, 1, 5];

const sum = (k: u8[]): i32 => {
  let total: i32 = 0;
  for (let i: i32 = 0; i < toI32(k.length); i++) {
    total = total + toI32(k[i]);
  }
  return total;
};

const weigh = (kind: Kind): i32 => {
  const k: Secret<u8[]> = secret(key());
  let out: i32 = 0;
  switch (kind) {
    case Kind.Circle:
      out = expose(k, sum);
      wipe(k);
      break;
    case Kind.Square:
      out = expose(k, sum) + 1;
      wipe(k);
      break;
  }
  return out;
};

export const main = (): i32 => {
  console.log(weigh(Kind.Circle));
  return 0;
};
