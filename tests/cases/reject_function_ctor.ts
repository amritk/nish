// Phase 0: `Function(...)` builds code at runtime and there is no interpreter.
export const f = (): number => {
  const g = Function("return 1");
  return 0;
};
