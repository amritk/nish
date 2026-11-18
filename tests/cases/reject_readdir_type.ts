// A path is a string. The argument is checked by type, and nothing converts one.
const f = (): boolean => {
  return readdirSync(1) === null;
};
