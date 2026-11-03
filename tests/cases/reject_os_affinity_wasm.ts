// A wasm32 build schedules nothing of the host's, so it pins no CPU either.
export const pin = (): i32 => setCpuAffinity(0);
