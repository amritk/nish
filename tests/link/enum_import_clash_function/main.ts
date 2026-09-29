// The clash the other way round: the import binds `Kind` before any function
// is collected, so the local function is the second declaration.
import { Kind } from "./kinds";

const Kind = (): i32 => 1;

export const main = (): number => Kind();
