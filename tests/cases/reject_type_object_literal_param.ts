// An inline object type is refused wherever a type is written: a parameter
// names a declared `interface` or `class` instead.
export const getX = (p: { x: i32 }): i32 => p.x;
