# Rendering design-tool handoff exports

The `.dc.html` files in a design handoff package are templates, not pages. Opening one
in a browser shows an unstyled skeleton with visible `{{ }}` holes, because the export
references two things it does not ship:

- `support.js`, the runtime that expands `sc-for` / `sc-if` and interpolates `{{ }}`
- `_ds/.../*.css`, the design-system stylesheet that defines `--black`, `--orange`,
  `--gray-1` through `--gray-5`, `--green`, `--red`, and loads the brand faces

`dc-runtime.js` reimplements the first. It defines `DCLogic`, reads the props defaults
out of the `<script type="text/x-dc" data-props="...">` tag, calls `renderVals()`, then
walks the DOM expanding loops and conditionals and resolving bindings. Style objects
returned from `renderVals()` are converted to CSS text. Event handlers and `style-hover`
are dropped, since the output is static.

`dc-tokens.css` supplies the second: the efelle token values, plus Plus Jakarta Sans and
JetBrains Mono inlined as woff2 so a render needs no network.

## Use

```
npm i playwright
npx playwright install chromium
node render-dc.js ../../../handoff/reference ./out
```

Writes `<slug>.html` and `<slug>.png` for every export in the source directory. The HTML
is self-contained and can be opened directly. Screenshots are full-page at 1440px, 2x.

If the sources reference the efelle logo by URL, put `e-logo-white.png` in the package's
`assets/` folder and it is inlined automatically.

## Caveat

A render shows what the export describes, which is not necessarily what shipped. Check the
version stamp in each screen's own chrome before treating one as current.
