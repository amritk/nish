// Generic aliases stay forbidden: an alias only renames a type that already
// exists, so there is nothing for a type argument to apply to. WP18 §2.
type Box<T> = T[];

export const test = (): number => 0;
