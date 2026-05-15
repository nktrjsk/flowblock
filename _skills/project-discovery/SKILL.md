---
name: project-discovery
description:
  Structured brainstorming and discovery session for new project ideas.
  Use this skill whenever a user has a project idea but needs to think it through
  before starting — clarifying goals, scope, risks, unknowns, and what "done"
  looks like. Trigger on phrases like "I have an idea for a project", "help me
  think through", "want to build", "planning a new project", "should I build X",
  or when someone describes an early-stage idea and asks what to do next.
---

# Project Discovery Skill

Guides the user through a structured brainstorming session for a new project idea. The output is a concise discovery document (Markdown) they can use as a foundation for planning or handing off to other tools/people.

## How the skill works

Two phases:

1. **Brainstorming** — interactive conversation. Claude asks questions, pushes back, and surfaces blind spots.
2. **Discovery doc** — after brainstorming, Claude offers a summary as a short Markdown document.

Don't skip phases. Write the document after the brainstorming, not instead of it.

---

## Phase 1: Brainstorming

### Attitude

Be like a smart friend, not a consultant. Ask questions one at a time, not in batches. If an answer is vague, ask again — don't fill in the blanks for the user.

If you see an obvious problem (bad scope, unrealistic expectations, missing MVP), say it directly. Don't just nod along.

### Questions (in this order, but adapt to the conversation)

**1. What and why**

- What do you want to build? Describe it in one sentence.
- Who is it for — just you, or others too?
- Why do you want to build this? What's pulling you toward it?

**2. What it isn't**

- What do you _not_ want it to do? Where's the boundary?
- Does something similar already exist — why isn't that enough?

**3. Success**

- How will you know it's working? What has to happen?
- What's the smallest version that would tell you whether this is worth pursuing?

**4. Unknowns and risks**

- What don't you know yet that you need to find out before starting?
- What could kill this project? (technically, motivationally, time-wise)
- Pre-mortem: imagine the project is sitting abandoned in six months. What happened?

**5. Reality**

- How much time do you want to put into this? (appetite, not estimate)
- What other commitments do you have right now that will compete for your attention?

### ADHD-friendly tips

- One question at a time. Never a list of five.
- If the user is scattered, gently redirect — don't shut them down, just don't lose the thread.
- If they're talking about implementation before the problem, bring them back: "Hold on — why do you want to build this?"
- Praise specificity, not grand ambitions.

---

## Phase 2: Discovery document

After brainstorming, ask: _"Want me to summarize this into a document?"_

If yes, create a Markdown file with the following structure (but only include sections where you actually have content from the brainstorming — don't invent):

```markdown
# [Project name]

> [One sentence: what it is and who it's for]

## Why I'm building this

[2–3 sentences — motivation, context]

## What it is (and isn't)

[Scope boundaries — what's in, what's out]

## How I'll know it's working

[Concrete success criteria]

## MVP

[Smallest thing that proves the value]

## Unknowns

[What I don't know and need to find out]

## Risks

[What could kill the project — technically, motivationally, time-wise]

## Appetite

[How much time/energy I want to invest]

## Next steps

[Max 3 things to do first]
```

Omit sections for which you have no content from brainstorming. No generic filler.

---

## Notes

- Skill works in both Claude.ai and Claude Code — save the output document to the current directory or offer it for download.
- If Claude Code has access to the project, save the discovery doc as `DISCOVERY.md` in the root.
- Target length: ideally one page. If it's longer, cut it down.
