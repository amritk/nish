---
name: WP92 — std/ui, a signals-driven UI library on std/gfx
overview: std/ui keeps its state in a fine-grained signals graph (a port of alien-signals as std/signals) whose derivations, effects and handlers are top-level functions over a typed per-node context, and builds on it a retained widget library — flexbox layout, TrueType text, a CPU reference painter then a GPU SDF renderer, input and focus, DTCG design tokens, scrolling lists, text input, a game HUD pack and accessibility — that redraws only what a signal write dirtied, within a 240 Hz frame budget.
priority: 280
labels: [ready]
issue: 2417
stages:
  - id: s1-design
    title: WP92 S1 — the signals design note
    goal: docs/wp92-signals.md settles the graph, the Rt, Signal, Store and bridge API, memory, the dirty-marking rules and the four scenarios, each with a compiled sketch or a measurement
    verification: Every sketch the note quotes compiles (or refuses with the code it names) under build/seed/bin/nish run, the string-growth figure is re-measured, and node docs/check-links.mjs passes
    issue: 2418
    todos:
      - id: s1-note
        content: Write docs/wp92-signals.md — algorithm, API, memory, dirty rules, scenarios, rejected models — see WP92 S1
        status: pending
      - id: s1-sketches
        content: Re-run the probe sketches and the dispatch bench on the current seed and record each result in the note — see WP92 S1
        status: pending
  - id: s2-signals
    title: WP92 S2 — std/signals, the reactive runtime
    goal: std/signals.ts ships Rt, Signal, Store with computeds, effects and handlers, batch, effect scopes and dispose, ported from alien-signals with its notice, and the ported tests pass natively
    verification: The tests/cases signals programs pass with goldens and llvm-as, the ported alien-signals suite passes under std/testing, the string-growth check stays inside its bound, node tests/run.js third-party-licence passes, and node scripts/gen-reference.mjs --check passes
    issue: 2419
    todos:
      - id: s2-graph
        content: Add std/signals.ts — Rt with the flat link arrays, flags, propagate, checkDirty, batch and the effect queue — see WP92 S2
        status: pending
      - id: s2-store
        content: Add Signal and Store in std/signals.ts — typed contexts, function columns, cut-off, handlers as nodes, scopes and dispose — see WP92 S2
        status: pending
      - id: s2-notice
        content: Add std/LICENSE-alien-signals, its THIRD_PARTY_NOTICES.md entries and its name in the three release.yml presence gates — see WP92 S2
        status: pending
      - id: s2-tests
        content: Port alien-signals' tests to tests/cases signals programs with the upstream notice, and add the string-growth check — see WP92 S2
        status: pending
      - id: s2-docs
        content: Register signals in src/std-modules.ts, std/README.md and standard-library.md, add docs/guide/using-nish/signals.md with its route, regenerate docs/reference and the goldens — see WP92 S2
        status: pending
  - id: s3-bindings
    title: WP92 S3 — headless UI bindings and dirty marking
    goal: A retained UiNode's chained setters take a plain value, a Signal or a computed node, bindings mark the node layout- or paint-dirty when the value changes, and the four scenarios run headless
    verification: node tests/run.js ui_ passes, each scenario program asserts which nodes are dirty after each write, an unchanged write marks nothing, and requestRedraw fires once per flush
    issue: 2420
    todos:
      - id: s3-uinode
        content: Add std/ui/node.ts — UiNode with chained setters that bind Signal or computed nodes — see WP92 S3
        status: pending
      - id: s3-dirty
        content: Add std/ui/dirty.ts — the layout and paint dirty queues, the flush order and the requestRedraw hook — see WP92 S3
        status: pending
      - id: s3-scenarios
        content: Add the virtualList, textInput, theme hot-swap and HUD scenario programs to tests/cases and register them as differential goldens — see WP92 S3
        status: pending
      - id: s3-docs
        content: Register ui/node and ui/dirty in src/std-modules.ts, add docs/guide/using-nish/ui.md with its route, regenerate docs/reference and the goldens — see WP92 S3
        status: pending
  - id: s4-gfx-loop
    title: WP92 S4 — std/ui on the std/gfx idle loop
    goal: A std/ui app runs on runApp's wait-for-events mode, sleeping while nothing is dirty and drawing only dirty nodes, natively and in the browser
    verification: An example UI app idles at the CPU figure WP89 S9 pins, a click redraws within one frame, and the HUD example keeps the game loop's rate
    issue: 2421
    todos:
      - id: s4-runner
        content: Connect the std/ui dirty queue to runApp's requestRedraw and idle mode in std/ui/app.ts — see WP92 S4
        status: pending
      - id: s4-examples
        content: Add examples/ui/todos.ts and examples/ui/hud.ts on both backends — see WP92 S4
        status: pending
      - id: s4-docs-security
        content: Register ui/app, extend the ui guide page and docs/reference, and name std/ui/app.ts in docs/security/gfx.md's scope — see WP92 S4
        status: pending
  - id: s5-direct-api
    title: WP92 S5 — passing derivations directly once generic function-type aliases land
    goal: Store's methods take the derivation or handler as an argument, as in a.perTodo.computedStr(t, rowLabel) and a.perTodo.handler(t, toggle), and the staging fields go
    verification: The S2 and S3 programs are rewritten to the direct form and pass, the staging fields are gone, and the guide page shows only the direct form
    issue: 2422
    todos:
      - id: s5-api
        content: Replace the staging fields in std/signals.ts and std/ui/node.ts with method parameters typed through Derive — see WP92 S5
        status: pending
      - id: s5-docs
        content: Rewrite the tests, examples and docs/guide/using-nish/signals.md to the direct form — see WP92 S5
        status: pending
  - id: s6-layout
    title: WP92 S6 — flexbox layout
    goal: std/ui/layout.ts lays out the UiNode tree by the CSS flexbox algorithm over flat per-node arrays, re-laying out only the dirty subtrees the S3 flush hands it, and replaces the S3 layout stub
    verification: The ported Taffy fixtures pass in tests/cases/ui_layout_*.ts, a dirty-subtree relayout touches only the nodes the scenario names, and bench/ui-layout records a 10k-node full and incremental layout in docs/BENCHMARKS.md
    issue: 2428
    todos:
      - id: s6-engine
        content: Add std/ui/layout.ts — the flexbox algorithm over flat f64 arrays, with a measure hook for text and images — see WP92 S6
        status: pending
      - id: s6-incremental
        content: Wire std/ui/dirty.ts to the layout pass so only dirty subtrees up to the nearest fixed-size box re-run — see WP92 S6
        status: pending
      - id: s6-fixtures
        content: Port a set of Taffy's flexbox fixtures to tests/cases/ui_layout_*.ts with the upstream MIT notice and THIRD_PARTY_NOTICES.md rows — see WP92 S6
        status: pending
      - id: s6-bench
        content: Add bench/ui-layout and its docs/BENCHMARKS.md table — see WP92 S6
        status: pending
      - id: s6-docs
        content: Register ui/layout, add the layout section to docs/guide/using-nish/ui.md, regenerate docs/reference and the goldens — see WP92 S6
        status: pending
  - id: s7-paint-cpu
    title: WP92 S7 — the display list and the CPU reference painter
    goal: Paint turns dirty nodes into a backend-neutral display list, and a CPU painter renders it into a nish/raster framebuffer with the same signed-distance maths the GPU shader will use, redrawing only the damaged rects
    verification: Pixel goldens for every display-list op match in node tests/run.js ui_paint, a paint-only write repaints only its damage rect, and the S3 paint stub is gone
    issue: 2429
    todos:
      - id: s7-display-list
        content: Add std/ui/display-list.ts — rect, rounded rect, border, linear gradient, box shadow, clip push and pop, glyph run and image ops in flat arrays — see WP92 S7
        status: pending
      - id: s7-paint
        content: Add std/ui/paint.ts — the walk from dirty nodes to display-list ops and the damage-rect union — see WP92 S7
        status: pending
      - id: s7-cpu
        content: Add std/ui/paint-cpu.ts — SDF coverage for each op into a nish/raster framebuffer, clipped to the damage rect — see WP92 S7
        status: pending
      - id: s7-goldens
        content: Add tests/ui-pixels with one golden image per op and a tests/run.js section ui_paint that compares them — see WP92 S7
        status: pending
      - id: s7-docs
        content: Register the paint modules, add the painting section to docs/guide/using-nish/ui.md, regenerate docs/reference and the goldens — see WP92 S7
        status: pending
  - id: s8-text
    title: WP92 S8 — TrueType fonts, the glyph atlas and text layout
    goal: A pure-Nish TrueType parser and coverage rasterizer fill a per-size glyph atlas, and std/ui/text.ts lays out Latin text with kerning, line breaking and ellipsis as a layout measure function
    verification: The font parser is proven panic-free and its fuzz target runs in fuzz-smoke, glyph bitmaps match pixel goldens for the fixture font, text measurement goldens pass, and text nodes lay out through the S6 measure hook
    issue: 2430
    todos:
      - id: s8-ttf
        content: Add std/font/ttf.ts — head, hhea, maxp, cmap 4 and 12, loca, glyf (simple and composite), hmtx, kern and GPOS pair kerning, bounded against the file length — see WP92 S8
        status: pending
      - id: s8-raster
        content: Add std/font/raster.ts — quadratic outlines to a signed-area coverage bitmap — see WP92 S8
        status: pending
      - id: s8-atlas
        content: Add std/ui/atlas.ts — a per-size shelf-packed alpha atlas keyed by glyph id and size, with eviction — see WP92 S8
        status: pending
      - id: s8-layout
        content: Add std/ui/text.ts — UTF-8 to glyph runs, kerning, greedy line breaking at spaces and hyphens, ellipsis, and the S6 measure hook — see WP92 S8
        status: pending
      - id: s8-fuzz
        content: Add tests/fuzz/targets/ttf.ts with a corpus — see WP92 S8
        status: pending
      - id: s8-font-licence
        content: Check in the fixture font under tests/fonts with its licence text and its THIRD_PARTY_NOTICES.md row — see WP92 S8
        status: pending
      - id: s8-docs
        content: Register the font and text modules, add docs/guide/using-nish/ui-text.md with its route, regenerate docs/reference and the goldens — see WP92 S8
        status: pending
  - id: s9-input-controls
    title: WP92 S9 — input routing, focus and the basic controls
    goal: Pointer and keyboard events from std/gfx reach the right node through hit testing, focus moves by Tab and pointer, and text, button, checkbox, toggle, slider and image controls ship as UiNode builders with their state in signals
    verification: Headless scenario programs drive synthetic events and assert handler calls, focus order and dirty sets, and examples/ui/controls.ts runs natively and in the browser
    issue: 2431
    todos:
      - id: s9-hit
        content: Add std/ui/events.ts — hit testing over laid-out rects and clips, pointer capture, hover and pressed signals, wheel and key dispatch — see WP92 S9
        status: pending
      - id: s9-focus
        content: Add std/ui/focus.ts — the focus signal, Tab and Shift-Tab order, focus ring paint, and keyboard activation — see WP92 S9
        status: pending
      - id: s9-controls
        content: Add std/ui/controls.ts — text, button, checkbox, toggle, slider and an RGBA image control — see WP92 S9
        status: pending
      - id: s9-tests
        content: Add tests/cases/ui_input_*.ts scenario programs driven by synthetic events — see WP92 S9
        status: pending
      - id: s9-example-docs
        content: Add examples/ui/controls.ts, the controls section of the ui guide page, regenerate docs/reference and the goldens — see WP92 S9
        status: pending
  - id: s10-png
    title: WP92 S10 — std/png, decoding images for the image control
    goal: std/png.ts decodes PNG files to RGBA8 on std/compress/zlib, so the image control takes a file as well as raw pixels
    verification: The generated test images decode to their reference pixels, the decoder is proven panic-free, its fuzz target runs in fuzz-smoke, and the image control loads a PNG in examples/ui/controls.ts
    issue: 2432
    todos:
      - id: s10-decoder
        content: Add std/png.ts — chunks with CRC, IHDR, PLTE, tRNS, IDAT through std/compress/zlib, the five filters, every colour type and bit depth, and Adam7 — see WP92 S10
        status: pending
      - id: s10-tests
        content: Add tests/cases/png_*.ts over the PNG suite images and tests/fuzz/targets/png.ts — see WP92 S10
        status: pending
      - id: s10-docs
        content: Register png, add it to the image section of the ui guide page and standard-library.md, regenerate docs/reference and the goldens — see WP92 S10
        status: pending
  - id: s11-theme
    title: WP92 S11 — Theme, DTCG design tokens and nish ui import-tokens
    goal: Every control reads its styles from a Theme signal, themeFromTokens builds a Theme from a W3C DTCG token file at run time, and nish ui import-tokens generates a typed Theme preset module from the same file
    verification: The DTCG conformance programs pass (aliases, type inheritance, cycles, every token type std/ui reads), a hot swap marks layout only for font tokens and paint only for colours, and the generated preset compiles and equals the run-time Theme
    issue: 2433
    todos:
      - id: s11-theme-presets
        content: Add std/ui/theme.ts — the Theme class, its default light and dark presets, and the controls reading it through a Signal of Theme — see WP92 S11
        status: pending
      - id: s11-tokens
        content: Add std/ui/tokens.ts — themeFromTokens over nish/json-value, alias resolution, type inheritance and a Result naming the bad token — see WP92 S11
        status: pending
      - id: s11-cli
        content: Add the nish ui import-tokens subcommand to src/compile.ts, generating a typed preset module — see WP92 S11
        status: pending
      - id: s11-tests
        content: Add tests/cases/ui_tokens_*.ts and a tests/run.js check that the generated module equals the run-time Theme — see WP92 S11
        status: pending
      - id: s11-docs
        content: Add docs/guide/using-nish/ui-theming.md with its route, the subcommand in docs/guide/using-nish/cli.md, and regenerate the help, break-web and reference pages — see WP92 S11
        status: pending
  - id: s12-scroll
    title: WP92 S12 — scroll containers and virtualList
    goal: A scroll container clips and offsets its child by a scroll signal driven by wheel, drag and keys, and virtualList lays out and paints only the rows in view by recycling row nodes through setCtx
    verification: A 1,000,000-row list keeps a fixed node count, a scroll step re-lays out only recycled rows, scenario programs assert the visible range, and bench/ui-scroll records the per-frame CPU cost in docs/BENCHMARKS.md
    issue: 2434
    todos:
      - id: s12-container
        content: Add std/ui/scroll.ts — the scroll signal, clip, wheel and drag, keyboard paging, momentum and the scrollbar — see WP92 S12
        status: pending
      - id: s12-vlist
        content: Add std/ui/virtual-list.ts — fixed and measured row heights, overscan, row recycling through setCtx and a scroll-to-index — see WP92 S12
        status: pending
      - id: s12-tests-bench
        content: Add tests/cases/ui_scroll_*.ts and bench/ui-scroll with its docs/BENCHMARKS.md table — see WP92 S12
        status: pending
      - id: s12-docs
        content: Add the scrolling and lists section to the ui guide page, regenerate docs/reference and the goldens — see WP92 S12
        status: pending
  - id: s13-text-input
    title: WP92 S13 — textInput, the clipboard and IME
    goal: A single- and multi-line textInput edits a Signal of string with cursor, selection, word moves, undo and a password mask, and takes text from the OS clipboard and from IME composition on both backends
    verification: Scenario programs drive keystrokes, composition and paste and assert the value, cursor and dirty sets, the shim's new reads are bounded and recorded in docs/security/gfx.md with a before-and-after check, and node tests/run.js c-symbols and budget pass
    issue: 2435
    todos:
      - id: s13-widget
        content: Add std/ui/text-input.ts — value binding, cursor and selection signals, grapheme-safe moves, word moves, undo and redo, password mask and scrolling — see WP92 S13
        status: pending
      - id: s13-shim
        content: Add text-input, text-editing, input-area and clipboard calls to runtime/gfx/nish-gfx.c and the browser host, and their std/gfx wrappers — see WP92 S13
        status: pending
      - id: s13-security
        content: Record the clipboard and IME inputs in docs/security/gfx.md with their bounds and failing checks, and update its index row — see WP92 S13
        status: pending
      - id: s13-tests
        content: Add tests/cases/ui_text_input_*.ts and the shim checks in tests/run.js — see WP92 S13
        status: pending
      - id: s13-docs
        content: Add the textInput section to docs/guide/using-nish/ui-text.md, regenerate docs/reference and the goldens — see WP92 S13
        status: pending
  - id: s14-gpu
    title: WP92 S14 — the GPU renderer and the 240 Hz budget
    goal: The display list renders on std/gpu as instanced quads through one SDF uber-shader and the glyph atlas in a few draw calls, matches the CPU painter within a stated tolerance, and a reference scene's layout plus encode fits the 240 Hz CPU budget
    verification: The offscreen comparison against the S7 goldens passes within its tolerance natively and in the browser, the draw-call count per frame is pinned, and bench/ui-frame records the reference scene's CPU time per frame in docs/BENCHMARKS.md against the 0.5 ms target
    issue: 2436
    todos:
      - id: s14-renderer
        content: Add std/ui/paint-gpu.ts — the instance buffer ring, batching by texture, scissor clips and atlas upload — see WP92 S14
        status: pending
      - id: s14-shader
        content: Add std/ui/ui-shader.ts — the WGSL uber-shader as a string constant, for rounded rect, border, gradient, shadow, glyph and image — see WP92 S14
        status: pending
      - id: s14-compare
        content: Add the GPU-against-CPU pixel comparison to tests/gfx.js with its tolerance — see WP92 S14
        status: pending
      - id: s14-bench
        content: Add bench/ui-frame, its reference scene, and its docs/BENCHMARKS.md table — see WP92 S14
        status: pending
      - id: s14-docs
        content: Make std/ui/app.ts choose the GPU painter, add the renderer and present-mode section to the ui guide page, regenerate docs/reference and the goldens — see WP92 S14
        status: pending
  - id: s15-hud
    title: WP92 S15 — the game HUD pack
    goal: std/ui/hud.ts ships bars, a radial cooldown, a minimap frame, floating damage numbers, toasts, a crosshair and safe-area anchors that draw over a game's frame in continuous mode
    verification: Each HUD widget has pixel goldens, an unchanged HUD value costs no relayout, and examples/ui/hud.ts runs over a SpriteBatch scene natively and in the browser
    issue: 2437
    todos:
      - id: s15-widgets
        content: Add std/ui/hud.ts — bar, radial cooldown, minimap frame, damage numbers, toast stack, crosshair and anchors — see WP92 S15
        status: pending
      - id: s15-tests
        content: Add tests/cases/ui_hud_*.ts and pixel goldens for each widget — see WP92 S15
        status: pending
      - id: s15-example-docs
        content: Extend examples/ui/hud.ts, add docs/guide/using-nish/ui-hud.md with its route, regenerate docs/reference and the goldens — see WP92 S15
        status: pending
  - id: s16-a11y
    title: WP92 S16 — the accessibility tree
    goal: Every control publishes a role, a name, a value, its states and its actions to an accessibility tree that follows the signals graph, and the platform's assistive technology can read and act on it
    verification: A headless check in CI asserts the tree for examples/ui/controls.ts and its updates after each write, and the PR records a manual screen-reader pass on each supported platform
    issue: 2438
    todos:
      - id: s16-tree
        content: Add std/ui/a11y.ts — the node table, updates from bindings, and focus and action routing — see WP92 S16
        status: pending
      - id: s16-backend
        content: Add the AccessKit backend through accesskit-c in scripts/fetch-gfx.sh and the shim, the browser ARIA mirror, and the security record row — see WP92 S16
        status: pending
      - id: s16-docs
        content: Add the accessibility section to the ui guide page, regenerate docs/reference and the goldens — see WP92 S16
        status: pending
