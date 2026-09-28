// === categories array — single source of truth for sidebar ===
// Add new categories by adding another ["Label","slug"] pair here.
var categories=[
 ["Videos","videos"],["Books","books"],["Question and Sheets","questions"],
 ["IQ Games","games"],["Study Music","music"],["Tools","tools"],
 ["General Math","math"],["Physics","physics"],["Chemistry","chemistry"],
 ["Biology","biology"],["Higher Math","highermath"]
];

// === Generate sidebar navigation ===
function generateSidebar(){
 var side=document.getElementById('side');
 if(!side) return;
 var prefix=window.location.pathname.indexOf("/games/")>-1?"../":"";
 var html='<a href="' + prefix + 'index.html"><b>Home</b></a>';
 for(var i=0;i<categories.length;i++){
 var c=categories[i];
 html+='<a href="' + prefix + 'category.html?c='+c[1]+'">'+c[0]+'</a>';
 }
 side.innerHTML=html;

 // Attach mobile menu events
 var menuBtn=document.getElementById('menuBtn');
 var shade=document.getElementById('shade');
 if(menuBtn && shade){
 function toggle(){side.classList.toggle('open');shade.classList.toggle('show');}
 menuBtn.onclick=toggle;
 shade.onclick=toggle;
 }
}

// === Theme toggle ===
function initThemeToggle(){
 var tb=document.getElementById('themeBtn');
 if(!tb) return;
 function setTheme(t){
 document.documentElement.setAttribute('data-theme',t);
 localStorage.setItem('theme',t);
 tb.textContent=t==='dark'?'Classic':'Dark';
 }
 setTheme(localStorage.getItem('theme')||'classic');
 tb.onclick=function(){
 setTheme(document.documentElement.getAttribute('data-theme')==='dark'?'classic':'dark');
 };
}

// === Read URL query parameter ===
function qs(key){
 var p=new URLSearchParams(window.location.search);
 return p.get(key);
}

// === Escape HTML to prevent XSS ===
function escapeHTML(str){
 if(!str) return '';
 return String(str)
 .replace(/&/g,'&amp;')
 .replace(/</g,'&lt;')
 .replace(/>/g,'&gt;')
 .replace(/"/g,'&quot;')
 .replace(/'/g,'&#039;');
}

// === Highlight active sidebar link ===
function highlightActiveSidebar(){
 var slug=qs('c');
 if(!slug) return;
 var links=document.querySelectorAll('.side a');
 for(var i=0;i<links.length;i++){
 var href=links[i].getAttribute('href');
 if(href && href.indexOf('c='+slug)>-1){
 links[i].classList.add('active');
 } else {
 links[i].classList.remove('active');
 }
 }
}

// === Initialize page (called from each HTML file) ===
function initPage(){
 generateSidebar();
 initThemeToggle();
 highlightActiveSidebar();
}
