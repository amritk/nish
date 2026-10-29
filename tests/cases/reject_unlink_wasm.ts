// `unlinkSync` is refused on freestanding wasm32 as `renameSync` is.
export const remove = (): i32 => unlinkSync("a");
