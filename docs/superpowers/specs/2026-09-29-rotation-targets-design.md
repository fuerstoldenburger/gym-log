# Gym-Log: Rotation, Tagesvorschlag, Zielgewichte - Design

Date: 2026-09-29 · Direction approved by Benjamin in chat (B: targets + "which day is due" on Home; legs focus; auto-suggested weight once the target is reached).

## Goals
1. Home says which plan day is due. No thinking before a session.
2. Two schedules, one active: 3 days full body (A, B, C) or 4 days upper/lower (Ober 1, Unter 1, Ober 2, Unter 2). Legs twice per 4-day cycle, legs first on every full-body day.
3. Every plan exercise shows a target: sets, rep range, weight. The weight comes from the last session; once all sets reached the top of the range, the next target is heavier and the logger pre-fills it.
4. Benjamin's added exercises become part of the built-in catalogue; wrong muscle groups fixed; empty duplicates archived.

## Decisions (user-confirmed)
- Rotation pointer, not weekdays: the next day is the one after the last plan day trained. Survives gaps.
- Knees: no free-bar squats in the seeded plans. Leg main lifts are Beinpresse, geführte Kniebeuge, Kreuzheben in work sets. Legs use 10 to 15 reps. Warm-up is not in the app (Benjamin walks or jogs 10 min before every session anyway).
- Progression: upper body 3 x 8 to 12, plus 2.5 kg. Legs 3 x 10 to 15, plus 5 kg. Bankdrücken and Kreuzheben 3 x 5 to 8 work sets, plus 2.5 / plus 5 kg. Bodyweight, time and cardio exercises carry sets and reps or seconds, no weight rule.
- Existing plans Push, Pull, Beine stay; user can delete them.

## Data model (additive only, import of v2 exports keeps working)
- `data.schedule = { mode: '3' | '4' | null, planIds: [] }`. `null` = no rotation, Home shows no day card.
- Plan gains optional `targets: { [exId]: { sets, repMin, repMax, incr } }`. Missing rule falls back to the group default (Beine 3/10/15/5, else 3/8/12/2.5; time and cardio: sets only).
- `data.migrations = { rotation2609: true }` guards the one-time seed.
- New built-in exercises (stable ids, added to DEFAULTS): schraeg-kh Schrägbank Kurzhantel (Brust), goodmorning Good mornings (Beine), trizeps-oh Triceps overhead (Arme), seilpull Rücken Seil pull (Rücken), bizeps-kh Bizeps Krummhantel (Arme), hangraise Hang raise (Bauch, bw), schulter-lh Schulterdrücken Langhantel (Schulter), liegestuetz Liegestütze (Brust, bw), rudern-maschine Rudern Maschine (Rücken), kh-rows Kurzhantel bent rows (Rücken), burpees Burpees (Cardio, bw, reps), kettlebell Full kettlebell workout (Cardio, bw, time), kniebeuge-g Geführte Kniebeuge (Beine), bizeps-turm Bizeps pull up turm (Arme), latzug-h Horizontal lat Zug (Rücken), hintere-schulter Angled Bank hintere Schulter (Schulter), rudern-schraeg Rudern schräg Maschine (Rücken).
- Seeded plans (ids plan-gk-a, plan-gk-b, plan-gk-c, plan-ob-1, plan-un-1, plan-ob-2, plan-un-2) reference exercises by name at seed time: `resolveByName(name)` returns the user's existing exercise id if one with that name exists (so his sets stay attached), else the new default id. Exercises with the same name as a new default are not duplicated.

## Migration `rotation2609` (runs once, idempotent, also after import)
1. Add missing DEFAULTS by name (skip if an exercise with the same normalised name exists, archived or not).
2. Group fixes by name: "Rücken Seil pull" -> Rücken, "Bizeps Krummhantel" -> Arme, "Schulterfreien langhantel" -> rename to "Schulterdrücken Langhantel" (Schulter).
3. Archive duplicates without sets: second "Butterfly", "Good mornings" in group Brust.
4. Seed the seven plans if their ids are missing. Do not touch existing plans.
5. Set `schedule` to `{mode:null, planIds:[]}` if absent. Benjamin picks 3 or 4 days in the Pläne screen.

