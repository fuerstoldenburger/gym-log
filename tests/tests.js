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

print('\n'+__pass+' passed, '+__fail+' failed');
if(__fail) throw new Error(__fail+' checks failed');
