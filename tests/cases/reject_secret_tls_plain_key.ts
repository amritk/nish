// `nish/net/tls/schedule`'s one-shot derivations take every secret as a
// `Secret<u8[]>`: a plain `u8[]` shared secret is refused at the call, so a
// key never reaches the schedule unwiped.
import { tlsEarlySecret, tlsHandshakeSecret } from "nish/net/tls/schedule";
import { wipe } from "nish:secret";
export const main = (): i32 => {
  const shared: u8[] = new Array<u8>(32);
  const early = tlsEarlySecret(32);
  const handshake = tlsHandshakeSecret(32, early, shared);
  wipe(early);
  wipe(handshake);
  return 0;
};
