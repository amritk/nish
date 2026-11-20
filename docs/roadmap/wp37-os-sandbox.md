# WP37: The OS sandbox

**State:** Landed · **Open work:** [#1909](https://github.com/amritk/nish/issues/1909) · **Design note:** [`docs/wp37-os-sandbox.md`](https://github.com/amritk/nish/blob/main/docs/wp37-os-sandbox.md)

## Stages

- [x] Stage 1: `--sandbox` and `--sandbox=best-effort`, with Landlock and seccomp
- [x] Stage 2: the `fs.read=<dir>` and `fs.write=<dir>` scopes
- [x] Dependency-grant scopes and the exec allowlist under `--sandbox`
- [x] Close SBX-1: the loader a granted program reaches can run any program, as a spawn target and from the granted program's own exec (one exec per spawn)
- [x] `process.spawn=exec:<program>`: a grant that lets one program start helpers, outside the one-exec hold

## Open work

Open stages are the sub-issues of [#1909](https://github.com/amritk/nish/issues/1909), one pull request each, specified in [`.claude/plans/wp37-os-sandbox.plan.md`](https://github.com/amritk/nish/blob/main/.claude/plans/wp37-os-sandbox.plan.md). What waits on a decision is labelled `needs-decision` there.

## Not planned

MacOS and Windows sandboxes, a `nish:sandbox` builtin.

[All work packages](index.md)
