# English and French HTML rulebooks

Open the [English edition](../TTRPG_RANDOM_RULES_EN.html) or the
[French edition](../JDR_RANDOM_RULES_FR.html) directly in a
browser. This is a complete standalone file: typography, five illustrations,
styles, navigation, and search are embedded. It requires neither a server nor a
network connection. You can copy or share that HTML file by itself.

Use the chapter navigation or original table of contents to move around the book.
Search opens from the toolbar or **Ctrl/Cmd + K**; use the arrow keys and Enter to
select a result, and Escape to close it. The document remains readable with working
anchor links when JavaScript is disabled.

## Source and rebuilding

Each edition uses only its matching Markdown source, either
`documentation/TTRPG_RANDOM_RULES_EN.md` or `documentation/JDR_RANDOM_RULES_FR.md`.
The build reads those files; it never writes to either Markdown rulebook. Reading
tools sit outside the marked canonical-content region of the HTML. Illustrations
are decorative and introduce no captions, rules, class names, or lore.

From the repository root, with Node.js 22.12 or newer:

```sh
node documentation/rulebook/build.js
npm run format
node documentation/rulebook/build.js
npm test
```

Rebuild after formatting so the embedded reader script is current. There is no
additional package installation or build-time network dependency. Marked 17.0.5 is
vendored under `vendor/` with its MIT license. This documentation renderer is not
loaded by the Discord bot.

The default build produces both editions. Pass `en` or `fr` to build one edition,
for example `node documentation/rulebook/build.js fr`. `editions.js` contains only
source/output paths, section identifier mappings, and reading-interface labels.
Both editions share the template, CSS rules, reader script, fonts, and exact WebP
artwork bytes. The French edition adds an HTML-only target at the existing rarity
label for the source's `#niveaux-de-rareté` link.

`template.html`, `rulebook.css`, and `reader.js` own presentation and reading tools.
`build.js` renders Markdown without smart punctuation or content rewriting,
preserves source heading levels and inline formatting, and supplies compatible
heading IDs. The output contains the SHA-256 of the original Markdown bytes.

The source edition currently has no Markdown tables. Its lists, including numeric
reference lists, remain semantic lists. Table styling is available for future
authorized source editions; no tables or rule summaries are invented.

## Illustrations and fonts

Reusable original PNGs and smaller WebP copies live in `media/rulebook/`.
[`artwork.json`](../../media/rulebook/artwork.json) records the full generation
prompts, actual reference-image inputs, reference hashes, and output hashes.
All five illustrations were produced with the integrated `image_gen.imagegen`
tool using relevant supplied files from `media/references` as visual inputs.
WebP copies only compress the original images; they do not redraw or recolor them.

The cover establishes the visual identity. Interior artwork is limited to
Character Creation, Combat, Enchantments and Runes, and Adventure. Other sections
remain text-led. The supplied D&D PDF informed hierarchy, compact rule examples,
and restrained typographic organization; none of its art or ornaments is reused.

[EB Garamond](https://github.com/google/fonts/tree/main/ofl/ebgaramond) and
[Cinzel](https://github.com/google/fonts/tree/main/ofl/cinzel) are bundled from
Google's official font repository under the SIL Open Font License. Their original
license files are retained in `fonts/` and embedded in the standalone HTML.

## Validation

`scripts/rulebook.test.js` is included in the repository's normal `npm test` run.
It compares the published content with a fresh Markdown rendering for exact text,
source order, heading levels, paragraphs, emphasis, inline code, lists,
blockquotes, horizontal rules, and link destinations. It also checks unique IDs,
all internal link targets, the source fingerprint, embedded assets, absence of
runtime network requests, and artwork provenance.

Visual and interaction QA should open the actual HTML using `file://`, block
network access, and cover desktop, tablet, and narrow mobile widths. Check long
lists, nested examples, glossary columns, the navigation drawer, search results,
keyboard navigation, back/forward history, and direct anchor opening. Verify that
there is no horizontal overflow or concealed content. Keep temporary screenshots
and reports in ignored `.runtime/rulebook-qa/`.
