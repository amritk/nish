// HKDF-Expand at its bounds under `--number-mode i32`; `checks.ts` says which.
import { boundsChecks } from "./checks";

export const main = (): i32 => boundsChecks();
