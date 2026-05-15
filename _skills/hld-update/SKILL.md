---
name: hld-update
description: "Use this skill when the user wants to update, modify, or extend an existing DESIGN.md file. Triggers include: 'uprav DESIGN.md', 'přidej do designu', 'změň architekturu', 'update HLD', 'add component to design', 'revise the design', 'the architecture changed', or any request to modify an existing high-level design document. Also use when a user mentions a design decision has changed, a new feature needs to be designed, or a component needs to be restructured. Always use this skill instead of hld-create when DESIGN.md already exists."
---

# HLD Update

**Language note:** Always respond in the user's language throughout the entire skill. If the conversation is in Czech, respond in Czech. If in English, respond in English.

## Purpose

Produce a **unified diff** that modifies an existing `DESIGN.md` in a precise, auditable way. Changes are never made without user approval. The file is treated as a versioned artifact — every change bumps the version and is logged.

---

## Phase 0 — Prerequisites Check

Check whether `DESIGN.md` exists:

```bash
ls DESIGN.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

**If MISSING:** Stop. Tell the user:

> "`DESIGN.md` neexistuje. Pokud začínáš nový projekt, použij prosím skill **hld-create** místo tohoto."

_(In English: "`DESIGN.md` does not exist. If you're starting a new project, please use the **hld-create** skill instead.")_

**If EXISTS:** Read the full contents of `DESIGN.md`. Note the current version number and all existing sections before proceeding.

---

## Phase 1 — Understand the Change

Ask the user to describe what needs to change. If the request is vague, ask one clarifying question before proceeding.

Understand:

1. **What** is changing — which section(s), component(s), or decision(s)?
2. **Why** — what triggered the change? (new requirement, wrong assumption, implementation feedback?)
3. **Scope** — is this additive (new section/component), corrective (fixing something wrong), or restructuring (reorganizing existing content)?

---

## Phase 2 — Design the Change

Think through the change before generating the diff. Consider:

- Does this change affect other sections? (e.g., adding a component may affect the diagram, data flow, and tech choices)
- Does anything in the Open Questions section get resolved or added?
- Does the version need to bump? (yes, always — see versioning rules below)

### Versioning rules:

- Patch (0.1 → 0.1.1): typo fixes, clarifications, minor additions
- Minor (0.1 → 0.2): new component, new section, changed tech choice
- Major (0.1 → 1.0): significant architectural restructuring

---

## Phase 3 — Generate the Diff

Generate a unified diff in standard format. The diff must:

- Be directly applicable with `patch -p0 < change.patch`
- Include context lines (3 lines before and after each change)
- Cover **all** affected sections, not just the primary change
- Always include a version bump in the diff header

### Diff format:

```diff
--- DESIGN.md
+++ DESIGN.md
@@ -N,M +N,M @@
 context line
 context line
-removed line
+added line
 context line
```

### After the diff, always include a **Change Summary** in plain language:

- What sections changed
- What was added / removed / modified
- Why (based on Phase 1)

---

## Phase 4 — User Approval

Present the diff and change summary. Then ask:

> "Chceš tuto změnu aplikovat? Pokud ano, řekni mi a zapíšu ji do souboru. Pokud chceš něco upravit, napiš mi co."

_(In English: "Do you want to apply this change? If yes, tell me and I'll write it to the file. If you want to adjust anything, let me know.")_

**Do not apply the change until the user explicitly approves.**

---

## Phase 5 — Apply the Change

Once approved, apply using Python (not patch, not str_replace — to handle Unicode safely):

```python
import re
from datetime import date

with open('DESIGN.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Apply changes programmatically based on the diff
# [generated Python code specific to this change]

# Bump version
content = re.sub(
    r'\*\*Version:\*\* [\d.]+',
    f'**Version:** [NEW_VERSION]',
    content
)

# Update date
content = re.sub(
    r'\*\*Date:\*\* \d{4}-\d{2}-\d{2}',
    f'**Date:** {date.today().isoformat()}',
    content
)

with open('DESIGN.md', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done.")
```

After applying, verify the change was written correctly:

```bash
grep -n "VERSION_MARKER_OR_CHANGED_LINE" DESIGN.md
```

Confirm to the user that the change has been applied, and show the new version number.

---

## Handling Edge Cases

**Conflicting changes:** If the requested change contradicts something already in DESIGN.md, flag the contradiction explicitly before generating a diff. Do not silently resolve it.

**Large restructuring:** If the change would affect more than 3 sections, split into multiple diffs and apply sequentially. Explain why before proceeding.

**Diagram updates:** Whenever a component diagram or sequence diagram changes, regenerate the full Mermaid block — do not produce partial diagram diffs, as they are hard to validate visually.

**Resolving open questions:** When a change resolves an item in the `Open Questions & Risks` section, remove that specific item from the list and note the resolution in the change summary.
