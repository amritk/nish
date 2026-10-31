// `unixListen` takes its flags word: there is no optional third argument.
export const main = (): number => unixListen("@nish", 4);
