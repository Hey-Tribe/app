(function(){
"use strict";
var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function $(s, r){ return (r||document).querySelector(s); }
function $$(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }

/* family faces */
var PEOPLE = {
  alex:{name:"Alex",c:"#5E8C7A",bg:"#D7E5DC",skin:"#E2B48C",hair:"#3B2A22",s:"short"},
  maria:{name:"Maria",c:"#6B8BA4",bg:"#D9E3EB",skin:"#C98E66",hair:"#2A1E1A",s:"long"},
  leo:{name:"Leo",c:"#B08A84",bg:"#EFE0DC",skin:"#D9A27A",hair:"#6E4A30",s:"kid"},
  sofia:{name:"Sofia",c:"#8A8F6B",bg:"#E6E8D7",skin:"#F1C9A5",hair:"#8A6142",s:"baby"}
};
function face(k, size){
  var p = PEOPLE[k]; if(!p) return "";
  var small = p.s === "kid" || p.s === "baby", hr = small ? 9.5 : 10, hy = small ? 22 : 21;
  var hair = {
    short:'<path d="M9.8 20.5 Q9.6 9.5 20 9.6 Q30.4 9.5 30.2 20.5 Q28.5 14.2 21 14.6 Q15 13.8 12.5 17 Q11 18.4 9.8 20.5Z" fill="'+p.hair+'"/>',
    long:'<circle cx="20" cy="8.6" r="4.6" fill="'+p.hair+'"/><path d="M9.6 25 Q8.6 10.6 20 10.8 Q31.4 10.6 30.4 25 Q29.4 15.8 20 15.2 Q12.6 15.4 9.6 25Z" fill="'+p.hair+'"/>',
    kid:'<path d="M10.6 20.5 Q10.2 12 20 11.8 Q29.8 12 29.4 20.5 L27 16.2 L24.4 18 L22 14.8 L19 17.6 L16.2 15 L13.6 17.8Z" fill="'+p.hair+'"/>',
    baby:'<path d="M19 13.2 q1.4 -4.4 4.6 -2.6 q-2.6 0.2 -2.4 3" fill="none" stroke="'+p.hair+'" stroke-width="1.6" stroke-linecap="round"/>'
  }[p.s];
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 40 40" role="img" aria-label="'+p.name+'" style="display:block;border-radius:50%"><circle cx="20" cy="20" r="20" fill="'+p.bg+'"/><path d="M7 41 Q8 31 20 31 Q32 31 33 41Z" fill="'+p.c+'"/><circle cx="20" cy="'+hy+'" r="'+hr+'" fill="'+p.skin+'"/>'+hair+'<circle cx="14.6" cy="'+(hy+3.6)+'" r="1.6" fill="#E59A8A" opacity=".45"/><circle cx="25.4" cy="'+(hy+3.6)+'" r="1.6" fill="#E59A8A" opacity=".45"/><circle cx="16.6" cy="'+(hy+.6)+'" r="1.15" fill="#2F3B45"/><circle cx="23.4" cy="'+(hy+.6)+'" r="1.15" fill="#2F3B45"/><path d="M17.6 '+(hy+4.2)+' Q20 '+(hy+6.2)+' 22.4 '+(hy+4.2)+'" fill="none" stroke="#2F3B45" stroke-width="1.1" stroke-linecap="round"/></svg>';
}
$$("[data-face]").forEach(function(el){ el.innerHTML = face(el.getAttribute("data-face"), +el.getAttribute("data-size") || 56); });

/* header */
var head = $(".site-head");
function onScroll(){ if(head) head.classList.toggle("scrolled", window.scrollY > 8); }
window.addEventListener("scroll", onScroll, {passive:true}); onScroll();
var mb = $(".menu-btn"), nav = $(".nav");
if(mb && nav){ mb.addEventListener("click", function(){ var o = nav.classList.toggle("open"); mb.setAttribute("aria-expanded", o ? "true" : "false"); }); }

/* rotating headline */
var rot = $(".rotator .w");
if(rot && !reduce){
  var words = (rot.getAttribute("data-words") || "").split("|"), i = 0;
  setInterval(function(){ i = (i + 1) % words.length; rot.textContent = words[i]; rot.style.animation = "none"; void rot.offsetWidth; rot.style.animation = ""; }, 2600);
}

/* Hey Tribe demo */
var DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
function parse(text){
  var out = [], marks = [], rest = text;
  function mark(phrase, cls){ if(!phrase) return; var i = text.toLowerCase().indexOf(phrase.toLowerCase()); if(i < 0) return; for(var k=0;k<marks.length;k++){ if(i < marks[k].e && i + phrase.length > marks[k].s) return; } marks.push({s:i, e:i+phrase.length, c:cls}); }
  var lm = rest.match(/\b(?:add|put|get|buy)\s+(.+?)\s+(?:to|on)\s+(?:the\s+)?(?:\w+\s+)?list\b/i);
  if(lm){ lm[1].split(/,|\band\b|&/i).map(function(s){ return s.trim().replace(/^(some|a|an|more)\s+/i,""); }).filter(Boolean).forEach(function(x){ out.push({type:"item", text:x}); mark(x, "i"); }); rest = rest.replace(lm[0], " "); }
  var who = null, driver = null;
  Object.keys(PEOPLE).forEach(function(k){ var n = PEOPLE[k].name, re = new RegExp("\\b"+n+"\\b","i"); if(re.test(text)){ mark(n,"p"); if(new RegExp("\\b"+n+"\\s+(drives|is driving|will drive|can drive|takes)","i").test(text)) driver = k; else if(!who) who = k; } });
  var day = null, dm = rest.match(/\b(?:(next|this)\s+)?(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\b|\btomorrow\b|\btonight\b|\btoday\b/i);
  if(dm){ day = dm[0]; mark(dm[0], "t"); }
  var tm = rest.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b|\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i), time = null;
  if(tm){ var h = +(tm[1]||tm[4]), mm = tm[2]||tm[5]||"00", ap = (tm[3]||tm[6]||"").toLowerCase(); if(!ap) ap = (h >= 7 && h <= 11) ? "am" : "pm"; time = h + (mm !== "00" ? ":"+mm : "") + ap; mark(tm[0].replace(/^at\s+/i,""), "t"); }
  var dr = text.match(/\b(\w+)\s+(drives|is driving|will drive|can drive)\b/i); if(dr) mark(dr[0], "t");
  rest = rest.replace(/^[\s,.;]+|[\s,.;]+$/g, "").replace(/^(oh,?\s*)?(and\s+)?/i, "");
  if(rest && (day || time)){
    var title = rest.split(/\s+for\s+|\s+(?:at|on)\s+|,/i)[0];
    if(dm) title = title.replace(dm[0], "");
    title = title.replace(/\b(next|this)\s*$/i, "").trim() || "Plan";
    title = title.charAt(0).toUpperCase() + title.slice(1);
    var when = (day ? day.replace(/^(next|this)\s+/i,"") : "Today"); when = when.charAt(0).toUpperCase() + when.slice(1);
    out.unshift({type:"event", title:title, who:who, driver:driver, when: when + (time ? " at " + time : "")});
  } else if(rest && !lm){ out.push({type:"note", text: rest.charAt(0).toUpperCase() + rest.slice(1)}); }
  marks.sort(function(a,b){ return a.s - b.s; });
  var html = "", p = 0; marks.forEach(function(m){ html += esc(text.slice(p, m.s)) + '<span class="mk '+m.c+'">' + esc(text.slice(m.s, m.e)) + '</span>'; p = m.e; });
  html += esc(text.slice(p));
  return {actions: out, html: html};
}
var ICON = {
  cal:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  cart:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2l2.5 11h11L21 8H6.5"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/></svg>',
  note:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3h14v12l-6 6H5z"/><path d="M13 21v-6h6"/></svg>'
};
function renderDemo(text){
  var q = $("#demo-quote"), c = $("#demo-cards"); if(!q || !c) return;
  var r = parse(text);
  q.innerHTML = "“" + r.html + "”";
  if(!r.actions.length){ c.innerHTML = '<p style="margin:0;color:rgba(255,255,255,.75)">Try naming a day and a time, or “add … to the list”.</p>'; return; }
  c.innerHTML = r.actions.map(function(a, n){
    var delay = 'style="animation-delay:'+(n*90)+'ms"';
    if(a.type === "event") return '<div class="rcard" '+delay+'><span class="ic" style="background:#fff;padding:0;overflow:hidden">'+(a.who ? face(a.who, 40) : '<span style="color:#3E5A55">'+ICON.cal+'</span>')+'</span><span><b>'+esc(a.title)+'</b><small>'+esc(a.when)+(a.who ? " · " + PEOPLE[a.who].name : " · Everyone")+(a.driver ? " · " + PEOPLE[a.driver].name + " drives" : "")+'</small></span></div>';
    if(a.type === "item") return '<div class="rcard" '+delay+'><span class="ic" style="background:#5E8C7A;color:#fff">'+ICON.cart+'</span><span><b>'+esc(a.text)+'</b><small>Added to Groceries</small></span></div>';
    return '<div class="rcard" '+delay+'><span class="ic" style="background:#F3E6E2;color:#8E6A64">'+ICON.note+'</span><span><b>'+esc(a.text)+'</b><small>Stuck on the fridge</small></span></div>';
  }).join("");
}
var df = $("#demo-form");
if(df){
  var ta = $("#demo-text");
  df.addEventListener("submit", function(e){ e.preventDefault(); if(ta.value.trim()) renderDemo(ta.value.trim()); });
  $$(".demo .chip").forEach(function(b){ b.addEventListener("click", function(){ ta.value = b.getAttribute("data-ex"); renderDemo(ta.value); }); });
  renderDemo(ta.value.trim());
}

/* chore toy */
var toy = $("#toy");
if(toy){
  var GOAL = +toy.getAttribute("data-goal") || 15, rots = [-14,9,-6,12,-10,5,-12,8];
  function count(){ return $$(".stamp.on", toy).length; }
  function update(celebrate){
    var n = count(), pct = Math.min(100, Math.round(n / GOAL * 100));
    $("#toy-meter").style.width = pct + "%";
    $("#toy-count").textContent = n;
    var msg = $("#toy-msg");
    if(n >= GOAL){ msg.textContent = "Movie night unlocked!"; if(celebrate) confetti(); }
    else msg.textContent = (GOAL - n) + (GOAL - n === 1 ? " star to movie night" : " stars to movie night");
  }
  $$(".stamp", toy).forEach(function(s, i){
    s.style.setProperty("--r", rots[i % rots.length] + "deg");
    if(s.classList.contains("on")) s.style.transform = "rotate(" + rots[i % rots.length] + "deg)";
    s.addEventListener("click", function(){
      var was = count() >= GOAL, on = s.classList.toggle("on");
      s.setAttribute("aria-pressed", on ? "true" : "false");
      s.innerHTML = on ? '<svg width="17" height="17" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>' : "";
      s.style.transform = on ? "rotate(" + rots[i % rots.length] + "deg)" : "";
      update(!was && count() >= GOAL);
    });
  });
  update(false);
}
function confetti(){
  if(reduce) return;
  var cv = document.createElement("canvas"); cv.id = "confetti"; document.body.appendChild(cv);
  var ctx = cv.getContext("2d"), W = cv.width = innerWidth, H = cv.height = innerHeight;
  var cols = ["#5E8C7A","#B08A84","#6B8BA4","#8A8F6B","#C9A66B","#D7E5DC"], bits = [];
  for(var k=0;k<140;k++) bits.push({x:W/2 + (Math.random()-.5)*200, y:H*.55, vx:(Math.random()-.5)*14, vy:-Math.random()*15-6, r:Math.random()*6+4, c:cols[k%cols.length], a:Math.random()*6, va:(Math.random()-.5)*.3});
  var t = 0;
  (function tick(){
    ctx.clearRect(0,0,W,H); t++;
    bits.forEach(function(b){ b.vy += .45; b.vx *= .99; b.x += b.vx; b.y += b.vy; b.a += b.va; ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(b.a); ctx.fillStyle = b.c; ctx.fillRect(-b.r/2,-b.r/4,b.r,b.r/2); ctx.restore(); });
    if(t < 150) requestAnimationFrame(tick); else cv.remove();
  })();
}

/* forms: waitlist and contact go to /api/forms, which saves them in Supabase */
var PREVIEW_MSG = "Couldn't send that. Check your connection and try again.";
$$("form[data-netlify]").forEach(function(form){
  var msg = $(".form-msg", form);
  if(!msg){ msg = document.createElement("p"); msg.className = "form-msg"; form.appendChild(msg); }
  if(!msg.hasAttribute("aria-live")) msg.setAttribute("aria-live", "polite");
  var btn = $('button[type="submit"]', form) || $("button", form);
  function say(text, bad){ msg.textContent = text; msg.classList.toggle("bad", !!bad); }
  form.addEventListener("submit", function(e){
    e.preventDefault();
    var em = $('input[type="email"]', form);
    if(em && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em.value.trim())){ say("That email doesn't look quite right. Check it and try again.", true); em.focus(); return; }
    var empty = $$("[required]", form).filter(function(f){ return !String(f.value || "").trim(); })[0];
    if(empty){ say("Almost there. Please fill in every field.", true); empty.focus(); return; }
    var done = function(){ if(btn) btn.disabled = false; };
    var fail = function(){ say(PREVIEW_MSG, true); done(); };
    if(btn) btn.disabled = true;
    say("Sending...");
    try{
      fetch("/api/forms", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(Object.fromEntries(new FormData(form).entries()))})
        .then(function(r){
          if(!r.ok) return fail();
          say(form.getAttribute("data-success") || "Thanks, we got it.");
          form.reset(); done();
        }, fail);
    }catch(err){ fail(); }
  });
});
$$("[data-year]").forEach(function(el){ el.textContent = new Date().getFullYear(); });
})();

