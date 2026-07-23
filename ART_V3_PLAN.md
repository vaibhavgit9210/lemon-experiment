# lemon-experiment v3 — Cyberpunk "Neon-Noir → Dawn" visual overhaul

## Context

The current lemon-experiment art is boxy and flat: the room is ~150 flat `fillRect`s, the character is a tiny 8-pose rect figure, and of the 140 registered action ids only ~40–50 are visually distinct (~63 are "…" bubble stubs). The user wants reference-quality lofi-cyberpunk pixel art (dense detail, neon color, constant ambient motion) with **100+ visually unique animations** (e.g. listening to music), live on GitHub Pages.

Research conclusion: the GitHub pixel-art-tools collection is authoring editors (Aseprite/Piskel/etc.), not runtime libraries — nothing there fits the single-file/zero-dependency/offline house style. The path to reference quality is upgrading the existing procedural renderer with real pixel-art techniques: 3–4 step color ramps with hue-shifted shadows, selective outlines, dithered gradients, additive neon glow, and dense data-driven animated detail (signs, rain, traffic, screens).

User decisions (confirmed):
1. **Hope arc = neon-noir → dawn**: low hope is rain-soaked purple/magenta/cyan neon night; as hope rises rain stops, neon fades, dawn breaks over the megacity. Preserves "color is never withheld, only re-warmed".
2. **Character**: bigger (~48px tall) procedural rig with ramps — stays hand-writable code.
3. **Actions**: upgrade ALL existing 140 catalog ids to distinct animations + add ~18 new cyberpunk ids; worker gets a superset vocab update + redeploy.

## Files

- `lemon-experiment/index.html` (1399 lines) — everything except Phase 5 lands here. Final size ≈ 2,700–2,900 lines (~120 KB, fine for Pages).
- `lemon-experiment/worker/worker.js` — `STAGES[*].acts` lists (lines 51–68) superset update + `npx wrangler deploy` (account vaibhavpro9210, secrets already set).
- `lemon-experiment/README.md` — update copy at the end.
- `art-mock.html` — read-only look reference; do not modify.

## Invariants (never touch)

- Single file, zero deps, no CDN, offline-capable.
- `lemon.v2` save shape & `migrateV1` (lines 145–160); `parseTag`/`@@hope|mood|act@@` regexes (1087–1105); `playAct` scheduler semantics (683–704); `winGame` cutscene flow (restyle visuals only); moody-day/DARK_RE safety lines; worker rate limits & model CHAIN; the beacon `<script>` at the bottom stays byte-identical.
- `privacy_mode`/`reach_out` keep their quiet tone — never flashy.
- All `R.*` keys and `WP.*` waypoints keep (nearly) the same coordinates — ~85 action defs reference them. Window grows up/left only.
- `POSES` external signature `(ctx,x,y,c,br)` and existing pose names stay valid so every `pose:` field keeps working.

## Phase 1 — Palette & render core (+~150 lines) — playable after

At lines 221–245 + `drawBG()` head (~296):
- `PAL[key]` becomes 3-stop `[nightNeon, mid(=today's col 0), dawn(=today's col 1 warmed)]`; add `mix3(a,t)` (piecewise 2-segment lerp); line 296 becomes `P[k]=mix3(PAL[k],t)`. `P` stays flat — all `P.wall` etc. call sites survive.
- `warmC`/`coolC` targets become hope-lerped `SHADE` (night: highlight→neon magenta/cyan, shadow→blue-violet; dawn: highlight→sun-gold). Keep function names (20+ call sites).
- `ramp(c)` → `[coolC(c,.38), coolC(c,.16), c, warmC(c,.28)]`; precompute `RP[k]=ramp(P[k])` per BG rebuild; global outline color `OUT = mix3([...],t)`.
- `neon(ctx,x,y,w,h,col,s)` — core rect + 2-ring dithered additive halo (`lighter` + cached `pat()`), same technique as existing lamp bloom.
- `nightAmt() = clamp(1 - hope01*1.35, 0, 1)` — hope drives the sky/time-of-day; win forces dawn (existing `winPhase` term). Re-point `isNight()`/`isMorning()` at thresholds of it. `skyColors()` becomes pure hope: `#0a0620/#2a1050` night → `#3a5a9a/#ff9a5e` dawn.
- Replace `DECOR` non-lerped prints with a `NEON` constants table (magenta/cyan/amber sign colors).

Verify: screenshots at `#test:girl:5|50|95` — night-purple / dusk / golden, geometry unchanged.

## Phase 2 — Scene rewrite (+~450 / −230 lines, replaces lines 293–522) — playable after

