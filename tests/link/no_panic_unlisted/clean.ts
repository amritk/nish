// Listed in `noPanic`, and clean: the index is guarded.
export const firstField = (fields: i32[], at: i32): i32 => {
  if (at >= 0 && at < fields.length) {
    return fields[at];
  }
  return 0;
};
