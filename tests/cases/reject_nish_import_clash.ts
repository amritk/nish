// The point of being able to import a builtin: it cannot be silently taken
// over. As a global, a user `panic` replaces the builtin and nothing says so;
// imported, declaring one is a collision at the import.
import { panic } from "nish:io";

const panic = (message: string): void => {
  write(message);
};

export const main = (): number => 0;
