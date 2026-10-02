// The HMAC verifiers against every wrong tag length and every bit flip, under
// `--number-mode i32`; `checks.ts` says why.
import { verifyChecks } from "./checks";

export const main = (): i32 => verifyChecks();
