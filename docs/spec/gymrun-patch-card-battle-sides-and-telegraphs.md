# Patch: card battle sandbox, sides, panel colours and telegraph kinds

2026-10-09, on `claude/card-battler-ui-layout-yejhur`, from `main` at
`3c40ceb`. Filed **before any change to `src/`**, verbatim, as
[`README.md`](README.md) rule 7 asks. Feedback from the author on the card
battle sandbox, with one phone screenshot of round 2 of the `#test` fight,
saved as
[`assets/card-battle-sides-and-telegraphs-screen.webp`](assets/card-battle-sides-and-telegraphs-screen.webp).

The card battler is outside the design bible by the author's ruling
([`gymrun-card-battle-engine-rulings.md`](gymrun-card-battle-engine-rulings.md)),
so this patch touches no rule of it.

---

## The message, verbatim

> So card battler feedback player units should be left and enemies should be right. Make the backgrounds coloured like player should be light and enemies should be dark.
> Enemie highlights have to distinguish between strike, pierce, slash etc.
> strike should "stop" a strike but not pierce. Then slash should be distinct as well.

## What the screenshot shows

The enemy panels (Drone 1, Lancer 2, Drone 3) stand in the left column and
the unit panels (A Commander, B Gunner, C Sword dasher) in the right; all six
share one cream background. Every tile an enemy telegraphs onto carries the
same red hatch, whatever the act: Drone 3's Strike lights its whole lane down
to the player's back row, through C standing in it, and reads exactly as a
Pierce would.

---

## The follow-up, verbatim

Sent 2026-10-09 while the first message was being built, after `35c182c`.
Filed here **before any work on it**.

> No, wait. Some more clarity issues.
> On card select, attacks should highlight the affected areas (same telegraph as enemies)
> Then non attacks should hold a reticle to the target (same as target)
> Moves should also show available spaces
> Then if enemes are telegraphing an attack, move should show the intercept to block
