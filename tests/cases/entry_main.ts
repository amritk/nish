function compute(): number {
  return 20 + 22;
}

// The entry: emitted as @amrit_main and wrapped by a C-ABI @main that returns
// this value as the process exit code (0 here so the harness sees success).
export function main(): number {
  return compute() - 42;
}
