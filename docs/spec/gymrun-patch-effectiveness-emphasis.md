# Patch: effectiveness emphasis on the move bar and the bench

2026-10-01, on `claude/band-long-press`, from `main` at `563d1f1`, in the same
session as [`gymrun-patch-band-long-press.md`](gymrun-patch-band-long-press.md).
Filed as written, before any change to `src/` for it.

---

## The message, verbatim

> also help me highlight when a move is super and grey it out when the move is not super.
> also highlight the moves for effectiveness in the party select from switch team out. teach players what to do

## The session's question, and the author's answers, verbatim

The session reported two conflicts with the design bible before building:
greying out non-super moves is conditional emphasis (C1) and marks neutral
(R4); a forecast on the bench is outside R8's "on the move button"; and
"teach players what to do" read as a recommendation would breach C1 outright.

> **Q.** Battle move buttons already get a coloured left edge plus the
> multiplier (2, 4, ½, ¼) when a move is super effective or resisted, and
> nothing when neutral. The bible forbids marking neutral moves and forbids
> "conditional emphasis" (C1, R6), so greying out non-super moves breaks a
> top-level rule. How should I go?
>
> **A.** Amend: grey out non-super. *(You direct a bible amendment to C1/R6,
> recorded in the playtest log. Neutral and resisted moves get dimmed while a
> super-effective one exists.)*

> **Q.** In the switch picker, showing each benched member's move
> effectiveness against the opponent on the field counts as the present board,
> so C1 allows it. But R8 puts the forecast on the move button only, so this
> needs a small amendment. "Teach players what to do" would be a
> recommendation, which C1 forbids outright. What should I build?
>
> **A.** Edges on bench moves. *(Amend R8 so the same edge and multiplier
> appear on each benched member's moves against the current opponent. They
> show facts, not advice. The tutorial gets one coach mark explaining what the
> edge means.)*

The question named R6 where it meant R4 (neutral renders nothing); the bible
amendment corrects the rule it touches rather than the one the question named.
