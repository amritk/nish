// WP35: `getenv` is `env`, reached from `main` through `setting`. The value
// comes from `caps_env.env`, because the language has no `setenv`.
const setting = (name: string): string => {
  const value = getenv(name);
  return value === null ? "<unset>" : value;
};

export const main = (): number => {
  console.log(setting("NISH_CAPS_SETTING"));
  return 0;
};
