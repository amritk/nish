function passthrough(s: string): string {
  return s;
}

function wrapped(s: string): string {
  return `${s}`;
}

function printed(s: string): string {
  console.log(s);
  return "done";
}

function test(): number {
  console.log(wrapped(passthrough("pass")));
  console.log(printed("printed"));
  return 0;
}
