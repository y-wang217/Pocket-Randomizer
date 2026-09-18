# Patch: the update sequence audit — what else was a node behind

Filed 2026-09-18 on `claude/party-check-mantyke-anorith-xttrxm`, before any work
on it, per [`README.md`](README.md) rule 7. It follows
[`gymrun-patch-party-drawer-stale-capture.md`](gymrun-patch-party-drawer-stale-capture.md)
on the same branch: that patch fixed one readout, this one asks whether the
mechanism behind it had other victims.

---

## The prompt, verbatim

> before we close this, investigate the update sequences and see if anything
> else is off from the intended paths. things should all happen as
> simultaneously as possible

Answered before any code with a scope question, whose four options were: fix the
in-battle drawer only; that plus the relic; everything including moving
`applyBattleState` out of `resolveNode`; or investigate and change nothing. The
author chose **everything, including the core move**, with the risk stated as
"touches a stated invariant; needs the full gate and a visual-baseline
re-record check".

A second instruction arrived mid-run:

> you're running this overnight. so try your best and report back in the
> morning. find as many workarounds as possible to optimize progress

---

## The deviation from what was approved, and why

**The approved option named a specific change — move `applyBattleState` out of
`resolveNode` — and that change was not made.** It is recorded here rather than
by re-writing the option, because the reason is the finding.

`resolveNode` is called directly by twelve test files, several of which exist
precisely to assert what it folds; `test/run.test.ts` calls it on a damaged
party to check HP carries through a node. Moving the battle fold out would not
be an internal reordering, it would change what the function *means* for every
caller, and `resolveNode`'s own header states the invariant it would break:
"everything that happens between two nodes happens here and nowhere else".

More importantly, moving it was not necessary to get what the instruction asked
for. Nothing about the run needs to happen earlier. What needed to happen
earlier was the **reporting**: `onState` is the only refresh signal and it fires
once per node, so every surface between a mid-node event and the node boundary
was drawing the run as the node started. So the work went into a projection —
`RunProjection` and the `onProjection` hook — which reports the same three folds
`resolveNode` performs, in `resolveNode`'s own order, at the moment each becomes
true, and which moves no state at all. `test/run-projection.test.ts` asserts
that a run played with the hook and a run played without it produce byte
identical logs, which is the property that makes it safe and the one a
transition could not have offered.

## What the audit found

Measured on this tree with the scripted baseline before any fix.

| # | surface | measurement | disposition |
|---|---|---|---|
| A | the drawer, mid-fight | **137 of 217 turns** across 12 seeds disagreed with the field; worst case a Seel the fight had at 1 HP and the drawer at 25 | fixed |
| B | the drawer, after a fight | **165 of 182** battle reviews disagreed with the result screen beside them | fixed |
| C | the recipient screen's own cards | show the HP the node was entered with | **not fixed — see below** |
| D | the drawer's relic list | a relic taken from a card is missing until the node ends | fixed |
| E | an open drawer | never refreshes; it is a snapshot with no subscription | subsumed by A |
| F | the drawer's contribution rows | fold with HP, so they lag with it | fixed by A and B |

Not defects, checked and dismissed: the result screen's coins (the balance
updates at the boundary, and `BattleReview.currencyEarned` documents the split
deliberately), the map overlay's position (the node has not resolved), and the
evolution fork's pre-level party (the fork has not been answered).

## C is not fixed, and the reason is the most useful thing here

The obvious repair for C is to fold the battle into `partyAfterAcquisition` so
the recipient cards carry the fight's own numbers. **That would change who gets
the move.**

`rewards.recipientFor` returns the lead when the named slot is fainted. The
question's reading and the apply site's reading agree today only because neither
has a fainted member in it: the question is posed pre-battle, and `resolveNode`
applies the reward after `betweenNodes`, which revives. Folding the battle in
breaks that symmetry from one side only.

This was nearly filed as a defect on the strength of a scan that compared the
question against a battle-folded party **without** the node boundary — 123 of
605 move questions appeared to diverge. That scan was wrong. Measured against
what `resolveNode` actually resolves against:

- the move landed on the Pokemon the question named in **466 of 466** resolved
  cases across 300 seeds, and elsewhere in none;
- today's reading agrees with the apply site **316 out of 316** across 200
  seeds;
- a battle-folded reading would disagree **70 times** in those same 316 — 22%.

So the tree is correct and the tempting fix is the bug. It is pinned by
`test/move-recipient-fold.test.ts`, whose second case fails if the two ever
become equivalent — which is the signal that C has become safe to fix — and the
rule is written into `partyAfterAcquisition`'s header where the next person will
be standing when they think of it.

**C therefore becomes a question rather than a patch**: what should the
recipient screen draw for a member who fainted in the fight that paid the card
and will be revived before the move lands? That is a design call and it is filed
in [`../README.md`](../README.md) section 5.

## Also checked and left alone

The `teachMove` crash filed at `generation.md` section 35 —
`RangeError: Snover already knows Confusion` — was hypothesised to be this same
divergence. **It is not**, or at least the hypothesis is unsupported: it did not
reproduce in 300 seeds, and the divergence it was supposed to rest on does not
exist. The open item stands, unexplained, with one more cause ruled out.

## Scope

Presentation and observation only. One new optional hook and one new pure
projection in `core/run.ts`; no transition moved, no hook argument changed, no
decision touched, no version axis moved, `contentHash` unmoved at `94c6c1`.

[`../generation.md`](../generation.md) section 39 is the account.
