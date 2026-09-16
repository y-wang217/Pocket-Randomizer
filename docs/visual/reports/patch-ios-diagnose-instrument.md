# The on-device diagnostic — the instrument, and how to read what it says

Prompt: [`../../spec/gymrun-patch-ios-diagnose-instrument.md`](../../spec/gymrun-patch-ios-diagnose-instrument.md).
Branch `claude/hopeful-lovelace-w118jz`, 2026-09-16, on top of merged PR #41 (`5a13d6b`).
Deviations and the design argument: [`../../generation.md`](../../generation.md) section 28.

Diagnostic tooling only. No `core/` change, no `ui/` change, no version axis
moved, `contentHash` unmoved. The shipped bundle is byte identical.

---

## 0. The short version

The PR #41 handoff told the reader to open `public/diagnose.html` on their
iPhone. **That file was never committed** — not on the PR #41 branch, not at any
commit on any branch. Everything else that handoff claims did land and is gated.
The one deliverable with no test behind it is the one that was not there.

This patch builds it, to that handoff's own six-section specification, adds a
seventh, and puts a gate behind it so the same thing cannot happen twice.

| | |
|---|---|
| ships | `public/diagnose.html`, copied verbatim into `dist/` by Vite |
| gate | `test/visual-diagnose.test.ts`, both engines, under `npm run check` |
| bundle cost | none — it enters no chunk and is not processed by the build |
| answers the iPhone question | **no.** It lets the question be asked |

## 1. How to use it

1. Deploy this branch.
2. On the iPhone, open the deployed site's **/diagnose.html**.
3. Read the headline. It names one thing.
4. Tap **Copy the full report** and paste it back.

Before opening it, one thing is worth checking first because it explains the
whole reported symptom on its own: **iOS Settings → Accessibility → Motion →
Reduce Motion**. GYMRUN cancels every battle animation by design when that is
on. "No animations on iPhone, fine on desktop" is exactly what it looks like,
and nothing would be broken. The tool's first section reports it either way.

Also confirm the build. Section 2 fingerprints the deployed assets two ways, so
a stale deploy cannot masquerade as a failed fix.

## 2. What it reports, in the order it stops being worth reading

| § | reports | why it is where it is |
|---|---|---|
| 1 | Reduce Motion, user agent, DPR, viewport, touch | the one setting that reproduces the whole symptom; everything below is moot while it is on |
| 2 | the deployed build: asset names, byte count, an on-device checksum, whether the stylesheet applied | a report about the wrong build is worse than no report |
| 3 | what this device's parser kept: CSSOM rule count, each stage keyframe present or `MISSING`, `CSS.supports` for five features | candidate cause 5 asked of the hardware — a dropped declaration is invisible from the outside |
| 4 | every motion token as this device resolves it, plus a live beat's `animation-name` and `animation-duration` | a token that resolves to nothing gives every rule reading it an invalid value |
| 5 | all twelve beats as `MOVES` or `STATIC`, with resting and mid-flight samples | the question the whole patch is about |
| 6 | a `calc()` duration through a custom property, with literal and plain-`var()` controls | `--motion-beat` is `calc(var(--motion-duration) / 4)`; lose that and all twelve go at once while every class stays correctly wired |
| 7 | measured frame rate | how Low Power Mode shows up |

Then one headline naming the likeliest cause, chosen by an ordered rule set that
stops at the first match — the value of a headline is that it names *one* thing
to go and check.

## 3. What a reply will mean

| headline | reading |
|---|---|
| Reduce Motion is ON | fully explained, nothing broken. Turn it off, reload, re-run |
| the stylesheet did not load | a delivery problem — path, MIME type or cache — not a CSS one |
| keyframes dropped | candidate cause 5, confirmed on hardware. This is the answer |
| tokens unresolved | an invalid duration, which is a dropped declaration |
| no `calc()` through a custom property | publish `--motion-beat` from JavaScript the way `--motion-outro` already is |
| nothing moves, causes ruled out | a **new** finding. The per-beat samples in the paste say which property refused to interpolate |
| n of 12 static | more informative than all twelve: those beats share something the working ones do not |
| healthy at low fps | the motion system is intact and the frame rate is not |
| healthy | the fault is above the CSS. Check §2 first, then paste back |

## 4. Validation, before anyone relies on it

Four runs, on the built app, before the file was committed:

| engine | Reduce Motion | verdict | beats | `calc()` | fps |
|---|---|---|---|---|---|
| Chromium 153 | off | healthy (`ok`) | 12 / 12 | all three move | 60.1 |
| Chromium 153 | **emulated on** | `Reduce Motion is ON` (`warn`) | 0 / 12 | all three move | 60.1 |
| WebKit 26.6, iPhone 14 Pro Max descriptor | off | healthy (`ok`) | 12 / 12 | all three move | 61.1 |
| WebKit 26.6, iPhone 14 Pro Max descriptor | **emulated on** | `Reduce Motion is ON` (`warn`) | 0 / 12 | all three move | 60.8 |

Reduced motion reports `warn`, not `bad`, and still shows `0 of 12` underneath:
the stylesheet cancelling every animation under that query is the designed
behaviour, and the measurement is shown rather than asserted so the reader can
see what the setting did.

`test/visual-diagnose.test.ts` carries the same cases forward on both engines
and holds three things: **a known-good engine is reported as healthy**, emulated
Reduce Motion is *named* rather than reported as twelve dead animations, and the
file makes no parse-time request of its own.

The first is the one that matters. The PR #41 handoff records that its own
`calc()` discriminator reused a single element across the three cases and
re-assigned its `id`, so nothing restarted and it called a healthy desktop
Chromium a broken engine. A false headline sends the reader to fix something
that is not broken and spends the credibility the next report needs, so the
three cases each get their own element and the test asserts all three `MOVES`
lines individually rather than asserting the absence of `STATIC`.

## 5. What this does not do

It does not answer the iPhone question, and it cannot. That answer is on a
device this repository cannot reach — which is the entire reason the instrument
exists. Linux WebKit shares iOS Safari's engine and not its graphics stack, its
accessibility settings or its power management, and all three are live
candidates. What changed is that the question can now be asked, on the device,
by someone holding it.
