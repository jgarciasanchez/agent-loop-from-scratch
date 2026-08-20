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

## Stack

TypeScript, Node.js, ESM, Anthropic SDK

## Next steps

- **`02-eval-harness`** — Build an eval harness with a fixed set of tasks and
  expected outcomes, so changes to tool descriptions, context, or agent behavior
  can be measured instead of judged by intuition.