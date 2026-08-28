/**
 * Render Claude design-tool (.dc.html) exports to standalone HTML + PNG.
 *
 * The .dc.html files are templates, not pages. They rely on a `support.js`
 * runtime and a `_ds/` design-system stylesheet that are not shipped with the
 * export. dc-runtime.js reimplements just enough of that runtime (sc-for,
 * sc-if, {{ }} interpolation, the DCLogic class) and dc-tokens.css supplies
 * the efelle tokens plus the two brand faces inlined as woff2.
 *
 *   npm i playwright && npx playwright install chromium
 *   node render-dc.js <dir-of-dc-files> [outDir]
 *
 * Writes <slug>.html (openable, self-contained) and <slug>.png next to it.
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const WIDTH = 1440;
const HERE = __dirname;

// Resolve both to absolute paths: a relative path makes a broken file:// URL, and on
// Windows an absolute one needs pathToFileURL rather than string concatenation.
const srcDir = process.argv[2] && path.resolve(process.argv[2]);
const outDir = path.resolve(process.argv[3] || 'dc-rendered');
if (!srcDir) {
  console.error('usage: node render-dc.js <dir-of-dc-files> [outDir]');
  process.exit(1);
}

const runtime = fs.readFileSync(path.join(HERE, 'dc-runtime.js'), 'utf8');
const tokens  = fs.readFileSync(path.join(HERE, 'dc-tokens.css'), 'utf8');

// The exports point at a live logo URL. Swap in a local copy when one is next
// to the sources, so the render works with no network.
let logo = null;
for (const p of [path.join(srcDir, '../assets/e-logo-white.png'),
                 path.join(srcDir, 'e-logo-white.png')]) {
  if (fs.existsSync(p)) { logo = 'data:image/png;base64,' + fs.readFileSync(p).toString('base64'); break; }
}

const slug = f => path.basename(f, '.dc.html').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

(async () => {
  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.dc.html')).sort();
  if (!files.length) { console.error('no .dc.html files in ' + srcDir); process.exit(1); }
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  for (const f of files) {
    let html = fs.readFileSync(path.join(srcDir, f), 'utf8')
      .replace(/<script src="\.\/support\.js"><\/script>/, '')
      .replace(/<link rel="stylesheet" href="_ds\/[^"]*">\s*/g, '')
      .replace(/<script src="_ds\/[^"]*"><\/script>\s*/g, '')
      .replace(/zoom:\s*0?\.\d+;?/g, '')            // canvas scaling, not design intent
      .replace('</head>', `<style>${tokens}</style></head>`)
      .replace('</body>', `<script>${runtime}</script><script>__dcRender();</script></body>`);
    if (logo) html = html.replace(/https:\/\/[^"']*e-logo-white\.png/g, logo);

    const name = slug(f);
    const file = path.join(outDir, name + '.html');
    fs.writeFileSync(file, html);

    const page = await browser.newPage({ viewport: { width: WIDTH, height: 1000 }, deviceScaleFactor: 2 });
    await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
    await page.waitForFunction("document.body.hasAttribute('data-dc-done')", { timeout: 8000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outDir, name + '.png'), fullPage: true });
    await page.close();
    console.log(name);
  }
  await browser.close();
  console.log('\n' + files.length + ' screens rendered to ' + outDir);
})();
