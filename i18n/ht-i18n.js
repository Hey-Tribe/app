/* HeyTribe language switch (English / Español), shared by the website and the app.
   English is written in the HTML. When Spanish is on, text and labels are swapped from a dictionary,
   and a few app formats with numbers or dates are rewritten by exact-pattern rules,
   so words people type themselves are never touched. */
(function(){
  "use strict";
  var KEY = "ht-lang";
  function get(){
    try {
      var q = /[?&]lang=(en|es)\b/.exec(location.search); if(q){ localStorage.setItem(KEY, q[1]); return q[1]; }
      return localStorage.getItem(KEY) === "es" ? "es" : "en";
    } catch(e){ return "en"; }
  }
  var LANG = get();
  var DOW = { Mon:"lun", Tue:"mar", Wed:"mié", Thu:"jue", Fri:"vie", Sat:"sáb", Sun:"dom" };
  var DOWL = { Monday:"Lunes", Tuesday:"Martes", Wednesday:"Miércoles", Thursday:"Jueves", Friday:"Viernes", Saturday:"Sábado", Sunday:"Domingo" };
  var MON = { Jan:"ene", Feb:"feb", Mar:"mar", Apr:"abr", May:"may", Jun:"jun", Jul:"jul", Aug:"ago", Sep:"sep", Oct:"oct", Nov:"nov", Dec:"dic" };
  var MONL = { January:"enero", February:"febrero", March:"marzo", April:"abril", May:"mayo", June:"junio", July:"julio", August:"agosto", September:"septiembre", October:"octubre", November:"noviembre", December:"diciembre" };
  var D = "(Mon|Tue|Wed|Thu|Fri|Sat|Sun)", M = "(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)";
  function date(s){
    return s.replace(new RegExp(D + ", " + M + " (\\d{1,2})(?:, (\\d{4}))?", "g"), function(_, d, m, n, y){ return DOW[d] + " " + n + " " + MON[m] + (y ? " " + y : ""); })
            .replace(new RegExp("\\b" + M + " (\\d{1,2})(?:, (\\d{4}))?\\b", "g"), function(_, m, n, y){ return n + " " + MON[m] + (y ? " " + y : ""); })
            .replace(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/g, function(w){ return DOWL[w]; })
            .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/g, function(w){ return MONL[w]; });
  }
  var DATE = "(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), )?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \\d{1,2}(?:, \\d{4})?";
  var RULES = [
    [new RegExp("^" + DATE + "(?: · (yearly|every week))?$"), function(s){ return date(s).replace(" · yearly", " · cada año").replace(" · every week", " · cada semana"); }],
    [new RegExp("^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:,? " + DATE.replace("(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), )?", "") + "| \\d{1,2})?(?: · every week)?$"), function(s){ return date(s).replace(" · every week", " · cada semana"); }],
    [new RegExp("^(.+) · " + DATE + "$"), function(s){ return date(s); }],
    [new RegExp("^(.*?)(?:until|next) (" + DATE + ")(.*)$"), function(s, a, d, b){ return a + (/until/.test(s) ? "hasta el " : "próximo ") + date(d) + b; }],
    [/^(Due|Renews|Expires|Expired|Next) (.+)$/, function(s, a, b){ return ({Due:"Vence", Renews:"Se renueva", Expires:"Vence", Expired:"Venció", Next:"Próximo"})[a] + " " + date(b); }],
    [/^(Autopay · )?Paid for (\w+) · next (.+)$/, function(s, a, m, n){ return (a ? "Pago automático · " : "") + "Pagado en " + (MONL[m] || m) + " · próximo " + date(n); }],
    [/^Autopay · Due (.+)$/, function(s, d){ return "Pago automático · Vence " + date(d); }],
    [/^Every (\d+) months? · last done (.+)$/, function(s, n, d){ return "Cada " + n + (n === "1" ? " mes" : " meses") + " · última vez " + date(d); }],
    [/^(\d+) plans? today\.(?: Next up:)?$/, function(s, n){ return n + (n === "1" ? " plan hoy." : " planes hoy.") + (/Next up/.test(s) ? " Lo que sigue:" : ""); }],
    [/^Nothing on the calendar today\.$/, function(){ return "Nada en el calendario hoy."; }],
    [/^(Morning|Afternoon|Evening), (.+) —$/, function(s, t, n){ return ({Morning:"Buenos días", Afternoon:"Buenas tardes", Evening:"Buenas noches"})[t] + ", " + n + " —"; }],
    [/^Next up: (.+), (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|today|tomorrow) at (.+)$/, function(s, w, d, t){ return "Lo que sigue: " + w + ", " + (d === "today" ? "hoy" : d === "tomorrow" ? "mañana" : date(d).toLowerCase()) + " a las " + t; }],
    [/^Fed (\d+h )?(\d+)m ago$/, function(s, h, m){ return "Comió hace " + (h || "") + m + "m"; }],
    [/^(\d+h )?(\d+)m ago$/, function(s, h, m){ return "hace " + (h || "") + m + "m"; }],
    [/^Show (\d+) more$/, function(s, n){ return "Ver " + n + " más"; }],
    [/^(\d+) checked off$/, function(s, n){ return n + (n === "1" ? " marcado" : " marcados"); }],
    [/^Packing · (\d+) of (\d+)$/, function(s, a, b){ return "Equipaje · " + a + " de " + b; }],
    [/^(\d+)\/(\d+) packed$/, function(s, a, b){ return a + "/" + b + " empacado"; }],
    [/^(\d+) of (\d+) (done|given|steps)$/, function(s, a, b, w){ return a + " de " + b + " " + ({done:"listos", given:"dadas", steps:"pasos"})[w]; }],
    [/^(.+) (?:was )?due at (.+)$/, function(s, w, t){ return w + (/was due/.test(s) ? " tocaba a las " : " toca a las ") + t; }],
    [/^(.+) \((\$[\d.,]+)\) (?:due in (\d+) days?|due today|due tomorrow|is overdue)$/, function(s, w, a, n){ return w + " (" + a + ") " + (/overdue/.test(s) ? "está vencida" : /today/.test(s) ? "vence hoy" : /tomorrow/.test(s) ? "vence mañana" : "vence en " + n + (n === "1" ? " día" : " días")); }],
    [/^(.+) (?:due in (\d+) days?|due today|due tomorrow|is overdue|is due)$/, function(s, w, n){ return w + " " + (/overdue/.test(s) ? "está atrasado" : /is due/.test(s) ? "toca ya" : /today/.test(s) ? "vence hoy" : /tomorrow/.test(s) ? "vence mañana" : "vence en " + n + (n === "1" ? " día" : " días")); }],
    [/^(.+) expires in (\d+) days?$/, function(s, w, n){ return w + " vence en " + n + (n === "1" ? " día" : " días"); }],
    [/^Sign “(.+)” by (.+)$/, function(s, w, d){ return "Firmar “" + w + "” antes del " + date(d); }],
    [/^Bedtime at (.+)$/, function(s, t){ return "A dormir a las " + t; }],
    [/^Starts (.+) · tap to edit$/, function(s, t){ return "Empieza " + t + " · toca para editar"; }],
    [/^(.+) today: tap when done$/, function(s, w){ return w + " hoy: toca cuando termines"; }],
    [/^(.+) (Mon|Tue|Wed|Thu|Fri|Sat|Sun): (done|missed)$/, function(s, w, d, r){ return w + " " + DOW[d] + ": " + (r === "done" ? "hecho" : "faltó"); }],
    [/^Sleep( ·)? (\d+h \d+m)$/, function(s, dot, t){ return "Sueño" + (dot || "") + " " + t; }],
    [/^(Feeds|Diapers) (\d+)$/, function(s, w, n){ return (w === "Feeds" ? "Tomas " : "Pañales ") + n; }],
    [/^Your tribe is ready\. Invite code ([A-Z0-9]+)$/, function(s, c){ return "Tu tribu está lista. Código de invitación " + c; }],
    [/^Sent! Request #(\d+)\. We'll reply here\.$/, function(s, n){ return "¡Enviado! Solicitud #" + n + ". Te responderemos aquí."; }],
    [/^(\d+) days left$/, function(s, n){ return "Quedan " + n + " días"; }],
    [/^(\d+) days? to go$/, function(s, n){ return n === "1" ? "falta 1 día" : "faltan " + n + " días"; }]
  ];
  function tr(dict, raw){
    var t = raw.replace(/\s+/g, " ").trim(); if(!t) return null;
    if(Object.prototype.hasOwnProperty.call(dict, t)) return dict[t];
    for(var i = 0; i < RULES.length; i++){ var r = RULES[i]; var m = r[0].exec(t); if(m) return r[1].apply(null, m); }
    return null;
  }
  var ATTRS = ["placeholder", "aria-label", "title", "alt", "data-success", "data-name", "data-sub", "data-words", "data-label"];
  var SKIP = { SCRIPT:1, STYLE:1, TEXTAREA:1, CODE:1 };
  function applyAttrs(dict, el){
    for(var i = 0; i < ATTRS.length; i++){
      var a = ATTRS[i], v = el.getAttribute(a);
      if(v){ var o = a === "data-words" ? v.split("|").map(function(w){ return tr(dict, w) || w; }).join("|") : tr(dict, v); if(o != null && o !== v) el.setAttribute(a, o); }
    }
  }
  function applyNode(dict, node){
    if(node.nodeType === 3){
      var p = node.parentNode; if(!p || SKIP[p.nodeName] || (p.closest && p.closest("svg,[data-no-tr],[contenteditable]"))) return;
      var out = tr(dict, node.nodeValue);
      if(out != null && out !== node.nodeValue.trim()){ var lead = /^\s*/.exec(node.nodeValue)[0], tail = /\s*$/.exec(node.nodeValue)[0]; node.nodeValue = lead + out + tail; }
      return;
    }
    if(node.nodeType !== 1 || SKIP[node.nodeName] || node.nodeName === "svg") return;
    if(node.hasAttribute && node.hasAttribute("data-no-tr")) return;
    applyAttrs(dict, node);
    if(node.nodeName === "META" && node.getAttribute("name") === "description"){ var c = tr(dict, node.getAttribute("content") || ""); if(c) node.setAttribute("content", c); }
    var kids = node.childNodes; for(var k = 0; k < kids.length; k++) applyNode(dict, kids[k]);
  }
  function watch(dict, root){
    applyNode(dict, root);
    var busy = false;
    new MutationObserver(function(list){
      if(busy) return; busy = true;
      try {
        list.forEach(function(m){
          if(m.type === "characterData") applyNode(dict, m.target);
          else if(m.type === "attributes"){ if(!(m.target.closest && m.target.closest("[data-no-tr]"))) applyAttrs(dict, m.target); }
          else m.addedNodes.forEach(function(n){ applyNode(dict, n); });
        });
      } finally { busy = false; }
    }).observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function load(url){
    return fetch(url, { cache: "force-cache" }).then(function(r){ return r.ok ? r.json() : {}; }).catch(function(){ return {}; });
  }
  window.HTi18n = {
    lang: LANG,
    set: function(l){ try { localStorage.setItem(KEY, l); } catch(e){} location.reload(); },
    start: function(url, root){
      document.documentElement.lang = LANG;
      if(LANG !== "es"){ document.documentElement.classList.remove("es-wait"); return Promise.resolve(); }
      return load(url).then(function(dict){
        watch(dict, root || document.documentElement);
        document.title = tr(dict, document.title) || document.title;
        document.documentElement.classList.remove("es-wait");
      });
    }
  };
})();
