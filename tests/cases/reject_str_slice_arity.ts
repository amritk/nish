// `slice` takes one or two byte offsets, like `substring`; there is no
// step or count argument.
const f = (s: string): string => s.slice(1, 2, 3);
