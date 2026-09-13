// A type-only import asks for something the emitter has no symbol for.
import type { twice } from "./other";

export const run = (): number => twice(2);
