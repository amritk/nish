// WP40 B1.1: a rest `u8[]` parameter is refused by its form before its type
// is read, so a variadic byte list never reaches the buffer rules.
declare function emit(...bytes: u8[]): i32;

export const main = (): i32 => 0;
