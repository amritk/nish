// `--deny fs.read` refuses a program whose `main` reaches `fs.read` through a
// helper (NL2459): spanned at `main`'s call, with the whole chain named.
const settings = (): string => readFileSync("settings.txt");

export const main = (): number => settings().length;
