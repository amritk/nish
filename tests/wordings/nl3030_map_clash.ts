// NL3030: this module declares a class `Map` of its own, which is legal by
// itself, while `map_clash_global.ts` names the global one. A class name is
// program-wide, so the program cannot have both.
import { counted } from "./map_clash_global";

class Map {
  size: i32 = 0;
}

export const main = (): i32 => new Map().size + counted();
