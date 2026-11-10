/* HeyTribe guide tools: chore generator, printables and template buttons.
   Everything runs in the browser. Nothing typed here is sent anywhere. */
(function () {
  "use strict";
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function lines(s) { return String(s || "").split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function copyText(text, done) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta); done(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function () { done(true); }, fallback); }
    else { fallback(); }
  }
  function flash(el, ok) {
    if (!el) return;
    el.textContent = ok ? "Copied" : "Could not copy. Select the text and copy it by hand.";
    clearTimeout(el._t); el._t = setTimeout(function () { el.textContent = ""; }, 2500);
  }
  function printSoon() { setTimeout(function () { window.print(); }, 50); }

  /* ------------------------------------------------------------ chore generator */
  var BANDS = [
    { min: 2, max: 3, label: "Ages 2 to 3", items: [
      ["Put toys in the bin", "daily"], ["Put dirty clothes in the hamper", "daily"], ["Carry their plate to the counter", "daily"],
      ["Help feed the pet, with a grown-up", "daily"], ["Wipe up a small spill with a cloth", "as needed"], ["Help water the plants", "weekly"] ] },
    { min: 4, max: 5, label: "Ages 4 to 5", items: [
      ["Make their bed, as well as they can", "daily"], ["Set the table", "daily"], ["Feed the pet", "daily"], ["Put shoes by the door", "daily"],
      ["Put away toys before bed", "daily"], ["Water the plants", "weekly"], ["Match socks from the laundry", "weekly"], ["Wipe the table after meals", "daily"] ] },
    { min: 6, max: 8, label: "Ages 6 to 8", items: [
      ["Make their bed", "daily"], ["Clear and wipe the table", "daily"], ["Pack their school bag", "daily"], ["Feed and water the pet", "daily"],
      ["Put away clean laundry", "weekly"], ["Empty the small trash cans", "weekly"], ["Water the plants", "weekly"], ["Help unload the dishwasher", "daily"], ["Tidy their room", "weekly"] ] },
    { min: 9, max: 12, label: "Ages 9 to 12", items: [
      ["Load or unload the dishwasher", "daily"], ["Take out the trash and recycling", "weekly"], ["Fold and put away their own laundry", "weekly"],
      ["Help with dinner prep", "weekly"], ["Walk the dog", "daily"], ["Vacuum a room", "weekly"], ["Make their own lunch", "daily"], ["Clean their room", "weekly"], ["Wipe down the bathroom sink", "weekly"] ] },
    { min: 13, max: 17, label: "Ages 13 and up", items: [
      ["Cook a family dinner once a week", "weekly"], ["Do their own laundry from start to finish", "weekly"], ["Clean a bathroom", "weekly"],
      ["Take out the trash and recycling", "weekly"], ["Mow the lawn or shovel snow", "as needed"], ["Help make the grocery list and shop", "weekly"],
      ["Wash the dishes after dinner", "daily"], ["Wash the car", "as needed"], ["Change their sheets", "weekly"] ] }
  ];
  function bandFor(age) {
    for (var i = 0; i < BANDS.length; i++) if (age >= BANDS[i].min && age <= BANDS[i].max) return BANDS[i];
    return BANDS[2];
  }
  function pick(band, n, shuffle) {
    var idx = band.items.map(function (_, i) { return i; });
    if (shuffle) { for (var i = idx.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = idx[i]; idx[i] = idx[j]; idx[j] = t; } }
    return idx.slice(0, Math.min(n, idx.length)).sort(function (a, b) { return a - b; });
  }

  var gen = $("#gen");
  if (gen) {
    document.body.classList.add("pg-gen");
    var kidsBox = $("#kids"), out = $("#out"), count = $("#count");
    var results = [];
    function ageOptions(sel) {
      var h = ""; for (var a = 2; a <= 17; a++) h += '<option value="' + a + '"' + (a === sel ? " selected" : "") + ">" + a + "</option>"; return h;
    }
    function addKid(name, age) {
      var row = document.createElement("div"); row.className = "kid-row";
      row.innerHTML = '<label class="field"><span>Name (optional)</span><input type="text" maxlength="30" placeholder="Name" value="' + esc(name || "") + '"></label>' +
        '<label class="field age"><span>Age</span><select>' + ageOptions(age || 6) + "</select></label>" +
        '<button type="button" class="rm">Remove</button>';
      $(".rm", row).addEventListener("click", function () { if ($$(".kid-row", kidsBox).length > 1) row.remove(); });
      kidsBox.appendChild(row);
    }
    addKid("", 6);
    $("#addKid").addEventListener("click", function () { if ($$(".kid-row", kidsBox).length < 8) addKid("", 8); });

    function kidText(r) {
      var t = (r.name || "Chore list") + " (" + r.band.label.toLowerCase() + ")\n";
      r.sel.forEach(function (i) { t += "- " + r.band.items[i][0] + " (" + r.band.items[i][1] + ")\n"; });
      return t;
    }
    function render() {
      var h = '<div class="gen-bar"><button class="btn sage sm" type="button" id="printAll">Print all</button><button class="btn line sm" type="button" id="copyAll">Copy all</button><span class="copied" id="copiedAll" role="status" aria-live="polite"></span></div>';
      results.forEach(function (r, k) {
        h += '<article class="gen-card" data-k="' + k + '"><span class="band-label">' + esc(r.band.label) + "</span><h3>" + esc(r.name || "Kid " + (k + 1)) + "</h3><ul>";
        r.sel.forEach(function (i) { h += "<li><span>" + esc(r.band.items[i][0]) + "<small>" + esc(r.band.items[i][1]) + "</small></span></li>"; });
        h += '</ul><div class="acts"><button class="btn line sm" type="button" data-shuffle>Shuffle</button><button class="btn line sm" type="button" data-copy>Copy</button><span class="copied" role="status" aria-live="polite"></span></div></article>';
      });
      out.innerHTML = h;
      $("#printAll").addEventListener("click", printSoon);
      $("#copyAll").addEventListener("click", function () {
        copyText(results.map(function (r, k) { r.name = r.name || "Kid " + (k + 1); return kidText(r); }).join("\n"), function (ok) { flash($("#copiedAll"), ok); });
      });
      $$("[data-shuffle]", out).forEach(function (b) {
        b.addEventListener("click", function () {
          var k = +b.closest(".gen-card").getAttribute("data-k");
          results[k].sel = pick(results[k].band, results[k].n, true); render();
        });
      });
      $$("[data-copy]", out).forEach(function (b) {
        b.addEventListener("click", function () {
          var card = b.closest(".gen-card"), k = +card.getAttribute("data-k");
          var r = results[k]; var copy = { name: r.name || "Kid " + (k + 1), band: r.band, sel: r.sel };
          copyText(kidText(copy), function (ok) { flash($(".copied", card), ok); });
        });
      });
    }
    $("#make").addEventListener("click", function () {
      var n = +count.value || 4;
      results = $$(".kid-row", kidsBox).map(function (row) {
        var age = +$("select", row).value, band = bandFor(age);
        return { name: $("input", row).value.trim(), band: band, n: n, sel: pick(band, n, false) };
      });
      render();
      out.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  /* ------------------------------------------------------------ printables */
  var sheet = $("#sheet");
  if (sheet) {
    document.body.classList.add("pg-printables");
    var fieldsBox = $("#prFields");
    var DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    var DAYSL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    var current = "chores";
    var DEF = {
      chores: { title: "Our chore chart", names: "Alex\nMaria\nLeo", chores: "Make bed\nSet the table\nFeed the pet\nTidy room" },
      week: { title: "This week", names: "Alex\nMaria\nLeo", dinners: "" },
      routine: { title: "Morning routine", name: "", steps: "Wake up and use the bathroom\nGet dressed\nEat breakfast\nBrush teeth and hair\nPack the school bag\nShoes and jacket on" },
      meals: { title: "Meal plan and groceries", dinners: "" }
    };
    var state = JSON.parse(JSON.stringify(DEF));
    function field(label, key, val, kind) {
      if (kind === "text") return '<label class="field"><span>' + label + '</span><input type="text" data-k="' + key + '" value="' + esc(val) + '" maxlength="60"></label>';
      return '<label class="field"><span>' + label + '</span><textarea rows="5" data-k="' + key + '">' + esc(val) + "</textarea></label>";
    }
    function fields() {
      var s = state[current], h = "";
      if (current === "chores") h = field("Title", "title", s.title, "text") + field("People, one per line", "names", s.names) + field("Chores, one per line", "chores", s.chores);
      if (current === "week") h = field("Title", "title", s.title, "text") + field("People, one per line (up to 6)", "names", s.names) + field("Dinners, one per line (optional, Monday first)", "dinners", s.dinners);
      if (current === "routine") h = field("Title", "title", s.title, "text") + field("Child's name (optional)", "name", s.name, "text") + field("Steps, one per line", "steps", s.steps);
      if (current === "meals") h = field("Title", "title", s.title, "text") + field("Dinners, one per line (optional, Monday first)", "dinners", s.dinners);
      fieldsBox.innerHTML = h;
      $$("[data-k]", fieldsBox).forEach(function (el) {
        el.addEventListener("input", function () { state[current][el.getAttribute("data-k")] = el.value; draw(); });
      });
    }
    function blankCells(n, cls) { var h = ""; for (var i = 0; i < n; i++) h += '<td class="' + (cls || "box") + '"></td>'; return h; }
    function draw() {
      var s = state[current], h = "";
      if (current === "chores") {
        h = "<h2>" + esc(s.title) + "</h2><p class=\"sub\">Check the box when the chore is done.</p>";
        var chores = lines(s.chores), names = lines(s.names);
        if (!names.length) names = [""];
        names.forEach(function (n) {
          h += "<h3>" + esc(n) + "</h3><table><thead><tr><th class=\"l\">Chore</th>" + DAYS.map(function (d) { return "<th>" + d + "</th>"; }).join("") + "</tr></thead><tbody>";
          chores.forEach(function (c) { h += '<tr><td class="l">' + esc(c) + "</td>" + blankCells(7) + "</tr>"; });
          h += "</tbody></table>";
        });
        h += '<p class="foot-note">Made with HeyTribe, heytribe.app</p>';
      }
      if (current === "week") {
        var people = lines(s.names).slice(0, 6), dinners = lines(s.dinners);
        h = "<h2>" + esc(s.title) + '</h2><p class="sub">Week of ______________________</p><table><thead><tr><th class="l">Day</th>' +
          people.map(function (p) { return "<th>" + esc(p) + "</th>"; }).join("") + "<th>Dinner</th></tr></thead><tbody>";
        for (var i = 0; i < 7; i++) h += '<tr><td class="l"><b>' + DAYSL[i] + "</b></td>" + blankCells(people.length, "tall") + '<td class="l tall">' + esc(dinners[i] || "") + "</td></tr>";
        h += '</tbody></table><h3>Notes</h3><div class="line"></div><div class="line"></div><div class="line"></div><p class="foot-note">Made with HeyTribe, heytribe.app</p>';
      }
      if (current === "routine") {
        var steps = lines(s.steps);
        h = "<h2>" + esc(s.title) + (s.name ? " for " + esc(s.name) : "") + '</h2><p class="sub">Check each step when it is done.</p><table><thead><tr><th class="l">Step</th>' +
          ["M", "T", "W", "T", "F", "S", "S"].map(function (d) { return "<th>" + d + "</th>"; }).join("") + "</tr></thead><tbody>";
        steps.forEach(function (st, i) { h += '<tr><td class="l tall">' + (i + 1) + ". " + esc(st) + "</td>" + blankCells(7, "box tall") + "</tr>"; });
        h += '</tbody></table><p class="foot-note">Made with HeyTribe, heytribe.app</p>';
      }
      if (current === "meals") {
        var dn = lines(s.dinners);
        h = "<h2>" + esc(s.title) + '</h2><p class="sub">Week of ______________________</p><div class="twocol"><div><h3>Dinners</h3><table><tbody>';
        for (var d = 0; d < 7; d++) h += '<tr><td class="l" style="width:34%"><b>' + DAYSL[d] + '</b></td><td class="l tall">' + esc(dn[d] || "") + "</td></tr>";
        h += '</tbody></table></div><div><h3>Grocery list</h3><div class="groc">';
        ["Produce", "Dairy and eggs", "Meat and fish", "Pantry", "Frozen", "Household"].forEach(function (g) {
          h += "<div><h3>" + g + '</h3><div class="line"></div><div class="line"></div><div class="line"></div><div class="line"></div></div>';
        });
        h += '</div></div></div><p class="foot-note">Made with HeyTribe, heytribe.app</p>';
      }
      sheet.innerHTML = h;
    }
    $$(".chip").forEach(function (c) {
      c.addEventListener("click", function () {
        current = c.getAttribute("data-sheet");
        $$(".chip").forEach(function (x) { var on = x === c; x.classList.toggle("on", on); x.setAttribute("aria-selected", on ? "true" : "false"); });
        fields(); draw();
      });
    });
    $("#printBtn").addEventListener("click", printSoon);
    fields(); draw();
  }

  /* ------------------------------------------------------------ templates */
  var tpls = $$(".tpl");
  if (tpls.length) {
    document.body.classList.add("pg-tpl");
    tpls.forEach(function (art) {
      var title = $("h2", art).textContent;
      var copyBtn = $("[data-copy]", art), printBtn = $("[data-print]", art), msg = $(".copied", art);
      copyBtn.addEventListener("click", function () {
        var t = title + "\n" + $$("[data-tpl-list] li", art).map(function (li) { return "- " + li.textContent; }).join("\n");
        copyText(t, function (ok) { flash(msg, ok); });
      });
      printBtn.addEventListener("click", function () {
        art.classList.add("print-this");
        function done() { art.classList.remove("print-this"); window.removeEventListener("afterprint", done); }
        window.addEventListener("afterprint", done);
        printSoon();
      });
    });
  }
})();
