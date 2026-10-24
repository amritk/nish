// The four-lane batch does not run in a std/threads task: `bcryptHash4` makes
// the batch's state with `secret(...)` and wipes it, and a task may not wipe a
// `Secret` it made (docs/security/crypto-bcrypt.md, BCRYPT-9). The
// single `bcryptHash` runs in a task (tests/link/thread_bcrypt_task).
import { bcryptHash4 } from "nish/crypto/bcrypt";
import { Secret, secret, wipe } from "nish:secret";
import { scope } from "nish/threads";

const hashFour = (pw: Secret<u8[]>): string => {
  const salts: u8[] = new Array<u8>(64);
  salts.fill(0);
  const r = bcryptHash4(pw, null, null, null, salts, 4);
  if (r.isErr()) {
    return r.error;
  }
  return r.value[0];
};

export const main = (): i32 => {
  const bytes: u8[] = [97, 98, 99];
  const pw: Secret<u8[]> = secret(bytes);
  const out: string[] = [""];
  {
    using s = scope();
    s.spawn(hashFour, pw, out, 0);
  }
  wipe(pw);
  console.log(out[0]);
  return 0;
};
