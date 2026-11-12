# WP37: The OS sandbox

**State:** In progress · **Done:** 4 of 8 · **Design note:** [`docs/wp37-os-sandbox.md`](https://github.com/amritk/nish/blob/main/docs/wp37-os-sandbox.md)

## Stages

- [x] Stage 1: `--sandbox` and `--sandbox=best-effort`, with Landlock and seccomp
- [x] Stage 2: the `fs.read=<dir>` and `fs.write=<dir>` scopes
- [x] Dependency-grant scopes and the exec allowlist under `--sandbox`
- [x] Close SBX-1: the loader a granted program reaches can run any program
- [ ] Scopes in the `package.json` manifest *(deferred)*
- [ ] Refuse IFUNC resolvers at link time *(deferred)*
- [ ] `nish run` sandboxed by default *(deferred)*
- [ ] A seccomp allowlist mode, as its own flag *(deferred)*

## Next

The remaining stages are deferred; none is scheduled.

## Not planned

MacOS and Windows sandboxes, a `nish:sandbox` builtin.

[All work packages](index.md)
