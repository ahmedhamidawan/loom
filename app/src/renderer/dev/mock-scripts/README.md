# Mock scripts

Scripts that `orbitMock.use("<name>")` plays into the renderer instead of the
brain (see `../agent-mock.ts`). `<name>` is the file name without `.jsonl`.

Two ways to make one:

- **Record a live run** (exact): open Orbit with `?mock-record`, or run
  `orbitMock.record()` in devtools, use it normally, then
  `orbitMock.save("<name>")` and move the download here.
- **Convert a pi session** (close, no model needed):
  `node scripts/pi-session-to-mock.mjs ~/.pi/agent/sessions/<dir>/<file>.jsonl <name>`

Files here are gitignored because they hold real Galaxy data. To share one,
scrub it first and `git add -f` it.
