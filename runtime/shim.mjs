/**
 * Nish builtins for Node: the host-agnostic core (`runtime/core.mjs`, whose
 * header lists the semantics) with the Node host (`runtime/node.mjs`)
 * installed. The differential runner and `runtime/nish.mjs` import this module,
 * and the frozen rewrites name its exports.
 */
import "./node.mjs";

export * from "./core.mjs";
