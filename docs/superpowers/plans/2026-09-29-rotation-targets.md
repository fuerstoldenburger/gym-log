# Rotation, Day Suggestion, Target Weights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Home tells Benjamin which plan day is due, every plan exercise carries a target with an auto-suggested weight, his added exercises become built-in, and a 3-day or 4-day rotation can be switched on.

**Architecture:** Everything lives in the single-file PWA `index.html` (vanilla JS, template strings, `data` object in localStorage). New pure functions (`migrate2609`, `resolveByName`, `ruleFor`, `suggestFor`, `planDayOf`, `nextPlanId`, `todayPlanState`) are added next to the existing helpers and unit-tested with the `jsc` harness in `tests/`. Views (`viewHome`, `viewPlans`, `viewPlan`, `viewLog`) render from those functions; two new click actions (`rotmode`, `homeplan`) join the existing switch.

**Tech Stack:** Plain HTML/CSS/JS, no build, no dependencies. Tests: macOS `jsc` (`/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc`) with a DOM stub. No Node on this Mac.

**Spec:** `docs/superpowers/specs/2026-09-29-rotation-targets-design.md`

## Global Constraints

- Data model changes are additive only; a v2 export without `schedule`/`migrations` must import and work.
- `migrate()` runs after `load()` and after import; every migration is idempotent.
- Existing exercise ids and sets are never rewritten; seeded plans reference the user's existing exercise when the name matches (`resolveByName`).
- German UI copy, sentence case as in the app ("Übung", "Ziel", "als Nächstes"). Eyebrows are uppercase as the app already does.
- No new external resources; `index.html` stays the only product file.
- Free-bar `kniebeuge` is not in any seeded plan.
- Commit after every task with a German or English one-line message; never push in a task (push is the last, separate step).

## Review Focus

1. A user who never logged a set opens Home with mode 3 on: card must show "Ganzkörper A" with "erstes Mal" targets, no crash on empty history. (Task 4 test `next: no history`, Task 6 test `home card empty history`.)
2. The user logs only one exercise of a plan on a day: that day must not count as a plan day. (Task 4 test `one exercise does not count`.)
3. Import of the 2026-09-29 backup (v2, custom ids like `ex-1783942574578`): seeded plans must point at those ids, not at new duplicates. (Task 1 test `resolveByName prefers existing`, Task 2 test `seed uses existing ids`.)
4. Last session had 3 sets but the user did 4 and one was below repMax: no increase. Last session had only 2 sets: no increase. (Task 3 tests `partial no up`, `too few sets no up`.)
5. Logger opened from Home (not from a plan) must not pre-fill targets; opened from a plan twice on the same day must not overwrite a changed draft. (Task 7 tests `no prefill from home`, `no overwrite same day`.)

---

### Task 0: Test harness with jsc

**Files:**
- Create: `tests/harness.js`, `tests/tests.js`, `tests/run.sh`

**Interfaces:**
- Produces: `bash tests/run.sh` extracts the script from `index.html`, concatenates `harness.js + app.js + tests.js`, runs `jsc`, exits non-zero on any failing check. `tests.js` exposes `check(name, cond)` and `section(name)`.

- [ ] **Step 1: Write the harness**

```javascript
// tests/harness.js - minimal DOM/browser stubs so index.html's script runs under jsc
var __els = {};
function __el(id){
  if(__els[id]) return __els[id];
  var e = { id:id, innerHTML:'', value:'', style:{}, files:[], _cls:{},
    classList:{ add:function(c){e._cls[c]=1;}, remove:function(c){delete e._cls[c];}, contains:function(c){return !!e._cls[c];}, toggle:function(c,on){ if(on===undefined) on=!e._cls[c]; if(on) e._cls[c]=1; else delete e._cls[c]; } },
    focus:function(){}, click:function(){}, remove:function(){}, appendChild:function(){}, addEventListener:function(){},
    querySelector:function(){return null;}, querySelectorAll:function(){return [];}, closest:function(){return null;},
    getAttribute:function(){return null;}, setAttribute:function(){}, scrollIntoView:function(){} };
  __els[id]=e; return e;
}
var document = { getElementById:function(id){return __el(id);}, addEventListener:function(){}, querySelector:function(){return null;},
  querySelectorAll:function(){return [];}, createElement:function(){return __el('__tmp'+Math.random());}, body:{appendChild:function(){}} };
var __store = {};
var localStorage = { getItem:function(k){return (k in __store)?__store[k]:null;}, setItem:function(k,v){__store[k]=String(v);}, removeItem:function(k){delete __store[k];}, clear:function(){__store={};} };
var window = { scrollY:0, scrollTo:function(){}, addEventListener:function(){}, innerWidth:390 };
var navigator = {};
var setTimeout = function(f){ return 0; }, clearTimeout = function(){}, setInterval = function(){ return 0; }, clearInterval = function(){};
var Blob = function(){}, URL = { createObjectURL:function(){return 'blob:';}, revokeObjectURL:function(){} };
var FileReader = function(){ this.readAsText=function(){}; };
var confirm = function(){ return true; }, alert = function(){};
```

- [ ] **Step 2: Write the test runner scaffold**

```javascript
// tests/tests.js - runs after the app script; uses print() from jsc
var __pass=0, __fail=0, __sec='';
function section(n){ __sec=n; print('\n== '+n); }
function check(name, cond){ if(cond){__pass++;} else {__fail++; print('  FAIL: '+name);} }
function fresh(){ localStorage.clear(); data={exercises:DEFAULTS.slice(),sets:[],plans:defaultPlans(),body:[]}; migrate(); ui.draft=null; ui.origin='home'; ui.prefilled={}; }

section('harness');
check('app loaded: DEFAULTS exists', Array.isArray(DEFAULTS) && DEFAULTS.length>20);
check('render does not throw', (function(){ try{ render(); return true; }catch(e){ print(String(e)); return false; } })());

print('\n'+__pass+' passed, '+__fail+' failed');
if(__fail) throw new Error(__fail+' checks failed');
```

- [ ] **Step 3: Write the runner**

```bash
#!/usr/bin/env bash
# tests/run.sh - extract <script> from index.html and run the jsc test bundle
set -euo pipefail
cd "$(dirname "$0")/.."
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
awk '/^<script>$/{p=1;next} /^<\/script>/{p=0} p' index.html > tests/.app.js
cat tests/harness.js tests/.app.js tests/tests.js > tests/.bundle.js
"$JSC" tests/.bundle.js
```

- [ ] **Step 4: Run it**

Run: `bash tests/run.sh`
Expected: `== harness`, then `2 passed, 0 failed`. (`ui.prefilled` does not exist yet; `fresh()` sets it anyway, harmless.)

