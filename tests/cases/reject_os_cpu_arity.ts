// WP34 N12: `availableParallelism` asks the host, and takes nothing.
export const main = (): i32 => {
  return availableParallelism(4);
};
