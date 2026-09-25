// WP32 (docs/wp32-map.md §4.2): the first module to use a global collection
// uses `Set`, and only the third uses `Map`; `shapes.ts`'s own `Map` is still
// refused, naming the module that uses the global one (NL3030).
import { distinct } from "./uses_set";
import { area } from "./shapes";
import { counted } from "./uses_map";

export const main = (): i32 => distinct() + area() + counted();
