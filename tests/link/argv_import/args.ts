export const argumentCount = (): number => {
  return process.argv.length - 1;
};

export const firstArgumentIsSet = (): boolean => {
  return process.argv[0].length > 0;
};
