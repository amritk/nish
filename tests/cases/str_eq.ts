function same(a: string, b: string): boolean {
  return a === b;
}

function differ(a: string, b: string): boolean {
  return a !== b;
}

export function test(): number {
  console.log(same("abc", "abc"));
  console.log(same("abc", "abd"));
  console.log(differ("x", "y"));
  return 0;
}
