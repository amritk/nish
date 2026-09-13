// An interface is a layout: inheritance would put the fields somewhere a reader cannot see.
export interface Base {
  x: number;
}

export interface Point extends Base {
  y: number;
}
