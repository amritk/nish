// The four-lane batch runs in a std/threads task: `bcryptHash4` and
// `bcryptVerify4` make the batch's state with `secret(...)` from a fresh array
// and wipe it, which a task may do (docs/security/crypto-bcrypt.md, BCRYPT-9).
// One task hashes the parent's password in two lanes (salts of sevens and of
// zeros), another verifies two lanes against crypt_blowfish's "U*U" vector, and
// the parent checks the lanes against the single `bcryptHash` once the scope
// has joined and wipes the passwords.
import { bcryptHash, bcryptHash4, bcryptVerify4 } from "nish/crypto/bcrypt";
import { Secret, secret, wipe } from "nish:secret";
import { scope } from "nish/threads";

const VECTOR: string = "$2a$05$CCCCCCCCCCCCCCCCCCCCC.E5YPO9kmyuRGyh0XouQYb4YMJKvyOeW";

const hashTwo = (pw: Secret<u8[]>): string => {
  const salts: u8[] = new Array<u8>(64);
  salts.fill(0);
  for (let i: i32 = 0; i < 16; i++) {
    salts[i] = 7;
  }
  const r = bcryptHash4(pw, pw, null, null, salts, 4);
  if (r.isErr()) {
    return r.error;
  }
  return `${r.value[0]} ${r.value[1]}`;
};

const verifyTwo = (pw: Secret<u8[]>): string => {
  const wrong: string = "$2a$05$CCCCCCCCCCCCCCCCCCCCC.VGOzA784oUp/Z0DY336zx7pLYAy0lwK";
  const r = bcryptVerify4(pw, pw, null, null, [VECTOR, wrong, "", ""]);
  if (r.isErr()) {
    return r.error;
  }
  return `${r.value[0] ? "match" : "no match"} ${r.value[1] ? "match" : "no match"}`;
};

const single = (pw: Secret<u8[]>, fill: u8): string => {
  const salt: u8[] = new Array<u8>(16);
  salt.fill(fill);
  const r = bcryptHash(pw, salt, 4);
  if (r.isErr()) {
    return r.error;
  }
  return r.value;
};

export const main = (): i32 => {
  const a: u8[] = [97, 98, 99];
  const u: u8[] = [85, 42, 85];
  const pa: Secret<u8[]> = secret(a);
  const pu: Secret<u8[]> = secret(u);
  const out: string[] = ["", ""];
  {
    using s = scope();
    s.spawn(hashTwo, pa, out, 0);
    s.spawn(verifyTwo, pu, out, 1);
  }
  const expected: string = `${single(pa, 7)} ${single(pa, 0)}`;
  wipe(pa);
  wipe(pu);
  console.log(out[0]);
  console.log(out[0] === expected ? "batch agrees with bcryptHash" : "batch differs from bcryptHash");
  console.log(out[1]);
  return 0;
};
