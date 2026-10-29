// A wasm32 build that imports `nish/crypto/pki-roots` is refused: the module
// reads the file system and the environment, and a wasm32 build has neither
// (docs/security/crypto-pki.md, PKI-R4).
import { pkiLoadSystemRoots } from "nish/crypto/pki-roots"

export const main = (): i32 => pkiLoadSystemRoots().skipped