- [ ] **Step 5: Ignore generated files and commit**

```bash
printf '.app.js\n.bundle.js\n' > tests/.gitignore
git add tests/
git commit -m "test: jsc harness for index.html"
```

---

### Task 1: Catalogue additions and migration `rotation2609`

**Files:**
- Modify: `index.html` DEFAULTS array (around line 200-214), `load()` (line 225), `migrate()` (line 230)
- Test: `tests/tests.js`

**Interfaces:**
- Produces: `normName(s)` → lowercased, trimmed, single-spaced string. `resolveByName(name)` → exercise id (existing, archived or not, else the DEFAULTS id, else `null`). `data.schedule = {mode, planIds}`, `data.migrations = {}`. `migrate2609()` called from `migrate()`, guarded by `data.migrations.rotation2609`.
- Consumed by Task 2 (seeding runs inside `migrate2609` after the catalogue step).

- [ ] **Step 1: Write failing tests**

Append to `tests/tests.js` before the summary lines:

```javascript
section('catalogue + migration');
fresh();
check('normName collapses', normName('  Rücken   Seil pull ')==='rücken seil pull');
check('new default present on fresh install', !!ex('schraeg-kh') && ex('schraeg-kh').group==='Brust');
check('kettlebell default is time mode', ex('kettlebell').mode==='time');
check('schedule initialised', data.schedule && data.schedule.mode===null && Array.isArray(data.schedule.planIds));
check('migration flag set', data.migrations.rotation2609===true);
// import-like state: user's custom exercises with old ids
localStorage.clear();
data={exercises:DEFAULTS.filter(function(e){return e.id==='bank'||e.id==='latzug'||e.id==='beinpresse';}).concat([
  {id:'ex-1',name:'Schrägbank Kurzhantel',group:'Brust',bw:false,mode:'reps'},
  {id:'ex-2',name:'Rücken Seil pull',group:'Brust',bw:false,mode:'reps'},
  {id:'ex-3',name:'Bizeps Krummhantel',group:'Brust',bw:false,mode:'reps'},
  {id:'ex-4',name:'Schulterfreien langhantel',group:'Schulter',bw:false,mode:'reps'},
  {id:'ex-5',name:'Good mornings',group:'Brust',bw:false,mode:'reps'},
  {id:'ex-6',name:'Good mornings',group:'Beine',bw:false,mode:'reps',fav:true},
  {id:'ex-7',name:'Butterfly',group:'Brust',bw:false,mode:'reps'},
  {id:'butterfly',name:'Butterfly',group:'Brust',bw:false,mode:'reps'}
]),sets:[{id:'s1',exerciseId:'ex-6',date:'2026-09-08',ts:1,weight:40,mode:'reps',reps:12}],plans:defaultPlans(),body:[]};
migrate();
check('resolveByName prefers existing', resolveByName('Schrägbank Kurzhantel')==='ex-1');
check('no duplicate by name', data.exercises.filter(function(e){return normName(e.name)==='schrägbank kurzhantel';}).length===1);
check('group fix Seil pull', ex('ex-2').group==='Rücken');
check('group fix Bizeps Krummhantel', ex('ex-3').group==='Arme');
check('rename Schulterdrücken Langhantel', ex('ex-4').name==='Schulterdrücken Langhantel' && resolveByName('Schulterdrücken Langhantel')==='ex-4');
check('empty Good mornings (Brust) archived', ex('ex-5').archived===true);
check('Good mornings with sets kept', !ex('ex-6').archived && resolveByName('Good mornings')==='ex-6');
check('second Butterfly archived', ex('ex-7').archived===true && !ex('butterfly').archived);
var n1=data.exercises.length; migrate(); check('idempotent', data.exercises.length===n1);
check('resolveByName unknown is null', resolveByName('Gibt es nicht')===null);
```

- [ ] **Step 2: Run to verify failure**

Run: `bash tests/run.sh`
Expected: `ReferenceError: Can't find variable: normName` (uncaught, non-zero exit).

- [ ] **Step 3: Implement**

In `index.html`, extend the `DEFAULTS` array (add these rows before the closing `]`):

```javascript
 ['schraeg-kh','Schrägbank Kurzhantel','Brust',false,'reps'],['goodmorning','Good mornings','Beine',false,'reps'],
 ['trizeps-oh','Triceps overhead','Arme',false,'reps'],['seilpull','Rücken Seil pull','Rücken',false,'reps'],
 ['bizeps-kh','Bizeps Krummhantel','Arme',false,'reps'],['hangraise','Hang raise','Bauch',true,'reps'],
 ['schulter-lh','Schulterdrücken Langhantel','Schulter',false,'reps'],['liegestuetz','Liegestütze','Brust',true,'reps'],
 ['rudern-maschine','Rudern Maschine','Rücken',false,'reps'],['kh-rows','Kurzhantel bent rows','Rücken',false,'reps'],
 ['burpees','Burpees','Cardio',true,'reps'],['kettlebell','Full kettlebell workout','Cardio',true,'time'],
 ['kniebeuge-g','Geführte Kniebeuge','Beine',false,'reps'],['bizeps-turm','Bizeps pull up turm','Arme',false,'reps'],
 ['latzug-h','Horizontal lat Zug','Rücken',false,'reps'],['hintere-schulter','Angled Bank hintere Schulter','Schulter',false,'reps'],
 ['rudern-schraeg','Rudern schräg Maschine','Rücken',false,'reps']
```

Replace `var data=...`, `load()` and `migrate()` with:

