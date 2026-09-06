export function argumentCount(): number {
  return process.argv.length - 1;
}

export function firstArgumentIsSet(): boolean {
  return process.argv[0].length > 0;
}
