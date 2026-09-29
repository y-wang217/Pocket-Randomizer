# Patch: the opening playtest QA report, five findings

Filed **before any change to `src/`**, per [`README.md`](README.md) rule 7.
The code named below was read before the filing and nothing was built until
after it.

2026-09-29, on `claude/epic-brahmagupta-31h20a`.

A QA report from an outside tester against the production deploy, uploaded by
the author with one line: *"okay help me resolve these playtest findings"*.
It is filed as it was written. The tester states they did no source
inspection, so every "cause" the report withholds is withheld deliberately.

---

## The prompt, verbatim

> okay help me resolve these playtest findings

The attached report, verbatim:

> # Pocket Randomizer — opening playtest
>
> Date: September 29, 2026. Production UI test in desktop Chrome, viewport screenshot 1363 × 936. No source-code inspection or changes.
>
> URL: https://pocket-randomizer.vercel.app/#seed=GYMRUN-715122-5TVDFUBH
>
> Visible version: footer 0.3.0 · R22; header Stage 4.8; browser title GYMRUN — Stage 1. These are separate labels, not a verified release identifier.
>
> ## Route and results
>
> Completed intro, starter and region/map tutorials; skipped battle tutorial. Selected Skrelp → Cave → first Wild (tier 2, Rookie) → Lileep level 10 → Water Pulse twice, Poison Sting once → victory → 35-coin reward → Take It → Manage → make Lileep lead → refresh → Resume Saved Run.
>
> Battle ended with Skrelp 36/44 HP and 133/136 total PP. Payout 13 + selected 35 = 48 coins. Lileep joined at level 15, 49/49 HP. Map advanced to step 2. Lead switching worked immediately. Refresh/resume retained progression, 48 coins, two Pokémon, and their HP/PP, but reverted the lead. Repeated the lead switch and refresh/resume with the same result.
>
> ## QA-001 — Lead change does not survive refresh/resume
>
> Severity: Medium (saved gameplay configuration lost).
> Location: Party management → Resume Saved Run.
> Steps: Follow the route above; expand Lileep in Manage; click LEAD; verify Lileep is slot 1; refresh; click RESUME SAVED RUN.
> Expected: Lileep remains the lead.
> Observed: Skrelp returns to slot 1 and LEAD. First attempt returned to map before refresh; second refreshed directly from party management.
> Frequency: 2/2 attempts in this run.
> Notes: Coins, Pokémon, HP and PP persisted. This isolates an observable party-order persistence problem; implementation cause is unverified.
>
> ## QA-002 — Recruitment screen displays incorrect existing-party HP/PP
>
> Severity: Medium (misleading information during a roster decision).
> Location: Post-victory Lileep recruitment screen.
> Steps: Win the first encounter with Skrelp at 36/44 HP, 133/136 PP; select the 35-coin reward; inspect YOUR PARTY before taking Lileep.
> Expected: Skrelp shows its current 36/44 HP and 133/136 PP.
> Observed: Recruitment preview shows 44/44 HP (100%) and PP 136/136. After TAKE IT, map and Manage correctly show 36/44 and 133/136.
> Frequency: Once in one completed encounter; not independently replayed.
> Notes: Display inconsistency, not evidence of actual healing or resource duplication.
>
> ## QA-003 — Coin reward card shows stale or ambiguous balance
>
> Severity: Low.
> Location: First victory reward selection.
> Steps: Win the first Wild encounter and inspect the COINS card.
> Expected: If Carrying means coin balance, it should match the 13 coins displayed by the victory heading.
> Observed: Heading reads +13 · 13; 35-coin reward says Carrying 0. Final total correctly becomes 48 after selection.
> Frequency: Once in one completed encounter.
> Notes: Confirm intended meaning of Carrying. No arithmetic failure observed.
>
> ## QA-004 — Restore reward contradicts itself
>
> Severity: Low.
> Location: First victory reward selection.
> Steps: Inspect RESTORE option after the first battle.
> Expected: Title and explanation agree on the healing amount.
> Observed: Title says Restore 85%; description says Full HP, PP and status, whole party.
> Frequency: Once in one completed encounter.
> Notes: Reward was not selected; actual healing behavior untested.
>
> ## QA-005 — Starter move metadata overflows cards
>
> Severity: Low (readability).
> Location: Three-column starter selection at observed desktop viewport.
> Steps: Open this seed and inspect starter move cards.
> Expected: Type, category and power remain legible within each move card.
> Observed: Power numbers and category rows extend beyond narrow card edges; several numbers appear clipped or adjacent to neighboring cards. Visible during the final starter tutorial screenshot.
> Frequency: One screenshot observation; other widths not tested.
> Notes: Recheck outside tutorial and across widths before assigning a responsive-layout root cause.
>
> ## Player-experience observations
>
> - Tutorial terminology provides useful explanations, but there are 11 tutorial steps before the first battle, followed by 6 more battle steps. Consider shorter progressive guidance. This is subjective feedback, not a bug.
> - Refresh shows starter selection with a Resume Saved Run button. The save exists, but a returning player may initially think progress was lost; prioritize Continue when a save exists.
> - Recruitment displays Lileep at level 10 before it joins at level 15. If catch-level normalization is intentional, explain it in the offer.
>
> ## Coverage limits
>
> This was an opening smoke test, stopped on the step-2 map. No gym, shop purchase, later battle, loss, empty/fainted-party validation, double-click reward exploit, pending-reward refresh, mobile layout, or full same-seed replay was tested. Starter choices remained identical across reloads; that does not prove whole-run determinism. No duplication occurred in the two tested map/party refreshes; broader reward idempotence remains unverified.
>
> Recommended next pass: pending-reward refresh and double-click checks, then continue to the first gym and verify progression advances once.
>
> Evidence: pocket-qa-resume.jpg shows final resumed state with Skrelp incorrectly leading, 48 coins and two Pokémon. The screenshot alone does not show the earlier Lileep lead state; the two observed before/after UI sequences establish that comparison.

---

## The author's rulings on the first report, verbatim

2026-09-29, after the first four findings and the recruitment level were
built. The three questions put were: QA-001 logged or kept outside the log;
Continue first when a save exists; a shorter tutorial.

> yes reorders logged, bump the run log version
> on load, 'continuing' should be assumed. this points to something I noticed as well. when I resume a session on my phone, I get a new run from the starter choice sometimes.
> yes, tutorial shorter is better.i always skip it.

---

## The author's ruling on the resume button, verbatim

2026-09-29, after the rulings above were built. The report had noted that
after an automatic resume the seed bar still offers "Resume saved run", which
only restarts the same run.

> let's hide it to make it not ambiguous
