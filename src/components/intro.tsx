import { getMessages } from "@/lib/i18n";
import { INTRO_KEY } from "@/lib/theme";
import { burstPath } from "./burst";

/** The two couches as SVG markup on a 128 × 50 grid (the same drawing as <CouchShape>). */
function couchesMarkup() {
  const couch = (fill: string, x: number) =>
    `<g transform="translate(${x} 0)" stroke="var(--outline)" stroke-width="3"><rect x="9" y="8" width="46" height="24" rx="9" fill="${fill}"/><rect x="3" y="20" width="14" height="22" rx="6" fill="${fill}"/><rect x="47" y="20" width="14" height="22" rx="6" fill="${fill}"/><rect x="13" y="28" width="38" height="14" rx="5" fill="${fill}"/><path d="M10 42v5M54 42v5" stroke-linecap="round"/><ellipse cx="26" cy="19" rx="2.6" ry="3.4" fill="var(--outline)" stroke="none"/><ellipse cx="38" cy="19" rx="2.6" ry="3.4" fill="var(--outline)" stroke="none"/><path d="M28 25q4 3.5 8 0" fill="none" stroke-width="2.4" stroke-linecap="round"/></g>`;
  return couch("var(--me)", 0) + couch("var(--partner)", 64);
}

/**
 * The opening animation, once per app launch: a starburst spins in with the app's name, the name swaps
 * for the two couches, then the cover spins open while the burst whirls up into the header logo. About
 * 1.7 s; a tap or any key skips it. LOOK_SCRIPT asks for it (data-intro) before the first paint, so the
 * cover is up from the start; this plain script runs as soon as the header exists, before React, and
 * measures the logo so it lands there at every screen size. Reduced motion never asks for it.
 */
const SCRIPT = `(function(){
var d=document.documentElement,el=document.getElementById("intro"),anims=[],started=false,ended=false;
if(!el||!d.hasAttribute("data-intro"))return;
try{sessionStorage.setItem(${JSON.stringify(INTRO_KEY)},"1")}catch(e){}
function end(){if(ended)return;ended=true;d.removeAttribute("data-intro");el.innerHTML="";removeEventListener("keydown",skip,true);el.removeEventListener("pointerdown",skip)}
function skip(){anims.forEach(function(a){a.cancel()});end()}
addEventListener("keydown",skip,true);el.addEventListener("pointerdown",skip);
var B=${burstPath.toString()};
function start(){if(started||ended)return;started=true;try{
var w=innerWidth,h=innerHeight,cx=w/2,cy=h/2,r=Math.min(w,h)*.42,cw=r*1.15,k=cw/128,burst=B(14,r,r*.72,cx,cy);
el.innerHTML='<svg viewBox="0 0 '+w+' '+h+'"><defs><mask id="intro-mask"><rect width="'+w+'" height="'+h+'" fill="#fff"/><path id="intro-hole" d="'+burst+'" fill="#000"/></mask></defs><rect width="'+w+'" height="'+h+'" fill="var(--accent)" mask="url(#intro-mask)"/><g id="intro-fly"><path id="intro-spin" d="'+burst+'" fill="var(--stamp)" stroke="var(--outline)" stroke-width="8" stroke-linejoin="round"/><g id="intro-couches"><g transform="translate('+(cx-cw/2)+' '+(cy-25*k)+') scale('+k+')">'+${JSON.stringify(couchesMarkup())}+'</g></g></g></svg><div class="intro-word" id="intro-word">'+${JSON.stringify(getMessages("en").common.appName)}+'!</div>';
d.setAttribute("data-intro","playing");
var logo=document.querySelector("[data-logo-couches]"),b=logo&&logo.getBoundingClientRect(),tx=40-cx,ty=36-cy,s=.12;
if(b&&b.width){tx=b.left+b.width/2-cx;ty=b.top+b.height/2-cy;s=b.width/cw}
var T=1700;
function run(id,kf,origin){var n=document.getElementById(id);if(origin){n.style.transformOrigin=origin}else{n.style.transformBox="fill-box";n.style.transformOrigin="center"}anims.push(n.animate(kf,{duration:T,fill:"forwards"}))}
run("intro-spin",[{transform:"scale(0) rotate(-200deg)",easing:"cubic-bezier(.2,.8,.3,1)"},{transform:"scale(1.12) rotate(14deg)",offset:.26},{transform:"scale(.96) rotate(-4deg)",offset:.32},{transform:"scale(1) rotate(0deg)",offset:.4},{transform:"scale(1) rotate(0deg)",offset:.46,easing:"cubic-bezier(.6,0,.3,1)"},{transform:"scale(1) rotate(540deg)",opacity:1,offset:.9},{transform:"scale(1) rotate(560deg)",opacity:0}]);
run("intro-fly",[{transform:"translate(0px,0px) scale(1)"},{transform:"translate(0px,0px) scale(1)",offset:.46,easing:"cubic-bezier(.65,0,.25,1)"},{transform:"translate("+tx+"px,"+ty+"px) scale("+s+")",offset:.9},{transform:"translate("+tx+"px,"+ty+"px) scale("+s+")"}],cx+"px "+cy+"px");
run("intro-couches",[{transform:"scale(0) rotate(-20deg)"},{transform:"scale(0) rotate(-20deg)",offset:.44},{transform:"scale(1.2) rotate(8deg)",offset:.54},{transform:"scale(1) rotate(0deg)",offset:.6},{transform:"scale(1) rotate(0deg)"}]);
run("intro-hole",[{transform:"scale(0) rotate(0deg)"},{transform:"scale(0) rotate(0deg)",offset:.5,easing:"cubic-bezier(.7,0,.2,1)"},{transform:"scale(10) rotate(-260deg)",offset:.92},{transform:"scale(10) rotate(-260deg)"}]);
anims.push(document.getElementById("intro-word").animate([{opacity:0,scale:.2,rotate:"-12deg"},{opacity:0,scale:.2,rotate:"-12deg",offset:.12},{opacity:1,scale:1.15,rotate:"4deg",offset:.27},{scale:.95,rotate:"-2deg",offset:.34},{opacity:1,scale:1,rotate:"-3deg",offset:.4},{opacity:1,scale:1,rotate:"-3deg",offset:.44},{opacity:0,scale:1.5,rotate:"-8deg",offset:.5},{opacity:0,scale:1.5,rotate:"-8deg"}],{duration:T,fill:"forwards"}));
Promise.all(anims.map(function(a){return a.finished})).then(end,end);
}catch(e){end()}}
var face=getComputedStyle(d).getPropertyValue("--font-skin-display");
if(face&&document.fonts){document.fonts.load("400 48px "+face).then(start,start)}
setTimeout(start,face?450:0);
})()`;

export function Intro() {
  return (
    <>
      {/* Filled by the script and emptied again when it ends, so React leaves its contents alone. */}
      <div id="intro" className="intro" aria-hidden suppressHydrationWarning dangerouslySetInnerHTML={{ __html: "" }} />
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </>
  );
}
