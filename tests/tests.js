// tests/tests.js - runs after the app script; uses print() from jsc
var __pass=0, __fail=0, __sec='';
function section(n){ __sec=n; print('\n== '+n); }
function check(name, cond){ if(cond){__pass++;} else {__fail++; print('  FAIL: '+name);} }
function fresh(){ localStorage.clear(); data={exercises:DEFAULTS.slice(),sets:[],plans:defaultPlans(),body:[]}; migrate(); ui.draft=null; ui.origin='home'; ui.prefilled={}; }

section('harness');
check('app loaded: DEFAULTS exists', Array.isArray(DEFAULTS) && DEFAULTS.length>20);
check('render does not throw', (function(){ try{ render(); return true; }catch(e){ print(String(e)); return false; } })());

section('catalogue + migration');
fresh();
check('normName collapses', normName('  Rücken   Seil pull ')==='rücken seil pull');
check('new default present on fresh install', !!ex('schraeg-kh') && ex('schraeg-kh').group==='Brust');
check('kettlebell default is time mode', ex('kettlebell').mode==='time');
check('schedule initialised', data.schedule && data.schedule.mode===null && Array.isArray(data.schedule.planIds));
check('migration flag set', data.migrations.rotation2609===true);
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
localStorage.clear();
data={exercises:DEFAULTS.filter(function(e){return e.id!=='schraeg-kh';}).concat([{id:'ex-1',name:'Schrägbank Kurzhantel',group:'Brust',bw:false,mode:'reps'}]),sets:[],plans:defaultPlans(),body:[]};
migrate();
check('seed uses existing ids', plan('plan-gk-a').exIds.indexOf('ex-1')>=0 && plan('plan-gk-a').exIds.indexOf('schraeg-kh')<0);
var pc=data.plans.length; migrate(); check('seed idempotent', data.plans.length===pc);

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
check('fmtTarget zero weight reads Körpergewicht', fmtTarget({sets:3,repMin:10,repMax:15,weight:0,up:false,first:false},{id:'x',name:'Hang raise',group:'Bauch',bw:false,mode:'reps'})==='3 × 10–15 · Körpergewicht');
check('fmtTarget time', fmtTarget({sets:3,seconds:75,weight:null,first:false},ex('plank'))==='3 × 1:15');

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

section('plans screen');
fresh(); ui.view='plans';
var h=viewPlans();
check('rotation control rendered', h.indexOf('data-a="rotmode" data-v="3"')>=0 && h.indexOf('data-v="off"')>=0);
check('off: no due tag', h.indexOf('als Nächstes')<0);
data.schedule={mode:'3',planIds:ROTATION['3'].slice()}; h=viewPlans();
check('due tag on first plan', h.indexOf('als Nächstes')>=0 && h.indexOf('Ganzkörper A')<h.indexOf('als Nächstes'));
check('custom plans listed under Weitere', h.indexOf('WEITERE PLÄNE')>=0 && h.indexOf('Push')>h.indexOf('WEITERE PLÄNE'));
ui.activePlanId='plan-gk-a'; data.sets=[mk('beinpresse','2026-09-20',60,15,1),mk('beinpresse','2026-09-20',60,15,2),mk('beinpresse','2026-09-20',60,15,3)];
var hp=viewPlan();
check('plan row shows target with up arrow', hp.indexOf('3 × 10–15 · <b>65</b> kg')>=0 && hp.indexOf('↑')>=0);
check('plan row first time', hp.indexOf('erstes Mal')>=0);

section('home card');
fresh(); ui.view='home';
check('home card empty history', (function(){data.schedule={mode:'3',planIds:ROTATION['3'].slice()};var h=viewHome();return h.indexOf('HEUTE DRAN')>=0&&h.indexOf('Ganzkörper A')>=0&&h.indexOf('erstes Mal')>=0;})());
check('home card lists three exercises', (viewHome().match(/dayEx/g)||[]).length===3);
data.schedule=emptySchedule(); check('no card when off', viewHome().indexOf('HEUTE DRAN')<0);
data.schedule={mode:'3',planIds:ROTATION['3'].slice()};
data.sets=plan('plan-gk-a').exIds.map(function(id,i){return {id:'d'+i,exerciseId:id,date:dayKey(new Date()),ts:i,weight:10,mode:'reps',reps:10};});
check('home card done state', viewHome().indexOf('ERLEDIGT')>=0 && viewHome().indexOf('Ganzkörper B')>=0);

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

