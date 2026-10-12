// `std/crypto`'s wipes after `opt -O2` (`index.js` says what a group is and how
// a root's count is read). The counts are as LLVM 18's `opt -O2` leaves them,
// and each kind was checked by turning one wipe into ordinary stores and
// watching its roots' counts drop.

/** The modules that define HMAC, HKDF or SHA-2. */
const HMAC_HKDF_MODULES = /^define [^\n]*@nish\.(Hmac|hmac|Hkdf|hkdf|Sha|sha)/m

/** The modules that define AES or ChaCha20-Poly1305. */
const AEAD_MODULES = /^define [^\n]*@nish\.(Aes|aes|ghash|chacha20|poly1305)/m

export const wipeChecks = [
  // `nish/crypto/hmac` and `nish/crypto/hkdf` wipe what their keys reach (#476).
  // `crypto_hkdf_wycheproof` imports both modules. The roots: an HMAC
  // constructor 6 (the long-key path's hasher, three arrays, its hash and the
  // key block; the short path's key block), `digest` 7 (the inner digest, both
  // hashers' three arrays), HKDF's `expand` 15 (T(i) in the loop and the last
  // one, the constructor's 6, the digest's 7), the `Secret` HKDF 29 (the PRK,
  // `extract`'s one-shot HMAC, 13, and `expand`), and the `Secret`
  // HKDF-Expand-Label 15 (`expand`'s, the label being no secret). The scratch:
  // `begin` 16 (on the long-key path the key's digest, `keyBlocks` and the key
  // hash; on the short path `keyBlocks`, which wipes both hashers, six arrays,
  // and the pad), `finishInto` 2 (the inner digest, the tag's copy), `wipe` 6,
  // `HkdfScratch`'s `wipe` 13 (T(i) and both hashes' scratch), and the `*Into`
  // functions 49 or 50 (both hashes' `begin` and `finishInto`, and `hkdfWipe`;
  // `hkdfExtractInto` inlines `hkdfWipe` into both hash branches, so it reaches
  // 50 where its source writes 49).
  {
    name: "crypto_hmac crypto_hkdf: the wipes survive -O2 (HMAC's key blocks, hashed key, inner digest and hashers; HKDF's T(i) and PRK)",
    program: "tests/link/crypto_hkdf_wycheproof/main.ts",
    modules: HMAC_HKDF_MODULES,
    roots: [
      ["nish.HmacSha256.constructor", 6],
      ["nish.HmacSha384.constructor", 6],
      ["nish.HmacSha512.constructor", 6],
      ["nish.HmacSha256.digest", 7],
      ["nish.HmacSha384.digest", 7],
      ["nish.HmacSha512.digest", 7],
      ["nish.hkdfExpandSha256", 15],
      ["nish.hkdfExpandSha384", 15],
      ["nish.hkdfSha256Secret", 29],
      ["nish.hkdfSha384Secret", 29],
      ["nish.hkdfExpandLabelSha256Secret", 15],
      ["nish.hkdfExpandLabelSha384Secret", 15],
      ["nish.HmacSha256Scratch.begin", 16],
      ["nish.HmacSha384Scratch.begin", 16],
      ["nish.HmacSha256Scratch.finishInto", 2],
      ["nish.HmacSha384Scratch.finishInto", 2],
      ["nish.HmacSha256Scratch.wipe", 6],
      ["nish.HmacSha384Scratch.wipe", 6],
      ["nish.HkdfScratch.wipe", 13],
      ["nish.hkdfExtractInto", 50],
      ["nish.hkdfExpandInto", 49],
      ["nish.hkdfExpandLabelInto", 49],
    ],
  },
  // `nish/crypto/aes` and `nish/crypto/chacha20poly1305` (#430).
  // `crypto_aes_wipes` imports both modules. AES: `aesKeyWipe` 2 (the whole
  // of `roundKeys`, the kernels' powers of H included, and `h`); the
  // bitsliced key schedule's working copies, 3 (its words, its last round key
  // and the batch it packed), and the block H and E(K, J0) pass through, 2
  // (the batch and the bitsliced state), so `aesKeyInto` and `aesKey` 6 (the
  // schedule's 3, the block's 2 and the bytes of H) and every function that
  // encrypts one block 2. GCTR wipes its last batch of keystream and its
  // bitsliced state, 2, counted at `aesGcmCtr` because `opt` inlines the
  // seam's body into its one caller; the tag wipes E(K, J0)'s block besides
  // the block's 2, 3; so seal and open 5 (open runs GCTR only once the tag
  // has verified). On a CPU with the AES instructions the seams call
  // the runtime's kernels instead, and the counts are the bitsliced arm's,
  // which the branch keeps. ChaCha20-Poly1305: a keystream block, 1, wiped
  // by every run of the keystream; Poly1305's `r` and accumulator, 2; so the
  // one-shot functions 2 (the keystream and the state, or `r` and `h`), seal 6
  // (the state, the Poly1305 key, the tag's `r` and `h`, and two runs of the
  // keystream) and open 7 (the same, and the tag it compared; its state is
  // wiped on the refusal path and the success path alike, which `opt` sinks
  // into one store in the block both reach).
  {
    name: "crypto: the wipes survive opt -O2 (AES's key schedule, H and working copies; ChaCha20-Poly1305's state, keystream, Poly1305 key and accumulators)",
    program: "tests/link/crypto_aes_wipes/main.ts",
    modules: AEAD_MODULES,
    roots: [
      ["nish.aesKeyWipe", 2],
      ["nish.aesKey", 6],
      ["nish.aesKeyInto", 6],
      ["nish.aesEncryptBlock", 2],
      ["nish.aesHeaderMask", 2],
      ["nish.aesGcmCtr", 2],
      ["nish.aesGcmSeal", 5],
      ["nish.aesGcmOpen", 5],
      ["nish.chacha20XorInto", 1],
      ["nish.chacha20Block", 2],
      ["nish.chacha20", 2],
      ["nish.chacha20HeaderMask", 2],
      ["nish.poly1305", 2],
      ["nish.poly1305KeyGen", 2],
      ["nish.chacha20Poly1305Seal", 6],
      ["nish.chacha20Poly1305Open", 7],
    ],
  },
]