```javascript
var KEY='gymlog-v1';
function emptySchedule(){return {mode:null,planIds:[]};}
var data={exercises:DEFAULTS.slice(),sets:[],plans:defaultPlans(),body:[],schedule:emptySchedule(),migrations:{}};
function load(){try{var r=localStorage.getItem(KEY);if(r){var p=JSON.parse(r);data={
  exercises:(p.exercises&&p.exercises.length)?p.exercises:DEFAULTS.slice(),
  sets:p.sets||[],
  plans:(p.plans&&p.plans.length)?p.plans:defaultPlans(),
  body:p.body||[],
  schedule:p.schedule||emptySchedule(),
  migrations:p.migrations||{}};}}catch(e){}migrate();}
function normName(s){return String(s||'').toLowerCase().trim().replace(/\s+/g,' ');}
function resolveByName(name){
  var n=normName(name);
  var hit=data.exercises.filter(function(e){return normName(e.name)===n;});
  if(hit.length){var live=hit.filter(function(e){return !e.archived;});return (live[0]||hit[0]).id;}
  var d=DEFAULTS.find(function(e){return normName(e.name)===n;});
  return d?d.id:null;
}
function migrate(){
  if(!data.schedule)data.schedule=emptySchedule();
  if(!data.migrations)data.migrations={};
  if(!data.exercises.some(function(e){return e.id==='laufband'||e.mode==='cardio';}))
    data.exercises.push({id:'laufband',name:'Laufband',group:'Cardio',bw:true,mode:'cardio'});
  migrate2609();
}
function migrate2609(){
  if(data.migrations.rotation2609)return;
  /* 1. rename before matching */
  data.exercises.forEach(function(e){if(normName(e.name)==='schulterfreien langhantel'){e.name='Schulterdrücken Langhantel';e.group='Schulter';}});
  /* 2. group fixes by name */
  var fix={'rücken seil pull':'Rücken','bizeps krummhantel':'Arme'};
  data.exercises.forEach(function(e){var g=fix[normName(e.name)];if(g)e.group=g;});
  /* 3. add missing defaults by name */
  DEFAULTS.forEach(function(d){
    if(!data.exercises.some(function(e){return normName(e.name)===normName(d.name);}))
      data.exercises.push({id:d.id,name:d.name,group:d.group,bw:d.bw,mode:d.mode});
  });
  /* 4. archive duplicates without sets (keep the one with sets, else the first) */
  var seen={};
  data.exercises.forEach(function(e){
    var n=normName(e.name);if(e.archived)return;
    if(!seen[n]){seen[n]=e;return;}
    var a=seen[n],b=e,na=setsFor(a.id).length,nb=setsFor(b.id).length;
    if(nb>na||(nb===na&&isDefaultId(b.id)&&!isDefaultId(a.id))){a.archived=true;seen[n]=b;}else{b.archived=true;}
  });
  data.migrations.rotation2609=true;
}
function isDefaultId(id){return DEFAULTS.some(function(d){return d.id===id;});}
```

Tie-break: equal set counts keep the built-in exercise (its id is in DEFAULTS) and archive the custom duplicate.

Note: `setsFor` is defined later in the file (line ~275) as a function declaration, so it is hoisted and callable from `migrate2609`.

- [ ] **Step 4: Run tests**

Run: `bash tests/run.sh`
Expected: all checks in `catalogue + migration` pass, `0 failed`.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/tests.js
git commit -m "Katalog: Benjamins Übungen eingebaut, Gruppen korrigiert, Duplikate archiviert (Migration rotation2609)"
```

---

### Task 2: Seeded plans with targets

**Files:**
- Modify: `index.html` after `defaultPlans()` (add `SEED_PLANS`, `seedPlans()`), inside `migrate2609()` (call `seedPlans()` before setting the flag)
- Test: `tests/tests.js`

**Interfaces:**
- Produces: `RULES = {U, L, H, HL, LIGHT, BW, T}` rule objects; `SEED_PLANS` (array of `{id, name, rows:[[name, ruleKey], ...]}`); `seedPlans()` creates missing plans with `exIds` resolved by name and `targets` keyed by resolved id. `ROTATION = {'3':[ids], '4':[ids]}`.

- [ ] **Step 1: Write failing tests**

```javascript
section('seeded plans');
fresh();
check('seven plans seeded', ['plan-gk-a','plan-gk-b','plan-gk-c','plan-ob-1','plan-un-1','plan-ob-2','plan-un-2'].every(function(id){return !!plan(id);}));
check('old plans kept', !!plan('plan-push'));
check('GK A order legs first', plan('plan-gk-a').exIds[0]==='beinpresse');
check('GK A targets keyed by id', plan('plan-gk-a').targets['beinpresse'].repMax===15 && plan('plan-gk-a').targets['beinpresse'].incr===5);
check('GK C deadlift heavy rule', plan('plan-gk-c').targets['kreuz'].repMin===5 && plan('plan-gk-c').targets['kreuz'].incr===5);
check('GK C bench heavy rule', plan('plan-gk-c').targets['bank'].repMax===8 && plan('plan-gk-c').targets['bank'].incr===2.5);
check('no free-bar squat in seeds', SEED_PLANS.every(function(p){return p.rows.every(function(r){return normName(r[0])!=='kniebeugen';});}));
check('ROTATION 3 and 4', ROTATION['3'].length===3 && ROTATION['4'].length===4);
// seed uses existing ids
localStorage.clear();
data={exercises:DEFAULTS.filter(function(e){return e.id!=='schraeg-kh';}).concat([{id:'ex-1',name:'Schrägbank Kurzhantel',group:'Brust',bw:false,mode:'reps'}]),sets:[],plans:defaultPlans(),body:[]};
migrate();
check('seed uses existing ids', plan('plan-gk-a').exIds.indexOf('ex-1')>=0 && plan('plan-gk-a').exIds.indexOf('schraeg-kh')<0);
var pc=data.plans.length; migrate(); check('seed idempotent', data.plans.length===pc);
```

- [ ] **Step 2: Run to verify failure**

Run: `bash tests/run.sh`
Expected: `FAIL: seven plans seeded` and the following seeded-plan checks fail (or a ReferenceError on `SEED_PLANS`).

- [ ] **Step 3: Implement**

Add after `defaultPlans()`:

```javascript
var RULES={U:{sets:3,repMin:8,repMax:12,incr:2.5},L:{sets:3,repMin:10,repMax:15,incr:5},
  H:{sets:3,repMin:5,repMax:8,incr:2.5},HL:{sets:3,repMin:5,repMax:8,incr:5},
  LIGHT:{sets:3,repMin:12,repMax:15,incr:2.5},BW:{sets:3,repMin:10,repMax:15,incr:0},T:{sets:3}};
