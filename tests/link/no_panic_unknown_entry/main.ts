// A `noPanic` entry that names no module of the program is refused where the
// manifest writes it (NL3031): `parser.ts` does not exist, and a typo must
// not leave the module it meant outside the scope in silence.
export const main = (): i32 => 0;
