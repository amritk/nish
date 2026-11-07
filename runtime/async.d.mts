// The declarations of `runtime/async.mjs`, `nish:async` under Node.

/** Starts `task` without waiting for it; the launcher waits before it exits. */
export declare function spawn(task: Promise<void>): void;
/** Every task's answer, in the order the calls are written, once all of them finish. */
export declare function awaitAll<A, B>(a: Promise<A>, b: Promise<B>): Promise<[A, B]>;
export declare function awaitAll<A, B, C>(a: Promise<A>, b: Promise<B>, c: Promise<C>): Promise<[A, B, C]>;
export declare function awaitAll<A, B, C, D>(
  a: Promise<A>,
  b: Promise<B>,
  c: Promise<C>,
  d: Promise<D>,
): Promise<[A, B, C, D]>;
export declare function awaitAll<A, B, C, D, E>(
  a: Promise<A>,
  b: Promise<B>,
  c: Promise<C>,
  d: Promise<D>,
  e: Promise<E>,
): Promise<[A, B, C, D, E]>;
export declare function awaitAll<A, B, C, D, E, F>(
  a: Promise<A>,
  b: Promise<B>,
  c: Promise<C>,
  d: Promise<D>,
  e: Promise<E>,
  f: Promise<F>,
): Promise<[A, B, C, D, E, F]>;
export declare function awaitAll<A, B, C, D, E, F, G>(
  a: Promise<A>,
  b: Promise<B>,
  c: Promise<C>,
  d: Promise<D>,
  e: Promise<E>,
  f: Promise<F>,
  g: Promise<G>,
): Promise<[A, B, C, D, E, F, G]>;
export declare function awaitAll<A, B, C, D, E, F, G, H>(
  a: Promise<A>,
  b: Promise<B>,
  c: Promise<C>,
  d: Promise<D>,
  e: Promise<E>,
  f: Promise<F>,
  g: Promise<G>,
  h: Promise<H>,
): Promise<[A, B, C, D, E, F, G, H]>;
/** Waits for every task `spawn` started, the tasks those tasks start included. */
export declare function settleTasks(): Promise<void>;
