// An alias defined in terms of itself has no type to resolve to; it is caught
// rather than followed, exactly as a module constant's fold is.
type Feet = Metres;
type Metres = Feet;

export const test = (): number => {
  const d: Feet = 1;
  return d;
};
