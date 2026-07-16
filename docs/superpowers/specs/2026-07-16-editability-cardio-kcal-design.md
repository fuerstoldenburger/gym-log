# Gym-Log: Editability, Cardio & kcal — Design

Date: 2026-07-16 · Approved by Benjamin in chat.

## Goals
1. Delete + edit exercises (incl. fixing wrong muscle group).
2. Cardio/treadmill logging (distance + time).
3. Rough kcal estimate per training day.
4. General editability: rename plans.

## Decisions (user-confirmed)
- **Exercise delete = soft delete** (`archived: true`). Hidden from Home grid, plan-picker, PR list. Sets stay in storage, JSON backup and CSV export. Aggregates (muscle check, volume, timeline) keep counting — real training history.
- **Cardio fields**: distance (km) + time. Pace and kcal derived.
- **kcal**: per training day. Strength: `5 MET × body-kg × est. hours` (session span from set timestamps, floor 2 min/set). Cardio: `body-kg × km × 1.0`; time-only fallback `8 MET`. Body weight = latest logged entry, fallback 75 kg + hint. Shown as 4th Home stat and per day in Progress timeline, always with ≈.

## Changes
- **Model**: exercise `mode` gains `'cardio'`; cardio sets `{mode:'cardio', km, seconds, weight:0}`. New group chip `Cardio`. One-time migration seeds default `Laufband` exercise (runs on load **and** after JSON import; import format unchanged, only additive fields).
- **Logger**: pencil button opens edit modal (reused add modal: name, group, reps/time/cardio, bodyweight flag) with danger delete (confirm → archive). Cardio logger: distance stepper (0.1/0.5/1 km) + time stepper (1/5/10 min), stopwatch works, live ≈kcal + pace preview.
- **History**: cardio charts km/day; stats: longest, sessions, total km.
- **Plans**: rename via pencil (reused plan modal). Archived exercises drop out of plan rows.
- **CSV**: new `Distanz_km` column, Typ `Cardio`.
- **Volume section**: excludes Cardio (kg-based); hint updated.

## Out of scope
Editing past set values, plan reordering, un-archive UI.

---

## Addendum 2026-07-16: UX overhaul (approved)

Scope: all of A–D below, rest timer explicitly skipped by user.

- **A1 Edge-swipe back**: touchstart ≤28px from left edge, dx>70, dy<50, <600ms → back (modal → close; history → log; log → origin; plan → plans).
- **A2 Scroll memory**: `ui.scrollPos[view]` saved on leave; restored for list views (home/plans/progress); detail views open at top.
- **A3 Bottom nav on all screens** incl. Logger/Verlauf (active tab = origin tab).
- **A4 Sticky search+chips** on Home (`position:sticky`, safe-area aware).
- **B6 e1RM**: Epley `w×(1+r/30)` live in logger (reps 1–15, weight>0) + e1RM trend chart in Verlauf.
- **B7 Undo delete**: set deletion shows 5s "Rückgängig" toast; restore re-inserts by ts.
- **C8 Progress**: weekly volume bars (12w), kcal/week bars (8w).
- **C9 Verlauf**: volume/session bars + e1RM line (weights); pace trend line (cardio).
- **D10 A11y**: aria-labels on all icon buttons, aria-current on nav, ≥44px touch targets (delBtn), :focus-visible outlines.
- Charts follow dataviz method: single-series accent-on-dark, direct labels for max+latest, no legends, one axis.
