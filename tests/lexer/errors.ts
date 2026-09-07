// The lexical errors, which the oracle cannot judge: the `typescript` scanner
// recovers from each of these and keeps going, and this lexer stops, because a
// dump that keeps guessing after an unterminated string is a dump nobody can
// diff. The golden is the message and the position it stops at.
const bad = "unterminated
