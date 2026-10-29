// A wasm32 build schedules nothing of the host's.
export const idle = (): i32 => setIdlePriority();
