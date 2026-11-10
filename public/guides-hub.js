/* Search and filters for the guides hub (topic, age, type). Without JavaScript every guide stays visible. */
(function () {
  "use strict";
  var q = document.getElementById("gq");
  if (!q) return;
  var facets = Array.prototype.slice.call(document.querySelectorAll(".facet"));
  var cats = Array.prototype.slice.call(document.querySelectorAll(".g-cat"));
  var count = document.getElementById("gcount");
  var none = document.getElementById("gnone");
  var clear = document.getElementById("gclear");
  var total = document.querySelectorAll(".g-item").length;
  var state = { topic: "", age: "", type: "" };

  function has(attr, v) { return (" " + (attr || "") + " ").indexOf(" " + v + " ") !== -1; }

  function save() {
    try {
      var p = [];
      if (q.value.trim()) p.push("q=" + encodeURIComponent(q.value.trim()));
      ["topic", "age", "type"].forEach(function (k) { if (state[k]) p.push(k + "=" + state[k]); });
      history.replaceState(null, "", location.pathname + (p.length ? "?" + p.join("&") : "") + location.hash);
    } catch (e) {}
  }

  function apply() {
    var terms = q.value.toLowerCase().split(/\s+/).filter(Boolean);
    var shown = 0;
    cats.forEach(function (sec) {
      var inCat = !state.topic || sec.getAttribute("data-cat") === state.topic;
      var n = 0;
      Array.prototype.forEach.call(sec.querySelectorAll(".g-item"), function (li) {
        var s = li.getAttribute("data-s") || "";
        var ok = inCat &&
          (!state.age || has(li.getAttribute("data-age"), state.age)) &&
          (!state.type || li.getAttribute("data-type") === state.type) &&
          terms.every(function (t) { return s.indexOf(t) !== -1; });
        li.hidden = !ok;
        if (ok) n++;
      });
      sec.hidden = n === 0;
      var small = sec.querySelector(".g-h small");
      if (small) small.textContent = n;
      shown += n;
    });
    var active = shown !== total;
    count.textContent = active ? "Showing " + shown + " of " + total + " guides" : "Showing all " + total + " guides";
    none.hidden = shown !== 0;
    if (clear) clear.hidden = !(terms.length || state.topic || state.age || state.type);
    save();
  }

  function setFacet(f, v) {
    state[f.getAttribute("data-facet")] = v;
    Array.prototype.forEach.call(f.querySelectorAll(".chip"), function (c) {
      var on = (c.getAttribute("data-v") || "") === v;
      c.classList.toggle("on", on);
      c.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  facets.forEach(function (f) {
    f.addEventListener("click", function (e) {
      var c = e.target.closest ? e.target.closest(".chip") : null;
      if (!c) return;
      setFacet(f, c.getAttribute("data-v") || "");
      apply();
    });
  });
  q.addEventListener("input", apply);
  if (clear) clear.addEventListener("click", function () {
    q.value = "";
    facets.forEach(function (f) { setFacet(f, ""); });
    apply();
    q.focus();
  });

  // restore from the address, so a filtered view can be shared or reloaded
  try {
    var params = {};
    location.search.replace(/^\?/, "").split("&").forEach(function (kv) {
      var i = kv.indexOf("=");
      if (i > 0) params[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1));
    });
    if (params.q) q.value = params.q;
    facets.forEach(function (f) {
      var v = params[f.getAttribute("data-facet")];
      if (v && f.querySelector('.chip[data-v="' + v.replace(/[^a-z-]/g, "") + '"]')) setFacet(f, v.replace(/[^a-z-]/g, ""));
    });
  } catch (e) {}
  apply();
})();