Geometry (`R`, keep keys): `R.window` → `{x:252,y:26,w:176,h:92}` (window-wall; desk monitors silhouette against city). Additive keys: `R.monitor`, `R.billboard`, `R.led` (bed-platform LED strip), `R.synth`, `R.vr`. `WP`/`FLOOR` unchanged.

New `drawBG()` split into subs (all cached on BG; existing bgKey `round(hope01*40)|…` invalidation already covers hope-dependent spill):
1. `bgWalls` — dithered bands + grain + **neon spill** pools (magenta/cyan low-alpha dither around window/floor, intensity `nightAmt()`).
2. `bgCityStatic` — hope-lerped sky, 3 parallax silhouette bands (seeded from `S.seed` as today), unlit window grids, dark sign housings at `SIGNS` positions, rising dawn sun at `hope01>0.6`, curtains logic verbatim.
3. `bgFurniture` — platform bed w/ LED under-glow channel, ramped+selout blanket, crate→bedside console (ashtray/beer logic verbatim), desk→battlestation, TV kept, door keypad, plant.
4. `bgDressing` — holo-poster frames, server/router shelf + cables, ramen cup, kotatsu-style table (R.rug coords unchanged), micro-LED string, AO seams + rim lights re-targeted (rim = `SHADE.hi`).

Data-driven animated city (per-frame on AN, replacing `drawWindowLife()` call at line 1123 — keep exported `trainX/trainNext/shootT`, actions poke them):
- `SIGNS[]` seeded {x,y,w,h,col,mode:flicker|pulse|scrollText|kanjiBlink,ph}; drawn with `neon()`, global intensity = `nightAmt()` (they die at dawn).
- Holo-billboard: scrolling glyphs + 0.4s glitch every ~7s.
- `CARS[]` flying vehicles (headlight streak + tail dot), spawn rate ∝ nightAmt().
- `RAINP[]` pooled streaks, count = `70*rainAmt()` where `rainAmt() ≈ (1-hope01)*1.15` (moody-day boost; `WORLD.rainOn` still works); glass drips at high rain.
- Keep cloud/smog bank, train→maglev light-line, shooting star, dawn birds.
- New `drawInteriorLife()`: monitor contents via `SCREENS.*` (Phase 4), LED hue cycle (neon-pink→warm-white with hope), RGB keyboard (move line 1125 here), vent steam, holo-poster shimmer.

Verify: shots hope 5/50/95 × boy/girl + `#test:girl:5:moody` (max rain); confirm no per-frame content leaked into cached BG (flicker check).

## Phase 3 — Character rig v2 (+~350 / −100 lines, replaces lines 528–624) — playable after

- Parametric rig: `limb()` (2-segment, 2px cells, ramp-shaded edge), `torso()`, `head2()` (12×11: outline, 2-tone skin, 3-tone gendered hair, 2px eyes+shine, expr set neutral|sad|soft|happy|closed|wide|wink, mouth, blush; writes `RIG.head` for overlays).
- `drawRig(ctx,x,y,c,p)` with pose params {crouch, lean, headTilt, expr, armL/R:[a1,a2], legL/R:[a1,a2], sitH, lieAngle}; `kf(frames,t)` numeric keyframe lerp; `DP(id,fn)` registers a pose as `POSES[id]=(ctx,x,y,c,br)=>drawRig(...)`.
- Rebuild all 8 existing pose names via `DP()`, then add ~10: `sit_desk, sit_kotatsu, kneel, dance, air_guitar, lie_side, slump_wall, stretch, crouch, headbang`.
- `ccol()` extends to ramp arrays (skin/hair/shirt/pants via `ramp()`) — character re-warms with room.
- Overlays use `RIG.head`; `poseHeadY()` kept as thin wrapper (12+ actions call `headPos()`). Held-item registry `HELD={controller,phone,mug,ramen,book,vrHeadset,headphones,…}` so `hold:"x"` just works.
- Cat: 3-tone ramp + outline, +`loaf`,`tail_up` poses; keep `CAT` shape/pose names (actions poke them directly).
- Redraw intro pick canvases (lines 1347–1353) with new rig; tune bed/pillow lie offsets to taller rig.

Verify: `#test:boy:50` / `#test:girl:50` shots; `#gallery` sweep — unknown pose falls back to stand (safety net), QA flags it.

## Phase 4 — Animation library: 0 stubs, ~158 distinct actions (+~830 lines, 3 sub-phases, playable throughout)

