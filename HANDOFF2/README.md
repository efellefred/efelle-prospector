# Prospector — batch 2 handoff (Library + Settings only)

Hand `PROMPT.md` to Claude Code. The earlier screens (home, proposal builder pages) are already built; this batch adds ONLY the Library and Settings screens. `reference/` holds the approved markup (inline styles are the spec), `assets/` the logo.

Contents:
- `PROMPT.md` — build prompt for the two screens, plus the shared foundation they sit on
- `reference/Prospector Library.dc.html` — library (sortable columns, filters, Actions/gear menus)
- `reference/Prospector Settings.dc.html` — settings (Railway status, portfolio + RGS accordions, API keys)
- `assets/e-logo-white.png` — the efelle logo (never redraw or inline it)

Note: the reference files are design-tool documents; read them for markup/styles rather than running them standalone. Ignore the `<x-dc>` wrapper, `support.js`, `{{ … }}` holes, `sc-for`/`sc-if` tags, and `_ds/` stylesheet links — the inline styles and the data in the `class Component` script are the source of truth.
