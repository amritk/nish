// A `#!` line is trivia only at offset 0. Here it follows this comment, so it
// is not a shebang, to the kernel or to the lexer, and `#` is a syntax error.
#!/usr/bin/env -S nish run
export const main = (): number => 0;
