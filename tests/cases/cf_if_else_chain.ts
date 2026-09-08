function grade(score: number): number {
  if (score >= 90) {
    return 4;
  } else if (score >= 80) {
    return 3;
  } else if (score >= 70) {
    return 2;
  } else {
    return 1;
  }
}

export function test(): number {
  return grade(95) * 1000 + grade(85) * 100 + grade(75) * 10 + grade(10);
}