var SEED_PLANS=[
  {id:'plan-gk-a',name:'Ganzkörper A',rows:[['Beinpresse','L'],['Schrägbank Kurzhantel','U'],['Latzug','U'],['Good mornings','L'],['Schulterdrücken','U'],['Hang raise','BW']]},
  {id:'plan-gk-b',name:'Ganzkörper B',rows:[['Geführte Kniebeuge','L'],['Schrägbankdrücken','U'],['Rudern schräg Maschine','U'],['Beinbeuger','L'],['Trizeps-Drücken','U'],['Plank','T']]},
  {id:'plan-gk-c',name:'Ganzkörper C',rows:[['Kreuzheben','HL'],['Bankdrücken','H'],['Langhantelrudern','U'],['Beinstrecker','LIGHT'],['Bizeps-Curls','U'],['Dead Hang','T']]},
  {id:'plan-ob-1',name:'Ober 1',rows:[['Schrägbank Kurzhantel','U'],['Schrägbankdrücken','U'],['Schulterdrücken','U'],['Seitheben','U'],['Trizeps-Drücken','U'],['Triceps overhead','U']]},
  {id:'plan-un-1',name:'Unter 1',rows:[['Beinpresse','L'],['Geführte Kniebeuge','L'],['Beinstrecker','LIGHT'],['Wadenheben','L'],['Wall Sit','T'],['Plank','T']]},
  {id:'plan-ob-2',name:'Ober 2',rows:[['Latzug','U'],['Rudern schräg Maschine','U'],['Langhantelrudern','U'],['Rücken Seil pull','U'],['Bizeps-Curls','U'],['Hang raise','BW'],['Dead Hang','T']]},
  {id:'plan-un-2',name:'Unter 2',rows:[['Kreuzheben','HL'],['Good mornings','L'],['Beinbeuger','L'],['Wadenheben','L'],['Hang raise','BW'],['Seitstütz','T']]}
];
var ROTATION={'3':['plan-gk-a','plan-gk-b','plan-gk-c'],'4':['plan-ob-1','plan-un-1','plan-ob-2','plan-un-2']};
function seedPlans(){
  SEED_PLANS.forEach(function(sp){
    if(plan(sp.id))return;
    var p={id:sp.id,name:sp.name,exIds:[],targets:{}};
    sp.rows.forEach(function(r){var id=resolveByName(r[0]);if(!id||p.exIds.indexOf(id)>=0)return;p.exIds.push(id);p.targets[id]=Object.assign({},RULES[r[1]]);});
    data.plans.push(p);
  });
}
```

In `migrate2609()`, insert `seedPlans();` directly before `data.migrations.rotation2609=true;`. (`plan(id)` is a hoisted function declaration at line ~449, callable here.)

- [ ] **Step 4: Run tests**

Run: `bash tests/run.sh`
Expected: `0 failed`.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/tests.js
git commit -m "Pläne: Ganzkörper A/B/C und Ober/Unter 1+2 mit Zielregeln gesät"
```

---

### Task 3: Target rule and weight suggestion

**Files:**
- Modify: `index.html` helpers section (after `setsFor`, line ~275)
- Test: `tests/tests.js`

**Interfaces:**
- Produces: `ruleFor(p, exId)` → rule object (plan target or default by exercise). `lastSessionSets(exId, todayKey)` → array of sets of the latest date before `todayKey`, or `null`. `suggestFor(p, exId, todayKey)` → `{sets, repMin, repMax, weight, up, seconds, first}`. `fmtTarget(sugg, e)` → string like `3 × 10–15 · 65 kg`.
- Consumed by Tasks 5, 6, 7.

- [ ] **Step 1: Write failing tests**

```javascript
section('targets + suggestion');
fresh();
var P=plan('plan-gk-a'), T='2026-09-29';
function mk(id,date,w,r,i){return {id:id+date+i,exerciseId:id,date:date,ts:Date.parse(date)+i,weight:w,mode:'reps',reps:r};}
check('rule from plan', ruleFor(P,'beinpresse').incr===5);
check('rule default Beine', ruleFor({exIds:[],targets:{}},'beinstrecker').repMax===15);
check('rule default upper', ruleFor({exIds:[],targets:{}},'latzug').repMax===12 && ruleFor({exIds:[],targets:{}},'latzug').incr===2.5);
check('rule default bw', ruleFor({exIds:[],targets:{}},'hangraise').incr===0);
check('rule default time', ruleFor({exIds:[],targets:{}},'plank').repMax===undefined && ruleFor({exIds:[],targets:{}},'plank').sets===3);
check('no history -> first', suggestFor(P,'beinpresse',T).first===true && suggestFor(P,'beinpresse',T).weight===null);
data.sets=[mk('beinpresse','2026-09-20',60,15,1),mk('beinpresse','2026-09-20',60,15,2),mk('beinpresse','2026-09-20',60,15,3)];
var s=suggestFor(P,'beinpresse',T);
check('all sets at top -> +5 up', s.weight===65 && s.up===true && s.repMin===10 && s.repMax===15);
data.sets=[mk('beinpresse','2026-09-20',60,15,1),mk('beinpresse','2026-09-20',60,15,2),mk('beinpresse','2026-09-20',60,14,3),mk('beinpresse','2026-09-20',60,15,4)];
s=suggestFor(P,'beinpresse',T); check('partial no up', s.weight===60 && s.up===false);
data.sets=[mk('beinpresse','2026-09-20',60,15,1),mk('beinpresse','2026-09-20',60,15,2)];
s=suggestFor(P,'beinpresse',T); check('too few sets no up', s.weight===60 && s.up===false);
data.sets=[mk('latzug','2026-09-20',56,12,1),mk('latzug','2026-09-20',56,12,2),mk('latzug','2026-09-20',56,12,3),mk('latzug','2026-09-27',52,10,1)];
s=suggestFor(P,'latzug',T); check('uses latest session only', s.weight===52 && s.up===false);
data.sets=[mk('latzug','2026-09-29',56,12,1)];
s=suggestFor(P,'latzug',T); check('today sets ignored', s.first===true);
data.sets=[mk('latzug','2026-09-20',50,12,1),mk('latzug','2026-09-20',56,12,2),mk('latzug','2026-09-20',56,12,3)];
s=suggestFor(P,'latzug',T); check('most frequent weight wins', s.weight===58.5 && s.up===true);
data.sets=[{id:'p1',exerciseId:'plank',date:'2026-09-20',ts:1,weight:0,mode:'time',seconds:60},{id:'p2',exerciseId:'plank',date:'2026-09-20',ts:2,weight:0,mode:'time',seconds:75}];
s=suggestFor(plan('plan-gk-b'),'plank',T); check('time exercise suggests best seconds', s.seconds===75 && s.weight===null);
data.sets=[mk('hangraise','2026-09-20',0,15,1),mk('hangraise','2026-09-20',0,15,2),mk('hangraise','2026-09-20',0,15,3)];
s=suggestFor(P,'hangraise',T); check('bodyweight never up', s.weight===0 && s.up===false);
check('fmtTarget', fmtTarget({sets:3,repMin:10,repMax:15,weight:65,up:true,first:false},ex('beinpresse'))==='3 × 10–15 · 65 kg');
check('fmtTarget first', fmtTarget({sets:3,repMin:8,repMax:12,weight:null,up:false,first:true},ex('latzug'))==='3 × 8–12 · erstes Mal');
check('fmtTarget time', fmtTarget({sets:3,seconds:75,weight:null,first:false},ex('plank'))==='3 × 1:15');
```

- [ ] **Step 2: Run to verify failure**

