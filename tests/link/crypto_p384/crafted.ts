// A key and signatures made for this suite with a hand-written ECDSA over
// P-384 (Python integers), so that any digest length can be signed: the
// suite's key (key 0) and G itself (key 1, private key 1). Every message is the
// ASCII "crafted message"; each case carries the digest it was signed over.
// Generated, not upstream; not copyrighted.

/** One crafted case: what it is, its key, the digest it signs, the `r || s` signature, and whether it verifies. */
export interface P384CraftedCase {
  name: string;
  key: number;
  digest: string;
  sig: string;
  verifies: boolean;
}

/** The two uncompressed public keys, in hex. */
export const craftedP384Keys = (): string[] => [
  "04370f126791a48158020f6d0f284bdddec0af8941523cfa6b780a206a7a1116ddbe088bd01c40a599258acb3f0fcc191b7cb9c9f96eb48b9ef25b2fed26324c117f5d4afbb088e5ece5e12519f34d1dcb7f56c1ee8bc248cd55f712bff017545e",
  "04aa87ca22be8b05378eb1c71ef320ad746e1d3b628ba79b9859f741e082542a385502f25dbf55296c3a545e3872760ab73617de4a96262c6f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e5f",
];

/** The cases. */
export const craftedP384Cases = (): P384CraftedCase[] => [
  { name: "SHA-384", key: 0, digest: "3be210a81c65e68446d953966b8f1e46bb3c0d7d489bece05e3c64bfce349688d1b8e2f45ff7fc0f2d1264845fe56b8b", sig: "0b85539687fd77822fe76f229c75f2eb6cfe9e908706b10fdd3332cb5dd95c7627b1eb0b03a8f137a60a36404ba55aa09d7eba3c1bf385834569ea8964a0f9c810a061f46ec6d47e7a807b2d537937e45664361bcbf4799a0ed8eaeb86d6306c", verifies: true },
  { name: "SHA-384 with s replaced by n - s", key: 0, digest: "3be210a81c65e68446d953966b8f1e46bb3c0d7d489bece05e3c64bfce349688d1b8e2f45ff7fc0f2d1264845fe56b8b", sig: "0b85539687fd77822fe76f229c75f2eb6cfe9e908706b10fdd3332cb5dd95c7627b1eb0b03a8f137a60a36404ba55aa0628145c3e40c7a7cba9615769b5f0637ef5f9e0b91392b814ce2d254a0bdf5fb01b5d7967cbc2de0de132e7f45eef907", verifies: true },
  { name: "SHA-256", key: 0, digest: "9a2f8cbe3925582bb266609dc5dbba26aa833e8341e05a2980d6e47c9c0d67e7", sig: "7fe4fad06c0f90a729b4e1ecf9fad9e56bab5cd6a320bc61072ce61677f0c8e8719cf44d1903f913564f15768f0a2a9bd74cdf0a70ffa1e13be53713c2bbcb7464b14db4b7f78c997d7d5a9331bbab86a3137eee3fd8a2bd45f627b9149ba42d", verifies: true },
  { name: "SHA-512, its leftmost 384 bits", key: 0, digest: "70727dbcf8d118a0040a2f654febea5c2b88f92ba1b136eab69a6bf72062e9894f9f891072e9021a035d6ed44ecbf16925d894e8c338cf7b1be399678cd1c67a", sig: "09d6aaaf51d63461634eb87ba7d4f0da0449794be30523e83ef2fa9187c2f63a0f3409be4a2a301dec5a507f22b843ed2b10de0e01e9b97721dbee8e3267bb90d163707ec1e489f3d2012e7b99f8f76eac2f182f0dd023283b3446b9484dac22", verifies: true },
  { name: "a 20-byte digest", key: 0, digest: "cd5f1f2c242f06cced5c281ab4f70845f967d788", sig: "a10d4360c04ae43951e3eed2904aa5525ffbed3b88a03e9f97b44e6a6a991f235234a59234380b74a53e66f8336a640678c3f900547df4625dbe86d5e3f7376534f2a9f1e5f2ac0025e6704bfbbd410bb8de47f3f5989a7a205551848b7ec55c", verifies: true },
  { name: "a 1-byte digest", key: 0, digest: "2a", sig: "a895935b563dc118e3c0a3f541f977d6c1ae6566d7639a94cb96137bf1b1552aebde3b252615ba82912b84b961050b2a53c6cbc41cc567f99c8df44c774d083ec7bd45e37a97c4234add0f614c9adc768e323b510860d49dab0d3dc3d9dbeed7", verifies: true },
  { name: "a digest of 48 FF bytes, above n", key: 0, digest: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", sig: "d6fedd192f74989ca1da0af70eefb44b09310621df6aba1a5c7bf16128318a6a4cf85a24e8d56fa8e5b65b590f4c31c44c3ae050a8d3c58ab42376bc168f08f1eff57655b84f8c0ff89743c7af56d11cf278e709ebcbd8ed6cef9db60985b7ad", verifies: true },
  { name: "SHA-384 under the key G (private key 1)", key: 1, digest: "3be210a81c65e68446d953966b8f1e46bb3c0d7d489bece05e3c64bfce349688d1b8e2f45ff7fc0f2d1264845fe56b8b", sig: "5eb67fdfd36d6c79b86305908fa7fff23d925153fe59e2a99b385e19d562fa2c3c248484b451208b3af7faa7ed8f8b80ac73f547ed7f861ff20cde0eb8ffaeab03e00dba7a5bb37c830bf8bb6fa83790181e022f401e5f64e226611dc3bd2278", verifies: true },
  { name: "under the key G, a digest of n - r and s = 1, which sums to the identity", key: 1, digest: "ffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77adab7c2f23c195b84", sig: "000000000000000000000000000000000000000000000000000000000000000000000000000000001234567890abcdef000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001", verifies: false },
  { name: "its twin with a digest of n - r + 1, which sums to G", key: 1, digest: "ffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77adab7c2f23c195b85", sig: "000000000000000000000000000000000000000000000000000000000000000000000000000000001234567890abcdef000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001", verifies: false },
];
