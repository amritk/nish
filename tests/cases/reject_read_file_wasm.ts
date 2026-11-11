// WP21 S3: `readFileSync` has no runtime on freestanding wasm32. The exported
// function reaches it, so the build is refused rather than left to the link.
export const size = (): i32 => readFileSync("settings.conf").length;
