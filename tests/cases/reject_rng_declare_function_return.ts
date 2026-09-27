// WP31 §9: the same for a return type, which would be a promise from C that
// this compiler would then trust.
declare function rand(): integer<0, 32767>

export const main = (): number => rand()
