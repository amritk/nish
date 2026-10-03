const load = (path: string): string => readFileSync(path)

export const lineCount = (path: string): i32 => {
  const text = load(path)
  let lines = 0
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      lines = lines + 1
    }
  }
  return lines
}

export const main = (): number => {
  console.log(lineCount("settings.txt"))
  return 0
}
