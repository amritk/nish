// The `Secret` a password is handed to `bcryptVerify` in stays the caller's:
// verifying reads it and does not take it, so a caller that never wipes it is
// refused as any other unwiped `Secret` is.
import { secret } from "nish:secret";
import { bcryptVerify } from "nish/crypto/bcrypt";

export const main = (): i32 => {
  const bytes: u8[] = [104, 117, 110, 116, 101, 114, 50];
  const password = secret(bytes);
  const ok: Result<boolean, string> = bcryptVerify(password, "$2b$04$CCCCCCCCCCCCCCCCCCCCC.K7Qr0se1MxuggH4aP4YgB.U2Em1pGSK");
  return ok.isOk() ? 0 : 1;
};
