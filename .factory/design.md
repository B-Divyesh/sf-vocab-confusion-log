# Vocab Confusion Log — visual thesis

## Direction: the repair-room risograph

This is a tiny workbench for mistakes, not a course dashboard. The interface borrows from a language learner's annotated index cards: warm uncoated paper, two slightly misregistered ink plates, blunt crop marks, pencil-like annotations, and a pair of overlapping scraps that only make sense when compared. The tactility makes an error feel workable rather than shameful. Decoration is concentrated at the empty state and header; practice remains quiet and highly legible.

The experience is deliberately single-mode. A printed-paper world does not plausibly flip into a black surface, and maintaining the warm sheet is part of the product identity. Browser chrome is explicitly painted `paper`.

## Tokens

- `paper #F3E8CF`: page and install splash; warm recycled stock.
- `sheet #FFF9EB`: raised writing surface.
- `ink #172C3A`: primary copy and controls (12.4:1 on paper).
- `muted #596168`: secondary copy (5.1:1 on paper).
- `blue #175E8E`: focus, links, and listening plate (5.5:1 on paper).
- `tomato #B83A32`: error/contrast plate (5.2:1 on sheet); never the only error cue.
- `mustard #D6A526`: tactile highlight and due state; paired with an icon or label.
- `leaf #39704E`: repaired/success ink (5.0:1 on sheet).
- `line #A69A83`: rules; structural only, not text.

Every surface also carries a very light CSS dot texture made from the ink token. Misregistration is expressed with offset solid shadows, never blurry glass or gradients.

## Type and spacing

No runtime fonts are downloaded. Display type uses `Georgia, Charter, serif`, whose bookish forms make the vocabulary itself prominent. Interface and body type use `ui-sans-serif, system-ui, sans-serif` for compact utility. Scale: 14 / 16 / 18 / 24 / 34 / 52 px, with body at 16–18 px and 1.55 leading. Numbers use tabular figures.

Spacing follows a 4 px base: 4, 8, 12, 16, 24, 32, 48, 64. Text measure caps at 68 characters. Touch targets are at least 44 px. At 390 px the two-column desk becomes one column, top navigation becomes a horizontal scroll strip, and the secondary illustration drops below the first action.

## Interaction grammar and motion

- Pressing a control shifts it 2 px into its offset ink shadow.
- New scraps enter from 8 px below their origin over 180 ms; mode changes cross-fade over 180 ms.
- Success produces one short 220 ms stamp scale, never confetti or an endless loop.
- Focus is a 3 px blue outline with 3 px clearance.
- `prefers-reduced-motion: reduce` removes transforms, scrolling animation, and transitions; state changes remain visible through copy and ink color.
- Destructive deletion names the pair in a native confirmation. Pair edits keep all attempt history.

## Original asset plan

One generated hero/empty-state collage shows two overlapping flashcard scraps, an ear, a speaking mouth silhouette, and a looping pencil correction mark. It explains the two retrieval directions without depicting app UI or claiming speech scoring. Authored SVG icons provide the install icons and small interface marks.

### Prompt sheet

- Subject: two overlapping blank vocabulary index cards, an abstract listening ear, a simple speaking mouth cut-paper silhouette, a looping pencil correction arrow.
- World: a language learner's warm paper desk; optimistic repair workshop.
- Materials: torn recycled paper, soy risograph ink, coarse halftone dots, imperfect overprint, graphite.
- Light/lens: flat scanned editorial collage, no photographic depth, generous outer margin.
- Palette words: oat paper, deep navy, tomato red, muted mustard, restrained cornflower blue.
- Negative list: no text, letters, watermark, logos, brands, people, hands, flags, app interface, photorealism, 3D gradients, neon, drop-shadow mockups.

Final generation prompt (used verbatim):

> Use case: illustration-story. Asset type: PWA hero and empty-state editorial illustration. Primary request: an original tactile risograph collage about repairing confusion between two vocabulary words. Scene/backdrop: warm oat recycled paper with generous quiet outer margin. Subject: two overlapping blank torn index-card scraps, one abstract listening ear, one simple speaking mouth cut-paper silhouette, and a looping graphite correction arrow connecting the cards. Style/medium: flat scanned editorial paper collage, soy risograph ink, coarse halftone dots, slight two-color misregistration, handmade cut edges. Composition/framing: landscape 3:2, compact objects centered with breathing room, readable at small size. Lighting/mood: flat print scan, encouraging and practical. Color palette: deep navy, tomato red, muted mustard, restrained cornflower blue on oat paper. Constraints: all cards blank; no text, no letters, no watermark, no logos, no brands, no people, no hands, no flags, no app interface, no photorealism, no 3D, no gradients, no neon.

## Asset provenance

`public/assets/repair-collage.webp` is an original AI-generated bitmap created for this product on 2026-08-27 with the factory image deployment via `/opt/fleet/lib/gen-image.sh`. The exact prompt is above and in `assets/src/repair-collage.prompt.json`. It was visually reviewed for accidental text, logos, malformed symbols, and palette consistency, then converted locally to WebP. Product icons and UI marks are original authored SVG/CSS shapes. Generated imagery is disclosed in the footer.
