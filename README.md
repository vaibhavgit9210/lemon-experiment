# lemon

A small game about gently talking someone back to the world.

Someone hasn't left their room in a while. You play the small voice inside them
that still wants to. Be patient, be kind — there is no way to lose, only slower
ways to win. When hope fills up, they step outside. Some days they won't talk
at all; come back tomorrow, it still counts.

**Play:** https://vaibhavgit9210.github.io/lemon-experiment/

## How it works

- `index.html` — the whole game (v2). Single file, zero dependencies. Pixel-art
  room on a 480×270 canvas with three cached layers (background / animation /
  screen-FX), dithered texture, and a palette that lerps from dusk-blue to golden
  hour as hope rises — color is never withheld, only re-warmed. A city window
  (skyline, flickering windows, moon, a crossing train, shooting stars, rain),
  cozy clutter, an orange cat, and a procedural sprite with waypoint locomotion.
  A **141-action registry** driven by the model's reply tag plus an autonomous
  idle pool keeps the room alive. Procedural lofi (Am7–Fmaj7–Cmaj7–G6 pad, tape
  wobble, rain, crackle, synth SFX) via WebAudio. State in localStorage (`lemon.v2`).
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

- `#test:girl:70[:moody]` boots into the room at a hope value; `#gallery` cycles all
  141 actions with their id labelled; `#act:id+id2` force-plays actions; `#win` runs
  the win cutscene; `#qa` sandbox-runs every action and puts the verdict in the page
  `<title>` (read with headless Chrome `--dump-dom`).
- Worker: `cd worker && npx wrangler deploy`. Secrets: `GROQ_API_KEY`,
  `GEMINI_API_KEY`, `IP_SALT` (via `npx wrangler secret put`).

Not therapy, just a toy — the intro screen says so and links a helpline.
