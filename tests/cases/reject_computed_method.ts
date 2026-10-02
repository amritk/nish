// A method in an object literal is refused (NL2258), but a computed name is Phase 0's and comes first (NL1041).
function f(k: string): number { const o = { [k]() { return 1; } }; return 1; }
