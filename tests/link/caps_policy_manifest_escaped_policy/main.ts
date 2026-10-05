// A `capabilities` key written with a JSON escape is decoded as JSON.parse
// decodes it, so the `deny` behind it is honoured: the program that reaches
// `net` is refused (NL2459).
import { dial } from "./client";

export const main = (): number => (dial(8080) ? 0 : 1);
