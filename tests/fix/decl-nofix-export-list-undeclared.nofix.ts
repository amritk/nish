// One name of the list is declared nowhere here, so the whole list keeps its
// error rather than half of it moving.
const f = (): i32 => 1
export { f, h }
