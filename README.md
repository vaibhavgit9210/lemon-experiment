# lemon

A small game about gently talking someone back to the world.

Someone hasn't left their room in a while. You play the small voice inside them
that still wants to. Be patient, be kind — there is no way to lose, only slower
ways to win. When hope fills up, they step outside. Some days they won't talk
at all; come back tomorrow, it still counts.

**Play:** https://vaibhavgit9210.github.io/lemon-experiment/

## How it works

- `index.html` — the whole game (v3, cyberpunk). Single file, zero dependencies.
  Detailed procedural pixel art on a 480×270 canvas with three cached layers
  (background / animation / screen-FX): 4-step hue-shifted colour ramps, additive
  neon glow, dithering, and animated depth. **Hope drives the time of day** — a
  rain-soaked magenta/cyan neon night at low hope warms all the way to dawn over
  the megacity at high hope. Colour is never withheld, only re-warmed. The window
  is a full wall onto an animated city (parallax skyline, blinking windows, neon
  signs, a scrolling holo-billboard, flying cars, rain, a maglev light-line), the
  interior a lofi battlestation (dual monitors, RGB keyboard, LED bed strip, synth,
  ramen, server shelf). A ~48px parametric character rig (ramp-shaded, gendered
  hair, expressions, held items) with waypoint locomotion, plus a neon-lit cat.
  A **159-action registry** — including cyberpunk beats like `music_immerse`
  (headphones + floating equaliser), `synth_jam`, `vr_session`, `holo_pet`,
  `cyberdeck_type`, `dance_break` — driven by the model's reply tag plus an
  autonomous idle pool. Procedural lofi (Am9–Fmaj9–Dm9–Em7 pad, tape wobble, rain,
  crackle, synth SFX) via WebAudio. State in localStorage (`lemon.v2`).
- `worker/` — `lemon-brain`, a Cloudflare Worker that holds the LLM keys as
  secrets and rate-limits per visitor (salted IP hashes, no raw IPs). Cascades
  across free tiers: Groq llama-3.3-70b → llama-3.1-8b → Gemini 3.5 flash. When
  exhausted, the character is "not in the mood to talk" — quota failure is diegetic.
  The system prompt implements a behavioral-activation + motivational-interviewing
  model of depression (see `PSYCHOLOGY.md`), red-teamed on its hard lines.
- Each reply ends with a hidden `@@hope:H|mood:M|act:IDS@@` tag: `H` (−1/0/1) moves
  the hope stat, `mood` sets the typewriter's cadence, `act` fires 0–2 room
  animations that match what was said. Pushy/preachy lose ground; patient, specific,
  tiny steps gain it. Numbing asks get a flat yes and go nowhere.

## Dev / QA

- `#test:girl:70[:moody]` boots into the room at a hope value (also sets the neon→dawn
  look, since hope drives time-of-day); `#gallery` cycles all actions with their id
  labelled; `#act:id+id2` force-plays actions; `#shot:id:hope:gender` teleports to an
  action's spot and freezes it mid-animation for deterministic screenshots; `#win` runs
  the win cutscene; `#qa` sandbox-runs every action and puts the verdict in the page
  `<title>` (read with headless Chrome `--dump-dom`).
- Worker: `cd worker && npx wrangler deploy`. Secrets: `GROQ_API_KEY`,
  `GEMINI_API_KEY`, `IP_SALT` (via `npx wrangler secret put`).

Not therapy, just a toy — the intro screen says so and links a helpline.
