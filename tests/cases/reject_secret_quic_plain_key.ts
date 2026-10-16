// `nish/net/quic-packet`'s one-shot key derivations take the traffic secret
// as a `Secret<u8[]>`: a plain `u8[]` is refused at the call, so a Handshake
// or 1-RTT secret never reaches them unwiped.
import { QUIC_AEAD_AES_128_GCM, quicKeys } from "nish/net/quic-packet";
export const main = (): i32 => {
  const traffic: u8[] = new Array<u8>(32);
  const keys = quicKeys(QUIC_AEAD_AES_128_GCM, traffic);
  return keys === null ? 1 : 0;
};
