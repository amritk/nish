// The shapes of the Wycheproof RSA vectors in this directory, which import them.

/** One test group's public key: its PKCS #1 `RSAPublicKey` DER in hex, its hash as Wycheproof names it, and its PSS salt length (-1 for PKCS #1 v1.5). */
export interface WycheproofRsaKey {
  der: string;
  sha: string;
  // `number` rather than `i32`, so the files compile in either number mode: a
  // bare literal in an object literal takes the mode's width.
  sLen: number;
}

/** One verification case: its id, its group's key by index, the expected result, and the message and signature in hex. */
export interface WycheproofRsaCase {
  tcId: number;
  key: number;
  result: string;
  msg: string;
  sig: string;
}