/* mega menu */
(function(){
  var items = document.querySelectorAll(".mega-item");
  var hoverable = window.matchMedia ? window.matchMedia("(hover: hover) and (min-width: 861px)") : { matches:false };
  Array.prototype.forEach.call(items, function(it){
    var b = it.querySelector(".mega-btn"), t;
    function set(open){ it.classList.toggle("open", open); b.setAttribute("aria-expanded", open ? "true" : "false"); }
    b.addEventListener("click", function(e){ e.stopPropagation(); if(hoverable.matches){ clearTimeout(t); set(true); } else set(!it.classList.contains("open")); });
    it.addEventListener("mouseenter", function(){ if(hoverable.matches){ clearTimeout(t); set(true); } });
    it.addEventListener("mouseleave", function(){ if(hoverable.matches){ t = setTimeout(function(){ set(false); }, 220); } });
    document.addEventListener("click", function(e){ if(!it.contains(e.target)) set(false); });
    document.addEventListener("keydown", function(e){ if(e.key === "Escape" && it.classList.contains("open")){ set(false); b.focus(); } });
  });
})();

/* homepage features showcase: tabs by part of family life, phone swaps to the picked feature */
(function(){
  var root = document.querySelector("[data-fx]"); if(!root) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var phone = root.querySelector(".fx-phone"), img = phone.querySelector("img"), blob = root.querySelector(".fx-blob");
  var tabs = [].slice.call(root.querySelectorAll(".fx-tab")), lists = [].slice.call(root.querySelectorAll(".fx-list"));
  var timer = null, touched = false, cache = {};
  function preload(src){ if(cache[src]) return; var i = new Image(); i.src = src; cache[src] = i; }
  [].slice.call(root.querySelectorAll(".fx-item")).forEach(function(b){ preload(b.getAttribute("data-shot")); });
  function pick(btn){
    var list = btn.closest(".fx-list");
    [].slice.call(list.querySelectorAll(".fx-item")).forEach(function(b){ var on = b === btn; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    var src = btn.getAttribute("data-shot"); blob.style.background = btn.getAttribute("data-tone");
    if(img.getAttribute("src") === src) return;
    if(reduce){ img.src = src; return; }
    phone.classList.add("swap");
    setTimeout(function(){ img.src = src; setTimeout(function(){ phone.classList.remove("swap"); }, 40); }, 200);
  }
  function group(i){
    tabs.forEach(function(t, k){ var on = k === i; t.classList.toggle("on", on); t.setAttribute("aria-pressed", on ? "true" : "false"); });
    lists.forEach(function(l, k){ l.classList.toggle("on", k === i); });
    var cur = lists[i].querySelector(".fx-item.on") || lists[i].querySelector(".fx-item"); pick(cur);
  }
  function stop(){ touched = true; if(timer){ clearInterval(timer); timer = null; } }
  tabs.forEach(function(t, i){ t.addEventListener("click", function(){ stop(); group(i); }); });
  root.addEventListener("click", function(e){ var b = e.target.closest(".fx-item"); if(b){ stop(); pick(b); } });
  root.addEventListener("mouseover", function(e){ var b = e.target.closest(".fx-item"); if(b && window.matchMedia("(hover: hover)").matches){ stop(); pick(b); } });
  // gentle tour until someone interacts: walk through the open group, then the next
  if(!reduce && "IntersectionObserver" in window){
    var io = new IntersectionObserver(function(es){
      es.forEach(function(en){
        if(en.isIntersecting && !touched && !timer){
          timer = setInterval(function(){
            var gi = tabs.findIndex(function(t){ return t.classList.contains("on"); });
            var items = [].slice.call(lists[gi].querySelectorAll(".fx-item"));
            var ci = items.findIndex(function(b){ return b.classList.contains("on"); });
            if(ci < items.length - 1) pick(items[ci + 1]);
            else { var ng = (gi + 1) % tabs.length; var first = lists[ng].querySelector(".fx-item"); lists[ng].querySelectorAll(".fx-item").forEach(function(b){ b.classList.remove("on"); }); first.classList.add("on"); group(ng); }
          }, 4200);
        } else if(!en.isIntersecting && timer){ clearInterval(timer); timer = null; }
      });
    }, { threshold: .35 });
    io.observe(root);
  }
})();
