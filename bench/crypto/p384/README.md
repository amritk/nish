# The p384 family

ECDSA verification over P-384 with SHA-384, `nish/crypto/p384` against
`node:crypto`. The harness in [`../README.md`](../README.md) gives the program
contract, the input stream and the `family.json` schema.

## The kernel and its inputs

| Kernel | Key | Message | Before the clock | One iteration | Output folded |
| --- | --- | --- | --- | --- | --- |
| `p384-verify` | 48 bytes, the private scalar | `size` bytes | the ring | SHA-384 of ring entry `i % 16`, then ECDSA's verify | the 97-byte uncompressed public key first, then one byte per verify: 1 true, 0 false |

The ring is 16 messages, the drawn message with its first four bytes tweaked by
`j` for entry `j`, each signed with the key in IEEE P1363 form (`r || s`, 96
bytes). Entry 1's last byte is flipped after it is signed, so its verify must
answer false; a twin that answers otherwise exits 1. The size is 64.

**Why the signatures are embedded.** `nish/crypto/p384` verifies and cannot
sign, and it cannot derive a public key either. So `main.ts` carries the public
key and the ring's 16 signatures as hex, made once by `ring.mjs` with
`node:crypto` for 64-byte messages; it refuses any other size. `node.mjs` signs
its own ring with the same key before the clock starts. ECDSA's signatures are
randomised, so the two rings differ byte for byte, but both verify the same
way, and the fold is the public key and the verdicts alone, so the checksums
agree. Run `node bench/crypto/p384/ring.mjs` and paste its output over
`main.ts`'s `PUB` and `RING_SIGS` if the input stream changes.

## The programs

| File | Twin | Calls |
| --- | --- | --- |
| `main.ts` | Nish | `p384VerifySha384` from `nish/crypto/p384`. |
| `node.mjs` | `node:crypto` | `sign` and `verify` with `"sha384"` and `dsaEncoding: "ieee-p1363"`; the key comes in as a SEC1 ECPrivateKey. |
| `key.mjs` | — | The key and the ring's messages, shared by `node.mjs` and `ring.mjs`. |
| `ring.mjs` | — | Prints `main.ts`'s embedded public key and signatures. |

There is no OpenSSL, Go or Rust twin yet: the family was written to measure
`nish/crypto/p384` against `node:crypto`, which is OpenSSL's libcrypto with its
assembly. `nish/crypto/p384` is variable-time and unoptimised (Fermat
inversions, fiat-crypto's portable field code, a Shamir double-scalar
multiply with no window), so the gap to Node is expected; see
[`docs/security/crypto-ecc.md`](../../../docs/security/crypto-ecc.md).