## Seeded plans (exercise order = execution order, legs first on full-body days)
- Ganzkörper A: Beinpresse, Schrägbank Kurzhantel, Latzug, Good mornings, Schulterdrücken, Hang raise
- Ganzkörper B: Geführte Kniebeuge, Schrägbankdrücken, Rudern schräg Maschine, Beinbeuger, Trizeps-Drücken, Plank
- Ganzkörper C: Kreuzheben (3 x 5 to 8), Bankdrücken (3 x 5 to 8), Langhantelrudern, Beinstrecker (3 x 12 to 15, light), Bizeps-Curls, Dead Hang
- Ober 1: Schrägbank Kurzhantel, Schrägbankdrücken, Schulterdrücken, Seitheben, Trizeps-Drücken, Triceps overhead
- Unter 1: Beinpresse, Geführte Kniebeuge, Beinstrecker, Wadenheben, Wall Sit, Plank
- Ober 2: Latzug, Rudern schräg Maschine, Langhantelrudern, Rücken Seil pull, Bizeps-Curls, Hang raise, Dead Hang
- Unter 2: Kreuzheben (3 x 5 to 8), Good mornings, Beinbeuger, Wadenheben, Hang raise, Seitstütz
- Rotation order: mode 3 = A, B, C. Mode 4 = Ober 1, Unter 1, Ober 2, Unter 2.

## Rotation pointer
- `planDayOf(date)`: among `schedule.planIds`, the plan with the most logged exercises on that date; counts only if at least 2 of its exercises were logged. Ties: the plan that comes next in rotation after the previous matched day.
- `nextPlanId()`: walk dates with sets from newest to oldest, find the first matched plan day; next = the following id in `planIds` (wrap). No match anywhere = first id.
- If today already matches a plan: Home shows that plan as "Heute" with done count; when all exercises are done, Home shows "Erledigt · Nächstes: <name>".

## Targets and suggestion
- `targetFor(plan, exId)`: rule from plan.targets or group default. `lastSession(exId)` = sets of the most recent date before today.
- Weight suggestion: `w = most frequent weight in lastSession`. If lastSession has at least `rule.sets` sets and every set has reps >= repMax: `w + incr`, flagged `up`. Else `w`. No history: `null` ("erstes Mal, leicht anfangen"). Time exercises: suggestion = best seconds of last session; bodyweight reps: reps target only.
- Display: plan row "3 × 10–15 · 60 kg" and, when `up`, "↑ 65 kg" in accent. Logger (opened from a plan): target line under the exercise name; the draft weight and reps pre-fill with the suggestion on the first open of that exercise today. A draft the user already changed today is never overwritten. Reps pre-fill = repMin.
- Sets logged outside a plan count for history the same way.

## Home
- New card above the exercise grid when `schedule.mode`: "HEUTE DRAN" · plan name · the first three exercises with their targets · button "Plan öffnen". Tapping the card opens the plan (origin 'plan').
- No schedule: nothing new on Home.

## Pläne screen
- Top: segmented control "Rotation: 3 Tage · 4 Tage · Aus". Selecting sets `schedule` (mode + the seeded ids). Below it the rotation order with "als Nächstes" on the due day. Custom plans still listed and startable; they do not join the rotation in v1.

## Tests (jsc harness, recreate pattern from 2026-07-16)
- Migration: idempotent on second run; no duplicate by name; group fixes applied; duplicates archived; existing custom ids preserved in seeded plans via resolveByName; a v2 export without `schedule` loads and gets `{mode:null}`.
- Rotation: no history -> first plan; after A logged -> B; after C -> A (wrap); a day with 1 matching exercise does not count; today matched -> "Heute".
- Suggestion: all sets at repMax -> w + incr flagged up; one set below -> w; no history -> null; leg rule uses 5 kg; time exercise suggests seconds.
- Logger pre-fill: first open pre-fills; changed draft not overwritten.

## Out of scope
Deload weeks, rest timer, weekday schedule, editing rules per exercise in the UI (edit via plan JSON later), adding custom plans to the rotation, warm-up sets, exercise substitution.
