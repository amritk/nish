// An array element is arena memory the escape analysis walks, exactly as a
// field is, so a foreign pointer cannot be one.
export const main = (): i32 => {
  const handles: CPtr[] = [];
  return handles.length;
};
