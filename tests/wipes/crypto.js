// `std/crypto`'s wipes after `opt -O2` (`index.js` says what a group is and how
// a root's count is read). The counts are as LLVM 18's `opt -O2` leaves them,
// and each kind was checked by turning one wipe into ordinary stores and
// watching its roots' counts drop.

/** The modules that define HMAC, HKDF or SHA-2. */
const HMAC_HKDF_MODULES = /^define [^\n]*@nish\.(Hmac|hmac|Hkdf|hkdf|Sha|sha)/m

/** The module that defines P-256. */
const P256_MODULES = /^define [^\n]*@nish\.(P256|p256)/m

/** The modules that define HMAC, HKDF, SHA-2, the TLS schedule and record layer, or QUIC packet protection. */
const HELD_DERIVE_MODULES = /^define [^\n]*@nish\.(Hmac|hmac|Hkdf|hkdf|Sha|sha|Tls|tls|quic)/m

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
  // the block's 2, 3; J0 for an IV that is not 12 bytes wipes its GHASH
  // state, 1; so seal 7 (J0's 1, GCTR's 2, the tag's 3 and J0 itself) and
  // open 8 (the same, and the tag it compared; it runs GCTR only once the tag
  // has verified, and wipes J0 once, after the branch, on both paths). On a
  // CPU with the AES instructions the seams call the runtime's kernels
  // instead, and the counts are the bitsliced arm's, which the branch keeps. ChaCha20-Poly1305: a keystream block, 1, wiped
  // by every run of the keystream; Poly1305's `r` and accumulator, 2; so the
  // one-shot functions 2 (the keystream and the state, or `r` and `h`), seal 6
  // (the state, the Poly1305 key, the tag's `r` and `h`, and two runs of the
  // keystream) and open 7 (the same, and the tag it compared). Open wipes its
  // state once, after the branch on the tag, rather than once on each path:
  // `opt` merges two such wipes into one store, and the count could not then
  // see either go missing. Each wipe of seal, open and J0, AES's and
  // ChaCha20-Poly1305's, was deleted in turn to show its root's count drop.
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
      ["nish.aesGcmJ0", 1],
      ["nish.aesGcmSeal", 7],
      ["nish.aesGcmOpen", 8],
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
  // `nish/crypto/p256`'s fixed-base comb (#628). `p256BaseMultWith` wipes the
  // entry it selected, `s.entry`'s three coordinates, 3, and its callers wipe
  // the scratch, the accumulator they hand it and the scalar's other
  // intermediates (ECC-2): `p256PublicKeyExposed` 18, `p256SignExposed` 93 and
  // `p256SignSha256Into` 56. `opt` inlines `p256BaseMult` into
  // `p256PublicKeyExposed` and `p256SignScalar`, and that into
  // `p256SignExposed`, so its wipes are counted there.
  {
    name: "crypto: the wipes survive opt -O2 (P-256's selected comb entry in p256BaseMultWith; the scratch and accumulator in p256PublicKeyExposed, p256SignExposed and p256SignSha256Into)",
    program: "tests/link/crypto_p256/main.ts",
    modules: P256_MODULES,
    roots: [
      ["nish.p256BaseMultWith", 3],
      ["nish.p256PublicKeyExposed", 18],
      ["nish.p256SignExposed", 93],
      ["nish.p256SignSha256Into", 56],
    ],
  },
  // The derivations into a held `Secret` (#668). Each derives into a fresh
  // plain buffer inside `exposeWith`, copies it into the held destination and
  // wipes it before it returns, so every root counts its own HKDF-Expand
  // wipes (the HMAC states, their pads and the plain output block) beside
  // that one buffer: `hkdfExpandLabel*Held` 31, a schedule step 62 to 91
  // (one Expand, or an Extract and an Expand), `installHeld` and
  // `tlsTrafficKeysFromHeld` their key and iv derivations, and `advanceHeld`
  // the ratchet and the install it reaches. The plain output's two wipes,
  // `hkdfHeld`'s (the held destinations) and `hkdfExpandLabelHeldInto`'s (the
  // plain AEAD keys and IVs), were each deleted in turn: between them every
  // root's count dropped, by one per derivation it reaches.
  {
    name: "crypto: the wipes survive opt -O2 (the plain output of each derivation into a held Secret in HKDF, the TLS schedule and record layer, and QUIC)",
    program: "tests/link/crypto_held_derive/main.ts",
    modules: HELD_DERIVE_MODULES,
    roots: [
      ["nish.hkdfExpandLabelSha256Held", 31],
      ["nish.hkdfExpandLabelSha384Held", 31],
      ["nish.hkdfExpandLabelHeldInto", 31],
      ["nish.tlsDeriveSecretHeld", 62],
      ["nish.tlsHandshakeSecretHeld", 90],
      ["nish.tlsMasterSecretHeld", 91],
      ["nish.tlsFinishedVerifyDataHeld", 89],
      ["nish.tlsTrafficKeysFromHeld", 62],
      ["nish.TlsRecordProtection.installHeld", 65],
      ["nish.TlsRecordProtection.advanceHeld", 127],
      ["nish.quicKeysHeldInto", 93],
      ["nish.quicKeyUpdateSecretHeldInto", 62],
    ],
  },
]
