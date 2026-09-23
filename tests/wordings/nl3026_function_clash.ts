// NL3026: `hidden` is exported by neither module, and still clashes with
// `nl3_clash/lib.ts`'s, because the whole-program attribute analysis is keyed
// by symbol name and a module-private function has no prefix of its own.
import { anchor } from "./nl3_clash/lib";

const hidden = (): i32 => 4;

export const main = (): i32 => hidden() + anchor();
