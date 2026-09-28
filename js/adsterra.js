// === Adsterra Ad Loader ===
// Owner: paste your Adsterra banner script into the adConfig variable below.
// Example:
//   var adConfig = '<!-- Adsterra code here -->';
// If adConfig is not set, the placeholder text is shown instead.
// To enable ads: set adConfig to your Adsterra script and uncomment the load line.

(function(){
 var ad1 = document.getElementById('ad1');
 if(!ad1) return;

 // Paste your Adsterra banner code here as a string, OR leave as null to see placeholder:
 var adConfig = null; // e.g. '<script type="text/javascript" src="..."></script>'

 if(adConfig){
  ad1.innerHTML = adConfig;
 } else {
  ad1.innerHTML = '<div class="ad-placeholder">Adsterra banner code goes here — <a href="https://adsterra.com" target="_blank">Sign up</a> to get your code</div>';
 }
})();
