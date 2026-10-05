// NL3036: a second top-level `"nish"` is refused at its key even when it is
// spelled with an escape, because the key decodes to the same name.
import { dial } from "./client";

export const main = (): number => (dial(8080) ? 0 : 1);
