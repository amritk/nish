/**
 * `nish/crypto/scram` — the arithmetic of a SCRAM-SHA-256 client, as RFC 5802
 * §3 defines it with SHA-256 for `H` and `HMAC` (RFC 7677 §3):
 *
 *     SaltedPassword  := Hi(Normalize(password), salt, i)
 *     ClientKey       := HMAC(SaltedPassword, "Client Key")
 *     StoredKey       := H(ClientKey)
 *     ClientSignature := HMAC(StoredKey, AuthMessage)
 *     ClientProof     := ClientKey XOR ClientSignature
 *     ServerKey       := HMAC(SaltedPassword, "Server Key")
 *     ServerSignature := HMAC(ServerKey, AuthMessage)
 *
 *     import { scramSha256ClientProof, scramSha256SaltedPassword, scramSha256ServerSignature } from "nish/crypto/scram";
 *
 *     const salted: Secret<u8[]> | null = scramSha256SaltedPassword(password, salt, 4096);
 *     if (salted !== null) {
 *       const proof: u8[] = scramSha256ClientProof(salted, authMessage);
 *       const expected: u8[] = scramSha256ServerSignature(salted, authMessage);
 *       wipe(salted);
 *     }
 *
 * The module holds none of SCRAM's messages: the caller builds AuthMessage,
 * decodes the server's salt and encodes the proof, so that a driver keeps its
 * own wire format and this file stays a pure function of its inputs, which a
 * contract (`specs/scram-sha256.md`) can hold to the RFC's printed exchange.
 * `Normalize` (SASLprep) is the caller's too: the password arrives as the
 * bytes the caller decided to send.
 *
 * SaltedPassword, ClientKey and ServerKey each let whoever holds them log in
 * as the user, so SaltedPassword is taken and given as a `Secret`, and
 * ClientKey, StoredKey, ClientSignature and ServerKey are wiped before each
 * function returns. ClientProof and ServerSignature cross the wire in the
 * clear and are plain bytes. A caller compares the server's signature with
 * `timingSafeEqual` (`nish/crypto/ct`), and caps the iteration count before
 * it calls: `i=` is the server's to choose and Hi runs that many HMACs.
 */

import { hmacSha256, pbkdf2HmacSha256 } from "nish/crypto/hmac"
import { Sha256 } from "nish/crypto/sha256"
import { Secret, exposeWith, wipe } from "nish:secret"

/** The bytes of an ASCII literal, for the two HMAC labels. */
const scramAscii = (text: string): u8[] => {
  const n: i32 = toI32(text.length)
  const out: u8[] = []
  for (let i: i32 = 0; i < n; i++) {
    out.push(toU8(text.charCodeAt(i)))
  }
  return out
}

/**
 * SHA-256 of `data` through a hasher of its own, whose state, block and
 * schedule are wiped before it returns: the one-shot `sha256` leaves the last
 * block of its input in a hasher nothing wipes, and here the input is
 * ClientKey.
 */
const scramSha256Wiped = (data: u8[]): u8[] => {
  const h = new Sha256()
  h.update(data, toI32(0), toI32(data.length))
  const digest: u8[] = h.digest()
  wipe(h.state)
  wipe(h.block)
  wipe(h.schedule)
  h.fill = 0
  h.total = 0
  h.finished = true
  return digest
}

/** ClientKey XOR HMAC(H(ClientKey), AuthMessage), with every key on the way wiped. */
const scramClientProofExposed = (salted: u8[], authMessage: u8[]): u8[] => {
  const clientKey: u8[] = hmacSha256(salted, scramAscii("Client Key"))
  const storedKey: u8[] = scramSha256Wiped(clientKey)
  const clientSignature: u8[] = hmacSha256(storedKey, authMessage)
  // Both are HMAC-SHA-256 tags, 32 bytes each; the bounds below only let the
  // prover see that, and never stop the loop early.
  const proof: u8[] = new Array<u8>(32)
  for (let i: i32 = 0; i < 32 && i < toI32(clientKey.length) && i < toI32(clientSignature.length); i++) {
    proof[i] = clientKey[i] ^ clientSignature[i]
  }
  wipe(clientKey)
  wipe(storedKey)
  wipe(clientSignature)
  return proof
}

/** HMAC(HMAC(SaltedPassword, "Server Key"), AuthMessage), with ServerKey wiped. */
const scramServerSignatureExposed = (salted: u8[], authMessage: u8[]): u8[] => {
  const serverKey: u8[] = hmacSha256(salted, scramAscii("Server Key"))
  const signature: u8[] = hmacSha256(serverKey, authMessage)
  wipe(serverKey)
  return signature
}

/**
 * SaltedPassword, RFC 5802 §3's `Hi(password, salt, i)`: PBKDF2 with
 * HMAC-SHA-256 and a 32-byte output (§2.2).
 *
 * The time is linear in `iterations` and nothing here bounds it, so a caller
 * taking the count from a server caps it first.
 *
 * @param password The password, already normalized as the caller sends it;
 *   read only inside `exposeWith`, and still the caller's to wipe.
 * @param salt The salt the server sent, decoded from base64.
 * @param iterations The server's iteration count `i`; below 1 answers `null`.
 * @returns SaltedPassword, which the caller wipes, or `null` when it cannot be
 *   computed.
 */
export const scramSha256SaltedPassword = (
  password: Secret<u8[]>,
  salt: u8[],
  iterations: i32
): Secret<u8[]> | null => pbkdf2HmacSha256(password, salt, iterations, 32)

/**
 * ClientProof, the `p=` of the client-final message (RFC 5802 §3). ClientKey,
 * StoredKey and ClientSignature are wiped before it returns.
 *
 * @param saltedPassword SaltedPassword from `scramSha256SaltedPassword`, read
 *   only inside `exposeWith`; still the caller's to wipe.
 * @param authMessage The client-first message without its GS2 header, the
 *   server-first message and the client-final message without its proof,
 *   joined by commas.
 * @returns The 32-byte proof, which is sent in the clear.
 */
export const scramSha256ClientProof = (saltedPassword: Secret<u8[]>, authMessage: u8[]): u8[] =>
  exposeWith(saltedPassword, authMessage, scramClientProofExposed)

/**
 * ServerSignature, what the server's `v=` must equal (RFC 5802 §3). ServerKey
 * is wiped before it returns. Compare it to the server's with
 * `timingSafeEqual`.
 *
 * @param saltedPassword SaltedPassword from `scramSha256SaltedPassword`, read
 *   only inside `exposeWith`; still the caller's to wipe.
 * @param authMessage The same AuthMessage the proof was computed over.
 * @returns The 32-byte signature the server should send.
 */
export const scramSha256ServerSignature = (saltedPassword: Secret<u8[]>, authMessage: u8[]): u8[] =>
  exposeWith(saltedPassword, authMessage, scramServerSignatureExposed)
