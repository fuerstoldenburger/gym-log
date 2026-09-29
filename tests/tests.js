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

print('\n'+__pass+' passed, '+__fail+' failed');
if(__fail) throw new Error(__fail+' checks failed');
