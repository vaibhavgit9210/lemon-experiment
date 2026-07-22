# BUILD PLAN — lemon v2 "the living room"

Handoff spec. Read `PSYCHOLOGY.md` first (the character model — every dialogue
rule maps to literature there). This file specifies the visual/animation/action
overhaul. The v1 foundation is LIVE and working — do not regress it.

## 0. What already exists (do not rebuild)

- **Live game:** https://vaibhavkumar.is-a.dev/lemon-experiment/ (repo
  `vaibhavgit9210/lemon-experiment`; deploy = push `main` AND `main:gh-pages`;
  remote uses the `github-personal` SSH alias).
- **`index.html`** — single file, no dependencies (house style: must work
  offline/file:// except LLM calls). 320×180 canvas scene, palette lerp on
  hope, chat UI, choice chips, localStorage save (`lemon.v1`), moody-day
  system, procedural WebAudio lofi, win cutscene, analytics beacon (keep it).
- **`worker/`** — Cloudflare Worker `lemon-brain` (account vaibhavpro9210),
  DEPLOYED with secrets set (GROQ_API_KEY, GEMINI_API_KEY, IP_SALT). Chain:
  groq llama-3.3-70b → llama-3.1-8b → gemini-3.5-flash. KV rate limit
  80/IP/day, 450 global. Returns `{text, model}`; `{busy:true}` on exhaustion
  (client plays it as "not in the mood"). Reply ends with hidden
  `@@hope:-1|0|1@@` tag; client strips + applies (+4/+1/−2, floor 5, win ≥100).
- **Dev hooks:** `index.html#test:girl:70` boots into the room at hope 70.
  Headless Chrome screenshot loop is the verification method (command in
  workspace CLAUDE.md).

## 1. Vision

Reference: cozy lofi pixel-art rooms (city night through a big window, dense
warm clutter, everything subtly moving). Three pillars:

1. **Lively, cozy, colorful at every hope level.** Color is never withheld —
   low hope is dusk-blue cozy with warm lamp pockets; high hope is
   golden-hour. Hope shifts warmth + tidiness + which props are active, not
   "gray vs color".
2. **A depressed person's real nest**: recreational substances, gaming
   electronics, books, food debris. The room IS the psychology — cheap-dopamine
   props cluster near the bed; effortful-life props (shoes, guitar, desk) sit
   neglected until hope rises.
3. **≥100 unique actions**, most triggered by the LLM's reply, the rest
   autonomous idle behavior. The room should never be fully still.

## 2. Rendering architecture (rewrite the scene, keep the page)

- **Up-res the canvas to 480×270** (2× on the 960px stage, still chunky-pixel
  via `image-rendering: pixelated`). This is what allows reference-level
  detail density. All geometry below is in 480×270 coordinates.
- **Three layers (offscreen canvases), composited each frame:**
  - `bgLayer` — walls, floor, furniture, dithered light beams. Re-render ONLY
    when `(round(hope01,2), minuteOfDay, moodyDay, propsChanged)` changes.
  - `animLayer` — cleared every frame: character, cat, particles, prop
    animations, window life.
  - `fxLayer` — screen-space effects (shake, flash, vignette pulse, zoom
    drift). Implement shake/zoom as draw-offset/scale of the composite, not
    per-object.
- **Dithering** is the signature texture: 2×2 checkerboard patterns via
  `createPattern` (cache per color string). Use on: wall gradient bands, light
  beams, lamp pool edge, moon halo, rug shading.
- **Palette**: keep the `[low, high]` lerp system but re-tune cozy-colorful:
  wood floor (plum→warm oak), terracotta/mauve walls, coral+cream striped
  blanket, teal rug with rose border, warm-wood door. Décor prints (posters,
  book spines, polaroids) use constant saturated colors — they don't lerp.
- **Perf budget**: ≤2ms/frame draw. Particle cap ~120 live. If dithered
  regions are hot, they live in `bgLayer` (rarely redrawn).
- Save format: bump to `lemon.v2`; migrate v1 saves (keep name/gender/hope/
  day/history; add `facts`, `propsSeen`, `settings`).

## 3. The room (prop list)

Layout (480×270): bed left · rug + floor-life center · big window
center-right · desk/battlestation under-right of window · door far right.
Floor line y≈198; wall 0..198.

**Window (the centerpiece, per reference images)** — widen to ~96×72:
two-layer city skyline silhouette, ~40 lit windows (1px, individual slow
flicker phases), red antenna blink, moon + dithered halo, drifting clouds,
stars twinkle, occasional shooting star (~40s), **a train crossing the
horizon** with lit windows (~90s, 3s duration), dawn birds (tiny 2px vees) in
morning hours, rain streaks + droplets sliding on glass on moody days, rare
distant lightning. Sky gradient follows the player's real clock (keep v1
logic). Curtains both sides (dusty rose) with 1px sway; curtain openness is a
STATE (0–3) actions can change. Windowsill: cactus pot + incense stick
(thin smoke wisp when lit).

