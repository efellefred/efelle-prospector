# Prospector UI upgrade — handoff package

Hand `PROMPT.md` to Claude Code as the instruction. The `reference/` folder holds the exact approved markup (inline styles are the spec: sizes, colors, spacing can be read straight from it), and `assets/` holds the logo.

Contents:
- `PROMPT.md` — the complete build prompt, all screens, every change merged in
- `reference/Prospector Home.dc.html` — home (table + cards views)
- `reference/Proposal Builder.dc.html` — proposal setup (page 1)
- `reference/Proposal Builder – Client Details.dc.html` — client details (page 2)
- `reference/Proposal Builder – Preview.dc.html` — proposal ready / preview (page 3)
- `reference/Proposal Builder – AI Editor.dc.html` — preview + docked AI editor panel
- `assets/e-logo-white.png` — the efelle logo (only image asset; never redraw or inline it)

Note: the reference files are design-tool documents; open them for markup/styles rather than expecting them to run standalone. Ignore the `<x-dc>` wrapper, `support.js`, `{{ … }}` holes, `sc-for`/`sc-if` tags, and `_ds/` stylesheet links — the inline styles and the data in the `class Component` script are the source of truth.