Run: `bash tests/run.sh`
Expected: `ReferenceError: Can't find variable: ruleFor`.

- [ ] **Step 3: Implement** (add after `function setsFor(...)`)

```javascript
function ruleFor(p,exId){
  if(p&&p.targets&&p.targets[exId])return p.targets[exId];
  var e=ex(exId);if(!e)return RULES.U;
  if(isTime(e)||isCardio(e))return RULES.T;
  if(e.bw)return RULES.BW;
  return e.group==='Beine'?RULES.L:RULES.U;
}
function lastSessionSets(exId,todayKey){
  var ss=setsFor(exId).filter(function(s){return s.date<todayKey;});
  if(!ss.length)return null;
  var last=ss.reduce(function(m,s){return s.date>m?s.date:m;},'');
  return ss.filter(function(s){return s.date===last;}).sort(function(a,b){return a.ts-b.ts;});
}
function suggestFor(p,exId,todayKey){
  var e=ex(exId),r=ruleFor(p,exId),ls=lastSessionSets(exId,todayKey);
  var out={sets:r.sets,repMin:r.repMin,repMax:r.repMax,weight:null,up:false,seconds:null,first:!ls};
  if(!ls||!e)return out;
  if(isTime(e)){out.seconds=ls.reduce(function(m,s){return Math.max(m,s.seconds||0);},0);return out;}
  if(isCardio(e))return out;
  var cnt={};ls.forEach(function(s){var w=s.weight||0;cnt[w]=(cnt[w]||0)+1;});
  var w=Number(Object.keys(cnt).sort(function(a,b){return cnt[b]-cnt[a]||Number(b)-Number(a);})[0]);
  var hit=!!r.repMax&&ls.length>=r.sets&&ls.every(function(s){return (s.reps||0)>=r.repMax;});
  if(e.bw&&w===0){out.weight=0;return out;}
  out.up=hit&&r.incr>0;out.weight=out.up?w+r.incr:w;
  return out;
}
function fmtTarget(s,e){
  if(e&&isTime(e))return s.sets+' × '+(s.seconds?fmtTimeShort(s.seconds):(s.first?'erstes Mal':'Zeit'));
  var reps=s.repMin?s.repMin+'–'+s.repMax:'';
  var w=s.first?'erstes Mal':(e&&e.bw&&!s.weight?'Körpergewicht':s.weight+' kg');
  return s.sets+' × '+reps+' · '+w;
}
```

`fmtTimeShort(75)` already returns `1:15` in this app (used by the logger). Verify with `grep -n "function fmtTimeShort" index.html`.

- [ ] **Step 4: Run tests**

Run: `bash tests/run.sh`
Expected: `0 failed`.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/tests.js
git commit -m "Zielregel und Gewichtsvorschlag pro Übung (Doppelprogression)"
```

---

### Task 4: Rotation pointer

**Files:**
- Modify: `index.html` after `suggestFor` block
- Test: `tests/tests.js`

**Interfaces:**
- Produces: `planDayOf(dateKey)` → plan id or `null`; `nextPlanId(todayKey)` → plan id or `null` (schedule off); `todayPlanState(todayKey)` → `{kind:'off'}` | `{kind:'today', planId, done, total}` | `{kind:'done', planId, nextId}` | `{kind:'next', planId}`.
- Consumed by Tasks 5 and 6.

- [ ] **Step 1: Write failing tests**

```javascript
section('rotation');
fresh(); data.schedule={mode:'3',planIds:ROTATION['3'].slice()};
var T='2026-09-29';
check('next: no history -> first', nextPlanId(T)==='plan-gk-a');
check('state next', todayPlanState(T).kind==='next' && todayPlanState(T).planId==='plan-gk-a');
data.sets=[mk('beinpresse','2026-09-20',60,12,1),mk('latzug','2026-09-20',50,12,1)];
check('after A -> B', nextPlanId(T)==='plan-gk-b');
data.sets=[mk('beinpresse','2026-09-20',60,12,1)];
check('one exercise does not count', nextPlanId(T)==='plan-gk-a' && planDayOf('2026-09-20')===null);
data.sets=[mk('kreuz','2026-09-25',80,8,1),mk('bank','2026-09-25',60,8,1)];
check('after C -> A (wrap)', nextPlanId(T)==='plan-gk-a');
data.sets=[mk('beinpresse','2026-09-20',60,12,1),mk('latzug','2026-09-20',50,12,1),mk('kniebeuge-g','2026-09-29',40,12,1),mk('schraeg','2026-09-29',50,10,1)];
var st=todayPlanState(T); check('today matched B with done 2/6', st.kind==='today' && st.planId==='plan-gk-b' && st.done===2 && st.total===6);
data.sets=plan('plan-gk-b').exIds.map(function(id,i){return {id:'d'+i,exerciseId:id,date:'2026-09-29',ts:i,weight:10,mode:'reps',reps:10};});
st=todayPlanState(T); check('today complete -> done with next C', st.kind==='done' && st.nextId==='plan-gk-c');
data.schedule=emptySchedule(); check('schedule off', todayPlanState(T).kind==='off' && nextPlanId(T)===null);
```

- [ ] **Step 2: Run to verify failure**

Run: `bash tests/run.sh`
Expected: `ReferenceError: Can't find variable: nextPlanId`.

- [ ] **Step 3: Implement**

```javascript
function planDayOf(dateKey,prevId){
  var ids=data.schedule.planIds;if(!ids.length)return null;
  var logged={};data.sets.forEach(function(s){if(s.date===dateKey)logged[s.exerciseId]=1;});
  var best=[],bestN=1;
  ids.forEach(function(pid){var p=plan(pid);if(!p)return;var n=p.exIds.filter(function(x){return logged[x];}).length;
    if(n>bestN){best=[pid];bestN=n;}else if(n===bestN&&n>=2)best.push(pid);});
  if(!best.length)return null;
  if(best.length>1&&prevId){var exp=ids[(ids.indexOf(prevId)+1)%ids.length];if(best.indexOf(exp)>=0)return exp;}
  return best[0];
}
function lastPlanDayBefore(todayKey){
  var days={};data.sets.forEach(function(s){if(s.date<todayKey)days[s.date]=1;});
  var keys=Object.keys(days).sort().reverse();
  for(var i=0;i<keys.length;i++){var pid=planDayOf(keys[i]);if(pid)return {date:keys[i],planId:pid};}
  return null;
}
function nextPlanId(todayKey){
  var ids=data.schedule.planIds;if(!data.schedule.mode||!ids.length)return null;
  var last=lastPlanDayBefore(todayKey);
  if(!last)return ids[0];
  return ids[(ids.indexOf(last.planId)+1)%ids.length];
}
function todayPlanState(todayKey){
  var ids=data.schedule.planIds;if(!data.schedule.mode||!ids.length)return {kind:'off'};
  var last=lastPlanDayBefore(todayKey);
  var todayId=planDayOf(todayKey,last?last.planId:null);
  if(todayId){var p=plan(todayId);var done=planDoneCount(p,todayKey);
    if(done>=p.exIds.length)return {kind:'done',planId:todayId,nextId:ids[(ids.indexOf(todayId)+1)%ids.length]};
    return {kind:'today',planId:todayId,done:done,total:p.exIds.length};}
  return {kind:'next',planId:nextPlanId(todayKey)};
}
```

