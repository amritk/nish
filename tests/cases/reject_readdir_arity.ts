// One path, and nothing else: there is no second argument to mean "recursive".
const f = (): boolean => {
  return readdirSync("build", "sub") === null;
};
