// NL3036: a `package.json` that mentions `nish` and stops being JSON is
// refused where it breaks, because the reader cannot vouch for a field in it.
export const main = (): i32 => 0;