- [ ] **Step 4: Run tests**

Run: `bash tests/run.sh`
Expected: `0 failed`.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/tests.js
git commit -m "Rotation: welcher Plantag ist dran (Zeiger auf den letzten trainierten Tag)"
```

---

### Task 5: Plans screen: rotation control, order, targets on rows

**Files:**
- Modify: `index.html` `viewPlans()` (line ~453), `viewPlan()` row meta (line ~478), click switch (add `rotmode`), CSS (add `.dueTag`)
- Test: `tests/tests.js` (render smoke checks on the HTML string)

**Interfaces:**
- Consumes: `todayPlanState`, `suggestFor`, `fmtTarget`, `ROTATION`.
- Produces: action `rotmode` with `data-v` in `'3' | '4' | 'off'`.

- [ ] **Step 1: Write failing tests**

```javascript
section('plans screen');
fresh(); ui.view='plans';
var h=viewPlans();
check('rotation control rendered', h.indexOf('data-a="rotmode" data-v="3"')>=0 && h.indexOf('data-v="off"')>=0);
check('off: no due tag', h.indexOf('als Nächstes')<0);
data.schedule={mode:'3',planIds:ROTATION['3'].slice()}; h=viewPlans();
check('due tag on first plan', h.indexOf('als Nächstes')>=0 && h.indexOf('Ganzkörper A')<h.indexOf('als Nächstes'));
check('custom plans listed under Weitere', h.indexOf('Weitere Pläne')>=0 && h.indexOf('Push')>h.indexOf('Weitere Pläne'));
ui.activePlanId='plan-gk-a'; data.sets=[mk('beinpresse','2026-09-20',60,15,1),mk('beinpresse','2026-09-20',60,15,2),mk('beinpresse','2026-09-20',60,15,3)];
var hp=viewPlan();
check('plan row shows target with up arrow', hp.indexOf('3 × 10–15 · <b>65</b> kg')>=0 && hp.indexOf('↑')>=0);
check('plan row first time', hp.indexOf('erstes Mal')>=0);
```

- [ ] **Step 2: Run to verify failure**

Run: `bash tests/run.sh`
Expected: `FAIL: rotation control rendered` (and the others in this section).

- [ ] **Step 3: Implement**

CSS (add near `.planCard` rules):

```css
  .dueTag{font-size:11px;font-weight:700;color:var(--bg);background:var(--accent);border-radius:10px;padding:2px 8px;margin-left:8px;white-space:nowrap}
  .secHeadPlans{font-family:var(--display);font-size:11px;letter-spacing:2px;color:var(--muted);margin:16px 2px 8px}
```

Replace `viewPlans()`:

```javascript
function viewPlans(){
  var today=dayKey(new Date()),st=todayPlanState(today);
  var dueId=st.kind==='today'?st.planId:(st.kind==='done'?st.nextId:(st.kind==='next'?st.planId:null));
  function card(p){
    var done=planDoneCount(p,today),due=p.id===dueId;
    return `<button class="planCard tap" data-a="planopen" data-id="${p.id}">
      <div style="min-width:0"><div class="planName">${esc(p.name)}${due?'<span class="dueTag">'+(st.kind==='today'?'heute':'als Nächstes')+'</span>':''}</div>
      <div class="planMeta">${p.exIds.length} ${p.exIds.length===1?'Übung':'Übungen'}${done?' · heute '+done+' trainiert':''}</div></div>
      <div class="planProg">${done?done+'/'+p.exIds.length:''}</div>
      ${ico('chevright',18,'#8C8895')}
    </button>`;
  }
  var mode=data.schedule.mode||'off';
  var ctrl=`<div class="modeToggle" style="margin:0 0 14px">${[['3','3 Tage'],['4','4 Tage'],['off','Aus']].map(function(o){
    return `<button class="modeBtn tap${mode===o[0]?' on':''}" data-a="rotmode" data-v="${o[0]}">${o[1]}</button>`;}).join('')}</div>`;
  var rot=data.schedule.planIds.map(function(id){var p=plan(id);return p?card(p):'';}).join('');
  var others=data.plans.filter(function(p){return data.schedule.planIds.indexOf(p.id)<0;}).map(card).join('');
  var hint=mode==='3'?'Ganzkörper A, B, C im Wechsel. Der nächste Tag folgt auf den zuletzt trainierten.':(mode==='4'?'Ober und Unter im Wechsel, Beine zweimal pro Runde.':'Keine Rotation. Wähle 3 oder 4 Tage, dann sagt dir die Startseite, was dran ist.');
  return `<div class="header">
     <div><div class="eyebrow">TRAININGSPLÄNE</div><div class="dateBig">Deine Routinen</div></div>
     <div class="top-icons"><button class="icon-btn tap" data-a="menu" aria-label="Menü — Daten &amp; Sicherung">${ico('menu',22,'#8C8895')}</button>${ico('clipboard',24,'#F5C518')}</div>
   </div>
   ${ctrl}<div class="hintSub" style="margin:-6px 2px 12px">${hint}</div>
   ${rot}
   ${rot?'<div class="secHeadPlans">WEITERE PLÄNE</div>':''}
   ${others}
   <button class="planCard add tap" data-a="plannew">${ico('plus',18,'#F5C518')} Neuen Plan anlegen</button>
   ${navBar('plans')}`;
}
```

In `viewPlan()`, replace the two lines `var l=lastBy[eid],doneToday=...;` and `var last=l?...:'neu';` with:

```javascript
    var doneToday=data.sets.some(function(s){return s.exerciseId===eid&&s.date===today;});
    var sg=suggestFor(p,eid,today);
    var tgt=fmtTarget(sg,e).replace(/(\d+(?:\.\d+)?) kg$/,'<b>$1</b> kg')+(sg.up?' <span style="color:var(--accent)">↑</span>':'');
    var l=lastBy[eid];
    var last=l?(isCardio(l)?nf1(l.km||0)+' km':(isTime(l)?fmtTimeShort(l.seconds):(l.weight>0?l.weight+' × '+l.reps:l.reps+' Wdh.'))):'';
