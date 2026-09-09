// `getenv` answers `string | null`, and the null half is the point: an unset
// variable is not an empty string. So the result has to be narrowed before it
// is used, exactly as `readFileSyncOrNull`'s is
// (`reject_readfile_or_null_unchecked`).
export function main(): number {
  return getenv("CC").length;
}
