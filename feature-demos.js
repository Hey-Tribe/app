/* Hands-on demos for the feature pages. Each page has <div class="try" data-demo="name"></div>.
   Everything runs in the browser with made-up sample data; nothing is saved. English and Spanish built in. */
(function(){
  "use strict";
  var box = document.querySelector(".try[data-demo]"); if(!box) return;
  var ES = !!(window.HTi18n && HTi18n.lang === "es");
  function t(en, es){ return ES ? es : en; }
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]; }); }
  function h(html){ var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; }
  function $(s, r){ return (r || box).querySelector(s); }
  function $$(s, r){ return Array.prototype.slice.call((r || box).querySelectorAll(s)); }
  var PEOPLE = { alex:{ n:"Alex", c:"#6B8BA4" }, maria:{ n:"Maria", c:"#B08A84" }, leo:{ n:"Leo", c:"#C9A66B" }, sofia:{ n:"Sofia", c:"#8A8F6B" } };
  function dot(k, size){ var p = PEOPLE[k]; size = size || 28; return '<span class="d-av" style="width:' + size + 'px;height:' + size + 'px;background:' + p.c + ';font-size:' + Math.round(size * .42) + 'px" aria-hidden="true">' + p.n[0] + '</span>'; }
  function fmt(min){ var hh = Math.floor(min / 60) % 24, mm = min % 60, ap = hh < 12 ? "am" : "pm", h12 = hh % 12 || 12; return h12 + (mm ? ":" + (mm < 10 ? "0" : "") + mm : "") + ap; }
  function pop(el){ el.classList.remove("d-pop"); void el.offsetWidth; el.classList.add("d-pop"); }
  var DAYS = ES ? ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"] : ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  var D = {};

  /* ---------- Today: drag through the day ---------- */
  D.today = function(){
    var plans = [[465, t("School drop-off", "Llevar a la escuela"), "alex"], [540, t("Team call", "Llamada de equipo"), "alex"], [930, t("Soccer practice", "Práctica de fútbol"), "maria"], [1110, t("Tacos night", "Noche de tacos"), null]];
    box.innerHTML = '<div class="d-card d-today"><div class="d-row d-between"><b class="d-big" id="tt-clock"></b><span class="d-muted">' + t("Drag to move through the day", "Arrastra para moverte por el día") + '</span></div>'
      + '<input type="range" min="360" max="1320" step="15" value="420" id="tt-range" aria-label="' + t("Time of day", "Hora del día") + '">'
      + '<div class="d-brief" id="tt-brief"></div><ol class="d-tl" id="tt-tl"></ol></div>';
    function draw(){
      var now = +$("#tt-range").value; $("#tt-clock").textContent = fmt(now);
      var next = plans.filter(function(p){ return p[0] >= now; })[0];
      var greet = now < 720 ? t("Good morning, Alex", "Buenos días, Alex") : now < 1020 ? t("Good afternoon, Alex", "Buenas tardes, Alex") : t("Good evening, Alex", "Buenas noches, Alex");
      $("#tt-brief").innerHTML = "<b>" + greet + "</b><span>" + (next ? t("Next up: ", "Lo que sigue: ") + "<b>" + esc(next[1]) + "</b> " + t("at ", "a las ") + fmt(next[0]) + (next[2] ? ", " + PEOPLE[next[2]].n + (ES ? " se encarga." : " has it.") : ".") : t("Nothing else today. Dinner is Tacos night.", "Nada más hoy. La cena es Noche de tacos.")) + "</span>";
      $("#tt-tl").innerHTML = plans.map(function(p){ var past = p[0] < now; return '<li class="' + (past ? "past" : "") + '"><span class="d-time">' + fmt(p[0]) + '</span><span class="d-grow">' + esc(p[1]) + '</span>' + (p[2] ? dot(p[2], 24) : "") + "</li>"; }).join("");
    }
    $("#tt-range").addEventListener("input", draw); draw();
  };

  /* ---------- Countdowns ---------- */
  D.countdowns = function(){
    var presets = [[t("Grandma visits", "Visita de la abuela"), 4], [t("Beach weekend", "Fin de semana en la playa"), 11], [t("Leo's birthday", "Cumpleaños de Leo"), 23], [t("Last day of school", "Último día de clases"), 58]];
    box.innerHTML = '<div class="d-card d-cd"><div class="d-chips" id="cd-chips">' + presets.map(function(p, i){ return '<button type="button" class="d-chip' + (i ? "" : " on") + '" data-i="' + i + '">' + esc(p[0]) + "</button>"; }).join("") + '</div>'
      + '<div class="d-cd-face"><span class="d-cd-n" id="cd-n"></span><span id="cd-l"></span></div>'
      + '<label class="d-muted" for="cd-r">' + t("Or slide the date", "O mueve la fecha") + '</label><input type="range" id="cd-r" min="1" max="120" value="4"></div>';
    var name = presets[0][0];
    function draw(n){ $("#cd-n").textContent = n; pop($("#cd-n")); $("#cd-l").innerHTML = "<b>" + esc(name) + "</b> " + (n === 1 ? t("is tomorrow. One more sleep!", "es mañana. ¡Falta una noche!") : t(n + " more sleeps", "faltan " + n + " noches")); }
    $$("#cd-chips .d-chip").forEach(function(b){ b.addEventListener("click", function(){ $$("#cd-chips .d-chip").forEach(function(x){ x.classList.remove("on"); }); b.classList.add("on"); var p = presets[+b.dataset.i]; name = p[0]; $("#cd-r").value = p[1]; draw(p[1]); }); });
    $("#cd-r").addEventListener("input", function(){ draw(+this.value); });
    draw(4);
  };

  /* ---------- Fridge: notes and a poll ---------- */
  D.fridge = function(){
    var votes = [[t("Tacos", "Tacos"), 2], [t("Pizza", "Pizza"), 1], [t("Breakfast for dinner", "Desayuno de cena"), 0]], mine = -1;
    box.innerHTML = '<div class="d-grid2"><div class="d-card"><b class="d-h">' + t("Friday dinner?", "¿Cena del viernes?") + '</b><div id="fr-poll"></div><p class="d-muted">' + t("Tap to vote. Tap again to change it.", "Toca para votar. Toca otra vez para cambiar.") + '</p></div>'
      + '<div class="d-card"><b class="d-h">' + t("On the fridge", "En el refri") + '</b><div class="d-notes" id="fr-notes"><div class="d-note">' + t("Spare key is with the neighbors at #125", "La llave extra la tienen los vecinos del #125") + '<small>Maria</small></div></div>'
      + '<form class="d-add" id="fr-f"><input maxlength="80" placeholder="' + t("Leave a note…", "Deja una nota…") + '" aria-label="' + t("Note", "Nota") + '"><button class="d-btn">' + t("Stick it up", "Pegar") + '</button></form></div></div>';
    function poll(){ var total = votes.reduce(function(a, v){ return a + v[1]; }, 0) || 1;
      $("#fr-poll").innerHTML = votes.map(function(v, i){ return '<button type="button" class="d-opt' + (i === mine ? " on" : "") + '" data-i="' + i + '"><span class="d-between"><b>' + esc(v[0]) + '</b><span>' + v[1] + '</span></span><i style="width:' + Math.round(v[1] / total * 100) + '%"></i></button>'; }).join("");
      $$("#fr-poll .d-opt").forEach(function(b){ b.addEventListener("click", function(){ var i = +b.dataset.i; if(mine >= 0) votes[mine][1]--; mine = mine === i ? -1 : i; if(mine >= 0) votes[mine][1]++; poll(); }); }); }
    $("#fr-f").addEventListener("submit", function(e){ e.preventDefault(); var i = $("#fr-f input"), v = i.value.trim(); if(!v) return; var n = h('<div class="d-note d-pop">' + esc(v) + "<small>" + t("You", "Tú") + "</small></div>"); $("#fr-notes").insertBefore(n, $("#fr-notes").firstChild); i.value = ""; });
    poll();
  };

  /* ---------- Calendar: lanes, drivers and clashes ---------- */
  D.calendar = function(){
    var lanes = ["alex", "maria", "leo", "sofia"];
    var ev = [{ who:"leo", s:9, e:10, t:t("Swim", "Natación"), by:"maria" }, { who:"alex", s:10, e:11, t:t("Dentist", "Dentista") }];
    var add = [{ who:"sofia", s:10, e:11, t:t("Ballet", "Ballet"), by:"alex" }, { who:"leo", s:13, e:15, t:t("Birthday party", "Fiesta de cumpleaños"), by:"maria" }, { who:"maria", s:16, e:17, t:t("Yoga", "Yoga") }];
    box.innerHTML = '<div class="d-card"><div class="d-row d-between d-wrap"><b class="d-h">' + t("Saturday", "Sábado") + '</b><div class="d-chips" id="ca-add">' + add.map(function(a, i){ return '<button type="button" class="d-chip" data-i="' + i + '">+ ' + esc(a.t) + " · " + PEOPLE[a.who].n + (a.by ? " · " + t("drives: ", "maneja: ") + PEOPLE[a.by].n : "") + "</button>"; }).join("") + '</div></div>'
      + '<div class="d-cal"><div class="d-cal-hd"><span></span>' + lanes.map(function(k){ return '<span>' + dot(k, 26) + PEOPLE[k].n + "</span>"; }).join("") + '</div><div class="d-cal-bd" id="ca-bd"></div></div><p class="d-warn" id="ca-w" role="status"></p></div>';
    function draw(){
      var rows = ""; for(var hr = 8; hr <= 17; hr++) rows += '<div class="d-cal-r"><span class="d-time">' + fmt(hr * 60) + "</span>" + lanes.map(function(){ return "<span></span>"; }).join("") + "</div>";
      $("#ca-bd").innerHTML = rows + ev.map(function(e){ var col = lanes.indexOf(e.who); return '<div class="d-blk" style="--c:' + PEOPLE[e.who].c + ';left:calc(56px + (100% - 56px) / 4 * ' + col + ');top:' + ((e.s - 8) * 34 + 2) + 'px;height:' + ((e.e - e.s) * 34 - 4) + 'px"><b>' + esc(e.t) + "</b>" + (e.by ? "<small>" + t("Driver: ", "Maneja: ") + PEOPLE[e.by].n + "</small>" : "") + "</div>"; }).join("");
    }
    $$("#ca-add .d-chip").forEach(function(b){ b.addEventListener("click", function(){
      var a = add[+b.dataset.i]; b.disabled = true; ev.push(a); draw();
      var clash = a.by && ev.filter(function(e){ return e !== a && e.who === a.by && e.s < a.e && a.s < e.e; })[0];
      $("#ca-w").textContent = clash ? t("Heads up: " + PEOPLE[a.by].n + " has " + clash.t + " at " + fmt(clash.s * 60) + ". Pick another driver?", "Ojo: " + PEOPLE[a.by].n + " tiene " + clash.t + " a las " + fmt(clash.s * 60) + ". ¿Elegimos a otra persona para manejar?") : t("Added. Everyone sees it right away.", "Agregado. Todos lo ven al instante.");
    }); });
    draw();
  };

  /* ---------- Lists: items sort themselves ---------- */
  D.lists = function(){
    var AISLE = [[t("Produce", "Frutas y verduras"), /apple|banana|avocado|lettuce|tomato|onion|lime|berr|grape|potato|carrot|spinach|cilantro|manzana|plátano|platano|aguacate|lechuga|tomate|cebolla|limón|fresa|uva|papa|zanahoria|espinaca/i], [t("Dairy", "Lácteos"), /milk|cheese|yogurt|butter|egg|cream|leche|queso|yogur|mantequilla|huevo|crema/i], [t("Bakery", "Panadería"), /bread|tortilla|bagel|bun|muffin|pan\b|bolillo/i], [t("Baby", "Bebé"), /diaper|wipe|formula|pañal|toallita|fórmula/i], [t("Pantry", "Despensa"), /rice|pasta|cereal|beans|flour|sugar|coffee|oil|arroz|frijol|harina|azúcar|café|aceite/i]];
    var items = [[t("Bananas", "Plátanos"), "alex"], [t("Milk", "Leche"), "maria"], [t("Diapers, size 4", "Pañales, talla 4"), "maria"]];
    var ex = ES ? ["Aguacates", "Pan", "Queso", "Arroz", "Toallitas"] : ["Avocados", "Bread", "Cheese", "Rice", "Wipes"];
    box.innerHTML = '<div class="d-card d-list"><form class="d-add" id="li-f"><input maxlength="40" placeholder="' + t("Add something…", "Agrega algo…") + '" aria-label="' + t("Item", "Artículo") + '"><button class="d-btn">' + t("Add", "Agregar") + '</button></form><div class="d-chips">' + ex.map(function(x){ return '<button type="button" class="d-chip" data-x="' + esc(x) + '">+ ' + esc(x) + "</button>"; }).join("") + '</div><div id="li-l"></div></div>';
    function aisle(n){ for(var i = 0; i < AISLE.length; i++) if(AISLE[i][1].test(n)) return AISLE[i][0]; return t("Other", "Otros"); }
    function draw(fresh){ var groups = {}; items.forEach(function(it, i){ var a = aisle(it[0]); (groups[a] = groups[a] || []).push([it, i]); });
      $("#li-l").innerHTML = Object.keys(groups).map(function(g){ return '<div class="d-aisle">' + esc(g) + "</div>" + groups[g].map(function(x){ return '<label class="d-item' + (x[1] === fresh ? " d-pop" : "") + '"><input type="checkbox"><span class="d-grow">' + esc(x[0][0]) + "</span>" + dot(x[0][1], 22) + "</label>"; }).join(""); }).join(""); }
    function add(v){ v = v.trim(); if(!v) return; items.push([v, "leo"]); draw(items.length - 1); }
    $("#li-f").addEventListener("submit", function(e){ e.preventDefault(); add($("#li-f input").value); $("#li-f input").value = ""; });
    $$(".d-chip").forEach(function(b){ b.addEventListener("click", function(){ add(b.dataset.x); b.disabled = true; }); });
    draw();
  };

  /* ---------- Dinner menu: pick dinners, groceries follow ---------- */
  D["dinner-menu"] = function(){
    var MEALS = ES ? { "Tacos": ["Tortillas", "Carne molida", "Aguacates", "Queso"], "Pasta al pesto": ["Pasta", "Pesto", "Parmesano"], "Pollo al horno": ["Pollo", "Papas", "Limones"], "Sopa de lentejas": ["Lentejas", "Zanahorias", "Cebolla"], "Desayuno de cena": ["Huevos", "Pan", "Fresas"] }
      : { "Tacos": ["Tortillas", "Ground beef", "Avocados", "Cheese"], "Pesto pasta": ["Pasta", "Pesto", "Parmesan"], "Sheet-pan chicken": ["Chicken thighs", "Potatoes", "Lemons"], "Lentil soup": ["Lentils", "Carrots", "Onion"], "Breakfast for dinner": ["Eggs", "Bread", "Strawberries"] };
    var names = Object.keys(MEALS), plan = [null, null, null, null, null, null, null], pick = 0;
    box.innerHTML = '<div class="d-grid2"><div class="d-card"><b class="d-h">' + t("This week", "Esta semana") + '</b><div id="dm-w"></div><div class="d-chips" id="dm-c">' + names.map(function(n){ return '<button type="button" class="d-chip" data-n="' + esc(n) + '">' + esc(n) + "</button>"; }).join("") + '</div><p class="d-muted">' + t("Pick a night, then a dinner.", "Elige una noche y luego una cena.") + '</p></div><div class="d-card"><b class="d-h">' + t("Grocery list", "Lista del súper") + '</b><div id="dm-g"></div></div></div>';
    function draw(){
      $("#dm-w").innerHTML = plan.map(function(m, i){ return '<button type="button" class="d-night' + (i === pick ? " on" : "") + '" data-i="' + i + '"><span class="d-time">' + DAYS[i] + '</span><span class="d-grow">' + (m ? esc(m) : '<span class="d-muted">' + t("Add a dinner", "Agrega una cena") + "</span>") + "</span></button>"; }).join("");
      $$("#dm-w .d-night").forEach(function(b){ b.addEventListener("click", function(){ pick = +b.dataset.i; draw(); }); });
      var need = {}; plan.forEach(function(m){ if(m) MEALS[m].forEach(function(x){ need[x] = (need[x] || 0) + 1; }); });
      var keys = Object.keys(need);
      $("#dm-g").innerHTML = keys.length ? keys.map(function(k){ return '<div class="d-item"><span class="d-grow">' + esc(k) + "</span>" + (need[k] > 1 ? '<span class="d-tag">×' + need[k] + "</span>" : "") + "</div>"; }).join("") : '<p class="d-muted">' + t("Ingredients show up here as you plan.", "Los ingredientes aparecen aquí mientras planeas.") + "</p>";
    }
    $$("#dm-c .d-chip").forEach(function(b){ b.addEventListener("click", function(){ plan[pick] = b.dataset.n; pick = Math.min(6, pick + 1); draw(); }); });
    draw();
  };

  /* ---------- Chores: stamp stars toward a reward ---------- */
  D.chores = function(){
    var chores = [t("Make bed", "Tender la cama"), t("Feed Biscuit", "Alimentar a Biscuit"), t("Read 20 min", "Leer 20 min")], goal = 12, on = {};
    [[0,0],[0,1],[1,0],[2,1],[0,2]].forEach(function(x){ on[x[0] + "-" + x[1]] = 1; });
    box.innerHTML = '<div class="d-grid2"><div class="d-card"><div class="d-row">' + dot("leo", 34) + '<b class="d-h">' + t("Leo's week", "La semana de Leo") + '</b></div><table class="d-chart"><thead><tr><th></th>' + DAYS.map(function(d){ return "<th>" + d[0] + "</th>"; }).join("") + "</tr></thead><tbody>"
      + chores.map(function(c, r){ return "<tr><td>" + esc(c) + "</td>" + DAYS.map(function(d, i){ return '<td><button type="button" class="d-stamp" data-k="' + r + "-" + i + '" aria-label="' + esc(c) + " " + d + '"></button></td>'; }).join("") + "</tr>"; }).join("") + '</tbody></table></div>'
      + '<div class="d-card d-jar"><span class="d-muted">' + t("Saving up for", "Ahorrando para") + '</span><b class="d-h">' + t("Movie night + popcorn", "Noche de película + palomitas") + '</b><div class="d-jarbox"><i id="ch-fill"></i></div><b class="d-big" id="ch-n"></b><span id="ch-m" class="d-muted"></span></div></div>';
    function draw(){ var n = Object.keys(on).length;
      $$(".d-stamp").forEach(function(b){ var v = !!on[b.dataset.k]; b.classList.toggle("on", v); b.setAttribute("aria-pressed", v); b.innerHTML = v ? "★" : ""; });
      $("#ch-fill").style.height = Math.min(100, n / goal * 100) + "%"; $("#ch-n").textContent = n + " / " + goal;
      $("#ch-m").textContent = n >= goal ? t("Movie night unlocked.", "Noche de película ganada.") : t((goal - n) + " stars to go", "Faltan " + (goal - n) + " estrellas"); }
    $$(".d-stamp").forEach(function(b){ b.addEventListener("click", function(){ if(on[b.dataset.k]) delete on[b.dataset.k]; else { on[b.dataset.k] = 1; pop(b); } draw(); }); });
    draw();
  };

  /* ---------- Routines: out the door ---------- */
  D.routines = function(){
    var steps = [t("Get dressed", "Vestirse"), t("Brush teeth", "Cepillarse los dientes"), t("Eat breakfast", "Desayunar"), t("Shoes and jacket", "Zapatos y chamarra"), t("Pack backpack", "Preparar la mochila")], done = {};
    box.innerHTML = '<div class="d-card d-rt"><div class="d-row d-between"><div class="d-row">' + dot("leo", 34) + '<b class="d-h">' + t("Leo's morning", "La mañana de Leo") + '</b></div><b id="rt-c"></b></div><div class="d-bar"><i id="rt-b"></i></div><div id="rt-l"></div><p class="d-done" id="rt-d" role="status"></p></div>';
    function draw(){ var n = Object.keys(done).length;
      $("#rt-l").innerHTML = steps.map(function(s, i){ return '<button type="button" class="d-step' + (done[i] ? " on" : "") + '" data-i="' + i + '"><span class="d-box">' + (done[i] ? "✓" : "") + "</span>" + esc(s) + "</button>"; }).join("");
      $("#rt-c").textContent = n + " / " + steps.length; $("#rt-b").style.width = n / steps.length * 100 + "%";
      $("#rt-d").textContent = n === steps.length ? t("All done. Out the door at 7:45.", "Todo listo. A salir a las 7:45.") : "";
      $$(".d-step").forEach(function(b){ b.addEventListener("click", function(){ var i = b.dataset.i; if(done[i]) delete done[i]; else done[i] = 1; draw(); }); }); }
    draw();
  };

  /* ---------- Kid view ---------- */
  D["kid-view"] = function(){
    var jobs = [t("Make bed", "Tender la cama"), t("Feed Biscuit", "Alimentar a Biscuit"), t("Put toys away", "Guardar los juguetes")], done = {}, stars = 6;
    box.innerHTML = '<div class="d-kid"><div class="d-row">' + dot("sofia", 56) + '<div><b class="d-kid-hi">' + t("Hi Sofia!", "¡Hola, Sofia!") + '</b><span class="d-muted">' + t("Tap a job when it's done", "Toca una tarea cuando la termines") + '</span></div></div><div class="d-kid-stars"><b id="kv-s"></b> ' + t("stars this week", "estrellas esta semana") + '</div><div id="kv-l"></div></div>';
    function draw(){ $("#kv-s").textContent = stars;
      $("#kv-l").innerHTML = jobs.map(function(j, i){ return '<button type="button" class="d-kid-job' + (done[i] ? " on" : "") + '" data-i="' + i + '"><span class="d-kid-box">' + (done[i] ? "★" : "") + "</span>" + esc(j) + "</button>"; }).join("");
      $$(".d-kid-job").forEach(function(b){ b.addEventListener("click", function(){ var i = b.dataset.i; if(done[i]){ delete done[i]; stars--; } else { done[i] = 1; stars++; } draw(); pop($("#kv-s")); }); }); }
    draw();
  };

  /* ---------- School: forms with due dates ---------- */
  D.school = function(){
    var forms = [[t("Field trip permission: pumpkin farm", "Permiso para la excursión: granja de calabazas"), 2], [t("Picture day order form", "Formulario de fotos escolares"), 5], [t("Allergy action plan", "Plan de acción para alergias"), 9]];
    box.innerHTML = '<div class="d-card"><div class="d-row d-between"><b class="d-h">' + t("Forms and slips", "Formularios y permisos") + '</b><span class="d-muted" id="sc-n"></span></div><div id="sc-l"></div></div>';
    function draw(){ var left = forms.filter(function(f){ return !f[2]; }).length; $("#sc-n").textContent = left ? t(left + " to sign", left + " por firmar") : t("All signed", "Todo firmado");
      $("#sc-l").innerHTML = forms.map(function(f, i){ return '<label class="d-item' + (f[2] ? " d-off" : "") + '"><input type="checkbox" data-i="' + i + '"' + (f[2] ? " checked" : "") + '><span class="d-grow">' + esc(f[0]) + '</span><span class="d-tag' + (f[1] <= 2 && !f[2] ? " hot" : "") + '">' + (f[2] ? t("Signed", "Firmado") : t("in " + f[1] + " days", "en " + f[1] + " días")) + "</span></label>"; }).join("");
      $$("#sc-l input").forEach(function(c){ c.addEventListener("change", function(){ forms[+c.dataset.i][2] = c.checked; draw(); }); }); }
    draw();
  };

  /* ---------- Health: who gave the medicine ---------- */
  D.health = function(){
    var doses = [480, 1200], log = {}, who = "maria";
    box.innerHTML = '<div class="d-card"><div class="d-row d-between d-wrap"><div><b class="d-h">' + t("Amoxicillin for Leo", "Amoxicilina para Leo") + '</b><span class="d-muted">' + t("5 ml · 8am and 8pm · until Nov 2", "5 ml · 8am y 8pm · hasta el 2 de nov") + '</span></div><div class="d-chips" id="he-w">' + ["alex", "maria"].map(function(k){ return '<button type="button" class="d-chip' + (k === who ? " on" : "") + '" data-k="' + k + '">' + t("I'm ", "Soy ") + PEOPLE[k].n + "</button>"; }).join("") + '</div></div><div id="he-l"></div></div>';
    function draw(){ $("#he-l").innerHTML = doses.map(function(d, i){ var l = log[i]; return '<div class="d-item"><span class="d-time">' + fmt(d) + '</span><span class="d-grow">' + (l ? t("Given by ", "Dada por ") + "<b>" + PEOPLE[l.who].n + "</b> " + t("at ", "a las ") + fmt(l.at) : '<span class="d-muted">' + t("Not given yet", "Aún no se da") + "</span>") + '</span><button type="button" class="d-btn' + (l ? " ghost" : "") + '" data-i="' + i + '">' + (l ? t("Undo", "Deshacer") : t("Give", "Dar")) + "</button></div>"; }).join("");
      $$("#he-l .d-btn").forEach(function(b){ b.addEventListener("click", function(){ var i = +b.dataset.i; if(log[i]) delete log[i]; else log[i] = { who: who, at: doses[i] + 3 + Math.floor(Math.random() * 9) }; draw(); }); }); }
    $$("#he-w .d-chip").forEach(function(b){ b.addEventListener("click", function(){ who = b.dataset.k; $$("#he-w .d-chip").forEach(function(x){ x.classList.toggle("on", x === b); }); }); });
    draw();
  };

  /* ---------- Baby log ---------- */
  D["baby-log"] = function(){
    var start = Date.now() - 95 * 60000, log = [{ k:"feed", at:start }];
    var L = { feed:t("Feed", "Toma"), sleep:t("Sleep", "Sueño"), diaper:t("Diaper", "Pañal") };
    box.innerHTML = '<div class="d-grid2"><div class="d-card d-baby"><span class="d-muted">' + t("Last fed", "Última toma") + '</span><b class="d-big" id="bb-ago"></b><div class="d-chips">' + Object.keys(L).map(function(k){ return '<button type="button" class="d-btn big" data-k="' + k + '">' + L[k] + "</button>"; }).join("") + '</div></div><div class="d-card"><b class="d-h">' + t("Today's log", "Registro de hoy") + '</b><div id="bb-l"></div></div></div>';
    function ago(ms){ var m = Math.max(0, Math.round(ms / 60000)); return m < 1 ? t("just now", "ahora mismo") : (m >= 60 ? Math.floor(m / 60) + "h " : "") + (m % 60) + t("m ago", " min"); }
    function draw(){ var lf = log.filter(function(x){ return x.k === "feed"; }).slice(-1)[0]; $("#bb-ago").textContent = lf ? ago(Date.now() - lf.at) : "—";
      $("#bb-l").innerHTML = log.slice().reverse().map(function(x){ var d = new Date(x.at); return '<div class="d-item"><span class="d-time">' + fmt(d.getHours() * 60 + d.getMinutes()) + '</span><span class="d-grow">' + L[x.k] + "</span>" + dot(x === log[0] ? "maria" : "alex", 22) + "</div>"; }).join(""); }
    $$(".d-baby .d-btn").forEach(function(b){ b.addEventListener("click", function(){ log.push({ k:b.dataset.k, at:Date.now() }); draw(); pop($("#bb-ago")); }); });
    draw(); setInterval(draw, 30000);
  };

  /* ---------- Home and bills ---------- */
  D["home-bills"] = function(){
    var bills = [[t("Mortgage", "Hipoteca"), 1650, 1], [t("Electric", "Luz"), 142, 0], [t("Internet", "Internet"), 70, 1], [t("Water", "Agua"), 48, 0], [t("Daycare", "Guardería"), 980, 0]];
    box.innerHTML = '<div class="d-card"><div class="d-row d-between d-wrap"><div><span class="d-muted">' + t("Left to pay this month", "Falta pagar este mes") + '</span><b class="d-big" id="hb-t"></b></div><div class="d-bar w"><i id="hb-b"></i></div></div><div id="hb-l"></div></div>';
    function money(n){ return "$" + n.toLocaleString("en-US"); }
    function draw(){ var all = bills.reduce(function(a, b){ return a + b[1]; }, 0), left = bills.reduce(function(a, b){ return a + (b[2] ? 0 : b[1]); }, 0);
      $("#hb-t").textContent = money(left); $("#hb-b").style.width = (1 - left / all) * 100 + "%";
      $("#hb-l").innerHTML = bills.map(function(b, i){ return '<div class="d-item"><span class="d-grow">' + esc(b[0]) + '</span><span class="d-amt">' + money(b[1]) + '</span><button type="button" class="d-btn' + (b[2] ? " ghost" : "") + '" data-i="' + i + '">' + (b[2] ? t("Paid ✓", "Pagado ✓") : t("Mark paid", "Marcar pagado")) + "</button></div>"; }).join("");
      $$("#hb-l .d-btn").forEach(function(x){ x.addEventListener("click", function(){ var b = bills[+x.dataset.i]; b[2] = b[2] ? 0 : 1; draw(); }); }); }
    draw();
  };

  /* ---------- Documents: find it fast ---------- */
  D.documents = function(){
    var docs = [[t("Passport", "Pasaporte"), "Leo", t("Fireproof box, hall closet", "Caja a prueba de fuego, clóset del pasillo"), t("expires Feb 2027", "vence feb 2027")], [t("Passport", "Pasaporte"), "Maria", t("Fireproof box, hall closet", "Caja a prueba de fuego, clóset del pasillo"), t("expires Jun 2031", "vence jun 2031")], [t("Health insurance cards", "Tarjetas del seguro médico"), t("Everyone", "Todos"), t("Wallets", "Carteras"), ""], [t("Birth certificate", "Acta de nacimiento"), "Sofia", t("Fireproof box", "Caja a prueba de fuego"), ""], [t("Car registration", "Registro del carro"), "", t("Glove box", "Guantera"), t("expires Dec 2026", "vence dic 2026")], [t("Fridge warranty", "Garantía del refri"), "", t("Kitchen drawer, blue folder", "Cajón de la cocina, carpeta azul"), t("until Aug 2027", "hasta ago 2027")]];
    box.innerHTML = '<div class="d-card"><input class="d-search" id="dc-q" type="search" placeholder="' + t("Where's the… try “passport”", "¿Dónde está… prueba “pasaporte”") + '" aria-label="' + t("Search documents", "Buscar documentos") + '"><div id="dc-l"></div></div>';
    function draw(){ var q = $("#dc-q").value.trim().toLowerCase(), hit = docs.filter(function(d){ return !q || d.join(" ").toLowerCase().indexOf(q) >= 0; });
      $("#dc-l").innerHTML = hit.length ? hit.map(function(d){ return '<div class="d-item"><span class="d-grow"><b>' + esc(d[0]) + "</b>" + (d[1] ? " · " + esc(d[1]) : "") + "<small>" + t("Kept: ", "Guardado: ") + esc(d[2]) + "</small></span>" + (d[3] ? '<span class="d-tag">' + esc(d[3]) + "</span>" : "") + "</div>"; }).join("") : '<p class="d-muted">' + t("Nothing found.", "No se encontró nada.") + "</p>"; }
    $("#dc-q").addEventListener("input", draw); draw();
  };

  /* ---------- Trips: shared packing list ---------- */
  D.trips = function(){
    var items = [[t("Sunscreen", "Bloqueador"), "maria"], [t("Phone chargers", "Cargadores"), "alex"], [t("Swimsuits", "Trajes de baño"), "maria"], [t("Leo's medicine", "Medicina de Leo"), "alex"], [t("Sand toys", "Juguetes de arena"), "leo"], [t("Snacks for the road", "Botanas para el camino"), "sofia"]], got = {};
    box.innerHTML = '<div class="d-card"><div class="d-row d-between"><div><b class="d-h">' + t("Beach weekend", "Fin de semana en la playa") + '</b><span class="d-muted">' + t("Ocean City · Fri to Sun", "Ocean City · vie a dom") + '</span></div><b id="tr-c"></b></div><div class="d-bar"><i id="tr-b"></i></div><div id="tr-l"></div></div>';
    function draw(){ var n = Object.keys(got).length; $("#tr-c").textContent = t("Packed " + n + " of " + items.length, "Empacado " + n + " de " + items.length); $("#tr-b").style.width = n / items.length * 100 + "%";
      $("#tr-l").innerHTML = items.map(function(it, i){ return '<label class="d-item' + (got[i] ? " d-off" : "") + '"><input type="checkbox" data-i="' + i + '"' + (got[i] ? " checked" : "") + '><span class="d-grow">' + esc(it[0]) + "</span>" + dot(it[1], 22) + "</label>"; }).join("");
      $$("#tr-l input").forEach(function(c){ c.addEventListener("change", function(){ if(c.checked) got[c.dataset.i] = 1; else delete got[c.dataset.i]; draw(); }); }); }
    draw();
  };

  /* ---------- Contacts ---------- */
  D.contacts = function(){
    var C = { [t("Emergency", "Emergencia")]: [[t("Poison Control", "Control de envenenamiento"), "1-800-222-1222"], [t("Grandma Rosa", "Abuela Rosa"), "(570) 555-0187"]], [t("Doctors", "Doctores")]: [["Bright Smiles Dental", "(570) 555-0164"], [t("Dr. Rivera, pediatrician", "Dra. Rivera, pediatra"), "(570) 555-0142"]], [t("School", "Escuela")]: [[t("Lincoln Elementary office", "Oficina de Lincoln Elementary"), "(570) 555-0100"], [t("Ms. Patel, Leo's teacher", "Sra. Patel, maestra de Leo"), "(570) 555-0123"]] };
    var keys = Object.keys(C), cur = keys[0];
    box.innerHTML = '<div class="d-card"><div class="d-chips" id="co-t">' + keys.map(function(k, i){ return '<button type="button" class="d-chip' + (i ? "" : " on") + '" data-k="' + esc(k) + '">' + esc(k) + "</button>"; }).join("") + '</div><div id="co-l"></div><p class="d-done" id="co-m" role="status"></p></div>';
    function draw(){ $("#co-l").innerHTML = C[cur].map(function(c){ return '<div class="d-item"><span class="d-grow"><b>' + esc(c[0]) + '</b></span><button type="button" class="d-num" data-n="' + esc(c[1]) + '">' + esc(c[1]) + "</button></div>"; }).join("");
      $$("#co-l .d-num").forEach(function(b){ b.addEventListener("click", function(){ try { navigator.clipboard.writeText(b.dataset.n); } catch(e){} $("#co-m").textContent = t("Copied " + b.dataset.n, "Copiado " + b.dataset.n); }); }); }
    $$("#co-t .d-chip").forEach(function(b){ b.addEventListener("click", function(){ cur = b.dataset.k; $$("#co-t .d-chip").forEach(function(x){ x.classList.toggle("on", x === b); }); draw(); }); });
    draw();
  };

  /* ---------- Sitter sheet: choose what to share ---------- */
  D["sitter-sheet"] = function(){
    var parts = [["allergy", t("Allergies", "Alergias"), t("Leo: peanuts. EpiPen is in the front pocket of his backpack.", "Leo: cacahuate. El EpiPen está en la bolsa de enfrente de su mochila.")], ["bed", t("Bedtime", "Hora de dormir"), t("Leo 7:30pm: bath, pajamas, two books, lights out.", "Leo 7:30pm: baño, pijama, dos libros y a apagar la luz.")], ["meds", t("Medicine", "Medicinas"), t("Sofia: vitamin D drops, 1 drop at 9am.", "Sofia: gotas de vitamina D, 1 gota a las 9am.")], ["wifi", t("Wi-Fi", "Wi-Fi"), "TheRiveras / tacos2026"], ["call", t("Who to call", "A quién llamar"), t("Maria (570) 555-0111 · Grandma Rosa (570) 555-0187 · 911", "Maria (570) 555-0111 · Abuela Rosa (570) 555-0187 · 911")]], on = { allergy:1, bed:1, call:1 };
    box.innerHTML = '<div class="d-grid2"><div class="d-card"><b class="d-h">' + t("What the sitter sees", "Lo que ve la niñera") + '</b><div id="ss-t"></div></div><div class="d-phone"><div class="d-phone-in"><span class="d-muted">heytribe.app/sitter</span><b class="d-h">' + t("Care sheet for The Riveras", "Ficha de cuidados de los Rivera") + '</b><div id="ss-p"></div></div></div></div>';
    function draw(){ $("#ss-t").innerHTML = parts.map(function(p){ return '<label class="d-item"><input type="checkbox" data-k="' + p[0] + '"' + (on[p[0]] ? " checked" : "") + '><span class="d-grow">' + esc(p[1]) + "</span></label>"; }).join("");
      $("#ss-p").innerHTML = parts.filter(function(p){ return on[p[0]]; }).map(function(p){ return '<div class="d-ss d-pop"><small>' + esc(p[1]) + "</small>" + esc(p[2]) + "</div>"; }).join("") || '<p class="d-muted">' + t("Pick something to share.", "Elige algo para compartir.") + "</p>";
      $$("#ss-t input").forEach(function(c){ c.addEventListener("change", function(){ if(c.checked) on[c.dataset.k] = 1; else delete on[c.dataset.k]; draw(); }); }); }
    draw();
  };

  /* ---------- Family sharing: invite and approve ---------- */
  D["family-sharing"] = function(){
    var members = ["alex", "maria", "leo", "sofia"], waiting = true;
    PEOPLE.rosa = { n: t("Grandma Rosa", "Abuela Rosa"), c: "#5E8C7A" };
    box.innerHTML = '<div class="d-grid2"><div class="d-card"><span class="d-muted">' + t("Your invite code", "Tu código de invitación") + '</span><b class="d-code" id="fs-code">K7Q2MX</b><button type="button" class="d-btn ghost" id="fs-new">' + t("Make a new code", "Crear otro código") + '</button><p class="d-muted">' + t("Anyone with the code can ask to join. A parent approves them.", "Cualquiera con el código puede pedir unirse. Un padre o madre lo aprueba.") + '</p></div><div class="d-card"><b class="d-h">' + t("The Riveras", "Los Rivera") + '</b><div id="fs-l"></div></div></div>';
    function draw(){ $("#fs-l").innerHTML = (waiting ? '<div class="d-item d-wait">' + dot("rosa", 28) + '<span class="d-grow"><b>' + PEOPLE.rosa.n + "</b><small>" + t("asked to join", "pidió unirse") + '</small></span><button type="button" class="d-btn" id="fs-ok">' + t("Approve", "Aprobar") + "</button></div>" : "")
      + members.map(function(k){ return '<div class="d-item' + (k === "rosa" ? " d-pop" : "") + '">' + dot(k, 28) + '<span class="d-grow">' + PEOPLE[k].n + "</span></div>"; }).join("");
      var ok = $("#fs-ok"); if(ok) ok.addEventListener("click", function(){ waiting = false; members.push("rosa"); draw(); }); }
    $("#fs-new").addEventListener("click", function(){ var A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", c = ""; for(var i = 0; i < 6; i++) c += A[Math.floor(Math.random() * A.length)]; $("#fs-code").textContent = c; pop($("#fs-code")); });
    draw();
  };

  var fn = D[box.getAttribute("data-demo")];
  if(fn){ box.setAttribute("data-no-tr", ""); fn(); }
})();
