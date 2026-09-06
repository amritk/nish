// The concatenation is an arena temporary that dies with the call, so the
// function marks the arena on entry and releases it before returning.
function greet(name: string): void {
  console.log("hello, " + name + "!");
}

// The template is returned, so the caller owns it: no scope here.
function label(name: string): string {
  return `<${name}>`;
}
