// The classes the suite decodes and encodes: every field kind the route
// writes code for, nested three deep, with arrays of objects and `| null`
// fields at each level.

export class Player {
  name: string = "";
  score: i32 = 0;
  rating: f64 = 0;
  tags: string[];

  constructor() {
    this.tags = [];
  }
}

export class Team {
  id: u32 = 0;
  players: Player[];
  captain: Player | null = null;

  constructor() {
    this.players = [];
  }
}

export class Match {
  id: i64 = 0;
  live: boolean = false;
  title: string | null = null;
  home: Team;
  away: Team | null = null;
  scores: i32[];
  odds: f64[] | null = null;
  flags: boolean[];
  ids: u32[];
  big: i64[];
  notes: string[] | null = null;

  constructor() {
    this.home = new Team();
    this.scores = [];
    this.flags = [];
    this.ids = [];
    this.big = [];
  }
}

/** An array of scalars, and an array of objects that may be `null`. */
export class Lists {
  xs: i32[];
  members: Player[] | null = null;

  constructor() {
    this.xs = [];
  }
}

/** One of each scalar, for the range and type checks. */
export class Scalars {
  a: i32 = 0;
  b: u32 = 0;
  c: i64 = 0;
  d: f64 = 0;
  e: boolean = false;
  f: string = "";
}

/** A list that can hold itself, for the encoding that has no end. */
export class Chain {
  id: i32 = 0;
  next: Chain | null = null;
  links: Chain[];

  constructor() {
    this.links = [];
  }
}
