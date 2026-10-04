// `grid[r][c]` is two sites. The inner array holds numbers, so the access to it
// is rewritten; `grid[r]` reads an array, which `uncheckedGet` cannot, so it
// keeps its warning and stays an index.
export const cell = (grid: i32[][], r: i32, c: i32): i32 => grid[r][c]
