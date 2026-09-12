// A path is a string. The argument is checked by type, and nothing converts one.
function f(): boolean {
  return readdirSync(1) === null;
}
