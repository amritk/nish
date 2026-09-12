// NL2069: `&&` in a constant folds booleans, and the message says so rather than reporting a type mismatch.
const FLAG: boolean = 1 && 2;