**Sleep zone (cheap-dopamine cluster)**: bed with coral striped blanket +
cream pillow; **orange tabby cat** (10+ behaviors, see catalog); phone on
mattress (glow cone on face when doomscrolling); bedside crate: ashtray
(ember glow), lighter, **beer bottles** (count grows at low hope, gets cleared
into a bin at high hope), chips bag, tissue box; under-bed shadow with one
sock. **Bong/joint**: drawn small and matter-of-fact on the crate — see
substances policy §7.

**Battlestation**: desk with laptop (animated screen: scrolling code / video
color-bars / paused game), CRT TV on a low stand + retro console + controller
on a cable snaking the rug, console power LED "breathing", headphones on a
hook, RGB keyboard strip (slow hue cycle, an actual light source at night),
mug with steam, energy-drink can cluster, mousepad. TV content states: off /
static / game (two pixel paddles) / game-over screen / lofi-girl-style video.

**Book & life zone**: wall shelf with ~12 colored spines + one fallen-flat
book; floor book stack near bed (top one open, face down); manga pile;
**hobby prop reflecting the seeded trait** (guitar leaning on wall / sketch
pad + pinned drawings / running shoes by the door / camera + hanging prints /
skateboard against wall) — dusty at low hope (grayer tint), "picked up" at
high hope. Posters (sunset print, teal wave print) + polaroid cluster +
pennant. String **fairy lights** sagging across the wall (amber/pink/teal/
lilac, twinkle phases; flicker-dim at low hope, full at high). Wall clock
showing REAL local time (moving hands). Monstera pot (leaves nod, grows with
hope) + hanging vine over the shelf. Laundry pile (shrinks with hope), pizza
box, water bottle. Mini-fridge with magnet letters spelling something dumb;
its door can open (light spill) for fridge actions.

**Door zone**: warm wood door, hoodie on a hook beside it, shoe pair (at low
hope: one shoe missing, found later — tiny narrative), light strip under door
at high hope (keep v1 mechanic).

## 4. Action system (the core new tech)

### 4.1 Registry

Every action = `{ id, layer, dur, blocking?, cooldown?, requires?, update(t),
draw(t) }` in a single `ACTIONS` registry object. A small scheduler runs
parallel non-blocking actions + one blocking "performance" at a time.
Character locomotion = waypoint walk (bed↔rug↔window↔desk↔door) with an
8-frame walk cycle; actions that need a location auto-path first.

### 4.2 Trigger protocol (LLM-driven)

Worker reply tag extends to:

```
@@hope:-1|0|1|act:ID[+ID2]|mood:flat|dry|soft|open|bright@@
```

- Worker system prompt lists ONLY the ~40 action IDs valid for the current
  stage/props (keeps tokens down) with one-line semantics, and instructs: pick
  0–2 acts that match what you SAY (never contradict the text), prefer small
  ones.
- Client validates IDs against the registry (unknown → dropped), queues them.
  `mood:` drives typing-speed/pauses of the typewriter + character emote layer.
- **Fallback heuristic** when tags are missing/mangled: client keyword-matcher
  (e.g. reply contains "cig"/"smoke" → `smoke_window`; "tired" → `yawn`) so
  animations still fire on 8B-model days.
- **Autonomous idle pool**: every 6–14s pick a weighted idle action based on
  (hope tier, hour, moody). The room never freezes even if the player idles.

### 4.3 The catalog (target ≥100 — this list is 130; IDs are final)

**Locomotion/posture (14):** `walk_to_bed, walk_to_rug, walk_to_window,
walk_to_desk, walk_to_door, collapse_bed, sit_up, sit_edge, stand_up,
sit_floor_against_bed, hug_knees, lie_starfish, face_wall, pace_small`

**Bed/sleep (8):** `burrow_blanket, blanket_over_head, toss_turn, zzz_drift,
nap_micro (screen dims 3s), wake_jolt, stare_ceiling, pillow_hug`

**Phone (8):** `doomscroll (glow cone + thumb flick), phone_drop_face,
phone_toss_bedend, check_lock_check (3 quick glows), photo_scroll_pause
(longer glow + sigh), phone_face_down, alarm_dismiss, type_delete_type
(typing bubbles appear/vanish)`

**Gaming (10):** `console_on (LED+TV wake), console_off, grab_controller,
rage_pause (controller down, head back), small_victory (fist pixel + confetti
puff), headset_on, tv_static, game_over_screen, afk_menu_loop, unplug_cable
(sad beat)`

