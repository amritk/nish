/**
 * A resolve hook for running `--emit-ts` output from this checkout: the
 * emitted modules import `nish/runtime` and `nish/runtime/node`, which an
 * install of the package provides and a checkout does not, so the suite maps
 * them onto `runtime/core.mjs` and `runtime/node.mjs` when Node's own
 * resolution fails. Loaded with `node --import <this file>`.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

const runtime = path.resolve(import.meta.dirname, "../../runtime");
const targets = {
  "nish/runtime": pathToFileURL(path.join(runtime, "core.mjs")).href,
  "nish/runtime/node": pathToFileURL(path.join(runtime, "node.mjs")).href,
};

const source = `
const targets = ${JSON.stringify(targets)};
export async function resolve(specifier, context, nextResolve) {
  if (Object.hasOwn(targets, specifier)) {
    try {
      return await nextResolve(specifier, context);
    } catch {
      return { url: targets[specifier], shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
`;

register(`data:text/javascript,${encodeURIComponent(source)}`);
