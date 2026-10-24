// `bcryptVerify` answers a `Result`, and a verify whose answer is dropped is
// a login that checks nothing: the call may not stand as a statement.
import { secret, wipe } from "nish:secret";
import { bcryptVerify } from "nish/crypto/bcrypt";

export const main = (): i32 => {
  const bytes: u8[] = [104, 117, 110, 116, 101, 114, 50];
  const password = secret(bytes);
  bcryptVerify(password, "$2b$04$CCCCCCCCCCCCCCCCCCCCC.K7Qr0se1MxuggH4aP4YgB.U2Em1pGSK");
  wipe(password);
  return 0;
};
