// NL2191: A module constant is a compile-time value folded into each use, so a pattern has no receiver to read.
const { x } = { x: 1 };
