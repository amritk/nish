// A wasm32 build schedules nothing of the host's.
export const lower = (): i32 => setNice(10);
