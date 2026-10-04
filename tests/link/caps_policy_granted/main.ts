// A program that reaches only what `--allow fs.read,exit` grants compiles to
// the binary it compiles to without the policy, and runs (WP36,
// docs/wp36-capability-policy.md): `fs.read` through a helper module, `exit`
// in `main` itself.
import { exists } from "./probe";

export const main = (): number => {
  console.log(exists("/nonexistent/caps-policy-granted") ? "present" : "absent");
  if (process.argv.length > 8) {
    process.exit(2);
  }
  return 0;
};
