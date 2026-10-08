/* =========================================================
   主要互動：導航、星空、捲動顯示、材料、步驟、故障、改造、測驗
   ========================================================= */
(function () {
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem("hwbot_" + k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("hwbot_" + k, JSON.stringify(v)); } catch {} },
  };

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast"); t.innerHTML = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
  }

  /* ---------- 彩帶 ---------- */
  const cf = $("#confetti"), cctx = cf.getContext("2d");
  let pieces = [], cfRaf = null;
  function sizeCf() { cf.width = innerWidth; cf.height = innerHeight; }
  sizeCf(); addEventListener("resize", sizeCf);
  function confetti(n = 140) {
    const colors = ["#ff7a1a", "#ffb347", "#a3e635", "#8b5cf6", "#c4b5fd", "#f43f5e"];
    const emojis = ["🎃", "🦇", "👻", "🍬"];
    for (let i = 0; i < n; i++) {
      pieces.push({
        x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .55,
        vx: (Math.random() - .5) * 16, vy: -Math.random() * 18 - 6,
        r: Math.random() * TAU(), vr: (Math.random() - .5) * .3,
        s: Math.random() * 8 + 5, c: colors[i % colors.length],
        e: Math.random() < .12 ? emojis[i % emojis.length] : null, life: 0,
      });
    }
    if (!cfRaf) cfRaf = requestAnimationFrame(cfTick);
  }
  function TAU() { return Math.PI * 2; }
  function cfTick() {
    cctx.clearRect(0, 0, cf.width, cf.height);
    pieces.forEach((p) => {
      p.vy += .45; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life++;
      cctx.save(); cctx.translate(p.x, p.y); cctx.rotate(p.r);
      if (p.e) { cctx.font = p.s * 2.6 + "px serif"; cctx.fillText(p.e, 0, 0); }
      else { cctx.fillStyle = p.c; cctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); }
      cctx.restore();
    });
    pieces = pieces.filter((p) => p.y < cf.height + 40 && p.life < 300);
    cfRaf = pieces.length ? requestAnimationFrame(cfTick) : (cctx.clearRect(0, 0, cf.width, cf.height), null);
  }

  /* ---------- 星空 ---------- */
  function initStars() {
    const c = $("#stars"), ctx = c.getContext("2d");
    let stars = [];
    function resize() {
      c.width = innerWidth; c.height = innerHeight;
      stars = Array.from({ length: Math.round(innerWidth * innerHeight / 9000) }, () => ({
        x: Math.random() * c.width, y: Math.random() * c.height, r: Math.random() * 1.3 + .2, p: Math.random() * TAU(), s: Math.random() * .02 + .005,
      }));
    }
    resize(); addEventListener("resize", resize);
    (function tick() {
      ctx.clearRect(0, 0, c.width, c.height);
      stars.forEach((s) => {
        s.p += s.s; ctx.globalAlpha = .25 + Math.sin(s.p) * .25 + .25;
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU()); ctx.fill();
      });
      requestAnimationFrame(tick);
    })();
  }

  /* ---------- 導航 ---------- */
  function initNav() {
    const bar = $("#topbar"), prog = $("#scroll-progress"), nav = $("#nav");
    $("#menu-btn").onclick = () => nav.classList.toggle("open");
    $$("#nav a").forEach((a) => a.addEventListener("click", () => nav.classList.remove("open")));
    const secs = $$("#nav a").map((a) => $(a.getAttribute("href")));
    addEventListener("scroll", () => {
      const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
      prog.style.width = (y / max) * 100 + "%";
      bar.classList.toggle("scrolled", y > 30);
      let idx = -1;
      secs.forEach((s, i) => { if (s && s.offsetTop - 140 <= y) idx = i; });
      $$("#nav a").forEach((a, i) => a.classList.toggle("active", i === idx));
    }, { passive: true });

    const presBtn = $("#pres-btn");
    let slides = [];
    let currentSlide = 0;
    let presView = null;
    let placeholders = [];
    
    const navPrev = $("#pres-prev");
    const navNext = $("#pres-next");
    const navProg = $("#pres-progress");

    if (presBtn) {
      presBtn.onclick = () => {
        const isPres = document.body.classList.toggle("presentation");
        if (isPres) {
          presBtn.innerHTML = "❌ 退出簡報";
          toast("已進入簡報模式：可點擊下方按鈕或使用方向鍵切換");
          
          presView = document.createElement("div");
          presView.id = "pres-view";
          document.body.appendChild(presView);
          
          slides = $$(".hero, .section-head, .theory-block, .roadmap, .tabs, .parts-grid, .hw-grid, .sim-grid, .build, .trouble-grid, .costume-grid, .zone-wrap, .quiz");
          placeholders = [];
          
          slides.forEach((el) => {
            const ph = document.createElement("div");
            ph.className = "pres-placeholder";
            ph.style.display = "none";
            el.parentNode.insertBefore(ph, el);
            placeholders.push(ph);
            
            const slideContainer = document.createElement("div");
            slideContainer.className = "pres-slide";
            slideContainer.appendChild(el);
            presView.appendChild(slideContainer);
          });
          
          currentSlide = 0;
          updatePresView();
        } else {
          presBtn.innerHTML = "📽️ 簡報模式";
          slides.forEach((el, i) => {
            placeholders[i].parentNode.insertBefore(el, placeholders[i]);
            placeholders[i].remove();
          });
          if (presView) presView.remove();
          presView = null;
          slides = [];
          placeholders = [];
        }
      };
    }
    
    function updatePresView() {
      if (presView) {
        presView.style.transform = `translateX(-${currentSlide * 100}vw)`;
        navProg.textContent = `${currentSlide + 1} / ${slides.length}`;
        navPrev.disabled = currentSlide === 0;
        navNext.disabled = currentSlide === slides.length - 1;
      }
    }
    
    if (navPrev && navNext) {
      navPrev.onclick = () => {
        if (currentSlide > 0) { currentSlide--; updatePresView(); }
      };
      navNext.onclick = () => {
        if (currentSlide < slides.length - 1) { currentSlide++; updatePresView(); }
      };
    }
    
    // 簡報模式左右鍵導航
    addEventListener("keydown", (e) => {
      if (!document.body.classList.contains("presentation") || slides.length === 0) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        if (currentSlide < slides.length - 1) {
          currentSlide++;
          updatePresView();
        }
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        if (currentSlide > 0) {
          currentSlide--;
          updatePresView();
        }
      }
    });
  }

  /* ---------- 捲動顯示 + 計數器 ---------- */
  function initReveal() {
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        $$("[data-count]", e.target).forEach(countUp);
        io.unobserve(e.target);
      });
    }, { threshold: .12 });
    $$(".reveal").forEach((el) => io.observe(el));
  }
  function countUp(el) {
    const end = +el.dataset.count, t0 = performance.now(), dur = 1400;
    (function f(t) {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(end * e) + (end === 180 && k === 1 ? "°" : "");
      if (k < 1) requestAnimationFrame(f);
    })(t0);
  }

  /* ---------- Lightbox ---------- */
  function openLb(src, cap) {
    $("#lb-img").src = src; $("#lb-img").alt = cap || ""; $("#lb-cap").textContent = cap || "";
    $("#lightbox").classList.add("open");
  }
  function initLightbox() {
    const lb = $("#lightbox");
    lb.addEventListener("click", (e) => { if (e.target === lb || e.target.id === "lb-close") lb.classList.remove("open"); });
    addEventListener("keydown", (e) => { if (e.key === "Escape") lb.classList.remove("open"); });
    $$(".costume").forEach((c) => c.addEventListener("click", () => openLb(c.dataset.full, $("b", c).textContent)));
  }

  /* ---------- 材料 ---------- */
  function initMaterials() {
    $$(".tabs .chip-btn").forEach((b) => b.addEventListener("click", () => {
      $$(".tabs .chip-btn").forEach((x) => x.classList.toggle("active", x === b));
      $$(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + b.dataset.tab));
    }));
    const got = new Set(store.get("parts", []));
    const grid = $("#parts-grid");
    grid.innerHTML = PARTS.map((p) => `
      <div class="part ${got.has(p.id) ? "got" : ""}" data-id="${p.id}" id="part-${p.id}">
        <div class="part-img"><img src="${IMG + p.img}" alt="${p.name}" loading="lazy"></div>
        <span class="part-check" title="點擊確認">✓</span>
        <span class="part-qty">${p.qty}</span>
        <div class="part-body"><h4>${p.name}</h4><p>${p.desc}</p></div>
      </div>`).join("");
    const upd = () => {
      $("#parts-bar").style.width = (got.size / PARTS.length) * 100 + "%";
      $("#parts-count").textContent = `${got.size} / ${PARTS.length}`;
    };
    upd();
    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".part"); if (!card) return;
      const id = card.dataset.id, p = PARTS.find((x) => x.id === id);
      if (e.target.closest(".part-check")) {
        got.has(id) ? got.delete(id) : got.add(id);
        card.classList.toggle("got", got.has(id));
        store.set("parts", [...got]); upd();
        if (got.size === PARTS.length) { confetti(90); toast("📦 零件全部清點完成！可以開始組裝了"); }
      } else openLb(IMG + p.img, `${p.name} ${p.qty}｜${p.desc}`);
    });
    $("#hw-grid").innerHTML = HARDWARE.map((h) => `
      <div class="hw"><div class="hw-ico">${SVG_ICONS[h.icon]}</div>
      <div><h4>${h.name}<em>${h.qty}</em></h4><p>${h.desc}</p></div></div>`).join("");
  }

  /* ---------- 組裝步驟 ---------- */
  function initBuild() {
    const list = $("#step-list"), view = $("#step-view");
    const done = new Set(store.get("steps", []));
    const subs = store.get("subs", {});
    let cur = Math.min(STEPS.length - 1, done.size);

    STEPS.forEach((s, i) => {
      const b = document.createElement("button");
      b.className = "step-btn"; b.id = "step-btn-" + (i + 1);
      b.innerHTML = `<span class="n"><span>${i + 1}</span></span><span class="t">${s.short}<small>${s.time}</small></span>`;
      b.onclick = () => { cur = i; render(true); };
      list.appendChild(b);
    });

    function ring() {
      const pct = done.size / STEPS.length;
      $("#ring-fg").style.strokeDashoffset = 201 * (1 - pct);
      $("#ring-text").textContent = Math.round(pct * 100) + "%";
      $("#ring-sub").textContent = `${done.size} / ${STEPS.length} 步驟完成`;
      $$(".step-btn").forEach((b, i) => { b.classList.toggle("active", i === cur); b.classList.toggle("done", done.has(i)); });
    }

    function render(scroll) {
      const s = STEPS[cur], key = "s" + cur, ok = new Set(subs[key] || []);
      const stars = "★".repeat(s.diff) + "☆".repeat(5 - s.diff);
      view.innerHTML = `
        <div class="step-anim">
          <div class="step-hero">
            <div class="step-photos ${s.photos.length > 1 ? "two" : ""}">
              ${s.photos.map((p) => `<figure data-src="${IMG + p.src}" data-cap="${p.cap}"><img src="${IMG + p.src}" alt="${p.cap}"><figcaption>${p.cap}</figcaption></figure>`).join("")}
              <span class="zoom-hint">🔍 點擊放大</span>
            </div>
            <div class="step-info">
              <span class="step-kicker">STEP ${String(cur + 1).padStart(2, "0")} / ${String(STEPS.length).padStart(2, "0")}</span>
              <h3>${s.title}</h3>
              <div class="step-meta"><span class="meta-chip">⏱ 約 ${s.time}</span><span class="meta-chip diff">難度 ${stars}</span></div>
              <p class="step-goal">${s.goal}</p>
              <div class="step-tools">${s.tools.map((t) => `<span>🧰 ${t}</span>`).join("")}</div>
            </div>
          </div>
          <div class="step-body">
            <div>
              <h4>📝 詳細步驟 <small style="color:var(--text-3);font-weight:400;font-size:.8rem">（點一下打勾）</small></h4>
              <ol class="howto">${s.howto.map((h, j) => `<li data-j="${j}" class="${ok.has(j) ? "ok" : ""}">${h}</li>`).join("")}</ol>
            </div>
            <div>
              <h4>🚨 一定要注意</h4>
              <div class="alert alert-key"><span class="ai">⚠️</span><div><b>關鍵防呆</b>${s.key}</div></div>
              <div class="alert alert-fail"><span class="ai">💥</span><div><b>沒做好的後果</b>${s.fail}</div></div>
              <div class="alert alert-tip"><span class="ai">💡</span><div><b>老師小叮嚀</b>${s.tip}</div></div>
            </div>
          </div>
          <div class="step-foot">
            <button class="btn btn-ghost btn-sm" id="step-prev" ${cur === 0 ? "disabled style='opacity:.4'" : ""}>← 上一步</button>
            <button class="btn btn-sm btn-done ${done.has(cur) ? "is-done" : ""}" id="step-done">${done.has(cur) ? "✓ 已完成（點擊取消）" : "✅ 我完成了！"}</button>
            <button class="btn btn-ghost btn-sm" id="step-next" ${cur === STEPS.length - 1 ? "disabled style='opacity:.4'" : ""}>下一步 →</button>
          </div>
        </div>`;
      $$(".step-photos figure", view).forEach((f) => f.onclick = () => openLb(f.dataset.src, f.dataset.cap));
      $$(".howto li", view).forEach((li) => li.onclick = () => {
        const j = +li.dataset.j; ok.has(j) ? ok.delete(j) : ok.add(j);
        li.classList.toggle("ok", ok.has(j)); subs[key] = [...ok]; store.set("subs", subs);
      });
      $("#step-prev").onclick = () => { if (cur > 0) { cur--; render(true); } };
      $("#step-next").onclick = () => { if (cur < STEPS.length - 1) { cur++; render(true); } };
      $("#step-done").onclick = () => {
        if (done.has(cur)) { done.delete(cur); store.set("steps", [...done]); render(false); return; }
        done.add(cur); store.set("steps", [...done]);
        if (done.size === STEPS.length) { confetti(220); toast("🎉 全部完成！你的機器人誕生了！前往「創客改造」吧"); render(false); }
        else { confetti(60); toast(`👍 步驟 ${cur + 1} 完成！`); if (cur < STEPS.length - 1) cur++; render(true); }
      };
      ring();
      if (scroll && view.getBoundingClientRect().top < 0) view.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    render(false);
  }

  /* ---------- 故障排除 ---------- */
  function initTrouble() {
    const g = $("#trouble-grid");
    g.innerHTML = TROUBLES.map((t, i) => `
      <div class="acc reveal ${i % 2 ? "d1" : ""}" id="trouble-${i + 1}">
        <button class="acc-head"><span class="q">${t.q}</span><span>${t.t}</span><span class="arrow">▾</span></button>
        <div class="acc-body"><div class="acc-inner">
          ${t.c.map((c) => `<div><span class="lbl c">原因</span><span>${c}</span></div>`).join("")}
          ${t.f.map((f) => `<div><span class="lbl f">解法</span><span>${f}</span></div>`).join("")}
        </div></div>
      </div>`).join("");
    $$(".acc", g).forEach((a) => {
      $(".acc-head", a).onclick = () => {
        const open = !a.classList.contains("open");
        a.classList.toggle("open", open);
        const b = $(".acc-body", a); b.style.maxHeight = open ? b.scrollHeight + "px" : 0;
      };
    });
  }

  /* ---------- 創客改造 ---------- */
  function initMaker() {
    $$(".zone").forEach((z) => z.addEventListener("click", () => {
      $$(".zone").forEach((x) => x.classList.toggle("sel", x === z));
      const d = ZONES[z.dataset.zone], box = $("#zone-info");
      box.innerHTML = `<span class="zone-pill ${d.pill}">${d.label}</span><h4>${d.title}</h4><p style="color:var(--text-2)">${d.text}</p>`;
      box.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 350, easing: "ease-out" });
    }));
    const boxes = $$(".mk"), banner = $("#pass-banner");
    const saved = store.get("maker", []);
    boxes.forEach((b, i) => { b.checked = !!saved[i]; });
    const check = (celebrate) => {
      const all = boxes.every((b) => b.checked);
      if (all && !banner.classList.contains("show") && celebrate) confetti(160);
      banner.classList.toggle("show", all);
      store.set("maker", boxes.map((b) => b.checked));
    };
    boxes.forEach((b) => b.addEventListener("change", () => check(true)));
    check(false);
  }

  /* ---------- 小測驗 ---------- */
  function initQuiz() {
    const box = $("#quiz-box");
    let i = 0, score = 0;
    function render() {
      if (i >= QUIZ.length) return result();
      const q = QUIZ[i];
      box.innerHTML = `
        <div class="quiz-top"><span>第 ${i + 1} / ${QUIZ.length} 題</span><span>得分 <b style="color:var(--orange-2)">${score}</b></span></div>
        <div class="quiz-bar"><i style="width:${(i / QUIZ.length) * 100}%"></i></div>
        <div class="quiz-q">${q.q}</div>
        <div class="quiz-opts">${q.o.map((o, j) => `<button class="opt" data-j="${j}" id="quiz-opt-${j}"><span class="k">${"ABCD"[j]}</span>${o}</button>`).join("")}</div>
        <div class="quiz-exp" id="quiz-exp"></div>
        <div class="quiz-nav"></div>`;
      $$(".opt", box).forEach((b) => b.onclick = () => {
        const j = +b.dataset.j, right = j === q.a;
        if (right) score++;
        $$(".opt", box).forEach((x, k) => { x.disabled = true; if (k === q.a) x.classList.add("right"); });
        if (!right) b.classList.add("wrong");
        const exp = $("#quiz-exp"); exp.innerHTML = (right ? "✅ <b>答對了！</b> " : "❌ <b>再想想～</b> ") + q.e; exp.classList.add("show");
        $(".quiz-nav", box).innerHTML = `<button class="btn btn-primary btn-sm" id="quiz-next">${i === QUIZ.length - 1 ? "看結果 🎃" : "下一題 →"}</button>`;
        $("#quiz-next").onclick = () => { i++; render(); };
        if (right) toast("✨ 答對 +1");
      });
    }
    function result() {
      const full = score === QUIZ.length;
      const title = full ? "🏆 機構大師" : score >= 4 ? "🥈 機構見習生" : "📚 再複習一下";
      const msg = full ? "太厲害了！你完全理解了步行機器人的原理。" : score >= 4 ? "很不錯！回頭看看答錯的題目，就能升級成大師。" : "回到「機構原理」和「動態實驗室」再玩一次，然後重新挑戰吧！";
      box.innerHTML = `<div class="quiz-result"><div class="big">${score} / ${QUIZ.length}</div><h3 style="margin-top:10px;font-size:1.5rem">${title}</h3><p>${msg}</p><button class="btn btn-primary" id="quiz-retry">🔁 再挑戰一次</button></div>`;
      $("#quiz-retry").onclick = () => { i = 0; score = 0; render(); };
      if (full) confetti(220);
    }
    render();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initStars(); initNav(); initMaterials(); initBuild(); initTrouble(); initMaker(); initQuiz(); initLightbox();
    initReveal();
    $$(".flip").forEach((f) => f.addEventListener("click", () => f.classList.toggle("flipped")));
  });
})();
