const f = (o: number): number => {
  with (o) { }
  return 1;
};
