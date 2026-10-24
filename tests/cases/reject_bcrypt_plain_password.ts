// `bcryptHash` takes the password as a `Secret<u8[]>`, never as bytes anyone
// can read: a plain `u8[]` is refused, so a password cannot reach the hash
// without the caller taking on the wipe `nish:secret` asks of it.
import { bcryptHash } from "nish/crypto/bcrypt";

export const main = (): i32 => {
  const password: u8[] = [104, 117, 110, 116, 101, 114, 50];
  const salt: u8[] = new Array<u8>(16);
  const cost: i32 = 4;
  const made: Result<string, string> = bcryptHash(password, salt, cost);
  return made.isOk() ? 0 : 1;
};
