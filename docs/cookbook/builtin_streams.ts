function report(problem: string): void {
  console.error(problem);
  write("progress: ");
  writeError(problem);
}

function load(path: string): number {
  const text = readFileSyncOrNull(path);
  if (text === null) {
    panic(`cannot read ${path}`);
  } else {
    return text.length;
  }
}
