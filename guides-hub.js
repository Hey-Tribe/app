/* Search and topic filter for the guides hub. Without JavaScript every guide stays visible. */
(function () {
  "use strict";
  var q = document.getElementById("gq");
  if (!q) return;
  var chips = Array.prototype.slice.call(document.querySelectorAll(".hub-filter .chip"));
  var cats = Array.prototype.slice.call(document.querySelectorAll(".g-cat"));
  var count = document.getElementById("gcount");
  var none = document.getElementById("gnone");
  var total = document.querySelectorAll(".g-item").length;
  var cat = "all";

  function apply() {
    var terms = q.value.toLowerCase().split(/\s+/).filter(Boolean);
    var shown = 0;
    cats.forEach(function (sec) {
      var inCat = cat === "all" || sec.getAttribute("data-cat") === cat;
      var n = 0;
      Array.prototype.forEach.call(sec.querySelectorAll(".g-item"), function (li) {
        var s = li.getAttribute("data-s") || "";
        var ok = inCat && terms.every(function (t) { return s.indexOf(t) !== -1; });
        li.hidden = !ok;
        if (ok) n++;
      });
      sec.hidden = n === 0;
      shown += n;
    });
    count.textContent = shown === total ? "Showing all " + total + " guides" : "Showing " + shown + " of " + total + " guides";
    none.hidden = shown !== 0;
  }

  q.addEventListener("input", apply);
  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      cat = c.getAttribute("data-cat");
      chips.forEach(function (x) { var on = x === c; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on ? "true" : "false"); });
      apply();
    });
  });
})();
