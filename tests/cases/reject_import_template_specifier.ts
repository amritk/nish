// The specifier is resolved at compile time, so it is a plain string.
import { twice } from `./other`;

export const run = (): number => twice(2);
