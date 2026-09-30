// Import attributes tell a host how to load a module that is not code; every
// module here is source the compiler reads, so there is nothing to tell it.
import { twice } from "./locals" with { type: "json" };

export const run = (): number => twice(2);
