// Top-level code that ends by exiting: the code runs as a `void` `main`, so
// the exit status is the one `process.exit` gives, and nothing after it runs.
const code = 0
console.log("before")
if (code === 0) {
  process.exit(code)
}
console.log("never")
