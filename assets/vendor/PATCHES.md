# Local lifecycle extension for Hanzi Writer 3.7.3

Upstream: https://github.com/chanind/hanzi-writer, npm package `hanzi-writer@3.7.3`.
Original package integrity was verified against npm's SHA-512 value before extraction. Source and resulting file SHA-256 values are in `PROVENANCE.json`. MIT notice is preserved in `LICENSE.MIT.txt`; original `COPYING.md` is preserved in `COPYING.upstream.md`.

The locally shipped ESM is a derivative of `dist/index.esm.js`. No stroke paths, stroke matching algorithm, scoring tolerances, or animation geometry were changed. The upstream source map is omitted because the local changes alter line offsets.

Changes made on 2026-11-18 for navigation in this static application:

1. `RenderTargetBase` records node/document input listeners and removes them during cleanup. It handles `touchcancel` as an end-of-stroke event. Generated SVG roots are identified so disposal removes the writer's own SVG while preserving an existing caller-owned SVG element.
2. Each writer exposes an idempotent, synchronous `destroy()`. It cancels the quiz and every active render mutation chain, settles canceled animation promises using the upstream cancellation result, cancels pending data state, detaches listeners, removes the renderer, and releases local references. Pausing alone is deliberately not used, because a paused animation promise can remain pending.
3. Pending data requests receive a generation guard. Replacing a pending character settles the superseded load; responses for an older character or disposed writer do not render or call load callbacks.
4. Methods waiting on data and animation completion callbacks ignore work belonging to a destroyed writer or superseded load. An arbitrary caller-supplied network loader cannot be aborted by the library; the application's loader should own its `AbortController`. Late network results are ignored regardless.

Interface used by the application:

```js
const { default: HanziWriter } = await import('./hanzi-writer.esm.js');
const writer = HanziWriter.create(element, character, {
  charDataLoader: char => fetch(characterURL(char)).then(response => response.json())
});
// Standard upstream animateCharacter(), animateStroke(), quiz(), setCharacter(), etc.
writer.destroy(); // Local extension. Safe to call more than once.
```

This extension is specific to the pinned version. Reapply and test lifecycle behavior when upgrading. It does not certify the glyphs or stroke order as Taiwan MOE standards.
