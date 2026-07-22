# lemon

A small game about gently talking someone back to the world.

Someone hasn't left their room in a while. You play the small voice inside them
that still wants to. Be patient, be kind — there is no way to lose, only slower
ways to win. When hope fills up, they step outside. Some days they won't talk
at all; come back tomorrow, it still counts.

**Play:** https://vaibhavgit9210.github.io/lemon-experiment/

## How it works

- `index.html` — the whole game. Single file, zero dependencies. Hand-drawn
  pixel-art room on a 320×180 canvas (palette lerps from cold indigo to warm
  amber as hope rises; window sky follows your real local time). Procedural
  lofi ambience (rain + vinyl crackle + chord pad) via WebAudio. State in
  localStorage.
- `worker/` — `lemon-brain`, a Cloudflare Worker that holds the LLM API keys
  as secrets and rate-limits per visitor (salted IP hashes, no raw IPs).
  Cascades across free tiers: Groq llama-3.3-70b → llama-3.1-8b → Gemini
  3.5 flash. When everything is exhausted, the character is "not in the mood
  to talk" — quota failure is diegetic.
- The model ends each reply with a hidden `@@hope:-1|0|1@@` tag judging how
  the player's message landed; the client strips it and moves the hope stat.
  Pushy and preachy lose ground; patient, specific, tiny steps gain it.

## Dev

- `index.html#test:girl:70` boots straight into the room at a given hope value.
- Worker: `cd worker && npx wrangler deploy`. Secrets: `GROQ_API_KEY`,
  `GEMINI_API_KEY`, `IP_SALT` (via `npx wrangler secret put`).

Not therapy, just a toy — the intro screen says so and links a helpline.
