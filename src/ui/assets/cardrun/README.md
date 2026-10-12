# The card run's art

One SVG per slot in `src/ui/cardrun/assets.ts`, named `{slot id}.svg`, dropped
in this folder. The screens pick a file up by its name; nothing else changes.
A file here that is no slot's fails `test/cards-run-art.test.ts`.

The slots, their sizes and what each shows are in
[`docs/reports/card-run-menus-asset-prompt.md`](../../../../docs/reports/card-run-menus-asset-prompt.md),
the prompt the files are generated from.
