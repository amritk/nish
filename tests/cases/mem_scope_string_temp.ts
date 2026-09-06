// String temporaries (WP6): concatenations and templates that are only printed
// are released by the function's arena scope; a returned string disables it.
function label(i: number, name: string): string {
  return `${name}#${i}`; // returned: no scope here, the caller owns the string
}

function greet(name: string, times: number): void {
  for (let i = 0; i < times; i++) {
    const line = "hello, " + label(i, name) + "!";
    if (i === times - 1) {
      console.log(line);
    }
  }
}

export function main(): number {
  greet("world", 3);
  const before = Arena.used();
  greet("again", 50000);
  console.log(Arena.used() === before);
  return 0;
}