```

and the meta line becomes:

```javascript
        <div class="planRowMeta">Ziel ${tgt}${last?' · zuletzt '+last:''}</div></div>
```

Click switch, add after `case'planback'`:

```javascript
    case'rotmode':{data.schedule=v==='off'?emptySchedule():{mode:v,planIds:ROTATION[v].slice()};save();render();toast(v==='off'?'Rotation aus':'Rotation: '+v+' Tage');break;}
```

- [ ] **Step 4: Run tests**

Run: `bash tests/run.sh`
Expected: `0 failed`.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/tests.js
git commit -m "Pläne-Screen: Rotation 3/4 Tage, Reihenfolge mit 'als Nächstes', Ziele pro Übung"
```

---

### Task 6: Home card "Heute dran"

**Files:**
- Modify: `index.html` `viewHome()` (insert card between `statRow` and `stickyTop`), click switch (add `homeplan`), CSS (`.dayCard`)
- Test: `tests/tests.js`

**Interfaces:**
- Consumes: `todayPlanState`, `suggestFor`, `fmtTarget`.
- Produces: action `homeplan` (`data-id` = plan id) → sets `ui.activePlanId`, `go('plan')`.

- [ ] **Step 1: Write failing tests**

```javascript
section('home card');
fresh(); ui.view='home';
check('home card empty history', (function(){data.schedule={mode:'3',planIds:ROTATION['3'].slice()};var h=viewHome();return h.indexOf('HEUTE DRAN')>=0&&h.indexOf('Ganzkörper A')>=0&&h.indexOf('erstes Mal')>=0;})());
check('home card lists three exercises', (viewHome().match(/dayEx/g)||[]).length===3);
data.schedule=emptySchedule(); check('no card when off', viewHome().indexOf('HEUTE DRAN')<0);
data.schedule={mode:'3',planIds:ROTATION['3'].slice()};
data.sets=plan('plan-gk-a').exIds.map(function(id,i){return {id:'d'+i,exerciseId:id,date:dayKey(new Date()),ts:i,weight:10,mode:'reps',reps:10};});
check('home card done state', viewHome().indexOf('ERLEDIGT')>=0 && viewHome().indexOf('Ganzkörper B')>=0);
```

- [ ] **Step 2: Run to verify failure**

Run: `bash tests/run.sh`
Expected: `FAIL: home card empty history` etc.

- [ ] **Step 3: Implement**

CSS:

```css
  .dayCard{border-color:var(--accent)}
  .dayEx{font-size:12.5px;color:var(--muted);margin-top:3px} .dayEx b{color:var(--text);font-weight:600}
  .dayMore{font-size:12px;color:var(--muted);margin-top:4px}
```

In `viewHome()`, add before the `return` a helper and insert `${dayCard}` right after the `statRow` div (before the kcal hint):

```javascript
  var st=todayPlanState(today),dayCard='';
  if(st.kind!=='off'){
    var pid=st.kind==='done'?st.nextId:st.planId,p=plan(pid);
    if(p){
      var eyebrow=st.kind==='today'?'HEUTE · '+st.done+'/'+st.total:(st.kind==='done'?'ERLEDIGT · NÄCHSTES':'HEUTE DRAN');
      var rows=p.exIds.slice(0,3).map(function(eid){var e=ex(eid);if(!e)return'';return '<div class="dayEx"><b>'+esc(e.name)+'</b> · '+fmtTarget(suggestFor(p,eid,today),e)+'</div>';}).join('');
      dayCard=`<button class="planCard dayCard tap" data-a="homeplan" data-id="${p.id}">
        <div style="min-width:0"><div class="eyebrow">${eyebrow}</div><div class="planName">${esc(p.name)}</div>${rows}${p.exIds.length>3?'<div class="dayMore">+ '+(p.exIds.length-3)+' weitere</div>':''}</div>
        ${ico('chevright',18,'#F5C518')}</button>`;
    }
  }
```

Click switch:

```javascript
    case'homeplan':ui.activePlanId=id;ui.origin='home';go('plan');break;
```

Also in `goBack()` and the `planback` action nothing changes: from the plan screen, back goes to `plans` as today. (Accepted: user came from Home, lands on Pläne. Keep simple.)

- [ ] **Step 4: Run tests**

Run: `bash tests/run.sh`
Expected: `0 failed`.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/tests.js
git commit -m "Startseite: Karte 'Heute dran' mit Plantag und Zielen"
```

---

### Task 7: Logger target line and pre-fill

**Files:**
- Modify: `index.html` `ui` object (add `prefilled:{}`), `go()` (call `applyTargetPrefill` after `ensureDraft`), `viewLog()` (target line under `refLine()`), `planopen`/`open` actions (keep `ui.activePlanId` when origin is plan)
- Test: `tests/tests.js`

**Interfaces:**
- Produces: `applyTargetPrefill(e, todayKey)` mutates `ui.draft` once per exercise per day when `ui.origin==='plan'` and `ui.activePlanId` is set. `targetLine(e, todayKey)` → HTML string or `''`.

- [ ] **Step 1: Write failing tests**

```javascript
section('logger prefill');
fresh(); data.schedule={mode:'3',planIds:ROTATION['3'].slice()};
var T2=dayKey(new Date());
data.sets=[mk('beinpresse','2026-09-20',60,15,1),mk('beinpresse','2026-09-20',60,15,2),mk('beinpresse','2026-09-20',60,15,3)];
ui.origin='home'; ui.activePlanId='plan-gk-a'; ui.draft=null; ensureDraft(ex('beinpresse')); applyTargetPrefill(ex('beinpresse'),T2);
check('no prefill from home', ui.draft.weight===60 && ui.draft.reps===15);
ui.origin='plan'; ui.draft=null; ensureDraft(ex('beinpresse')); applyTargetPrefill(ex('beinpresse'),T2);
check('prefill from plan: +5 and repMin', ui.draft.weight===65 && ui.draft.reps===10);
ui.draft.weight=70; applyTargetPrefill(ex('beinpresse'),T2);
check('no overwrite same day', ui.draft.weight===70);
ui.activeId='beinpresse'; var hl=viewLog();
check('target line rendered', hl.indexOf('Ziel')>=0 && hl.indexOf('65 kg')>=0 && hl.indexOf('Ziel erreicht')>=0);
ui.origin='home'; check('no target line from home', viewLog().indexOf('Ziel')<0);
data.sets=[{id:'p1',exerciseId:'plank',date:'2026-09-20',ts:1,weight:0,mode:'time',seconds:75}];
ui.origin='plan'; ui.activePlanId='plan-gk-b'; ui.draft=null; ensureDraft(ex('plank')); applyTargetPrefill(ex('plank'),T2);
check('time prefill seconds', ui.draft.seconds===75);
```

- [ ] **Step 2: Run to verify failure**

Run: `bash tests/run.sh`
Expected: `ReferenceError: Can't find variable: applyTargetPrefill`.

