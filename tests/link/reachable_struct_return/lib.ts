export class Token {
  kind: number;

  constructor(kind: number) {
    this.kind = kind;
  }

  describe(): string {
    return `token ${this.kind}`;
  }
}

// A free function that hands out `Token` values. An importer of `lex` alone
// never writes `Token`, and still holds, calls and reads one.
export function lex(kind: number): Token {
  return new Token(kind);
}
