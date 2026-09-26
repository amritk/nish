const firstByte = (s: string): number => s.charCodeAt(0);

const head = (s: string, n: number): string => s.substring(0, n);

const has = (s: string, sub: string): boolean => s.startsWith(sub) || s.endsWith(sub);