- [ ] **Step 3: Implement**

`ui` object: add `prefilled:{}` after `undo:null`.

After `ensureDraft`:

```javascript
function applyTargetPrefill(e,todayKey){
  if(ui.origin!=='plan'||!ui.activePlanId||!ui.draft||ui.draft.exId!==e.id)return;
  if(ui.prefilled[e.id]===todayKey)return;
  var p=plan(ui.activePlanId);if(!p||p.exIds.indexOf(e.id)<0)return;
  var s=suggestFor(p,e.id,todayKey);
  if(isTime(e)){if(s.seconds)ui.draft.seconds=s.seconds;}
  else if(!isCardio(e)){if(s.weight!==null)ui.draft.weight=s.weight;if(s.repMin)ui.draft.reps=s.repMin;}
  ui.prefilled[e.id]=todayKey;
}
function targetLine(e,todayKey){
  if(ui.origin!=='plan'||!ui.activePlanId)return'';
  var p=plan(ui.activePlanId);if(!p||p.exIds.indexOf(e.id)<0)return'';
  var s=suggestFor(p,e.id,todayKey);
  var extra=s.up?' <span style="color:var(--accent)">(+'+ruleFor(p,e.id).incr+' kg, Ziel erreicht)</span>':'';
  return '<div class="lastRef">'+ico('trend',13,'#F5C518')+'<span>Ziel: <b>'+fmtTarget(s,e)+'</b>'+extra+'</span></div>';
}
```

In `go()`: change `if(view==='log'){var e=ex(ui.activeId);ensureDraft(e);}` to `if(view==='log'){var e=ex(ui.activeId);ensureDraft(e);applyTargetPrefill(e,dayKey(new Date()));}`.

In `viewLog()` return block, directly after `${refLine()}` add `${targetLine(e,today)}`.

- [ ] **Step 4: Run tests**

Run: `bash tests/run.sh`
Expected: `0 failed`.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/tests.js
git commit -m "Logger: Ziel-Zeile und Vorbelegung aus dem Plan (einmal pro Tag)"
```

---

### Task 8: Export and import carry schedule and migrations

**Files:**
- Modify: `index.html` `exportJson()` payload, `fileIn` change handler
- Test: `tests/tests.js`

**Interfaces:**
- Produces: export payload `version:3` with `schedule` and `migrations`; import accepts v2 (no schedule) and v3.

- [ ] **Step 1: Write failing tests**

```javascript
section('export / import');
fresh(); data.schedule={mode:'4',planIds:ROTATION['4'].slice()};
var payload=exportPayload();
check('payload v3 with schedule', payload.version===3 && payload.schedule.mode==='4' && payload.migrations.rotation2609===true);
var v2={app:'gym-log',version:2,exercises:DEFAULTS.slice(0,5),sets:[],plans:defaultPlans(),body:[]};
applyImport(v2);
check('v2 import gets empty schedule and seeds', data.schedule.mode===null && !!plan('plan-gk-a') && data.migrations.rotation2609===true);
applyImport(payload);
check('v3 import keeps schedule', data.schedule.mode==='4' && data.plans.filter(function(p){return p.id==='plan-un-1';}).length===1);
```

- [ ] **Step 2: Run to verify failure**

Run: `bash tests/run.sh`
Expected: `ReferenceError: Can't find variable: exportPayload`.

- [ ] **Step 3: Implement**

Replace `exportJson()` and the import body:

```javascript
function exportPayload(){
  return {app:'gym-log',version:3,exportedAt:new Date().toISOString(),exercises:data.exercises,sets:data.sets,plans:data.plans,body:data.body,schedule:data.schedule,migrations:data.migrations};
}
function exportJson(){
  download('gymlog-backup-'+dayKey(new Date())+'.json',JSON.stringify(exportPayload(),null,2));
  toast('Backup exportiert');
}
function applyImport(p){
  data={exercises:p.exercises,sets:p.sets,plans:(p.plans&&p.plans.length)?p.plans:defaultPlans(),body:p.body||[],
        schedule:p.schedule||emptySchedule(),migrations:p.migrations||{}};
  migrate();save();
}
```

and inside the `fileIn` change handler replace the line starting with `data={exercises:p.exercises,...};migrate();save();` by `applyImport(p);` keeping `ui.modal=null;ui.view='home';render();toast('Backup wiederhergestellt');` after it.

- [ ] **Step 4: Run tests**

Run: `bash tests/run.sh`
Expected: `0 failed`.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/tests.js
git commit -m "Backup: Rotation und Migrationsstand im Export, v2-Import bleibt kompatibel"
```

---

### Task 9: Manual check in Chrome with Benjamin's backup, then push

**Files:**
- No code changes expected; fix anything found, with a test, in the task that owns it.

- [ ] **Step 1: Serve locally** (outside the sandbox, port not 8765/8790/8791)

Run: `cd ~/gym-log && (nohup python3 -m http.server 8792 > /tmp/gymlog-serve.log 2>&1 &)`

- [ ] **Step 2: Load the backup into localStorage** via the Chrome javascript tool on `http://127.0.0.1:8792/`:

```javascript
// paste the file content of ~/Library/Mobile Documents/com~apple~CloudDocs/gymlog-backup-2026-09-29.json as BACKUP
localStorage.setItem('gymlog-v1', JSON.stringify(BACKUP)); location.reload();
```

- [ ] **Step 3: Check** with screenshots: Pläne shows the control and the seven plans; choose "3 Tage"; Home shows "HEUTE DRAN · Ganzkörper A" with Beinpresse 3 × 10–15 · 58 kg (his last press session was 58 × 10 ×3, not at top → 58, no arrow), Latzug 56 kg; open Ganzkörper A, open Latzug: the target line reads "Ziel: 3 × 8–12 · 56 kg" and the weight is pre-filled 56, reps 8. Open Home → Latzug (not via plan): no target line.

- [ ] **Step 4: Run the full test file one last time**

Run: `bash tests/run.sh`
Expected: `0 failed`.

- [ ] **Step 5: Push** (deploys GitHub Pages)

```bash
git push origin main
```

Then open https://fuerstoldenburger.github.io/gym-log/ on the phone, Menü → Backup importieren with the 2026-09-29 file, Pläne → 3 Tage.
