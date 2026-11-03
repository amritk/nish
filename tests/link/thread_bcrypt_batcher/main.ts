// The login batcher (`nish/crypto/bcrypt-batch`) at cost 4. A request waits
// for its hold window, a full batch goes at once, a run takes at most
// width × cores requests and spreads them over the cores' tasks, a damaged
// stored hash answers its `Err` on its own row only, a salt of the wrong
// length is answered without a batch, the batcher wipes its own copy of each
// password while the caller wipes its own, and every answer agrees with the single
// `bcryptVerify` and `bcryptHash` (docs/security/crypto-bcrypt.md, BCRYPT-11).
import { bcryptHash, bcryptVerify } from "nish/crypto/bcrypt";
import { BcryptAnswer, BcryptBatcher, bcryptBatcher } from "nish/crypto/bcrypt-batch";
import { Secret, secret, wipe } from "nish:secret";

const VECTOR: string = "$2a$05$CCCCCCCCCCCCCCCCCCCCC.E5YPO9kmyuRGyh0XouQYb4YMJKvyOeW";
const WRONG: string = "$2a$05$CCCCCCCCCCCCCCCCCCCCC.VGOzA784oUp/Z0DY336zx7pLYAy0lwK";
const DAMAGED: string = "$2a$05$CCCC";

/** A time in nanoseconds. */
const T = (n: i32): i64 => toI64(n);

const salt = (fill: u8): u8[] => {
  const s: u8[] = new Array<u8>(16);
  s.fill(fill);
  return s;
};

const show = (a: BcryptAnswer): string => {
  if (a.error !== "") {
    return `${a.ticket}: Err ${a.error}`;
  }
  if (a.hash !== "") {
    return `${a.ticket}: ${a.hash}`;
  }
  return `${a.ticket}: ${a.ok ? "match" : "no match"}`;
};

const print = (label: string, answers: BcryptAnswer[]): void => {
  console.log(`${label}: ${answers.length}`);
  for (const a of answers) {
    console.log(`  ${show(a)}`);
  }
};

const refused = (width: i32, holdNanos: i64, cores: i32, cost: i32): void => {
  const r = bcryptBatcher({ width: width, holdNanos: holdNanos, cores: cores, cost: cost });
  console.log(r.isErr() ? r.error : "made");
};

export const main = (): i32 => {
  refused(0, T(0), 1, 10);
  refused(7, T(0), 1, 10);
  refused(6, T(-1), 1, 10);
  refused(6, T(0), 0, 10);
  refused(6, T(0), 1, 3);
  refused(6, T(0), 1, 32);

  const made = bcryptBatcher({ width: 3, holdNanos: T(1000), cores: 2, cost: 4 });
  if (made.isErr()) {
    console.log(made.error);
    return 1;
  }
  const b: BcryptBatcher = made.value;
  const rawU: u8[] = [85, 42, 85];
  const rawAbc: u8[] = [97, 98, 99];
  const u: Secret<u8[]> = secret(rawU);
  const abc: Secret<u8[]> = secret(rawAbc);

  // The hold window: one verify waits 1000 ns, then goes alone.
  console.log(`empty wait ${b.waitNanos(T(0))}`);
  b.verify(u, VECTOR, T(0));
  console.log(`wait at 0: ${b.waitNanos(T(0))}, at 400: ${b.waitNanos(T(400))}`);
  print("run at 400", b.run(T(400)));
  print("run at 1000", b.run(T(1000)));

  // A full batch goes at once; a run takes width × cores = 6 of the 8.
  const single = bcryptHash(abc, salt(7), 4);
  const zero = bcryptHash(abc, salt(0), 4);
  const stored: string = single.isErr() ? single.error : single.value;
  const zeroed: string = zero.isErr() ? zero.error : zero.value;
  b.verify(u, VECTOR, T(2000));
  b.verify(u, WRONG, T(2000));
  b.verify(u, DAMAGED, T(2000));
  console.log(`wait with three: ${b.waitNanos(T(2000))}`);
  b.hash(abc, salt(7), T(2000));
  b.verify(abc, stored, T(2000));
  b.hash(abc, salt(0), T(2000));
  b.verify(u, stored, T(2000));
  b.verify(abc, VECTOR, T(2000));
  console.log(`pending ${b.pending()}`);
  print("run at 2000", b.run(T(2000)));
  console.log(`pending ${b.pending()}, wait ${b.waitNanos(T(2000))}`);
  print("run at 2000 again", b.run(T(2000)));
  print("run at 3000", b.run(T(3000)));

  // A salt of the wrong length is answered at the next run, without a batch.
  const short: u8[] = [1, 2, 3];
  b.hash(abc, short, T(4000));
  console.log(`bad salt: pending ${b.pending()}, wait ${b.waitNanos(T(4000))}`);
  print("run at 4000", b.run(T(4000)));

  // The single calls agree.
  const damaged = bcryptVerify(abc, DAMAGED);
  console.log(`single damaged: ${damaged.isErr() ? damaged.error : "ok"}`);
  console.log(`single hashes: ${stored} ${zeroed}`);
  wipe(u);
  wipe(abc);
  console.log(`pending ${b.pending()}, wait ${b.waitNanos(T(5000))}`);
  return 0;
};
