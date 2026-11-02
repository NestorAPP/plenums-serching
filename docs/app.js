"use strict";
(function () {
  const DATA = window.PLENUMS || [];
  const $ = (id) => document.getElementById(id);
  const norm = (s) => s.toLowerCase().replace(/ё/g, "е");
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (iso) => iso.split("-").reverse().join(".");

  // индекс для поиска
  DATA.forEach((d) => {
    d.pn = d.paras.map(norm);
    d.tn = norm(d.title);
    d.all = d.tn + "\n" + d.pn.join("\n");
  });

  // «основа» слова: убираем окончание, чтобы «кража» находила «краже», «кражи»
  const stem = (w) => (w.length <= 4 ? w : w.slice(0, Math.max(4, w.length - 2)));

  function parseQuery(raw) {
    const phrases = [];
    const rest = raw.replace(/[«"“]([^»"”]+)[»"”]/g, (_, p) => (phrases.push(norm(p.trim())), " "));
    const stems = norm(rest).split(/[^a-zа-я0-9.]+/).filter((w) => w.length > 1).map(stem);
    return { phrases: phrases.filter(Boolean), stems };
  }

  function hlRegex(q) {
    const parts = [...q.phrases, ...q.stems].map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/е/g, "[её]"));
    return parts.length ? new RegExp("(" + parts.join("|") + ")([а-яё]*)", "gi") : null;
  }
  const highlight = (text, re) => (re ? esc(text).replace(re, "<mark>$1</mark>$2") : esc(text));

  const state = { q: "", art: "", code: "rf", from: "", to: "", organ: "", sort: "rel" };

  function readState() {
    state.q = $("q").value.trim();
    state.art = $("art").value.trim();
    state.code = $("code").value;
    state.from = $("from").value;
    state.to = $("to").value;
    state.organ = $("organ").value;
    state.sort = $("sort").value;
  }

  function artList() {
    return (state.art.match(/\d{1,3}(?:\.\d{1,2})?/g) || []);
  }

  function search() {
    const q = parseQuery(state.q);
    const arts = artList();
    const hasQ = q.phrases.length + q.stems.length > 0;
    let out = [];
    for (const d of DATA) {
      if (state.organ && d.organ !== state.organ) continue;
      if (state.from && d.date < state.from) continue;
      if (state.to && d.date > state.to) continue;
      if (arts.length) {
        const pool = state.code === "rf" ? d.uk : state.code === "rsfsr" ? d.ukr : d.uk.concat(d.ukr);
        if (!arts.every((a) => pool.includes(a))) continue;
      }
      let score = 0, hits = [];
      if (hasQ) {
        if (!q.phrases.every((p) => d.all.includes(p))) continue;
        if (!q.stems.every((s) => d.all.includes(s))) continue;
        const keys = [...q.phrases, ...q.stems];
        d.pn.forEach((p, i) => {
          let n = 0;
          for (const k of keys) { let at = p.indexOf(k); while (at !== -1) { n++; at = p.indexOf(k, at + k.length); } }
          if (n) { hits.push({ i, n }); score += n; }
        });
        if (keys.some((k) => d.tn.includes(k))) score += 20;
        if (!score && !keys.some((k) => d.tn.includes(k))) continue;
      }
      out.push({ d, score, hits });
    }
    if (state.sort === "rel" && hasQ) out.sort((a, b) => b.score - a.score);
    else if (state.sort === "old") out.sort((a, b) => a.d.date.localeCompare(b.d.date));
    else out.sort((a, b) => b.d.date.localeCompare(a.d.date));
    return { out, q, hasQ };
  }

  function renderList() {
    readState();
    const { out, q, hasQ } = search();
    const re = hlRegex(q);
    $("count").textContent = `Найдено: ${out.length} из ${DATA.length}`;
    if (!out.length) {
      $("results").innerHTML = '<li class="empty">Ничего не найдено. Проверьте написание, уберите часть условий или нажмите «Сбросить».</li>';
      return;
    }
    $("results").innerHTML = out.slice(0, 100).map(({ d, hits }) => {
      const arts = (state.code === "rsfsr" ? d.ukr : d.uk).slice(0, 8)
        .map((a) => `<span class="chip" data-art="${a}">ст. ${a}</span>`).join("");
      const snips = hasQ ? hits.sort((a, b) => b.n - a.n).slice(0, 2).sort((a, b) => a.i - b.i)
        .map((h) => `<p class="snip">${snippet(d.paras[h.i], re)}</p>`).join("") : "";
      return `<li class="card" data-id="${d.id}" tabindex="0">
        <div class="date"><b>${fmt(d.date).slice(0, 5)}</b><span>${d.date.slice(0, 4)}</span><em>${d.organ}</em></div>
        <div class="card-body"><h2>${highlight(d.title, re)}</h2>
        <div class="meta">Постановление Пленума Верховного Суда ${d.organ} от ${fmt(d.date)} № ${esc(d.num)}${hasQ ? " · совпадений: " + hits.reduce((s, h) => s + h.n, 0) : ""}</div>
        ${snips}${arts ? `<div class="arts">${arts}</div>` : ""}</div></li>`;
    }).join("");
    if (out.length > 100) $("count").textContent += " (показаны первые 100, уточните запрос)";
  }

  function snippet(text, re) {
    let t = text;
    if (re) {
      re.lastIndex = 0;
      const m = re.exec(text);
      if (m && text.length > 320) {
        const s = Math.max(0, m.index - 110);
        t = (s ? "…" : "") + text.slice(s, s + 320) + "…";
      }
    }
    return highlight(t.length > 340 ? t.slice(0, 340) + "…" : t, re);
  }

  // чтение документа
  let hitEls = [], cur = -1;
  function openDoc(id, scroll) {
    const d = DATA.find((x) => x.id === id);
    if (!d) return;
    const re = hlRegex(parseQuery(state.q));
    $("docBody").innerHTML = `<h2>${esc(d.title)}</h2>
      <div class="meta">Постановление Пленума Верховного Суда ${d.organ} от ${fmt(d.date)} № ${esc(d.num)}</div>
      ${d.paras.map((p) => `<p>${highlight(p, re)}</p>`).join("")}`;
    $("listView").hidden = true;
    $("docView").hidden = false;
    hitEls = [...$("docBody").querySelectorAll("mark")];
    const has = hitEls.length > 0;
    $("prevHit").hidden = $("nextHit").hidden = !has;
    cur = -1;
    if (has) goHit(1); else { $("hitInfo").textContent = ""; window.scrollTo(0, 0); }
    if (scroll !== false) history.pushState({ id }, "", "#p" + id);
  }
  function goHit(step) {
    if (!hitEls.length) return;
    if (cur >= 0) hitEls[cur].classList.remove("cur");
    cur = (cur + step + hitEls.length) % hitEls.length;
    hitEls[cur].classList.add("cur");
    hitEls[cur].scrollIntoView({ block: "center" });
    $("hitInfo").textContent = `Совпадение ${cur + 1} из ${hitEls.length}`;
  }
  function closeDoc() {
    $("docView").hidden = true;
    $("listView").hidden = false;
  }

  // события
  let timer;
  ["q", "art"].forEach((id) => $(id).addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(renderList, 160); }));
  ["code", "from", "to", "organ", "sort"].forEach((id) => $(id).addEventListener("change", renderList));
  $("reset").addEventListener("click", () => {
    $("filters").reset();
    renderList();
  });
  $("results").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (chip) { $("art").value = chip.dataset.art; renderList(); window.scrollTo(0, 0); return; }
    const card = e.target.closest(".card");
    if (card) openDoc(+card.dataset.id);
  });
  $("results").addEventListener("keydown", (e) => {
    const card = e.target.closest(".card");
    if (card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openDoc(+card.dataset.id); }
  });
  $("back").addEventListener("click", () => history.back());
  $("nextHit").addEventListener("click", () => goHit(1));
  $("prevHit").addEventListener("click", () => goHit(-1));
  window.addEventListener("popstate", () => {
    const m = location.hash.match(/^#p(\d+)$/);
    if (m) openDoc(+m[1], false); else closeDoc();
  });

  renderList();
  const m = location.hash.match(/^#p(\d+)$/);
  if (m) openDoc(+m[1], false);

  if ("serviceWorker" in navigator && /^https:|^http:\/\/localhost/.test(location.href)) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