**Substances (10)** — see policy §7: `crack_beer (psst particle + bottle
joins crate), sip_beer, push_bottle_away (high-hope refusal — a VISIBLE
recovery beat), light_cig_window (window cracks open + smoke wisps drift
out), stub_out, bong_hit_implied (character leans off-screen-edge of frame,
only smoke drifts back in), ashtray_ember (idle glow pulse), incense_light,
bottles_to_bin (cleanup, high hope), fridge_beer_stare (open fridge, stare,
close it empty-handed)`

**Suggestive-implied (4)** — never explicit, camera always "looks away":
`privacy_mode (lamp off, phone glow only, chat shows "(…)" for 20s, then lamp
back on + character showers after — the whole thing reads via light),
long_shower (steam from door edge, 10s), blanket_shift (single subtle blanket
ripple + character fully hidden, cut to window view 4s), get_dressed_finally
(hoodie swap behind bed, only head visible)`

**Self-care (12):** `drink_water, refill_glass, curtain_open_notch,
curtain_close, window_crack_open, shower_quick (door steam 5s), brush_teeth
(timer bubble), stretch_arms, deep_breath (chest + particles), make_bed_half,
eat_something_real (bowl replaces chips bag 60s), splash_face`

**Cat (10):** `cat_tail_flick, cat_ear_twitch, cat_stretch_long, cat_knead,
cat_walk_to_rug, cat_lap_sit (only when character sits — big +cozy),
cat_headbutt_hand, cat_window_watch (cat + character watch city together),
cat_zoomies (3s dash circuit), cat_feed (bowl + crunch particles)`

**Room objects (12):** `water_plant (droplets + one new leaf), plant_new_leaf,
tidy_one_item (random floor item vanishes), laundry_shove, pizza_box_close,
fridge_snack (light spill + munch), kettle_on (steam + mug refill),
radio_toggle, fairy_lights_toggle, poster_straighten, book_pick_up
(reads on floor 8s, open-book overlay), book_toss`

**Emotes (12)** — 8px overlay bubbles/effects at head: `sigh_visible (breath
puff), laugh_real ("ha" particles + head tilt), smile_small (1px mouth shift),
eye_glisten (single shine pixel, NO sobbing), blush, eyeroll, wince,
shrug, nod_slow, headshake, ellipsis_bubble (…), note_bubble (♪)`

**Music (6):** `headphones_on, headphones_off, head_bob (syncs to WebAudio
pad tempo), vinyl_on (record spins on shelf + note particles), vinyl_off,
volume_up_gesture`

**Window/world (14):** `rain_start, rain_stop, lightning_far, shooting_star,
train_pass, city_flicker_wave, birds_morning, fireworks_rare (festival
nights — 1% of evenings, big cozy moment), fog_roll, moon_halo_pulse,
streetlight_flicker, neon_sign_toggle (a distant pink sign), plane_blink_cross,
window_watch_together (character + cat silhouette vs city — poster shot)`

**Screen/FX (10):** `shake_small (vibration — phone buzz feel), shake_big,
zoom_drift_in, zoom_reset, vignette_breathe, heartbeat_pulse (2 slow red-tinged
pulses for heavy moments), dream_desat (brief), warm_flash (golden 300ms on
+1 hope), confetti_win, letterbox_cinematic (win cutscene + special beats)`

**Time/meta (10):** `day_fastforward (sky wipes to next band when player says
goodnight), lamp_toggle, lamp_flicker, laptop_wake, laptop_sleep,
clock_glance (character looks at wall clock), door_glance, door_touch_retreat
(hand on handle… not yet — a chill-inducing near-win beat at hope 85+),
door_open_crack (light sliver + close), hope_bloom (palette warm-pulses,
plays automatically on every +1)`

Total: 14+8+8+10+10+4+12+10+12+12+6+14+10+10 = **130**.

### 4.4 QA harness (mandatory)

- Extend dev hook: `#test:girl:70:moody` (force moody) and
  `#act:cat_zoomies+shake_small` (force-play actions on load).
- `#gallery` mode: auto-cycles every action in the registry 2s apart with the
  ID rendered top-left — screenshot this with headless Chrome at several
  timestamps to verify all 130 visually. A `console.assert` that every
  catalog ID above exists in the registry (embed the ID list in a test array).

## 5. Character sprite v2

- ~20×32px at the new resolution, procedurally drawn (keep the rect approach
  but move to per-pose **pixel-map string arrays** — far easier to iterate:
  `".oohh." `-style rows with a char→palette-key legend).
- Poses: lie, lie-phone, sit-edge, sit-floor, hug-knees, stand, lean-window,
  walk×8, reach, drink, controller-held, headphones variants (band + pads
  overlay any pose).
- 1px outline (dark plum, not black), 2-tone shading, breathing offset,
  blink, gaze direction (eyes look toward window/door/phone based on last
  action).
- Boy/girl variants: hair shape/length + shirt color (boy sage-teal, girl
  mustard); same rig.

