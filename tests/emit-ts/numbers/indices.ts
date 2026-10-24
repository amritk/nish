// An i64 or u64 index of a string method goes through `Number` as an
// argument of its own, so the strings row still turns the call into its byte
// offset helper: under Node, `"héllo".slice(0, 3)` would count UTF-16 units.
export const main = (): i32 => {
  const s = "héllo wörld"
  const three: i64 = 3
  const one: u64 = 1
  console.log(s.slice(0, three))
  console.log(s.substring(one, three + 1))
  console.log(`${s.indexOf("l", three)} ${s.charCodeAt(three - 1)}`)
  console.log(s.slice(three * 2))
  return 0
}
