// Prints the nginx twin's extra routes as an `http`-level map, for build.sh to
// write beside nginx.conf as extra.conf. Each GET pattern and each POST to
// `<pattern>/submit` becomes one regex on "<method> <path>", tried in order, so
// a request matches exactly the routes extra-routes.mjs describes; nginx.conf's
// `location /` answers `ok` when $extra is 1.
import { extraRoutes } from "../extra-routes.mjs"

const regex = (method, pattern) =>
  `"~^${method} ${pattern
    .split("/")
    .map((segment) => (segment.startsWith(":") ? "[^/]+" : segment))
    .join("/")}$"`

const lines = extraRoutes.flatMap((pattern) => [
  `    ${regex("GET", pattern)} 1;`,
  `    ${regex("POST", `${pattern}/submit`)} 1;`,
])

process.stdout.write(`map "$request_method $uri" $extra {\n    default 0;\n${lines.join("\n")}\n}\n`)
