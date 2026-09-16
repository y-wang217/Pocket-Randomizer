# Stage 4.9: levels, evolution, gated power, the wider roster, and harder gyms

Filed 2026-09-15, verbatim, before any work, on `claude/charming-ride-q4ogfb`.

The brief arrived as a planning conversation rather than a single prompt: an
opening request, four questions answered in a picker, and two rulings given
on the plan that came back. All of it is the prompt and all of it is filed as
it was written. The plan that was approved against it lives outside the
repo (a planning session file); `../generation.md` section 21 is the account
of what was built and where it deviates.

## 1. The opening request

> i also want to move the scaling of the game. the beginning should be level
> 5-7s and each level should have level ups as well as evolutions. evolutions
> can follow the original dex evolution levels. i remember we did this
> research and there were limitations esp w the seed. summarize what needs to
> be done and create a plan to accomplish this scaling revamp

## 2. The four questions, and the answers

**When does the party level up?** (offered: every step converging at the gym;
+1 per node; +1 per battle won)

> keep the level scaling as it is. full party levels up after a gym - same as
> nuzlocke rules. but post gym has a new segment that shows pokemon evolving!
> makes gyms more satisfying to beat
>
> This means gyms should be harder too. currently, gyms are significantly
> lower level. this was based on balance runs on a not so clever ai. look up
> the level scaling on romhacks like the notorious crystal kaizo for
> reference.

**Roughly a third of evolution lines do not evolve by level. What should
those do?** (offered: synthetic level per method; never evolve; item-driven)

> like your recommended, but the level tiers should follow kaizo romhacks and
> their implementations that some players will already be familiar with.
> future note to add events that can reveal level up mechanics (like link
> cable, stones as additional relics)

**Branching evolutions: who picks the branch?**

> Player chooses (Recommended)

**Can the player decline an evolution?**

> No, evolution is automatic (Recommended)

## 3. First ruling on the plan

> above 55 thresholds make sense. i want to save the 'big, powerful mons' as
> a late gym exclusive, becuase if we see goodras and dragonites fromthe
> beginning they are less impresive. purposefully gate powerful mon behind
> levels (aka gyms) and force the player to start with a measly pokemon with
> lower base stats facing other lower base stats for the full experience.
> even if you high roll a gible, you have to nurture it through progressing
> through gyms to get your garchomp by gym 7

## 4. Second ruling on the plan

> band 4 opened at gym 7 is fine. i want to use band 4 mons by gym 8
>
> Also, check the full roster and report on what are the available mons. why
> do I see a lot of repeats in the seeds I'm getting while playtesting? this
> patch is a whole revamp, so it's worthwhile to investigate how we cna add
> more variety. since we're gating so many mons, we should allow higher
> variance inside the bands. i.e. you should be able to get every "low-tier"
> mon, up to gen 9 or whatever central mon dex we're pulling from. then, allow
> higher band mons appear as wild and as trainer mons. as a rule, wild mons
> should be lower level and i want trainer mons to be more of a challenge,
> using a better ai strategy than wild and the gyms to be fierce competitive
> kaizo-like ais. the gyms should also always have a full roster of mons
> comparable to the player. i.e. start at 2 mons, gym has 2 mons, then up to
> 3 for gym 2-3, 4 for gym 4-5, 5 for gmy 6-7 and 6 for gym 8.
> this is a much smoother upgrade curve since levels increase between roster
> expansions, and gyms 1-2 become less trivial.

## 5. Reference numbers the plan was built against

Crystal Kaizo gym level caps: 14, 16, 21, 28, 30, 35, 45, 46; Elite Four
52-55. Crystal Kaizo turns every trade evolution into a level-up except
Slowking. Emerald Kaizo trade conversions: Politoed 37, Golem 42, Porygon2
42, Steelix 45, Machamp 50, Gengar 50, Scizor 50, Alakazam 55, Kingdra 55.
