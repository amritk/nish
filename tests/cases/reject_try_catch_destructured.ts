// A destructuring catch binding, an object pattern and an array pattern, each
// with an annotation or without. The parser reads any binding TypeScript
// allows, so Phase 0 refuses the statement by its rule (NL1033), once, rather
// than the parser stopping at the pattern.
export const main = (): i32 => {
  try {
    return 1;
  } catch ({ message }) {
    return 2;
  }
};

export const second = (): i32 => {
  try
  {
    return 1;
  }
  catch ([first]: string[])
  {
    return 2;
  }
};
