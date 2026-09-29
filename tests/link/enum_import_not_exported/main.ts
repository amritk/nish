// `kinds.ts` declares `Kind` without `export`, so importing it is the
// not-exported mistake, in the words an unexported function or class gets.
import { Kind, weight } from "./kinds";

export const main = (): number => weight(Kind.B);