## 6. Worker upgrade (dialogue quality)

Rewrite `systemPrompt()` to implement `PSYCHOLOGY.md` §The model. Structure:

1. **Identity**: adult, early 20s, weeks inside; behavioral shutdown not
   sadness-drama; anhedonia = effort-cost inflation.
2. **Seeded life specifics** (deterministic from `state.seed` sent by client):
   abandoned hobby (matches the room prop!), ignored friend's name, missed
   food, what they doomscroll, what's on the floor. Keep consistent forever.
3. **The effort economy** (the user's core note): zero-effort numbing asks
   (scroll, snacks, sleep, masturbation, weed, beer, one more game) get an
   EASY flat yes — these are the only buttons that still work; brief relief,
   then emptier, mild shame shown in tone. Effortful asks get "yeah, but…"
   unless trust is high AND the step is tiny. 3rd+ numbing suggestion in a
   row from the player = feels like sabotage → withdraw, −1.
4. **MI dynamics**: advice/commands/cheerleading → sustain talk or
   withdrawal (−1); open questions, reflections, being remembered → opens up
   (+1). Ambivalence: at hope>50 change talk slips out unprompted.
5. **Clock + stage voice**: morning worst / evening looser / deep-night
   unguarded-honest; bed=fragments+absolutist words, sitting=dry jokes,
   window=future tense appears, door=almost themselves (see PSYCHOLOGY.md §7).
6. **Action picking**: the ~40 stage-valid action IDs + "pick 0–2 that match
   your words".
7. **Hard lines**: sexual topics = one dry non-graphic line + optional
   implied act (`privacy_mode`), never narration, shut down pushes
   in-character; substances = honest, never glamorized, never instructed-how,
   refusals emerge at high hope; NO self-harm content ever (scared-honest
   deflection + hopeful trajectory); never break character / mention AI.
8. **Tag**: `@@hope:…|act:…|mood:…@@` exactly once, last line.

Client additions: send `hour` (0–23) + `seed` in `state`. Bump
`max_tokens` to 380. Re-test after deploy with probes: numbing-compliance
(expect flat yes, non-graphic, hope:0 + a substances/phone act), pushy
command (expect −1 + withdraw act), tiny-step at high hope (+1 + self-care
act), morning flatness (short reply), explicit-push (expect in-character
shutdown, no explicit text).

## 7. Content policy (do not drift)

- **Substances**: shown matter-of-factly as part of the character's real
  coping (this is honest to the psychology — cheap dopamine), never
  glamorized, never how-to, and the recovery arc makes *declining* them the
  visible win (`push_bottle_away`, `bottles_to_bin`). Add a settings toggle
  `substances: on/off` (off swaps crate props for soda cans; default on).
- **Sexual content**: implied-only staging per the catalog; the character is
  an adult; dialogue = one dry acknowledgment max; NO nudity, NO narration,
  NO erotica regardless of user pushing. The "camera looks away" rule is
  absolute.
- **Self-harm**: never, in either direction; scared-honest in-character
  deflection; helpline note stays on the intro screen.
- Game remains, in trajectory, uplifting: you can never lose.

## 8. Audio v2 (procedural, still no assets)

- Pad: real voicings (Am7→Fmaj7→Cmaj7→G6), tape-wobble (slow detune LFO),
  sidechain-style gain dip at 62bpm, rain + crackle layers (keep).
- One-shot SFX synthesized on actions: soft blip (message), purr (noise burst
  lowpass tremolo), can-crack (filtered noise click), rain intensity tied to
  moody, TV static hiss, shower white-noise band. All ≤20 lines each.
- Head-bob and note particles sync to the 62bpm clock.

## 9. Build order (each step ends with headless-Chrome screenshots)

1. Canvas up-res + layer system + palette re-tune (room reads cozy at hope
   20/50/90, day + night).
2. Window centerpiece (city, train, weather) + curtains.
3. Prop pass (all of §3) + bgLayer caching.
4. Sprite v2 + locomotion/waypoints.
5. Action registry + scheduler + `#gallery` QA mode; implement all 130.
6. Worker prompt v2 + deploy + the 5 probes in §6.
7. Client tag parsing (act/mood) + fallback matcher + idle pool.
8. Audio v2. 9. Win cutscene v2 (letterbox + fireworks + sunrise).
10. Full playthrough test at `#test` hopes; push main + gh-pages; verify live
    URL; update workspace CLAUDE.md + memory.

## 10. Nice-to-have (only if everything above lands)

- Fact memory: after each reply, cheap 8B extraction call harvests new
  character facts → localStorage → injected as "things you've mentioned
  before" (costs 2× quota; gate behind a setting).
- Real lofi tracks (user picks, commit ≤4MB total).
- OG-image + title screen polish for sharing.
