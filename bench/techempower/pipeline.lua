-- wrk sends `depth` copies of its request in one write and counts each
-- response, as TechEmpower's plaintext test does with a depth of 16:
--
--   wrk -s pipeline.lua http://127.0.0.1:8080/plaintext -- 16
local burst

init = function(args)
  local depth = tonumber(args[1]) or 1
  local one = wrk.format()
  local copies = {}
  for k = 1, depth do
    copies[k] = one
  end
  burst = table.concat(copies)
end

request = function()
  return burst
end
