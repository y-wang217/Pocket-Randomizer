Patch on main: Stage 4.7 phone regressions. Presentation only, no core/ changes, no version bump.

1. Pre-gym softlock. A party of one cannot leave the pre-gym screen: slot 0 is disabled and nothing confirms the current lead. Add a confirm for the current lead so every party size can proceed. Test: a solo party reaches the gym battle headless and in the browser bot.

2. Measure before cutting. On 390x844, report the y of the bottom of the fourth move button on three trees: the commit before PR #10 merged, main after PR #10, and main now. Use the same measurer as docs/visual/reports/merge-4.7.md. If the pre-PR-#10 number is already above 740, say so and stop; the regression is older than 4.7 and needs a different diagnosis.

3. If step 2 confirms 4.7 is the cause, reclaim in this order, measuring after each:
   a. Drawer trigger: out of the flow bar and into a fixed floating pill in the bottom-right safe area, next to the corner stamp. Reclaims ~44px on every decision screen.
   b. Foe panel header: stop the wrap under the archetype chip. Move the chip to the meta row or shrink the header's gap. ~25px.
   c. Move tag rows: at most one tag on the button face on narrow viewports, the rest behind the existing tap-to-expand tooltip. ~37px.
   Stop as soon as the fourth move button ends at or above 740. Do not cut past that.

4. Flip the y=740 fold assertion in visual-v0 from expected-fail to a real assertion once it passes.

Gate green before commit. Report the three numbers from step 2 and the height after each cut in step 3.
