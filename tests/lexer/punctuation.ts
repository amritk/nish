// Every operator, including the ones Nish refuses. The lexer says what is
// written; the parser is where `??`, `?.`, `**` and `==` are turned down.
a ?? b;
a ?.b;
a ? .5 : b;
a ??= b;
a &&= b;
a ||= b;
a ** b;
a **= b;
a == b;
a != b;
a === b;
a !== b;
x >>>= 1;
x >>= 1;
x <<= 1;
x >>> 1;
x >> 1;
x << 1;
x >= 1;
x <= 1;
f(...xs);
obj?.[k];
obj?.(1);
@decorator
class K {
  #secret = 1;
  m() {
    return this.#secret;
  }
}