section('export / import');
fresh(); data.schedule={mode:'4',planIds:ROTATION['4'].slice()};
var payload=exportPayload();
check('payload v3 with schedule', payload.version===3 && payload.schedule.mode==='4' && payload.migrations.rotation2609===true);
var v2={app:'gym-log',version:2,exercises:DEFAULTS.slice(0,5),sets:[],plans:defaultPlans(),body:[]};
applyImport(v2);
check('v2 import gets empty schedule and seeds', data.schedule.mode===null && !!plan('plan-gk-a') && data.migrations.rotation2609===true);
applyImport(payload);
check('v3 import keeps schedule', data.schedule.mode==='4' && data.plans.filter(function(p){return p.id==='plan-un-1';}).length===1);

section('review fixes');
// 1. renamed built-in must not get a duplicate id
localStorage.clear(); data={exercises:DEFAULTS.map(function(e){return Object.assign({},e);}),sets:[],plans:defaultPlans(),body:[]};
data.exercises.find(function(e){return e.id==='bank';}).name='Bench Press'; migrate();
check('renamed built-in: no duplicate id', data.exercises.filter(function(e){return e.id==='bank';}).length===1 && !data.exercises.some(function(e){return e.name==='Bankdrücken';}));
// 2. deleting a rotation plan keeps the pointer sane
fresh(); data.schedule={mode:'3',planIds:ROTATION['3'].slice()};
data.plans=data.plans.filter(function(p){return p.id!=='plan-gk-b';}); 
data.sets=[mk('beinpresse','2026-09-20',60,12,1),mk('latzug','2026-09-20',50,12,1)];
check('missing plan skipped in rotation', nextPlanId('2026-09-29')==='plan-gk-c' && todayPlanState('2026-09-29').planId==='plan-gk-c');
check('home card survives a deleted plan', (function(){ui.view='home';return viewHome().indexOf('HEUTE DRAN')>=0;})());
// 3. no prefill when a set exists today
fresh(); data.schedule={mode:'3',planIds:ROTATION['3'].slice()}; var T3=dayKey(new Date());
data.sets=[mk('beinpresse','2026-09-20',60,15,1),mk('beinpresse','2026-09-20',60,15,2),mk('beinpresse','2026-09-20',60,15,3),mk('beinpresse',T3,62.5,10,1)];
ui.origin='plan'; ui.activePlanId='plan-gk-a'; ui.draft=null; ui.prefilled={}; ensureDraft(ex('beinpresse')); applyTargetPrefill(ex('beinpresse'),T3);
check('no prefill after reload when logged today', ui.draft.weight===62.5);
// 4. duplicates with sets on both sides stay; archived ids leave plan exIds
localStorage.clear();
data={exercises:DEFAULTS.map(function(e){return Object.assign({},e);}).concat([{id:'ex-b',name:'Butterfly',group:'Brust',bw:false,mode:'reps'},{id:'ex-c',name:'Butterfly',group:'Brust',bw:false,mode:'reps'}]),
  sets:[mk('butterfly','2026-09-01',35,12,1),mk('ex-b','2026-09-02',30,12,1)],plans:[{id:'plan-x',name:'X',exIds:['ex-c','bank']}],body:[]};
migrate();
check('both with sets kept', !ex('butterfly').archived && !ex('ex-b').archived);
check('empty duplicate archived', ex('ex-c').archived===true);
check('archived duplicate removed from plan exIds', plan('plan-x').exIds.indexOf('ex-c')<0 && plan('plan-x').exIds.indexOf('bank')>=0);

print('\n'+__pass+' passed, '+__fail+' failed');
if(__fail) throw new Error(__fail+' checks failed');
