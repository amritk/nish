// NL2610: an outer string stored inside a literal the region allocates.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";

class Grant {
  host: string;
  constructor(host: string) {
    this.host = host;
  }
}

interface Game {
  host: string;
  hits: i32;
}

const open = (g: Grant): Game => {
  const game: Game = { host: g.host, hits: 0 };
  return game;
};

export const main = (): i32 => {
  const g = new Grant("example");
  const r = regionWith(g, open);
  free(r);
  return 0;
};
