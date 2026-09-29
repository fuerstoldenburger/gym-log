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
