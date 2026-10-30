// `--sandbox` on a program that reaches no capability: the wrapper calls
// `nish_sandbox` from `.preinit_array` with an empty mask and strict mode, and
// `main` calls `nish_sandbox_check` before anything else.
export const main = (): number => {
  console.log("hello, confined")
  return 0
}
