(function(){
var CFG={"palettes":{"light":{"surface":"#f4efe4","text":"#42392e","line":"#8a7f6d","border":"#7a6c52","bg":"#fffdf8"},"dark":{"surface":"#262b34","text":"#f2f3f5","line":"#a8adb8","border":"#9aa4b8","bg":"#1f232b"}}};
var pres=Array.prototype.slice.call(document.querySelectorAll('pre.mermaid')).filter(function(p){if(p.hasAttribute('data-claude-mermaid-claimed'))return false;p.setAttribute('data-claude-mermaid-claimed','1');return true;});
if(!pres.length||typeof mermaid==='undefined')return;
var mq=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)'):null;
var root=document.documentElement;
var items=pres.map(function(pre){
var mount=document.createElement('div');mount.className='mermaid-diagram';
return {pre:pre,mount:mount,src:pre.textContent||''};
});
var seq=0;
var renderGen=0;
var lastKey='';
function pageBg(fallback){
var els=[document.body,document.documentElement];
for(var i=0;i<els.length;i++){
var c=els[i]&&getComputedStyle(els[i]).backgroundColor;
if(c&&c!=='transparent'&&c!=='rgba(0, 0, 0, 0)')return c;
}
return fallback;
}
function render(){
var theme=root.getAttribute('data-theme');
var dark=theme==='dark'||(!!(mq&&mq.matches)&&theme!=='light');
var pal=dark?CFG.palettes.dark:CFG.palettes.light;
var bg=pageBg(pal.bg);
var key=(dark?'d':'l')+'|'+bg;
if(key===lastKey)return;
lastKey=key;
var gen=++renderGen;
var font=getComputedStyle(document.body).fontFamily||'sans-serif';
var nat={useMaxWidth:false};
mermaid.initialize({
startOnLoad:false,securityLevel:'strict',theme:'base',
flowchart:nat,sequence:nat,er:nat,state:nat,class:nat,pie:nat,
gantt:nat,journey:nat,timeline:nat,gitGraph:nat,mindmap:nat,xyChart:nat,
quadrantChart:nat,sankey:nat,c4:nat,requirement:nat,block:nat,
packet:nat,kanban:nat,architecture:nat,radar:nat,
themeVariables:{background:bg,mainBkg:pal.surface,primaryColor:pal.surface,
primaryTextColor:pal.text,lineColor:pal.line,primaryBorderColor:pal.border,
nodeBorder:pal.border,clusterBorder:pal.border,edgeLabelBackground:bg,
clusterBkg:'rgba(127,127,127,0.07)',titleColor:pal.text,
darkMode:dark,rowOdd:bg,rowEven:'rgba(127,127,127,0.07)',
attributeBackgroundColorOdd:bg,attributeBackgroundColorEven:'rgba(127,127,127,0.07)',
fontSize:'16px',fontFamily:font},
themeCSS:'.node rect, .node circle, .node polygon, .node path, .cluster rect { stroke-width: 2px; }'
});
items.forEach(function(it){
var id='claude-mermaid-'+seq++;
mermaid.render(id,it.src).then(function(r){
if(gen!==renderGen)return;
var prev=it.pre.previousElementSibling;
if(prev&&prev.className==='mermaid-diagram'&&prev!==it.mount)return;
it.mount.innerHTML=r.svg;
if(!it.mount.parentNode)it.pre.parentNode.insertBefore(it.mount,it.pre);
it.pre.style.display='none';
},function(){
var scratch=document.getElementById(id);
if(scratch)scratch.parentNode.removeChild(scratch);
scratch=document.getElementById('d'+id);
if(scratch)scratch.parentNode.removeChild(scratch);
if(gen!==renderGen)return;
if(it.mount.parentNode)it.mount.parentNode.removeChild(it.mount);
it.pre.style.display='';
});
});
}
render();
if(mq&&mq.addEventListener)mq.addEventListener('change',render);
if(typeof MutationObserver!=='undefined')new MutationObserver(render).observe(root,{attributes:true,attributeFilter:['data-theme']});
})();