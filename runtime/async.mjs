// `nish:async` under Node (WP49): what `nish --emit-ts` writes an async
// program against, and what `runtime/nish.mjs` answers `nish:async` with. A
// file of its own, not `nish/runtime`, because `nish:process` has a `spawn`
// there already.
//
// `awaitAll` is `Promise.all` over its two to eight tasks. `spawn` starts a
// task without awaiting it and keeps it, so the launcher's `settleTasks` waits
// for every task started before the process exits, as the native driver
// drains its queue after `main` answers. Node runs a task only until its first
// `await` where native runs it until it first waits, so spawned tasks may print
// in another order (`docs/RUN_UNDER_NODE.md`). A task that throws is Node's
// unhandled rejection, which exits 1 as a native panic does.

const pending = [];

export const spawn = (task) => {
  pending.push(task);
};

export const awaitAll = (...tasks) => Promise.all(tasks);

export const settleTasks = async () => {
  for (let i = 0; i < pending.length; i++) {
    await pending[i];
  }
  pending.length = 0;
};
