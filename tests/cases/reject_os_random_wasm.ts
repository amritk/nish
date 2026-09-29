// WP34 N3: no entropy source on a wasm32 build.
export const fill = (b: u8[]): void => {
  crypto.getRandomValues(b);
};
