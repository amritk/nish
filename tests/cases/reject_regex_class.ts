// A regex that opens with `/=` and holds a `/` inside a class and another
// escaped is still one literal: the parser asks the lexer to read it as one
// where an operand is due.
export const run = (): boolean => /=[/]\//g.test("=/")
