Then this Patch: restore the fold on both guarded screens. 390x844, seed SMOKE24, scripts/visual/measure.mjs. Targets: fourth move button and the map's last offered node card both end at or above 740.

First, print every element from viewport top to each target with its height, on main now. Then reclaim in this order, measuring after each, stopping when both targets pass:
1. Drawer trigger out of the flow bar into a fixed pill in the bottom-right safe area. Both screens.
2. Foe panel header: no wrap under the archetype chip.
3. Battle only: on narrow viewports, each panel's six-stat block collapses to one row of six values, tappable to expand. Stat stages still render on the row. Both panels. This is the V5 budget brought forward; note it in the report so V5 does not redo it.
4. Move tag rows: one tag on the face at narrow widths, the rest behind the existing tooltip.
5. Map only: the tierInfo copy on node cards truncates to one line at narrow widths, full text in the tooltip.
Do not touch core/. Flip the y=740 assertion in visual-v0 from expected-fail to real once it passes, and add the map's equivalent. Gate green including strict trim. Report the element list and the height after each cut.
