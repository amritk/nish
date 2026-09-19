// The template is declared but not exported, so there is nothing to import.
// WP18 G7 made a template importable; it did not make every template public.
const identity = <T>(x: T): T => x;

export const anchor = (): i32 => identity(1);
