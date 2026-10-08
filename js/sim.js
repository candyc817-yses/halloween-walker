/* =========================================================
   機構動畫模擬：齒輪、偏心輪、正面重心、側視步行
   ========================================================= */
(function () {
  const TAU = Math.PI * 2;

  /* 高解析度 canvas */
  function hd(canvas) {
    const w = canvas.width, h = canvas.height, dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    return { ctx, w, h };
  }

  /* 只在畫面可見時執行動畫 */
  function loopWhenVisible(el, frame) {
    let visible = false, raf = null, last = performance.now();
    const tick = (t) => {
      const dt = Math.min(50, t - last); last = t;
      frame(dt / 16.67);
      raf = visible ? requestAnimationFrame(tick) : null;
    };
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    }, { threshold: 0.05 }).observe(el);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /* =====================================================
     ① 齒輪比模擬器 (SVG)
     ===================================================== */
  function initGears() {
    const svg = document.getElementById("gear-svg");
    const range = document.getElementById("gear-range");
    if (!svg) return;
    const NS = "http://www.w3.org/2000/svg";
    const m = 5, smallT = 8;
    let ratio = +range.value, angle = 0;

    function gearPath(teeth) {
      const r = (teeth * m) / 2, ro = r + m, ri = r - 1.25 * m, pts = [];
      for (let i = 0; i < teeth; i++) {
        const a = (i / teeth) * TAU, s = TAU / teeth;
        [[ri, a], [ri, a + s * 0.12], [ro, a + s * 0.3], [ro, a + s * 0.5], [ri, a + s * 0.68], [ri, a + s]]
          .forEach(([rad, an]) => pts.push((rad * Math.cos(an)).toFixed(2) + "," + (rad * Math.sin(an)).toFixed(2)));
      }
      return "M" + pts.join("L") + "Z";
    }

    function el(tag, attrs, parent) {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      (parent || svg).appendChild(e); return e;
    }

    let gSmall, gBig, bigT, r1, r2, cx1, cx2;
    const cy = 130;
    function build() {
      svg.innerHTML = "";
      bigT = smallT * ratio;
      r1 = (smallT * m) / 2; r2 = (bigT * m) / 2;
      cx1 = 70; cx2 = cx1 + r1 + r2;
      const shift = Math.max(0, (440 - (cx2 + r2 + m + 20)) / 2);
      cx1 += shift; cx2 += shift;
      // 馬達本體
      el("rect", { x: cx1 - 40, y: cy - 22, width: 32, height: 44, rx: 6, fill: "#3a3350" });
      el("text", { x: cx1 - 24, y: cy + 40, fill: "#8f86a8", "font-size": 11, "text-anchor": "middle" }).textContent = "馬達";
      gBig = el("g", { transform: `translate(${cx2},${cy})` });
      el("path", { d: gearPath(bigT), fill: "#ff7a1a", stroke: "#ffb347", "stroke-width": 1.5 }, gBig);
      el("circle", { r: r2 * 0.55, fill: "#c2560c" }, gBig);
      el("rect", { x: -3, y: -r2 * 0.9, width: 6, height: r2 * 0.6, rx: 3, fill: "#fff1c1" }, gBig);
      el("circle", { r: 7, fill: "#1a1329", stroke: "#fff1c1", "stroke-width": 2 }, gBig);
      gSmall = el("g", { transform: `translate(${cx1},${cy})` });
      el("path", { d: gearPath(smallT), fill: "#60a5fa", stroke: "#bfdbfe", "stroke-width": 1.5 }, gSmall);
      el("rect", { x: -2, y: -r1 + 2, width: 4, height: r1 * 0.7, rx: 2, fill: "#fff" }, gSmall);
      el("circle", { r: 4, fill: "#1a1329" }, gSmall);
      el("text", { x: cx1, y: cy + r1 + 28, fill: "#93c5fd", "font-size": 12, "text-anchor": "middle", "font-weight": 700 }).textContent = `小齒輪 ${smallT} 齒`;
      el("text", { x: cx2, y: Math.min(252, cy + r2 + 20), fill: "#ffb347", "font-size": 12, "text-anchor": "middle", "font-weight": 700 }).textContent = `大齒輪 ${bigT} 齒（輸出）`;
      // 數據
      document.getElementById("m-ratio").textContent = `1 : ${ratio}`;
      document.getElementById("m-speed").textContent = `${Math.round(100 / ratio)}%`;
      document.getElementById("m-torque").textContent = `×${ratio}`;
      document.getElementById("mb-speed").style.width = 100 / ratio + "%";
      document.getElementById("mb-torque").style.width = (ratio / 5) * 100 + "%";
    }
    range.addEventListener("input", () => { ratio = +range.value; build(); });
    build();
    loopWhenVisible(svg, (k) => {
      angle += 0.06 * k;
      const a1 = angle * 180 / Math.PI;
      const a2 = -a1 / ratio + 180 / bigT + 180;
      gSmall.setAttribute("transform", `translate(${cx1},${cy}) rotate(${a1})`);
      gBig.setAttribute("transform", `translate(${cx2},${cy}) rotate(${a2})`);
    });
  }

  /* =====================================================
     ② 偏心輪軌跡 (Canvas)
     ===================================================== */
  function initCam() {
    const canvas = document.getElementById("cam-canvas");
    if (!canvas) return;
    const { ctx, w, h } = hd(canvas);
    const range = document.getElementById("ecc-range"), out = document.getElementById("ecc-val");
    let ecc = +range.value, th = 0;
    const hist = [];
    range.addEventListener("input", () => { ecc = +range.value; out.textContent = ecc + " px"; hist.length = 0; });
    const C = { x: 120, y: 175 }, S = { x: 120, y: 52 }, R = 58, Lb = 70;

    loopWhenVisible(canvas, (k) => {
      th += 0.035 * k;
      ctx.clearRect(0, 0, w, h);
      // 地面格線
      ctx.strokeStyle = "rgba(167,139,250,.08)"; ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 26) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }

      const P = { x: C.x + Math.cos(th) * ecc, y: C.y + Math.sin(th) * ecc };
      // 輪子
      ctx.save(); ctx.translate(C.x, C.y); ctx.rotate(th);
      ctx.fillStyle = "#22c55e"; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
      ctx.fillStyle = "#16a34a"; ctx.beginPath(); ctx.arc(0, 0, R * 0.62, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(R * .65, 0); ctx.lineTo(R * .95, 0); ctx.stroke(); ctx.rotate(TAU / 6); }
      ctx.restore();
      // 軌跡圓
      ctx.setLineDash([4, 5]); ctx.strokeStyle = "rgba(255,179,71,.7)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(C.x, C.y, ecc, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      // 中心軸
      ctx.fillStyle = "#0b0812"; ctx.beginPath(); ctx.arc(C.x, C.y, 6, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
      // 連桿
      const dx = P.x - S.x, dy = P.y - S.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
      const F = { x: P.x + ux * Lb, y: P.y + uy * Lb };
      const A = { x: S.x - ux * 40, y: S.y - uy * 40 };
      ctx.strokeStyle = "#e3c9a3"; ctx.lineWidth = 10; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(F.x, F.y); ctx.stroke();
      ctx.strokeStyle = "#a3e635"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(F.x, F.y); ctx.stroke();
      // 肩膀支點
      ctx.fillStyle = "#ef4444"; roundRect(ctx, S.x - 16, S.y - 9, 32, 18, 5); ctx.fill();
      ctx.fillStyle = "#fecaca"; ctx.font = "11px Noto Sans TC"; ctx.textAlign = "center"; ctx.fillText("肩膀支點", S.x, S.y - 16);
      // 偏心孔
      ctx.fillStyle = "#ef4444"; ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(P.x, P.y, 7, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
      // 腳
      ctx.fillStyle = "#a3e635"; roundRect(ctx, F.x - 22, F.y - 4, 44, 8, 3); ctx.fill();

      // 右側波形
      const gx0 = 250, gx1 = w - 20, gy = 165;
      hist.push(F.x - C.x);
      if (hist.length > gx1 - gx0) hist.shift();
      ctx.strokeStyle = "rgba(255,255,255,.15)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(gx0, gy); ctx.lineTo(gx1, gy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(gx0, 40); ctx.lineTo(gx0, 290); ctx.stroke();
      ctx.fillStyle = "#8f86a8"; ctx.font = "11px Noto Sans TC"; ctx.textAlign = "left";
      ctx.fillText("腳往前 ↑", gx0 + 6, 52); ctx.fillText("腳往後 ↓", gx0 + 6, 284);
      ctx.fillText("時間 →", gx1 - 40, gy - 8);
      ctx.strokeStyle = "#ffb347"; ctx.lineWidth = 2.5; ctx.beginPath();
      for (let i = 0; i < hist.length; i++) {
        const x = gx1 - (hist.length - 1 - i), y = gy - hist[i] * 2.2;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      // 連接虛線
      ctx.setLineDash([3, 4]); ctx.strokeStyle = "rgba(163,230,53,.5)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(F.x, F.y); ctx.lineTo(gx1, gy - (F.x - C.x) * 2.2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#a3e635"; ctx.beginPath(); ctx.arc(gx1, gy - (F.x - C.x) * 2.2, 5, 0, TAU); ctx.fill();
    });
  }

  /* =====================================================
     ③ 正面重心觀察 (Canvas)
     ===================================================== */
  function initFront() {
    const canvas = document.getElementById("front-canvas");
    if (!canvas) return;
    const { ctx, w, h } = hd(canvas);
    let th = 0;
    const ground = 270, cx = w / 2;

    loopWhenVisible(canvas, (k) => {
      th += 0.03 * k;
      const s = Math.sin(th);
      const liftL = Math.max(0, -s) * 22, liftR = Math.max(0, s) * 22;
      const tilt = s * 0.11; // 身體往支撐腳傾斜
      ctx.clearRect(0, 0, w, h);

      // 地面
      const g = ctx.createLinearGradient(0, ground, 0, h);
      g.addColorStop(0, "#3b2f52"); g.addColorStop(1, "#120d1d");
      ctx.fillStyle = g; ctx.fillRect(0, ground, w, h - ground);
      ctx.strokeStyle = "#6d5a92"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, ground); ctx.lineTo(w, ground); ctx.stroke();

      const feet = [
        { x: cx - 70, lift: liftL, name: "左腳", c: "#a3e635" },
        { x: cx + 70, lift: liftR, name: "右腳", c: "#a78bfa" },
      ];
      // 腳 & 腿
      feet.forEach((f) => {
        const support = f.lift < 2;
        const fy = ground - 10 - f.lift;
        if (support) { ctx.fillStyle = "rgba(255,122,26,.35)"; ctx.beginPath(); ctx.ellipse(f.x, ground + 4, 70, 9, 0, 0, TAU); ctx.fill(); }
        ctx.fillStyle = support ? "#ff7a1a" : f.c;
        roundRect(ctx, f.x - 55, fy, 110, 12, 4); ctx.fill();
        ctx.strokeStyle = "#e3c9a3"; ctx.lineWidth = 14; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(f.x, fy); ctx.lineTo(cx + (f.x - cx) * 0.55, 150); ctx.stroke();
        ctx.fillStyle = support ? "#ffb347" : "#c9c2dc"; ctx.font = "bold 12px Noto Sans TC"; ctx.textAlign = "center";
        ctx.fillText(support ? f.name + "（支撐）" : f.name + "（抬起）", f.x, ground + 26);
      });

      // 身體
      ctx.save(); ctx.translate(cx, 175); ctx.rotate(tilt);
      ctx.fillStyle = "#ef4444"; roundRect(ctx, -95, -95, 190, 16, 6); ctx.fill(); // 紅套管
      ctx.fillStyle = "#e3c9a3"; roundRect(ctx, -40, -110, 80, 130, 10); ctx.fill();
      ctx.fillStyle = "#22c55e"; ctx.beginPath(); ctx.arc(-52, 0, 16, 0, TAU); ctx.arc(52, 0, 16, 0, TAU); ctx.fill();
      // 頭
      ctx.fillStyle = "#d9b98c"; roundRect(ctx, -55, -200, 110, 90, 8); ctx.fill();
      ctx.fillStyle = "#1a1329"; ctx.beginPath(); ctx.arc(-20, -165, 9, 0, TAU); ctx.arc(20, -165, 9, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -138, 16, 0, Math.PI); ctx.fill();
      // 手臂
      ctx.strokeStyle = "#cfae80"; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(-95, -88); ctx.lineTo(-100 - s * 6, -20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(95, -88); ctx.lineTo(100 - s * 6, -20); ctx.stroke();
      ctx.restore();

      // 重心
      const cogX = cx + Math.sin(tilt) * 110 + s * 30, cogY = 150;
      ctx.setLineDash([5, 5]); ctx.strokeStyle = "rgba(239,68,68,.8)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cogX, cogY); ctx.lineTo(cogX, ground); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#ef4444"; ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(cogX, cogY, 9, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = "#fecaca"; ctx.font = "bold 12px Noto Sans TC"; ctx.fillText("重心", cogX, cogY - 16);
      ctx.beginPath(); ctx.moveTo(cogX - 6, ground - 10); ctx.lineTo(cogX + 6, ground - 10); ctx.lineTo(cogX, ground); ctx.fillStyle = "#ef4444"; ctx.fill();
    });
  }

  /* =====================================================
     ④ 側視步行機構實驗室 (Canvas)
     ===================================================== */
  function initWalker() {
    const canvas = document.getElementById("walker-canvas");
    if (!canvas) return;
    const { ctx, w, h } = hd(canvas);
    const speedEl = document.getElementById("sim-speed");
    const playBtn = document.getElementById("sim-play");
    const slowBtn = document.getElementById("sim-step");
    const traceBtn = document.getElementById("sim-trace");
    const warn = document.getElementById("sim-warning");
    const explain = document.getElementById("sim-explain");
    let running = true, slow = false, trace = true, phase = Math.PI, th = 0, tilt = 0, scroll = 0;
    const trails = [[], []];

    const GROUND = 380, cx = 300;
    const S = { x: cx, y: 128 }, C = { x: cx, y: 216 }, r = 22, Lb = 142, La = 95;

    playBtn.onclick = () => { running = !running; playBtn.textContent = running ? "⏸ 暫停" : "▶ 播放"; playBtn.classList.toggle("active", running); };
    slowBtn.onclick = () => { slow = !slow; slowBtn.classList.toggle("active", slow); };
    traceBtn.onclick = () => { trace = !trace; traceBtn.classList.toggle("active", trace); trails[0].length = trails[1].length = 0; };
    document.querySelectorAll("#phase-btns button").forEach((b) => {
      b.onclick = () => {
        document.querySelectorAll("#phase-btns button").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        phase = (+b.dataset.phase * Math.PI) / 180;
        trails[0].length = trails[1].length = 0; tilt = 0;
      };
    });

    function legGeom(a) {
      const P = { x: C.x + Math.cos(a) * r, y: C.y + Math.sin(a) * r };
      const dx = P.x - S.x, dy = P.y - S.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
      return { P, F: { x: P.x + ux * Lb, y: P.y + uy * Lb }, A: { x: S.x - ux * La, y: S.y - uy * La }, ang: Math.atan2(ux, uy) };
    }

    function drawLeg(g, color, alpha, maxY) {
      ctx.globalAlpha = alpha;
      // 手臂（上方延伸）
      ctx.strokeStyle = "#cfae80"; ctx.lineWidth = 12; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(S.x, S.y); ctx.lineTo(g.A.x, g.A.y); ctx.stroke();
      // 腿
      ctx.strokeStyle = "#e3c9a3"; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.moveTo(S.x, S.y); ctx.lineTo(g.F.x, g.F.y); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(g.A.x, g.A.y); ctx.lineTo(g.F.x, g.F.y); ctx.stroke();
      // 腳掌
      const support = maxY - g.F.y < 5;
      ctx.save(); ctx.translate(g.F.x, g.F.y);
      if (support) { ctx.shadowColor = "#ff7a1a"; ctx.shadowBlur = 18; }
      ctx.fillStyle = support ? "#ff7a1a" : color;
      roundRect(ctx, -58, -2, 116, 12, 4); ctx.fill();
      ctx.restore();
      // 偏心孔
      ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(g.P.x, g.P.y, 6, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      return support;
    }

    let lastExplain = "";
    function setExplain(html) { if (html !== lastExplain) { explain.innerHTML = html; lastExplain = html; } }

    loopWhenVisible(canvas, (k) => {
      const sp = +speedEl.value * (slow ? 0.25 : 1);
      if (running) { th -= 0.025 * sp * k; scroll = (scroll + 40 - 0.6 * sp * k * (phase > 3 ? 1 : 0.2)) % 40; }
      const gL = legGeom(th), gR = legGeom(th + phase);
      // 身體下沉，讓最低的那隻腳踩在地面上
      const maxY = Math.max(gL.F.y, gR.F.y), drop = GROUND - maxY;

      // 0°：雙腳同時往後蹬 → 身體往前倒；90°：前後晃動
      const back = Math.max(0, (gL.F.x - cx) / 40);
      const targetTilt = phase < 0.1 ? Math.min(0.5, back) : phase < 2 ? Math.max(0, Math.sin(th * 2)) * 0.1 : 0;
      tilt += (targetTilt - tilt) * 0.08 * k;

      ctx.clearRect(0, 0, w, h);
      // 背景格線 & 地面
      ctx.strokeStyle = "rgba(167,139,250,.07)"; ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, GROUND); ctx.stroke(); }
      const gg = ctx.createLinearGradient(0, GROUND, 0, h);
      gg.addColorStop(0, "#3b2f52"); gg.addColorStop(1, "#0e0a17");
      ctx.fillStyle = gg; ctx.fillRect(0, GROUND + 10, w, h - GROUND);
      ctx.strokeStyle = "#6d5a92"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, GROUND + 10); ctx.lineTo(w, GROUND + 10); ctx.stroke();
      ctx.strokeStyle = "rgba(109,90,146,.6)";
      for (let x = -scroll; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, GROUND + 10); ctx.lineTo(x - 12, h); ctx.stroke(); }
      ctx.fillStyle = "#8f86a8"; ctx.font = "12px Noto Sans TC"; ctx.textAlign = "left";
      ctx.fillText("← 前進方向", 20, GROUND + 30);

      ctx.save();
      // 以前腳掌前緣為支點傾倒
      ctx.translate(cx - 120, GROUND + 10); ctx.rotate(-tilt); ctx.translate(-(cx - 120), -(GROUND + 10));
      ctx.translate(0, drop);

      // 軌跡（以機身為參考座標）
      if (trace && running) {
        trails[0].push({ x: gL.F.x, y: gL.F.y }); trails[1].push({ x: gR.F.x, y: gR.F.y });
        trails.forEach((t) => { if (t.length > 160) t.shift(); });
      }
      if (trace) {
        [["rgba(163,230,53,.55)", trails[0]], ["rgba(167,139,250,.55)", trails[1]]].forEach(([c, t]) => {
          ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.setLineDash([2, 4]); ctx.beginPath();
          t.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y + 4) : ctx.moveTo(p.x, p.y + 4)));
          ctx.stroke(); ctx.setLineDash([]);
        });
      }

      // 後面那隻腳（右）較淡
      const supR = drawLeg(gR, "#a78bfa", 0.75, maxY);

      // 機身
      ctx.fillStyle = "#3a2f4f"; roundRect(ctx, cx - 70, 196, 140, 44, 6); ctx.fill(); // 隔板
      ctx.fillStyle = "#facc15"; roundRect(ctx, cx - 10, 200, 90, 32, 5); ctx.fill(); // 馬達
      ctx.fillStyle = "#d1d5db"; roundRect(ctx, cx + 78, 205, 22, 22, 4); ctx.fill();
      ctx.fillStyle = "#e3c9a3"; roundRect(ctx, cx - 34, 70, 68, 196, 12); ctx.fill(); // 主機身板
      ctx.fillStyle = "rgba(120,80,40,.55)"; ctx.font = "bold 15px Noto Sans TC"; ctx.textAlign = "center";
      "搖頭晃腦".split("").forEach((ch, i) => ctx.fillText(ch, cx, 104 + i * 22));
      // 頭
      ctx.fillStyle = "#d9b98c"; roundRect(ctx, cx - 58, 4, 116, 70, 8); ctx.fill();
      ctx.fillStyle = "#1a1329"; ctx.beginPath(); ctx.arc(cx - 34, 30, 7, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(cx - 46, 50, 10, 0, Math.PI); ctx.fill();
      // 偏心輪
      ctx.save(); ctx.translate(C.x, C.y); ctx.rotate(th);
      ctx.fillStyle = "#22c55e"; ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.fill();
      ctx.fillStyle = "#16a34a"; ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#0b0812"; ctx.beginPath(); ctx.arc(C.x, C.y, 5, 0, TAU); ctx.fill();
      // 肩膀套管
      ctx.fillStyle = "#ef4444"; ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(S.x, S.y, 13, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = "#9ca3af"; ctx.beginPath(); ctx.arc(S.x, S.y, 4, 0, TAU); ctx.fill();

      const supL = drawLeg(gL, "#a3e635", 1, maxY);
      ctx.restore();

      // 狀態
      const pDeg = Math.round((phase * 180) / Math.PI);
      warn.classList.toggle("show", pDeg === 0 && tilt > 0.2);
      const who = supL && supR ? (pDeg === 0 ? "<span style='color:#f43f5e'>雙腳同時（無法交替）</span>" : "雙腳（交換中）") : supL ? "左腳（綠）" : "右腳（紫）";
      let msg;
      if (pDeg === 180) msg = `<b>正確設定 180°：</b>左右腳輪流著地，一腳撐地、另一腳往前跨，重心可以順利轉移，所以能穩定前進。`;
      else if (pDeg === 90) msg = `<b>相位 90°：</b>雙腳節奏錯開不夠，支撐腳交換得太急，身體前後晃動、一跛一跛，前進效率很差。`;
      else msg = `<b>錯誤設定 0°：</b>兩隻腳同時抬起、同時落下，像兔子跳。重心沒有地方轉移，機器人往前撲倒！`;
      setExplain(msg + `<br><span style="color:var(--text-3)">目前支撐腳：</span>${who}`);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initGears(); initCam(); initFront(); initWalker();
  });
})();
