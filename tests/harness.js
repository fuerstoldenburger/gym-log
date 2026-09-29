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
