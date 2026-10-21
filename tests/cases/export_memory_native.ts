// #643: only a wasm module exports its linear memory as `memory`, so a native
// build keeps an exported function of that name (`reject_export_wasm_memory`).
export const memory = (n: i32): i32 => n + 1;

export const main = (): i32 => {
  console.log(`${memory(41)}`);
  return 0;
};
