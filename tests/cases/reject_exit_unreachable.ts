// `process.exit(n);` terminates the path like `return`, so code after it is unreachable.
function f(): number {
  process.exit(3);
  return 0;
}
