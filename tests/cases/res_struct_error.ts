// An interface as the error payload: `Result<i32, IoError>` monomorphises to
// `%struct.sts_result.i32.$IoError = type { i1, i32, %struct.IoError* }`, and
// the importer of a signature mentioning it gets `IoError`'s layout through the
// `Result` even though the name appears nowhere in its own source.
interface IoError {
  code: i32;
  path: string;
}

function openFile(path: string): Result<i32, IoError> {
  if (path === "") {
    const problem: IoError = { code: 2, path: path };
    return Err(problem);
  }
  return Ok(3);
}

function describe(path: string): string {
  const opened = openFile(path);
  if (opened.isErr()) {
    const failure = opened.error;
    return `error ${failure.code}`;
  }
  return `fd ${opened.value}`;
}

export function main(): i32 {
  console.log(describe("/etc/hosts"));
  console.log(describe(""));
  return 0;
}
