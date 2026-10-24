// A `--sandbox` program granted process.spawn and nothing else: tests/run.js
// runs it through `nish run`, and the child it starts inherits the filter and
// no_new_privs, so the NoNewPrivs and Seccomp lines grep prints are the
// parent's too.
export const main = (): number => {
  return spawnSync(["grep", "-E", "^(NoNewPrivs|Seccomp):", "/proc/self/status"])
}
