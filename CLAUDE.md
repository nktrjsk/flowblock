# Claude Code instructions for FlowBlock

## plan.md

`plan.md` is the source of truth for what to work on next.

- After every committed change, open `plan.md` and mark completed items with `[x]`.
- When deciding what to do next, consult `plan.md` and pick the next unchecked item.

## Coding guidelines

### 1. Think before coding
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If something is unclear, stop, name what's confusing, and ask.

### 2. Simplicity first
- Minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked.
- No abstractions for single-use code.
- No error handling for impossible scenarios.

### 3. Surgical changes
- Touch only what you must. Don't "improve" adjacent code or formatting.
- Match existing style, even if you'd do it differently.
- Remove only imports/variables/functions that YOUR changes made unused.
- Every changed line should trace directly to the user's request.

### 4. Goal-driven execution
- Define verifiable success criteria before starting.
- For multi-step tasks, state a brief plan with verification steps.
- Loop until criteria are met before declaring done.
