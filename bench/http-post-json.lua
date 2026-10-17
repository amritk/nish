-- wrk script for bench/http.mjs's post-json scenarios: every request is a POST
-- whose body is the file NISH_HTTP_PAYLOAD names, bench/http-payload.json
-- unless set, sent as application/json. The path is the URL's.
local path = os.getenv("NISH_HTTP_PAYLOAD") or "bench/http-payload.json"
local file = assert(io.open(path, "rb"))
local payload = file:read("*a")
file:close()

wrk.method = "POST"
wrk.body = payload
wrk.headers["Content-Type"] = "application/json"
