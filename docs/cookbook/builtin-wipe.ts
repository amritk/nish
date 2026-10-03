// #385: a key cleared once it is used. `secureZero` is one call into runtime.c,
// whose stores are `volatile`, so no pass drops them although nothing reads
// `key` again. The array is written through, so `nocapture` without `readonly`.
export const forget = (key: u8[]): void => {
  secureZero(key)
}