---

# WP92 — std/ui

## Context

std/ui is planned on WP89's std/gfx (#2235). WP89's frame model ([docs/wp89-gfx.md](../../docs/wp89-gfx.md) §4) is a game loop: every frame runs `step` (at most 8), `update(dt)` and `draw(alpha)`, and nothing tracks what changed. Nish has no capturing closures (NL2731), no arrow in value position (NL2336), no GC, and module constants hold only numbers, booleans and strings.

**Confirmed understanding.**
- **Goal:** settle how a std/ui app holds and changes state and how widget events reach it, without closures. The model is signals: a retained tree, fine-grained updates and event-driven redraw, after [amritk/niv](https://github.com/amritk/niv) (alien-signals plus DOM bindings).
- **In scope:**
  - std/signals, a port of alien-signals' push-pull algorithm;
  - its explicit-runtime API, usable on the seed today;
  - how signal writes mark retained UI nodes layout- or paint-dirty;
  - the wait-for-events loop mode this needs from WP89 S8 and S9;
  - the direct API that removes today's staging fields, once WP93 S1 (#2410) lands.
- **Done when:** the design note settles the model, std/signals passes the ported alien-signals tests, the four scenarios (virtualList, textInput, Theme.fromTokens hot-swap, a game HUD) run headless with correct dirty sets, and a UI app idles on the gfx loop.

**Ordering.** WP92 sits after WP51 (priority 40), WP89 (260) and WP93 (#2409, 270), at 280. S4 is blocked by WP89 S8 (#2243) and S9 (#2244). S5 is blocked by WP93 S1 (#2410), generic function-type aliases. Each blocked stage says so in its section. WP92 S2 is the std/signals port that WP93's parent issue calls "a separate plan".

**Confirmed understanding, the widget library (S6 to S16).**
- **Goal:** the layout, text, painting and widgets of std/ui, as stages on top of the state model above (S1 to S5) and WP89's std/gpu and std/gfx, adapting the "nish-ui" roadmap (FrameArena, flexbox, SDF, text, input, controls, theme tokens, virtualList, textInput, a HUD pack, 240 Hz and above) to this repository's rules.
- **In scope:**
  - flexbox layout;
  - a backend-neutral display list, painted first by a CPU reference rasterizer with pixel goldens, then by a GPU SDF renderer on std/gpu checked against it;
  - a pure-Nish TrueType parser with a coverage atlas and simple Latin text layout;
  - input routing, focus and the basic controls (text, button, checkbox, toggle, slider, image);
  - PNG decoding for the image control;
  - DTCG design tokens, at run time through `themeFromTokens` and as code through `nish ui import-tokens`;
  - scroll and virtualList;
  - textInput with the clipboard and IME;
  - the game HUD pack;
  - accessibility.
- **Out of scope:** complex shaping (ligatures, bidi, complex scripts), mobile, JSX and closures.
- **Done when:** every stage's goldens and pixel tests pass, the GPU renderer matches the CPU painter within its stated tolerance, and `bench/ui-frame` records a reference scene's layout plus encode against a 0.5 ms CPU target per 240 Hz frame.

**Ordering of S6 to S16.** The chain is S6, S7, S8, S9, then S10 and S11, then S12, S13, S14, S15 and S16. S6 needs S3. S7 to S13 run headless or on the CPU painter, so they need only WP89 S8 (#2243) for real events. S14 also needs WP89 S5, S7, S8 and S9. Each blocked stage says so in its section.

## Approach

### The model: signals over typed per-node contexts

A derivation, effect or handler is a **top-level function over a typed context**, `(t: Todo) => string`. It is never a closure. A **direct binding** (`ui.checkbox().checked(t.done)`) needs no function at all. Three pieces carry it:

| Piece | What it is | Why |
| --- | --- | --- |
| `Rt` | One per app, not generic. Holds flat `i32` arrays: flags, dependency and subscriber links, the owning store of each node, the node's index in that store. Also the active subscriber, the batch depth, the effect queue and `updaters: Array<Updater \| null>`. | The graph is one scheduler over every node. It is passed explicitly because a module constant cannot hold an object. `Signal<T>` keeps its `Rt`. |
| `Store<C>` | A table per context type. Holds `ctx: C[]`, one function column and one value column per value kind (string, boolean, i32, f64, handler), and the cached values. | It keeps a node's context typed. No key lookup can go stale when a list row is removed. |
| bridge | One top-level function per store, `(rt: Rt, i: i32): boolean => APP[0].perTodo.update(i)`, reached through a module-private root slot `const APP = new Array<App \| null>(1)`. | `Rt` dispatches without generics. A method cannot be referenced (WP51 §2.2), so the bridge stands in for `store.update`. |

**A write, step by step:**
1. `t.done.set(true)` marks its subscribers Dirty or Pending and queues the effects.
2. The flush calls each dirty node's bridge, which calls `store.update(i)`, which re-runs the function on `ctx[i]`.
3. **Cut-off:** an unchanged value stops propagation there.
4. A changed value reaches its binding, which marks its UiNode layout-dirty or paint-dirty (S3).
5. The flush ends with one `requestRedraw()`.

**The app, today:**

```ts
class Todo {
  title: Signal<string>
  done: Signal<boolean>
}

const rowLabel = (t: Todo): string =>
  t.done.get() ? `[x] ${t.title.get()}` : `[ ] ${t.title.get()}`
const toggle = (t: Todo): void => t.done.set(!t.done.peek())

class App {
  rt: Rt
  perTodo: Store<Todo>
}
const APP = new Array<App | null>(1)
const updateTodo = (rt: Rt, i: i32): boolean => {
  const a = APP[0]
  if (a === null) return false
  return a.perTodo.update(i)
}

const todoRow = (a: App, t: Todo): UiNode => {
  a.perTodo.nextStr = rowLabel          // staging field until WP93 S1
  const label = a.perTodo.computedStr(t)
  a.perTodo.nextHandler = toggle
  const onToggle = a.perTodo.handler(t)
  return ui.row().gap(8).padding(4)
    .child(ui.checkbox().checked(t.done))
    .child(ui.text().text(label))
    .child(ui.button("x").onClick(onToggle))
}
```

**The same view after S5:**

```ts
.child(ui.text().text(a.perTodo.computedStr(t, rowLabel)))
.child(ui.button("x").onClick(a.perTodo.handler(t, toggle)))
```

**Chaining stays.** A setter given a plain value sets it. A setter given a `Signal` or a computed node id creates a binding. `.onClick(id)` takes a handler node, so it works today.

**Mapping from the libraries the request named.**
- A jotai atom is a `Signal`.
- A pinia store's getters are a `Store`'s computeds.
- A zustand store is the app class holding signals, with its actions as top-level functions over it.

None of the three needs a closure once a derivation is a function over a context.

### Rejected models

| Model | Why not |
| --- | --- |
| (a) Immediate mode: rebuild the tree each frame, query clicks by id | It burns CPU while idle. Scroll offsets, cursors and focus still need id-keyed side storage that outlives a per-frame arena. Every frame re-lays out everything. |
| (b) Function references plus one app state and an `i32` key | It works today, and was first chosen, then replaced. A key goes stale when a row is removed, and a whole-state parameter gives no fine-grained invalidation. Per-node typed contexts keep (b)'s dispatch and drop both problems. |
| (c) Elm-style `Msg` queue into one `update(state, msg)` | It works today, but every message invalidates the whole view, so it needs a diff to find what changed. The signals graph knows what changed. |
| (d) Retained widget state the library owns | Kept, as signals inside widgets: textInput's cursor and virtualList's scroll offset are `Signal`s the widget owns, in the same graph. |
| (e) Dirty tracking or idle redraw instead of reactivity | Kept as the loop mode, not as the state model. Signals produce the dirty set, and idle mode consumes it. |

### The widget library: what the roadmap became here

| Roadmap item | Here | Why |
| --- | --- | --- |
| `FrameArena` reset each frame | flat arrays per node and a display list rebuilt per dirty node; buffers reused, never freed per frame (S7, S14) | the tree is retained (rejected model (a)), so only dirty ranges are rebuilt |
| `///` TypeDoc | `/** */` doc comments with `@param` and `@returns`, checked by `node scripts/gen-reference.mjs --check` | this repo's rule for every public std/ declaration |
| `.flexCol().p(16)` builder | camelCase setters with Tailwind's vocabulary (`.flexCol()`, `.padding(16)`, `.itemsCenter()`) that take a value, a `Signal` or a computed node (S3, S6) | method names are vocabulary, not code, so nothing is copied |
| MSDF text | a coverage atlas per pixel size (S8) | no MSDF generator to port under an allowed licence, and per-size coverage is exact at 1x and 2x |
| SDF uber-shader, 1 to 3 draw calls | S14, with S7's CPU painter computing the same maths as its reference | pixel goldens run in CI without a GPU |
| `nish ui import-tokens` | S11, sharing `std/ui/tokens.ts` with the run time through a relative import | one resolver, so the generated preset and `themeFromTokens` cannot disagree |
| 240 Hz and above | WP89 S9's present modes, and `bench/ui-frame` against 0.5 ms | the frame rate is the display's, and the CPU cost is what std/ui controls |

Flexbox is written from the W3C specification, and Taffy's MIT fixtures, ported with their notice, are its goldens. Fonts and PNGs are untrusted bytes, so both parsers are `--deny-panics` clean and fuzzed.

### What closures would change

Nothing in the graph. WP93 S4 (#2413, inline-environment closures) could later add `computed(() => ...)` as an optional facade that lowers to the same `Store` node with the closure's environment as its context. That is out of scope here.

### Facts the sketches established (seed 0.44.0)

| Sketch | Result |
| --- | --- |
| a generic type alias `type F<C> = (c: C) => string` | refused by the validator (no code): "Generic type parameters are forbidden on a type alias". WP93 S1 admits it for a function-type body |
| an inline function type on a method or constructor parameter | NL2338 |
| a top-level generic factory storing its function parameter | NL2334 |
| a capturing arrow | NL2731 |
| a capture-free arrow in value position | NL2336 |
| JSX | parse error |
| a non-generic alias-typed constructor parameter, stored in a field | compiles: WP51 stage 1 made it a reference parameter |
| a generic class field `get: ((rt: Rt, c: C) => T) \| null`, assigned directly | compiles: this is the staging field |
| `Store<C>` plus a bridge (p1) | compiles and runs, with cut-off (`true`, `false`, `true` for change, no change, change) |
| chained `UiNode` setters (c1) | compiles and runs |

Module-storage indexing on the seed needs `--allow-panics` before the file (fixed on main by #2391). The entry module needs `export const main`.

**Dispatch cost.** 1024 nodes, 200k rounds, native `-O2`:
- direct call: 0.100 s, 0.49 ns per call;
- through a reference, a 1-member set: 0.188 s, 0.92 ns;
- through a reference, a 4-member set: 0.178 s, 0.87 ns.

So a stored reference costs about 1.8 to 1.9 times a direct call. A bridge adds a second indirect call per update, still under 2 ns per node.

**String growth.** A fresh string written into long-lived storage on every update grows without bound: 76 MB at 1,000 updates, 862 MB at 20M (`m2.ts`). A string computed therefore needs an in-place text slot or a region per node (S1 decides which, by measurement).

## WP92 S1 — the signals design note

Write `docs/wp92-signals.md`, the spec S2 to S5 build from. It answers these, each with a compiled sketch or a figure:

- **Algorithm.** It ports alien-signals 3.2.1's `createReactiveSystem`: `link`, `unlink`, `propagate`, `checkDirty`, `shallowPropagate` and the batch. The flags are None 0, Mutable 1, Watching 2, RecursedCheck 4, Recursed 8, Dirty 16, Pending 32, HasChildEffect 64. Links are nodes in flat `i32` arrays (dep, sub, prevDep, nextDep, prevSub, nextSub) with a free list, in place of JS objects.
- **API:**
  - `Rt`, `Signal<T>` (`get`, `set`, `peek`);
  - `Store<C>`'s `computedStr`, `computedBool`, `computedI32` and `computedF64`, plus `effect`, `handler`, `update`, `read` and `setCtx`;
  - the staging fields (`nextStr`, `nextBool`, `nextI32`, `nextF64`, `nextHandler`);
  - the bridge and root slot an app writes per store;
  - `batch`;
  - effect scopes and `dispose`.
- **Memory:**
  - A disposed node's slots and links return to free lists.
  - An effect scope owns the nodes created inside it, so disposing a virtualList row frees them.
  - For string computeds, the note chooses a per-node text slot or a region per node. It re-measures `m2` (n = 1,000 and 20M) and gives the figure for each option.
- **Dirty-marking rules (S3):**
  - Layout properties mark the node layout-dirty, and its ancestors up to the nearest fixed-size box. These are gap, padding, width, height, flex, font size, text content, and child lists.
  - Paint properties mark only the node's rect paint-dirty. These are colour, background, opacity, checked and pressed visuals.
  - The flush order:
    1. signal effects;
    2. bindings mark nodes;
    3. layout over the dirty subtrees;
    4. paint over the dirty rects;
    5. one `requestRedraw()`.
- **Scenarios:**
  - **virtualList.** Rows are recycled. The list owns `scroll: Signal<f64>`. `setCtx(i, item)` re-points a row's context and marks it dirty.
  - **textInput.** The widget owns cursor, selection and scroll signals, and its value is a `Signal<string>` the app binds both ways.
  - **Theme.fromTokens hot-swap.** The theme is a `Signal<Theme>` every style binding reads. A swap is one `set` inside a batch: font tokens mark layout, colours mark paint.
  - **Game HUD.** The game's `step` writes `hp.set(x)`. Cut-off makes an unchanged value free, and the HUD re-lays out only the changed text.
- **Records.** It records the sketch table and the dispatch bench from the Approach. They are re-run on the then-current seed, with the bench's command line and noise band.
- **Rejected models.** It carries the rejected-models table, and what closures would change.

## WP92 S2 — std/signals, the reactive runtime

- **`std/signals.ts`.** The S1 API, ported from alien-signals' `src/system.ts` and `src/index.ts`. The upstream MIT notice ("Copyright (c) 2024-present Johnson Chu") goes at the head of the file.
  - Every index into the link arrays is guarded or proven by `src/bounds.ts`, so a `--deny-panics` caller can use the module.
  - It has no `wrappingAdd`, because counters stay in range.
- **Licensing** ([.claude/licensing.md](../licensing.md): a port is a copy).
  - Add `std/LICENSE-alien-signals` beside the module, as `std/LICENSE-fdlibm` is.
  - Add its entries in [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md), for the module and for the ported tests.
  - Add `std/LICENSE-alien-signals` to the three package presence gates in `.github/workflows/release.yml` (the `for f in ...` lists beside `std/LICENSE-fdlibm`).
  - Check with `node tests/run.js third-party-licence`, which reads those gates.
  - Each ported test file carries the upstream notice. The PR body names the upstream (alien-signals 3.2.1) and says, function by function, whether the port keeps its structure.
- **Tests.** Port alien-signals' test files to `tests/cases/signals_*.ts`, each with `.out` and a golden `.ll`, asserting through `nish/testing`. Add:
  - one program that pins cut-off;
  - one that pins the effect order in a batch;
  - one that pins dispose freeing a scope's nodes;
  - the string-growth check from S1, with its bound.

  Register them with `node tests/differential/goldens.js --update`.
- **Docs.**
  - Add `signals` to `stdModuleNames` in `src/std-modules.ts` (a string-only `src/` edit: no new construct, so no freeze issue; run `node tests/run.js wasi` and `node tests/run.js performance`). Add its rows in `std/README.md` and `docs/guide/using-nish/standard-library.md`.
  - Add `docs/guide/using-nish/signals.md` with its route in `scalar.config.json`, showing the Todo example.
  - Add a public-declaration doc comment for each export, with `@param` and `@returns`.
  - Run `node scripts/gen-reference.mjs` and `node tests/self/goldens.js --update`.
  - Add `DECLARED` entries in `tests/nish-cmp.js` if a corpus program's IR moves.

## WP92 S3 — headless UI bindings and dirty marking

- **`std/ui/node.ts`.** `UiNode` with chained setters. Each setter has three forms: a plain value, a `Signal<T>`, or a computed node id (`text(label)`). A binding records the node and the property kind (layout or paint) as an effect in the node's scope. `.onClick(handlerId)` and `.child(n)` return the node.
- **`std/ui/dirty.ts`.** Two queues, `layoutDirty` and `paintDirty`, deduplicated by a flag per node, and the S1 flush order. The `requestRedraw` hook is a function-reference field the runner sets, and is a no-op headless.
- **Scenarios.** Four programs in `tests/cases/ui_*.ts`: virtualList, textInput, theme hot-swap and HUD. Each writes signals and asserts the exact dirty sets after each flush. One write repeats an unchanged value and asserts an empty set.
- **Docs.**
  - Add `ui/node` and `ui/dirty` to `stdModuleNames`.
  - Add `docs/guide/using-nish/ui.md` with its `scalar.config.json` route, and its row in `standard-library.md`.
  - Regenerate `docs/reference` and the goldens.
  - Register the scenario programs with `node tests/differential/goldens.js --update`.
- No widget set, layout algorithm or painting lands here. Layout and paint are stubs that record what they were asked to do.

## WP92 S4 — std/ui on the std/gfx idle loop

**Blocked by** WP89 S8 (#2243), which adds `runApp`'s wait-for-events mode and `requestRedraw()`, and WP89 S9 (#2244), whose `bench/gfx-idle` pins the idle-CPU and redraw-latency bounds this stage is judged by.

- **`std/ui/app.ts`.**
  - Sets the runner's `requestRedraw` from the dirty flush.
  - Runs the S3 layout and paint stubs from `draw`.
  - Runs a game HUD on continuous mode, where the game loop already draws every frame.
- **`examples/ui/todos.ts`** (idle mode) and **`examples/ui/hud.ts`** (continuous mode) run natively and in the browser, in CI's `examples` job.
- **Docs and scope.**
  - Register `ui/app` in `stdModuleNames` (`src/std-modules.ts`).
  - Add the runner section to `docs/guide/using-nish/ui.md`, and regenerate `docs/reference`.
  - `std/ui/app.ts` reads input events through std/gfx, so name it in [docs/security/gfx.md](../../docs/security/gfx.md)'s scope, which `node scripts/security-scope.mjs` checks. It adds no new reader of the network, terminal or another process.

## WP92 S5 — passing derivations directly once generic function-type aliases land

**Blocked by** WP93 S1 (#2410), "generic function-type aliases, so a factory can store its function". It admits `type Derive<C, T> = (ctx: C) => T` and makes a method or constructor parameter typed through it a stored reference.

- **`std/signals.ts`.** `computedStr(c: C, f: Derive<C, string>)`, `handler(c: C, f: Derive<C, void>)` and the other kinds take the function directly. The staging fields go. A breaking change on 0.x, so the commit carries `feat(runtime)!` (std/ changes ship under `runtime`; CLAUDE.md lists no `std` scope) and `BREAKING CHANGE:`.
- **`std/ui/node.ts`.** It takes the new form where it forwards derivations.
- **Docs and tests.** The S2 and S3 tests, the examples and the guide page move to the direct form. The bridge stays, because a method still cannot be referenced.

## WP92 S6 — flexbox layout

**Blocked by** WP92 S3 (#2420), which adds `UiNode`, its setters and the layout stub this replaces.

- **`std/ui/layout.ts`.** The flex layout algorithm of CSS Flexible Box Layout Module Level 1, §9, written from the W3C specification.
  - **Properties:**
    - `direction`, with the reverse forms, and `wrap`;
    - `justifyContent`, `alignItems`, `alignSelf` and `alignContent`;
    - `grow`, `shrink` and `basis`;
    - `gap`, for rows and for columns;
    - `padding`, `margin` and border width;
    - `width` and `height`, with their `min` and `max` forms, in pixels, percent or `auto`;
    - `aspectRatio`;
    - absolute position (`top`, `left`, `right`, `bottom`).
  - **Builder names.** The setters use camelCase forms of Tailwind's words: `.flexRow()`, `.flexCol()`, `.gap(8)`, `.padding(16)`, `.itemsCenter()`, `.justifyBetween()`, `.grow(1)`, `.wFull()`. Each has a doc comment with `@param` and `@returns`.
  - **Storage.** Inputs and outputs (`x`, `y`, `w`, `h`) live in flat `f64` arrays indexed by node id, not in per-node objects.
  - **Measure cache.** Each node keeps a small cache from available size to result, so a deep tree is not measured more than once per constraint.
  - **Pixel snapping.** Positions snap to device pixels at the window's scale.
  - **Measure hook.** A switch on node kind:
    - a text node calls S8's measure;
    - until S8 lands, a text node uses std/raster's 5×7 font advance;
    - an image node uses its intrinsic size.
- **Incremental layout.** The S3 flush hands layout its dirty roots, each lifted to the nearest ancestor with a fixed size, as S1's rule says. Only those subtrees re-run. A scenario program asserts which nodes were visited.
- **Fixtures** ([.claude/licensing.md](../licensing.md): ported fixtures are a copy).
  - Port Taffy's flexbox fixtures (DioxusLabs/taffy, `test_fixtures/flex/`, MIT) to `tests/cases/ui_layout_*.ts`, with their Chrome-measured expected rects. The rule is every `flex/` fixture whose styles use only the properties S6 implements, about 100; the PR lists the fixtures skipped and the property each needs.
  - Each file carries Taffy's notice. Add the licence text, verbatim, as `tests/cases/LICENSE-taffy`, a ``### `tests/cases/LICENSE-taffy` `` section with its ```` ```notice ```` fence in `THIRD_PARTY_NOTICES.md`, and one `## Files` row per fixture file, so `node tests/run.js third-party-licence` checks each copy carries the notice.
  - The PR body says which fixtures were taken. It also says the engine follows the specification, not Taffy's code, and compares the two function by function.
- **Bench.** `bench/ui-layout` lays out a 10,000-node tree, then changes one leaf's text and lays out again. Its `docs/BENCHMARKS.md` table names the commit `main` reaches, the noise band and both figures.
- **Docs.** Add `ui/layout` to `stdModuleNames`, the layout section to `docs/guide/using-nish/ui.md`, and regenerate `docs/reference` and the goldens.

## WP92 S7 — the display list and the CPU reference painter

**Blocked by** WP92 S6.

- **`std/ui/display-list.ts`.** The ops, in flat arrays (an op code plus `f64` parameters and `u32` colours):
  - rect and rounded rect, with four radii;
  - border;
  - linear gradient, with up to 4 stops;
  - box shadow;
  - clip push and pop, rounded or not;
  - glyph run;
  - image.

  Each node owns a range of the list, so a paint-dirty node rebuilds only its range.
- **`std/ui/paint.ts`.**
  - Walks the paint-dirty nodes and rebuilds their ranges.
  - Takes the union of each node's old and new rects as damage, merged into at most 8 rects, or the whole window past that.
- **`std/ui/paint-cpu.ts`.** It renders the list into a `nish/term-pixels` `Framebuffer` (opaque `0xRRGGBB` in an `i32[]`, the frame nish/raster draws into), clipped to the damage.
  - **Coverage.** Coverage is the signed distance to a rounded box, clamped to 0.5 minus the distance. The rounded-box distance comes from Inigo Quilez's published `sdRoundBox` formula, cited as an idea.
  - **Borders and shadows.** A border is the difference of two distances. A shadow is the erf-based rounded-rect approximation, cited to its published description.
  - **Blending.** Each op's coverage and alpha are composited over the opaque frame in sRGB space, as browsers blend, so a CSS mock-up matches. Goldens compare RGB.
  - **Shared maths.** S14's shader computes exactly this, which is what makes this painter its reference.
- **Presenting.** Until S14, `std/ui/app.ts` (S4) presents this painter's framebuffer through WP89 S8's `std/gfx/framebuffer.ts`.
- **Goldens.**
  - `tests/ui-pixels/<case>.png` holds one image per op and per clip and damage case.
  - A `tests/run.js` section, `ui_paint`, runs each program, takes its RGBA output and compares it, decoding the golden with `node:zlib`.
  - `--update` rewrites them. They are generated, never edited by hand.
- **Docs.** Register the three modules, add the painting section to the ui guide page, and regenerate `docs/reference` and the goldens.

## WP92 S8 — TrueType fonts, the glyph atlas and text layout

**Blocked by** WP92 S6 (the measure hook) and S7 (the glyph-run op).

**Fonts are untrusted bytes.** Every read is checked against the file's length and returns a `Result`. The module is clean under `--deny-panics`, and a fuzz target runs in CI's `fuzz-smoke` ([tests/fuzz/README.md](../../tests/fuzz/README.md)).

- **`std/font/ttf.ts`.** Parses TrueType outlines:
  - `head`, `hhea`, `maxp` and `hmtx`;
  - `cmap`, formats 4 and 12;
  - `loca` and `glyf`, with composite glyphs and their transforms;
  - `kern` format 0, and `GPOS` lookup type 2 (pair adjustment), formats 1 and 2.

  CFF outlines (`OTTO`) return an error naming them. There is no hinting.
- **`std/font/raster.ts`.** It flattens quadratic outlines and accumulates signed area into an alpha coverage bitmap, with x placed at quarter-pixel offsets.
  - It is written from the published description of signed-area accumulation.
  - The closest upstream is font-rs (Raph Levien, Apache-2.0 or MIT). The PR compares the two function by function, as `.claude/licensing.md` → "Name the closest upstream" asks.
- **`std/ui/atlas.ts`.**
  - A 1024² alpha atlas per pixel size, packed in shelves.
  - Keyed by glyph id, size and offset.
  - Least-recently-used glyphs are evicted by frame stamp.
  - A dirty rect records what changed, for S14's upload.
- **`std/ui/text.ts`.**
  - Decodes UTF-8 to glyph runs, with `.notdef` for a missing glyph, and applies kerning.
  - Breaks lines greedily at spaces and after hyphens, and inside a word longer than the line.
  - Truncates with an ellipsis.
  - Exposes the S6 measure hook. Text nodes emit S7's glyph-run op.
  - Breaking and ellipsis work on code points. UAX #14 and grapheme clusters are out of scope.
- **No font given.** A text node renders in std/raster's 5×7 bitmap font scaled to the size, so a program works before it loads a font.
- **Tests.** Glyph bitmaps and measurements against goldens for a fixture font checked in under `tests/fonts/`, with its licence text beside it and its `THIRD_PARTY_NOTICES.md` row. The fuzz target is `tests/fuzz/targets/ttf.ts`, with a corpus.
- **Docs.** Register `font/ttf`, `font/raster`, `ui/atlas` and `ui/text`. Add `docs/guide/using-nish/ui-text.md` with its route, and regenerate `docs/reference` and the goldens.

### Decided: no bundled font

The owner chose no bundled font on 2026-11-28. `.claude/licensing.md` does not allow OFL-1.1, which covers most UI fonts, and the policy stays as it is. A program loads its own font file, and the 5×7 bitmap font covers the zero-setup case. The fixture font under `tests/fonts/` is one released under an allowed licence (Roboto's 2.x releases were Apache-2.0), or one generated by a test helper.

## WP92 S9 — input routing, focus and the basic controls

**Blocked by** WP92 S8 (the text control), and by WP89 S8 (#2243) for real events. The headless scenario programs need only WP92 S8, because they inject events.

- **`std/ui/events.ts`.**
  - **Hit testing.** A hit test walks the laid-out rects in reverse paint order. It honours clips, and skips a node set with `.pointerEvents(false)`.
  - **Capture.** A pointer down captures the pointer until up.
  - **Handlers.** `.onClick`, `.onPointerDown`, `.onPointerUp`, `.onKey` and `.onWheel` take S2 handler nodes, as `.onClick` does in S3. A handler reads the current event through `pointerEvent(app)` or `keyEvent(app)`, so it keeps the one-context signature `(c: C) => void`.
  - **State signals.** `hovered`, `pressed` and `focused` are `Signal<boolean>` on each interactive node, so a style binding reacts to them.
  - **Scale.** Device scale comes from the window's pixel size over its logical size.
- **`std/ui/focus.ts`.**
  - One focus signal per app.
  - Tab and Shift-Tab move in tree order, overridden by `.tabIndex(n)`.
  - Enter and Space activate; Escape blurs.
  - The focus ring paints from a constant until S11's Theme.
- **`std/ui/controls.ts`.** The controls and their bindings:

  | Control | Binding |
  | --- | --- |
  | `text` | S8's text node |
  | `button(label)` | — |
  | `checkbox` | a `Signal<boolean>` |
  | `toggle` | a `Signal<boolean>` |
  | `slider(min, max, step)` | a `Signal<f64>`, moved by pointer drag and the arrow keys |
  | `image(rgba, w, h)` | takes its pixels, with `contain`, `cover` and `fill` fits |

  Each control's state is a signal it owns or binds, as S1's virtualList and textInput scenarios do.
- **Tests.** `tests/cases/ui_input_*.ts` inject pointer and key sequences. They assert:
  - the handler calls;
  - the focus order;
  - the signal values;
  - the dirty sets.
- **Example and docs.** `examples/ui/controls.ts` runs natively and in the browser. Add the controls section to the ui guide page, and regenerate `docs/reference` and the goldens.

## WP92 S10 — std/png, decoding images for the image control

**Blocked by** WP92 S9, whose image control and example it extends.

`std/compress` already has inflate and the zlib wrapper (`std/compress/zlib.ts`, RFC 1950), so a decoder is mostly chunk parsing and filters.

- **`std/png.ts`.** Written from the W3C PNG Specification. It decodes to RGBA8.
  - **Chunks.** Signature and chunk walk, each CRC checked with `std/compress/checksum.ts`.
  - **Header and colour.** IHDR, PLTE and tRNS.
  - **Image data.** IDAT through zlib inflate, the five filters, Adam7 interlace, and every colour type and bit depth. A 16-bit sample is reduced to 8 bits.
  - **Ignored.** gAMA and iCCP; colour management is out of scope.
  - **Limits.** Width and height are each capped at 16,384. The inflated size is computed from IHDR and passed as inflate's output limit (`DEFLATE_ERR_OUTPUT_LIMIT`), so a decompression bomb stops at the size its header states.
- **Untrusted bytes.** The module is clean under `--deny-panics`, with a fuzz target at `tests/fuzz/targets/png.ts`.
- **Specs.** It cites the W3C specification, not RFC 2083. If the PR does cite RFC 2083, the module lands spec-first under `node scripts/rfc-specs.mjs`.
- **Tests.**
  - `tests/cases/png_*.ts` decode images that a `tests/run.js` helper writes with `node:zlib`, covering every colour type, depth, filter and interlace. No third-party image set is needed.
  - Each case asserts its pixels and the error for a truncated, a bad-CRC and an oversized file.
- **Docs.** Register `png`, add its rows in `std/README.md` and `standard-library.md`, add `image(png)` to the controls section, and regenerate `docs/reference` and the goldens.

## WP92 S11 — Theme, DTCG design tokens and nish ui import-tokens

**Blocked by** WP92 S9, whose controls read the Theme.

- **`std/ui/theme.ts`.** The `Theme` class:
  - colour roles (`surface`, `onSurface`, `primary`, `onPrimary`, `border`, `focus`, `danger`, and their hover and pressed forms);
  - a spacing scale, radii and shadows;
  - typography: a font handle, sizes, weights and line heights;
  - durations.

  Default `lightTheme()` and `darkTheme()` presets.
  - **Reading it.** Each control's style bindings read the app's `theme: Signal<Theme>`, so a hot swap is one `set` in a batch. Font tokens mark layout, and colours mark paint (S1's rule, pinned by a scenario).
  - **Signal-free.** `theme.ts` and `tokens.ts` import neither std/signals nor anything that uses WP93's constructs, because the CLI imports them (below).
- **`std/ui/tokens.ts`.** `themeFromTokens(json: string): Result<Theme, TokenError>` over nish/json-value, by the DTCG Format Module (the version is pinned in the guide page).
  - **What it resolves:**
    - groups, with `$type` inherited from the group;
    - `$value` aliases (`{color.primary}`), with cycle detection;
    - `$deprecated`;
    - `$extensions`, ignored.
  - **Token types:** `color` (the object form, and the hex strings Tokens Studio exports), `dimension`, `fontFamily`, `fontWeight`, `duration`, `number`, `shadow` and `typography`.
  - **Mapping.** A documented path map (`color.surface`, `space.2`, `radius.md`, …) fills the Theme. Other tokens stay readable through `themeToken(theme, path)`.
  - **Errors.** A `TokenError` names the token path and what is wrong with it.
- **`nish ui import-tokens <tokens.json> [-o theme.ts] [--name Brand]`.**
  - A subcommand in `src/compile.ts`.
  - It imports `../std/ui/tokens.ts` by a relative path, as `src/cli-style.ts` imports `std/cli.ts`, so the CLI and the run time share one resolver. That module is therefore under the rolling freeze ([.claude/selfhost.md](../selfhost.md)).
  - It writes a module exporting `brandTheme(): Theme` built from literals, so a shipped app parses no JSON.
  - The `src/` change runs `node tests/run.js wasi` and `node tests/run.js performance`.
- **Tests.**
  - `tests/cases/ui_tokens_*.ts` cover each token type, aliases, a cycle, a bad type, and the hot-swap dirty sets.
  - A `tests/run.js` check runs the subcommand on a fixture and compiles the output. It asserts the output equals `themeFromTokens` on the same file, field by field.
- **Docs and generated files.**
  - Add `docs/guide/using-nish/ui-theming.md` with its route: the Figma, Tokens Studio or Variables export to `nish ui import-tokens` workflow.
  - Add the subcommand to `docs/guide/using-nish/cli.md`.
  - The `--help` text changes, so regenerate `examples/break-web/help.ts` and `docs/site/break/` with `node examples/break-web/build.mjs`.
  - Regenerate `docs/reference` and the goldens.

## WP92 S12 — scroll containers and virtualList

**Blocked by** WP92 S11, so the scrollbar reads the Theme from the start.

- **`std/ui/scroll.ts`.**
  - A container that clips its child and offsets it by `scroll: Signal<f64>` on each axis. An offset change is paint-only, plus the S6 relayout of the newly visible rows.
  - **Wheel.** Pixel deltas from touchpads, line deltas times the line height.
  - **Drag and keys.** Pointer drag on touch, and PageUp, PageDown, Home and End.
  - **Momentum.** An effect asks for a redraw each frame while velocity is not zero, and stops at rest, so the idle loop sleeps again.
  - A themed scrollbar.
- **`std/ui/virtual-list.ts`.** `virtualList(count: Signal<i32>, rowHeight, buildRow)`:
  - `buildRow` is a top-level function over the row's context, which holds `index: Signal<i32>`.
  - Rows within the viewport plus an overscan are kept. Scrolling re-points them with `setCtx`, as S1's virtualList scenario says, so the node count stays fixed.
  - Measured row heights are cached per index, starting from an estimate. The first visible row stays anchored when an estimate is corrected.
  - `scrollToIndex(i)`.
- **Tests and bench.**
  - `tests/cases/ui_scroll_*.ts` assert the visible range, the recycled contexts and the dirty sets after wheel and key input.
  - One program builds a 1,000,000-row list and asserts its node count.
  - `bench/ui-scroll` records the CPU time per scroll step in `docs/BENCHMARKS.md`.
- **Docs.** Add the scrolling and lists section to the ui guide page, and regenerate `docs/reference` and the goldens.

## WP92 S13 — textInput, the clipboard and IME

**Blocked by** WP92 S12 (its own scrolling, and S8's text measure and S11's Theme before it), and WP89 S8 (#2243) and S7 (#2242) for the two backends' event paths.

- **`std/ui/text-input.ts`.** `textInput(value: Signal<string>)` and `.multiline()`.
  - The widget owns cursor, selection and scroll signals, as S1's textInput scenario says.
  - **Moves.** By code point, by word (with Ctrl or Alt), by line, Home and End.
  - **Selection.** By Shift, by double click, and select-all.
  - **Editing.** Undo and redo, grouping typing runs. A password mask. Horizontal scroll that keeps the cursor in view.
- **Shim and host.** `runtime/gfx/nish-gfx.c` copies only the event kinds it lists (`nishgfx_events_poll`) and drops every other kind. This stage adds:
  - **Events.** SDL's text-input and text-editing events. The composition text is copied into the ring with a byte cap and a NUL, as error messages are.
  - **Input calls.** `SDL_StartTextInput`, `SDL_StopTextInput` and `SDL_SetTextInputArea`, so the IME candidate window sits at the cursor.
  - **Clipboard.** `SDL_GetClipboardText` and `SDL_SetClipboardText`.
  - **Browser.** The host gets a hidden `<textarea>` that receives composition events, and the paste and copy events.
  - **Wrappers.** Their std/gfx wrappers.
- **Security.** The clipboard holds another process's data, and IME text comes from the input method. Both are new outside inputs to the shim.
  - Each gets a row in [docs/security/gfx.md](../../docs/security/gfx.md)'s "What reaches the shim from outside": a byte cap, UTF-8 validation, and the failing `tests/run.js` check for each bound.
  - Update the record's row in `docs/security/README.md`.
  - Run `node tests/run.js c-symbols`. If `tests/runtime-budgets.js` has a row for the shim, move its ceiling with the measurement.
- **Tests.**
  - `tests/cases/ui_text_input_*.ts` inject keystrokes, a composition sequence and a paste, and assert the value, cursor, selection and dirty sets.
  - The shim checks prove each cap by a helper's exit status.
- **Docs.** Add the textInput section to `docs/guide/using-nish/ui-text.md`, and regenerate `docs/reference` and the goldens.

## WP92 S14 — the GPU renderer and the 240 Hz budget

**Blocked by** WP92 S12, whose virtualList is in the reference scene (S7's display list and S8's atlas come before it), and these WP89 stages:
- S5 (#2240), std/gpu;
- S7 (#2242), the browser;
- S8 (#2243), the runner and the SpriteBatch pass the HUD draws over;
- S9 (#2244), the present modes and `bench/gfx-idle`.

- **`std/ui/paint-gpu.ts`.**
  - **Instances.** Converts the display list to one instance per op in a ring buffer, an instance holding the rect, four radii, fill or gradient, border, shadow, a UV rect, a clip rect and the kind.
  - **Textures.** Binds the glyph atlas (R8) and an RGBA image atlas. A batch breaks only when an image misses the atlas.
  - **Clips.** Applied per instance in the shader, so they break no batch.
  - **Atlas upload.** Uploads S8's atlas dirty rect with the queue's texture write.
  - **Target.** At most 3 draw calls for the reference scene.
- **`std/ui/ui-shader.ts`.** One WGSL shader with S7's coverage maths, held as an exported string constant and passed to std/gpu's shader creation, which takes the source as a string (`nishgfx_shader_create`, `std/gpu/sys.ts`). A `.ts` module ships through `scripts/std-module-paths.mjs` and the release gates, where a `.wgsl` file would not.
- **Present.** Uses WP89 S9's present modes: FIFO by default, so it runs at the display's rate (240 Hz on a 240 Hz panel), or Mailbox where the driver has it.
- **No per-frame growth.** A frame in steady state reuses its buffers. A check asserts the display list's and the instance ring's capacities stop changing after a warm-up of 100 frames.
- **CPU against GPU.**
  - A `tests/gfx.js` check renders every S7 golden through the offscreen target and compares it with the CPU painter's image.
  - The tolerance is at most 2 levels per 8-bit channel, and at most 0.5% of pixels past it, for edge antialiasing. It is stated in the check.
  - It runs where WP89's gfx checks run. The browser runs it if WP89 S7 ships a WebGPU page check.
- **Bench.** `bench/ui-frame` uses a reference scene: a settings panel of about 2,000 nodes, a 1,000,000-row virtualList, and S4's HUD example (S15's pack comes later). It measures the CPU time per frame for:
  - a HUD value change;
  - a theme swap (full relayout);
  - a scroll step.

  Against a 0.5 ms target: an eighth of the 4.17 ms frame at 240 Hz. The `docs/BENCHMARKS.md` table follows its rules: the commit, the noise band, and a maximum quoted as a maximum.
- **Switching painters.** `std/ui/app.ts` uses the GPU painter where std/gpu has a device, and keeps the CPU painter as the fallback and the reference.
- **Docs.** Add the renderer and present-mode section to the ui guide page, and regenerate `docs/reference` and the goldens.

## WP92 S15 — the game HUD pack

**Blocked by** WP92 S14: the pack draws over the game's SpriteBatch pass in the same GPU frame, which the CPU painter's framebuffer present would overwrite. Its pixel goldens need only S7.

- **`std/ui/hud.ts`.** Each widget is a builder over signals:
  - `bar(value, max)`, horizontal or vertical;
  - `radialCooldown(t)`;
  - `minimapFrame(image)`;
  - `damageNumbers()`, which spawns floating text that rises and fades;
  - `toastStack()`;
  - `crosshair()`;
  - anchors to the window's corners and edges, with an inset signal.
  - It draws after the game's SpriteBatch pass in the same frame, loading what is there. Continuous mode redraws each frame anyway, so an unchanged value costs no relayout (S1's cut-off).
- **Tests.**
  - Pixel goldens for each widget, through S7's `ui_paint`.
  - `tests/cases/ui_hud_*.ts` assert that `hp.set(sameValue)` dirties nothing, and that a changed value re-lays out only its text.
- **Example and docs.**
  - `examples/ui/hud.ts` grows from S4's into a SpriteBatch scene with the pack, natively and in the browser.
  - Add `docs/guide/using-nish/ui-hud.md` with its route.
  - Regenerate `docs/reference` and the goldens.

## WP92 S16 — the accessibility tree

**Blocked by** WP92 S13, for the full control set.

- **`std/ui/a11y.ts`.** The accessibility tree:
  - A node table with a role, a name, a value, states (focused, checked, disabled, expanded) and actions (press, focus, set value, scroll), filled from the controls.
  - The bindings that mark a node dirty also queue its accessibility update, so the tree follows the signals graph and sends only changes.
  - An action request from the platform runs the node's S2 handler.
- **Backend.** The one the decision picks. Assistive technology is another process that sends this process requests, so the backend lands with its `docs/security/` record and index row.
- **Tests.**
  - A headless check asserts the tree for `examples/ui/controls.ts`, and its updates after each write.
  - The headless check is the CI gate. A manual screen-reader pass on each supported platform is recorded in the PR body, because CI has no assistive technology.
- **Docs.** Add the accessibility section to the ui guide page, and regenerate `docs/reference` and the goldens.

### Decided: AccessKit

The owner chose AccessKit on 2026-11-28. The native backend is accesskit-c (MIT OR Apache-2.0), whose one C API covers Windows UI Automation, macOS NSAccessibility and Linux AT-SPI.
- It is fetched and checksummed like SDL in `scripts/fetch-gfx.sh`, and its licence text ships beside it with a `THIRD_PARTY_NOTICES.md` row.
- The browser gets an ARIA DOM mirror in the page host.
- The shim's new calls are reserved in `src/c-symbols.ts`, and the shim file's `docs/security/gfx.md` scope covers the tree updates it forwards.

## Out of scope

- Closures. A `computed(() => ...)` facade over WP93 S4 is later, optional work over the same nodes.
- Complex text shaping: ligatures, bidi, complex scripts, UAX #14 line breaking and grapheme clusters. S8's text is Latin with kerning.
- Mobile: touch keyboards, safe areas and app lifecycle.
- CSS grid, animation and transitions beyond the HUD pack's own.
- Colour management (gAMA, iCCP) in std/png.
- JSX. It is a parse error today.
- WP60 `Dyn`.
- Signals across threads.

## Tests

- **S2.** `tests/cases/signals_*.ts` (ported alien-signals cases, cut-off, batch order, dispose, string growth) with `.out` and goldens, mirroring `tests/cases/region_*`.
- **S3.** `tests/cases/ui_*.ts` scenario programs asserting dirty sets.
- **S4.** The examples, and the idle and latency checks from WP89 S9's bench.
- **S5.** The same programs in the direct form.
- **S6.** `tests/cases/ui_layout_*.ts`, the ported Taffy fixtures, and incremental-visit assertions.
- **S7, S15.** `tests/ui-pixels/*.png` goldens through the `ui_paint` section.
- **S8, S10.** Glyph and PNG goldens, error cases, and `tests/fuzz/targets/ttf.ts` and `png.ts` in `fuzz-smoke`.
- **S9, S12, S13.** `tests/cases/ui_input_*.ts`, `ui_scroll_*.ts` and `ui_text_input_*.ts` driven by injected events, and the shim's cap checks.
- **S11.** `tests/cases/ui_tokens_*.ts`, and the import-tokens equality check.
- **S14.** The GPU-against-CPU comparison in `tests/gfx.js`, and the buffer-capacity check.
- **S16.** The headless accessibility tree check.

## Verification

- **Every stage:**

  ```bash
  npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
  ```
- **S2 and S3:**

  ```bash
  node tests/run.js signals
  node tests/run.js ui_
  node tests/run.js third-party-licence
  node tests/run.js wasi
  node tests/run.js performance
  node scripts/gen-reference.mjs --check
  node tests/self/goldens.js --update
  ```

  Read the diff from the goldens update. Run nish-cmp.
- **S1:** `build/seed/bin/nish run --allow-panics <sketch>.ts` for every sketch the note quotes.
- **S6 to S16:**

  ```bash
  node tests/run.js ui_
  node tests/run.js third-party-licence
  node scripts/gen-reference.mjs --check
  node tests/self/goldens.js --update
  node tests/differential/goldens.js --update
  ```
- **S10:** `node tests/run.js png_`.
- **S7 on:** `node tests/run.js ui_` includes the `ui_paint` section S7 adds.
- **S8 and S10:** `bash scripts/fuzz.sh --build ttf` (and `png`), then `bash scripts/fuzz.sh --smoke`.
- **S11:** `node tests/run.js wasi`, `node tests/run.js performance`, and `node examples/break-web/build.mjs --check`.
- **S13:** `node tests/run.js c-symbols`, `node tests/run.js budget`, and `node scripts/security-scope.mjs`.
- **S6, S12, S14:** each bench's recorded run, named by its commit in `docs/BENCHMARKS.md`.
