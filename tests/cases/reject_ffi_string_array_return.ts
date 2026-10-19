// WP27 S3.2: a `string` result is copied out of C's `const char *`; a
// `string[]` would be a `char **` whose length and owner C alone knows, so
// the return position refuses it as the parameter position does.
declare function m(): string[];

export function main(): i32 {
  return 0;
}
