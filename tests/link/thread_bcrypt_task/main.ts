// bcrypt runs in a std/threads task: two tasks each hash a password the parent
// owns as a `Secret`, a third verifies one against a known hash, and the parent
// wipes the passwords once the scope has joined. The hashes are the single
// path's (crypt_blowfish's "U*U" vector and a salt of sevens), so the threads
// agree with Node's one-after-another.
import { bcryptHash, bcryptVerify } from "nish/crypto/bcrypt";
import { Secret, secret, wipe } from "nish:secret";
import { scope } from "nish/threads";

const hashSevens = (pw: Secret<u8[]>): string => {
  const salt: u8[] = new Array<u8>(16);
  salt.fill(7);
  const r = bcryptHash(pw, salt, 4);
  if (r.isErr()) {
    return r.error;
  }
  return r.value;
};

const hashZeros = (pw: Secret<u8[]>): string => {
  const salt: u8[] = new Array<u8>(16);
  salt.fill(0);
  const r = bcryptHash(pw, salt, 5);
  if (r.isErr()) {
    return r.error;
  }
  return r.value;
};

const verifyVector = (pw: Secret<u8[]>): string => {
  const r = bcryptVerify(pw, "$2a$05$CCCCCCCCCCCCCCCCCCCCC.E5YPO9kmyuRGyh0XouQYb4YMJKvyOeW");
  if (r.isErr()) {
    return r.error;
  }
  return r.value ? "match" : "no match";
};

export const main = (): i32 => {
  const a: u8[] = [97, 98, 99];
  const u: u8[] = [85, 42, 85];
  const pa: Secret<u8[]> = secret(a);
  const pu: Secret<u8[]> = secret(u);
  const out: string[] = ["", "", ""];
  {
    using s = scope();
    s.spawn(hashSevens, pa, out, 0);
    s.spawn(hashZeros, pu, out, 1);
    s.spawn(verifyVector, pu, out, 2);
  }
  wipe(pa);
  wipe(pu);
  for (const line of out) {
    console.log(line);
  }
  return 0;
};
