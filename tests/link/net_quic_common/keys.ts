// The plain view of `nish/net/quic-packet`'s one-shot key derivations, for
// the QUIC tests that keep traffic secrets in fields, where a `Secret` may
// not live. Each call goes through the module's real surface — the secret
// wrapped in a `Secret`, a derived one read back through `expose` — and wipes
// every `Secret` it made before it returns (docs/LANGUAGE.md, "Secrets").
import { Secret, expose, secret, wipe } from "nish:secret";
import { QuicKeys, QuicKeysSlot, quicKeyUpdateSecret, quicKeys, quicKeysUpdate } from "nish/net/quic-packet";
import { copyOf } from "../crypto_x25519/plain";

/** `quicKeys` of a plain traffic secret, into a slot of its own. */
export const quicKeysOf = (aead: i32, traffic: u8[]): QuicKeys | null => {
  const held: Secret<u8[]> = secret(copyOf(traffic));
  const keys: QuicKeys | null = quicKeys(new QuicKeysSlot(), aead, held);
  wipe(held);
  return keys;
};

/** `quicKeyUpdateSecret` of a plain traffic secret, answered plain. */
export const quicKeyUpdateCopy = (aead: i32, traffic: u8[]): u8[] | null => {
  const held: Secret<u8[]> = secret(copyOf(traffic));
  const next: Secret<u8[]> | null = quicKeyUpdateSecret(aead, held);
  wipe(held);
  if (next === null) {
    return null;
  }
  const plain: u8[] = expose(next, copyOf);
  wipe(next);
  return plain;
};

/** `quicKeysUpdate` with a plain next traffic secret, into a slot of its own. */
export const quicKeysUpdateOf = (keys: QuicKeys, nextTraffic: u8[]): QuicKeys | null => {
  const held: Secret<u8[]> = secret(copyOf(nextTraffic));
  const next: QuicKeys | null = quicKeysUpdate(new QuicKeysSlot(), keys, held);
  wipe(held);
  return next;
};
