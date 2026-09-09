# agent-loop-from-scratch

## What is this project about?

It's my personal research related to AI technologies, focused on the creation
of an agent loop with the SDK without the use of frameworks.

## Why without frameworks?

The main reason is the liberty that I get, as I'm able to run my own tests on
performance, scalability, etc.

This is the best way I have learned to fully understand technology.

## Index

- **`01-minimal-loop`** — It's the foundation of an agent loop. It implements
  some filesystem tools locally coded. But it is already treated as production
  code, that's why I tried to keep security standards such as path containment.
  It also includes instrumentation to measure token usage and context growth.
- **`web`** — A mini React/TSX chat interface for `01-minimal-loop`, served by
  `01-minimal-loop/server.ts`.

## Stack

TypeScript, Node.js, ESM, Anthropic SDK

## Next steps

- **`02-eval-harness`** — Build an eval harness with a fixed set of tasks and
  expected outcomes, so changes to tool descriptions, context, or agent behavior
  can be measured instead of judged by intuition.

  ## Running it

Requires an Anthropic API key in `ANTHROPIC_API_KEY`.

```bash
npm install
npm run loop   # runs 01-minimal-loop as a CLI
```

### Web UI

```bash
npm run server        # HTTP API for the agent loop, on :3001
cd web && npm install
npm run dev            # from web/, or `npm run web` from the repo root
```

Then open http://localhost:5173.