Shared machinery first (~120 lines before ACT registry):
- `SCREENS = {game, chat, code, static, gameover, eq, map, off}` — mini-renderers into any rect (TV/laptop/monitor/phone/billboard), each with scanline pass + faint `neon()` edge.
- `eqBars()` floating equalizer bars; `holo(ctx,alpha,fn)` cyan additive + flicker + slice-offset wrapper; `puffs()` steam/smoke emitter over `spawn()`; `arcHand()` arm-keyframe convenience.

4a — restyle all ~57 ids in `STAGE_ACTIONS` (lines 670–675; what the LLM actually fires — highest ROI). Mostly re-pointing `draw:` bodies at the new rig/ramps/SCREENS (e.g. doomscroll gets phone-glow on face).

4b — kill the ~63 `todo` stubs, grouped (avg ~6 lines each using machinery). Required migration sweep: grep EXTRA window-world actions for hardcoded `300,36`/`,96,76` literals (lines ~1031–1045) → re-anchor to new `R.window`. Add `TODO[n]` counter to `#qa` title; drive to `TODO[0]`. Keep the safety stub-fallback loop (line 1069).

4c — ~18 new cyberpunk ids appended to CATALOG: `music_immerse` (headphones + eqBars + headbang/head_bob), `synth_jam`, `vr_session`, `holo_pet_summon/play` (real cat stares at it), `ramen_slurp`, `cyberdeck_type`, `drone_toy_fly`, `neon_sign_fix`, `city_gaze_long`, `led_color_shift`, `billboard_glitch`, `siren_pass`, `drone_delivery`, `dance_break`, `rooftop_cat_visitor`, etc.

## Phase 5 — Worker sync (+~25 lines + deploy)

- `STAGES[*].acts` in worker.js (lines 51–68): superset per stage, each list ≤ ~22 ids (prompt-size discipline). bed: `+music_immerse ramen_slurp phone_face_down blanket_over_head`; sit: `+synth_jam vr_session ramen_slurp holo_pet_summon cyberdeck_type music_immerse`; window: `+city_gaze_long neon_sign_fix drone_delivery led_color_shift`; door: `+dance_break tidy_one_item synth_jam`.
- Mirror EXACTLY into `STAGE_ACTIONS` in index.html — both sides must agree.
- Ship client (Pages) first, then `cd worker && npx wrangler deploy` (old clients drop unknown ids gracefully anyway).

## Phase 6 — Audio retune (nice-to-have, ~40 lines in 1184–1213)

Data-only: wider Am9/Em7/Fmaj9/Dm7 voicings, tempo 3900→4400ms, rain-gain node follows `rainAmt()` live, quiet detuned-saw city hum (−30dB, LP 220Hz) following `nightAmt()`, `sfx("synth")` pluck for music actions.

## Phase 7 — Verification harness & sweep (+~25 lines)

Existing hooks: `#test:g:hope[:moody]`, `#gallery`, `#act:id+id2`, `#win`, `#qa`. Add:
- `#shot:id:hope:g` — deterministic screenshot mode (fixed `S.seed=7`, seeded Math.random, action at t=0).
- `#gallery:INDEX` start offset.

Headless-Chrome loop (project convention, run from scratchpad):
```bash
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
F="file:///Users/vaibhavkumar/Documents/personal/me/lemon-experiment/index.html"
for h in 5 35 70 95; do for g in boy girl; do
  "$CH" --headless=new --disable-gpu --use-angle=swiftshader --window-size=1280,800 \
    --virtual-time-budget=6000 --screenshot="room_${g}_${h}.png" "$F#test:$g:$h"; done; done
while read id; do "$CH" --headless=new --disable-gpu --use-angle=swiftshader --window-size=1280,800 \
  --virtual-time-budget=2600 --screenshot="act_${id}.png" "$F#shot:$id:50:girl"; done < catalog.txt
"$CH" --headless=new --disable-gpu --virtual-time-budget=4000 --dump-dom "$F#qa" | grep -o '<title>[^<]*'
```
Distinctness gate: `compare -metric AE act_none.png act_ID.png` — any action differing from idle by <~40px is visually inert → fix. `montage act_*.png -tile 10x contact.png` for eyeball pass. Run full sweep after Phases 2, 3, and each 4x sub-phase. Final: `#qa` title `QA_PASS … TODO[0]`.

## Phase 8 — Ship

- Update README (v3, neon-noir→dawn arc, action count) and header comment version.
- Push to `vaibhavgit9210/lemon-experiment` via `github-personal` remote (main → Pages). Curl/screenshot the live URL https://vaibhavgit9210.github.io/lemon-experiment/ to verify.
- Deploy worker (Phase 5).

## Known migration sweeps checklist

(a) hardcoded window literals in EXTRA window-world actions; (b) `isNight()` call sites → `nightAmt()`; (c) `DECOR` → `NEON` table; (d) README copy.
