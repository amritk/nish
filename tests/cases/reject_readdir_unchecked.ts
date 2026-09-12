// The result is `string[] | null`; it has to be narrowed before it is used, the
// same rule `readFileSyncOrNull` answers to. An unreadable directory would
// otherwise index a null pointer.
function f(dir: string): number {
  return readdirSync(dir).length;
}
