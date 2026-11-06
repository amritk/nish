// Under Node the top-level code and the declarations share one module scope,
// so a variable of the code may not take a name the module declares.
const go = (): void => {
  console.log("go")
}
let go = 2
console.log(go)
