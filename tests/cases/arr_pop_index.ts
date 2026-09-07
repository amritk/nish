// `pop` shortens the array and hands back the last element; `indexOf`
// compares with `===`, so strings match by content and numbers by value.
function test(): number {
  const names: string[] = ["a", "b", "c"];
  const last = names.pop();
  const nums: number[] = [4, 8, 15];
  return (
    names.length * 100000 +
    names.indexOf("b") * 10000 +
    (last === "c" ? 1000 : 0) +
    (nums.indexOf(15) + 1) * 100 +
    (nums.indexOf(99) + 1) * 10 +
    (names.indexOf("c") + 1)
  );
}
