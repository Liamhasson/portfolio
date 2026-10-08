# Build step 2: Live Sand Prototype

**Status:** draft for Liam's go (2026-10-09). Follows `2026-10-08-home-production-plan.md` §8 step 2. Reuses the engine design of `2026-10-05-phase-2a-stage-loader-hero.md` (stage class, tiers, governor, tests) where it still applies; its look (glowing additive sprites, bloom, Fibonacci sphere) is superseded by concept v3.

**Quality bar:** moto-card.com / oryzo.ai / lusion.co. Every live frame is compared side by side with its Blender render before Liam sees it. No shortcuts.

## 1. What this prototype proves

The sand and the ball, live, in the black void, on a hidden page (`/lab/sand`, noindex) deployed to a Vercel preview so Liam reviews on his own laptop and phone.

| In | Out (later steps) |
|---|---|
| The chaos sand, alive | Desk backplates, the pull-back (step 3) |
| Scroll compacts chaos into the dense ball (reversible) | 2.2 attempts, 2.3 glass (step 4) |
| The dense ball alive: drift, idle spin, scroll spin, flares | Wordmark, copy, type (hero build) |
| Cursor = light + soft drift (Lusion model); on phones the light follows the finger | Loader timing |
| Quality tiers, frame-time governor, fallbacks | |

**Pass criteria:** (1) side by side with `lookdev-ch1-hero-light.jpg` (chaos) and the dense ball render, a viewer can't tell which material is live; (2) 60fps on a mid-range laptop, never below 30fps on a corporate Windows laptop with integrated graphics (lowest tier); (3) the ball's centre is where the layout puts it, measured automatically; (4) Liam says the sand feels alive and the cursor feels like Lusion.

## 2. References and targets

- **Look:** the approved renders: chaos `lookdev-ch1-hero-light.jpg`, mid `lookdev-ch1-hero-mid.jpg`, dense ball `lookdev-ch1-hero-ball.jpg` and `lookdev-ch3-dense.jpg`. Material per concept v3 §2: solid, crisp, matte grains, no glow; plum / dusty rose / rose-gold / muted gold ramp; warm key front left, rose rim behind, dim cool fill; AgX tone.
- **Cursor and drift (read from lusion.co/about's code, 2026-10-09):** the cursor is a 3D light: per-grain diffuse `linearStep(0.35, 1, dot(n, toLight)) / sqrt(dist * 0.1)`, on top of a baked per-particle normal and shade. The drift is a screen-space paint field at low resolution: push strength 25, velocity dissipation 0.975 per frame (a stir fades in about half a second), curl noise scale 0.02, strength 3, brush radius 0 to 100px growing with cursor speed. We copy the model and the constants, then tune by eye against their page.
- **Ambient life (ours, Lusion's particles hold still):** a slow flow along the filaments, calmer than a cursor stir; idle spin when scrolling stops; flares every few seconds (concept v3 §2). Tuned side by side with the Lusion page so the sand never moves faster than their cursor trail.

## 3. Architecture

**Data, from the same Python that made the renders.** `blender/lookdev/export_sand.py` writes `public/lab/sand/*.bin` (Float32/Uint8, versioned, gzip at the edge):
- per grain: chaos position, ball position (the pairing already exists in `chaos_points`), hue, radius, a random seed;
- per grain, **baked shade**: ambient occlusion from local density (how buried the grain is in the ball and in the chaos), computed in numpy. This is how Lusion gets depth without real-time shadows, and it is what makes the ball read as a solid mass;
- the flare streamers (paths from `dense_points`), as a separate small buffer;
- grains are shuffled so any prefix is an even sample: a lower tier draws a prefix.

**Rendering (plain TypeScript on three.js, WebGL2, no React Three Fiber):** one fixed canvas owned by a `Stage` class (from plan 2a). Grains are **instanced camera-facing quads shaded as spheres** (impostors): the fragment shader builds the sphere normal, lights it with the three set lights plus the cursor light, applies the baked shade, and writes corrected depth so near grains hide far ones (high tier; lower tiers skip depth correction). A small per-grain noise on the silhouette gives the rounded-pebble shape. Near-camera grains get a size-based blur only in the last moment before the lens (concept v3). Colour: the hue ramp of `sand_material`, then three's AgX tone mapping to match Blender.

**Motion on the GPU:** chaos→ball blend from one `uCompact` uniform with per-grain timing offsets (the sand pulls inward from the outside first, like the renders); ambient flow = analytic curl noise in the vertex shader, small amplitude; spin = a model rotation (damped scroll velocity + idle rate); flares = the streamer buffer, each cycle re-seeded. The cursor paint field is a 64–128px ping-pong render target (Lusion's ScreenPaint model) sampled in the vertex shader to push grains in screen space.

**Scroll:** Lenis → progress store (from plan 2a) → `uCompact` with frame-rate-independent damping. Reversible by construction.

**Quality:** tiers by GPU signals (plan 2a's `pickTier`): high ~400k grains / mid ~160k / low ~60k, DPR caps 2 / 1.5 / 1, depth correction high only. Runtime governor steps down one tier on sustained slow frames, never back up. `prefers-reduced-motion`: no ambient flow or spin, scroll still compacts. No WebGL2: the approved render as a still.

**Verification:** a compare mode (`/lab/sand?compare=chaos|mid|ball`) places the live view at the exact Blender camera (exported with the data) with a split slider over the render; Playwright captures both and reports per-region colour difference and the measured ball centre; fps logged on a throttled CPU profile and on real devices.

## 4. Tasks (each ends in a check; two reviews with Liam)

1. **Read the Next.js 16 docs** relevant to a client-only route and static assets (`node_modules/next/dist/docs/`), per AGENTS.md. Add `three` (exact version pinned).
2. **Export the data.** `export_sand.py`: positions, pairing, hue, radius, baked shade, flares, the hero and ball cameras. Unit check: grain counts, bounds, ball centre at the origin.
3. **Stage + route.** `/lab/sand`, `Stage`, tiers, governor (ported from plan 2a with its tests).
4. **The material, static.** Dense ball only, frozen, at the Blender camera. Iterate until the compare mode passes. **Checkpoint A, sent to Liam: live vs render, side by side, still.**
5. **Chaos and compaction.** The chaos state at the hero camera; scroll drives `uCompact`; check the mid render.
6. **Life.** Ambient flow, idle spin, scroll spin, flares, tuned next to the Lusion page.
7. **Cursor.** Light + paint field with Lusion's constants; touch follows the finger, fades on release.
8. **Performance and fallbacks.** Tier counts tuned on this Mac with a throttled profile; reduced motion; no-WebGL still.
9. **Deploy preview. Checkpoint B, Liam reviews live on his devices.**

## 5. Risks

- **Matching Cycles in real time.** Real shadows inside the ball are what make it read as a mass. Mitigation: the baked per-grain shade (Lusion's own approach); if still flat, a cheap screen-space occlusion pass on the high tier.
- **400k impostors with depth writes** can be heavy on integrated GPUs. Mitigation: tiers draw a prefix; depth correction only on high; governor.
- **The paint field drift fighting the scroll compaction.** The drift is screen-space and decays in half a second; it offsets grains, never their targets, so compaction always wins.
