/* ==========================================================================
   QIANMI // MOSS SYSTEM — 交互脚本 v5 (BLACK TERMINAL)
   - 碎片场生成（闪电折线 + 细长三角 + 散列楔形 + 对角宽梁 + 水平刻度线）
   - 故障字图层注入
   - 滚动揭示 / 技能条 / 导航 / 文章筛选
   ========================================================================== */
(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var NEON = "#00ff41";
  var REDUCED =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 工具 ---------- */

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function node(name, attrs) {
    var n = document.createElementNS(SVG_NS, name);
    if (attrs) {
      for (var k in attrs) {
        if (attrs[k] !== null && attrs[k] !== undefined) {
          n.setAttribute(k, attrs[k]);
        }
      }
    }
    return n;
  }

  function pts(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      out.push(list[i][0].toFixed(1) + "," + list[i][1].toFixed(1));
    }
    return out.join(" ");
  }

  /* ---------- 碎片场 v5：闪电 / 细三角 / 楔形 ---------- */

  var FIELD_W = 1600;
  var FIELD_H = 1000;

  /*
   * 闪电：中轴按 stops 折线摆动（zig 为各节点横向偏移），
   * 宽度从根部渐缩到尖端收 0，形成折角锐利的闪电剪影。
   */
  function bolt(rnd, bx, by, ang, len, w0, kink) {
    var dx = Math.cos(ang);
    var dy = Math.sin(ang);
    var nx = -dy;
    var ny = dx;

    var stops = [0, 0.26, 0.5, 0.74, 1];
    var zig = [0, kink, -kink * 0.8, kink * 0.55, 0];
    var spine = [];
    var i, t, half;

    for (i = 0; i < stops.length; i++) {
      t = stops[i] + (rnd() - 0.5) * 0.05;
      spine.push([
        bx + dx * len * t + nx * zig[i],
        by + dy * len * t + ny * zig[i]
      ]);
    }

    var outline = [];
    /* 右侧边（根 → 尖） */
    for (i = 0; i < spine.length - 1; i++) {
      half = w0 * (1 - stops[i]) * (0.7 + rnd() * 0.5);
      outline.push([spine[i][0] + nx * half, spine[i][1] + ny * half]);
    }
    /* 尖端收成一点 */
    outline.push([spine[spine.length - 1][0], spine[spine.length - 1][1]]);
    /* 左侧边（尖 → 根） */
    for (i = spine.length - 2; i >= 0; i--) {
      half = w0 * (1 - stops[i]) * (0.7 + rnd() * 0.5);
      outline.push([spine[i][0] - nx * half, spine[i][1] - ny * half]);
    }

    return outline;
  }

  /* 细长三角：极窄长针，尖端轻微偏斜 */
  function sliver(rnd, bx, by, ang, len, w) {
    var dx = Math.cos(ang);
    var dy = Math.sin(ang);
    var nx = -dy;
    var ny = dx;
    var tip = (rnd() - 0.5) * w * 2.4;
    return [
      [bx + nx * w, by + ny * w],
      [bx - nx * w, by - ny * w],
      [bx + dx * len + nx * tip, by + dy * len + ny * tip]
    ];
  }

  /* 楔形：底边两侧长度不等，起点与终点分离 */
  function wedge(rnd, bx, by, ang, len, w) {
    var dx = Math.cos(ang);
    var dy = Math.sin(ang);
    var nx = -dy;
    var ny = dx;
    var a = w * (0.5 + rnd() * 0.9);
    var b = w * (0.25 + rnd() * 0.7);
    return [
      [bx + nx * a, by + ny * a],
      [bx - nx * b, by - ny * b],
      [bx + dx * len, by + dy * len]
    ];
  }

  /* 四点矩形：从 (ox,oy) 沿 (dx,dy) 延伸 len，半宽 half */
  function rect4(ox, oy, dx, dy, nx, ny, len, half) {
    return [
      [ox + nx * half, oy + ny * half],
      [ox - nx * half, oy - ny * half],
      [ox + dx * len - nx * half, oy + dy * len - ny * half],
      [ox + dx * len + nx * half, oy + dy * len + ny * half]
    ];
  }

  /*
   * 分层网格散布：把画布切成 cols×rows 格，每格取抖动后的中心点再洗牌。
   * 保证元素起点均匀铺满画面，而不是聚成一团。
   */
  function scatter(rnd, cols, rows, jitter) {
    var out = [];
    var i, j;
    for (i = 0; i < cols; i++) {
      for (j = 0; j < rows; j++) {
        out.push({
          x: (i + 0.5 + (rnd() - 0.5) * jitter) / cols,
          y: (j + 0.5 + (rnd() - 0.5) * jitter) / rows
        });
      }
    }
    for (i = out.length - 1; i > 0; i--) {
      j = Math.floor(rnd() * (i + 1));
      var tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function shardField(svg, options) {
    var o = {
      seed: 11,
      focal: { x: 0.72, y: 0.3 },
      flow: -155,              /* 主飞散方向（度）：默认朝左下 */
      density: 1.0,
      beams: 2,                /* 对角宽梁数量 */
      contrast: 0.5,           /* 楔形碎片强度 */
      greenRatio: 0.3          /* 绿色占比 */
    };
    if (options) {
      for (var k in options) o[k] = options[k];
    }

    svg.setAttribute("viewBox", "0 0 " + FIELD_W + " " + FIELD_H);
    svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    var rnd = mulberry32(o.seed);
    var W = FIELD_W;
    var H = FIELD_H;
    var flow = o.flow * Math.PI / 180;

    /* 调色：白为主体 + 荧光绿点缀 + 暗灰剪影 */
    var main = "#ffffff";
    var deep = "rgba(255,255,255,0.2)";
    var mid = "rgba(255,255,255,0.4)";
    var contrast = NEON;
    var seam = "#000000";

    var root = node("g", {});

    /* ---------- 第 0 层：氛围雾块（大而极淡，压住背景） ---------- */
    for (var m0 = 0; m0 < 2; m0++) {
      var mx = (0.22 + rnd() * 0.56) * W;
      var my = (0.16 + rnd() * 0.68) * H;
      var mw = W * (0.36 + rnd() * 0.3);
      var mh = H * (0.26 + rnd() * 0.3);
      root.appendChild(
        node("polygon", {
          points: pts([
            [mx - mw / 2, my - mh / 2],
            [mx + mw / 2, my - mh / 2 + mh * 0.22],
            [mx + mw / 2 - mw * 0.14, my + mh / 2],
            [mx - mw / 2 + mw * 0.1, my + mh / 2 - mh * 0.18]
          ]),
          fill: "rgba(255,255,255,0.03)",
          transform: "rotate(" + (o.flow + (rnd() - 0.5) * 26) + " " + mx + " " + my + ")"
        })
      );
    }

    /* ---------- 第 1 层：闪电（主视觉，起点在焦点周围大幅铺开） ---------- */
    var boltN = 4 + Math.floor(rnd() * 3);
    for (var b = 0; b < boltN; b++) {
      var bx = (o.focal.x + (rnd() - 0.5) * 1.0) * W;
      var by = (o.focal.y + (rnd() - 0.5) * 0.9) * H;
      var bAng = flow + (rnd() - 0.5) * 0.7;
      var bLen = (0.24 + Math.pow(rnd(), 1.4) * 0.42) * W * 0.72;
      var bW = 8 + rnd() * 16;
      var outline = bolt(rnd, bx, by, bAng, bLen, bW, 16 + rnd() * 40);

      /* 剪影底层：向右下偏移，制造纸雕厚度 */
      root.appendChild(
        node("polygon", {
          points: pts(outline),
          fill: deep,
          opacity: 0.45,
          transform: "translate(" + (7 + rnd() * 7) + "," + (6 + rnd() * 6) + ")"
        })
      );
      /* 主层：白为主，按 greenRatio 混入荧光绿 */
      root.appendChild(
        node("polygon", {
          points: pts(outline),
          fill: rnd() < o.greenRatio ? NEON : main,
          opacity: 0.9
        })
      );
    }

    /* ---------- 第 2 层：细三角针群（分层网格散布，低视觉重量） ---------- */
    var sPts = scatter(rnd, 8, 5, 0.92);
    var sliverN = Math.min(sPts.length, Math.round(26 * o.density));
    for (var s = 0; s < sliverN; s++) {
      var sp = sPts[s];
      var sAng = flow + (rnd() - 0.5) * 0.62;
      var sLen = (0.06 + Math.pow(rnd(), 1.7) * 0.34) * W * 0.72;
      var sW = 1.4 + rnd() * 5;
      var sx = sp.x * W;
      var sy = sp.y * H;

      root.appendChild(
        node("polygon", {
          points: pts(sliver(rnd, sx, sy, sAng, sLen, sW)),
          fill: rnd() < o.greenRatio * 0.8 ? NEON : (rnd() < 0.72 ? main : mid),
          opacity: 0.5 + rnd() * 0.45
        })
      );
      /* 少量补一层暗剪影，避免整层过于扁平 */
      if (rnd() < 0.22) {
        root.appendChild(
          node("polygon", {
            points: pts(sliver(rnd, sx + 6, sy + 6, sAng, sLen, sW)),
            fill: deep,
            opacity: 0.4
          })
        );
      }
    }

    /* ---------- 第 3 层：楔形（起点散布，终点随长度自然拉开） ---------- */
    var wPts = scatter(rnd, 6, 4, 0.95);
    var wedgeN = Math.min(wPts.length, Math.round(9 * o.contrast * o.density * 2));
    for (var w2 = 0; w2 < wedgeN; w2++) {
      var wp = wPts[w2];
      root.appendChild(
        node("polygon", {
          points: pts(
            wedge(
              rnd,
              wp.x * W,
              wp.y * H,
              flow + (rnd() - 0.5) * 0.9,
              (0.1 + Math.pow(rnd(), 1.5) * 0.4) * W * 0.7,
              4 + Math.pow(rnd(), 1.6) * 22
            )
          ),
          fill: rnd() < 0.55 ? contrast : main,
          opacity: 0.42 + rnd() * 0.4
        })
      );
    }

    /* ---------- 第 4 层：对角宽梁（细而干净，贯穿画面） ---------- */
    for (var bm = 0; bm < o.beams; bm++) {
      var bwm = 16 + rnd() * 34;
      var bmAng = flow + (rnd() - 0.5) * 0.12;
      var bmdx = Math.cos(bmAng);
      var bmdy = Math.sin(bmAng);
      var bmnx = -bmdy;
      var bmny = bmdx;
      var bmLen = W * 1.8;
      var x0 = o.focal.x * W - bmdx * bmLen * (0.25 + rnd() * 0.35) + (rnd() - 0.5) * 120;
      var y0 = o.focal.y * H - bmdy * bmLen * (0.25 + rnd() * 0.35) + (rnd() - 0.5) * 120;
      var isGreen = rnd() < 0.6;

      /* 勾边：绿色梁配白边，白色梁配淡白边 */
      root.appendChild(
        node("polygon", {
          points: pts(rect4(x0, y0, bmdx, bmdy, bmnx, bmny, bmLen, bwm / 2 + 2.5)),
          fill: isGreen ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)",
          opacity: 0.6
        })
      );
      /* 主梁面 */
      root.appendChild(
        node("polygon", {
          points: pts(rect4(x0, y0, bmdx, bmdy, bmnx, bmny, bmLen, bwm / 2)),
          fill: isGreen ? NEON : main,
          opacity: 0.92
        })
      );

      /* 梁末端飞散微粒（少量，避免画面发噪） */
      var ex = x0 + bmdx * bmLen * (0.6 + rnd() * 0.15);
      var ey = y0 + bmdy * bmLen * (0.6 + rnd() * 0.15);
      for (var d = 0; d < 6; d++) {
        var dAng = bmAng + (rnd() - 0.5) * 1.4;
        var dDist = 20 + Math.pow(rnd(), 1.4) * 180;
        var ds = 2 + rnd() * 7;
        var dx0 = ex + Math.cos(dAng) * dDist;
        var dy0 = ey + Math.sin(dAng) * dDist;
        root.appendChild(
          node("polygon", {
            points: pts([
              [dx0, dy0 - ds],
              [dx0 + ds * 0.85, dy0 + ds * 0.6],
              [dx0 - ds * 0.85, dy0 + ds * 0.6]
            ]),
            fill: rnd() < 0.65 ? NEON : main,
            opacity: 0.35 + rnd() * 0.45,
            transform:
              "rotate(" + (dAng * 180 / Math.PI + 90) + " " + dx0 + " " + dy0 + ")"
          })
        );
      }
    }

    /* ---------- 第 5 层：切缝（底色楔形，切出断裂感） ---------- */
    var seamPts = scatter(rnd, 4, 3, 1.0);
    var seamN = Math.min(seamPts.length, Math.round(6 * o.density));
    for (var sm = 0; sm < seamN; sm++) {
      var sp3 = seamPts[sm];
      root.appendChild(
        node("polygon", {
          points: pts(
            sliver(
              rnd,
              sp3.x * W,
              sp3.y * H,
              flow + (rnd() - 0.5) * 0.35,
              140 + rnd() * 380,
              2.5 + rnd() * 6
            )
          ),
          fill: seam,
          opacity: 0.9
        })
      );
    }

    /* ---------- 第 6 层：水平细线组（横贯 + 刻度齿） ---------- */
    for (var r = 0; r < 2; r++) {
      var ry = H * (0.16 + r * 0.5 + rnd() * 0.12);
      var rCol = "rgba(255,255,255,0.7)";
      var rOp = 0.45 + rnd() * 0.3;
      root.appendChild(
        node("line", {
          x1: -20, y1: ry, x2: W + 20, y2: ry,
          stroke: rCol, "stroke-width": 1, opacity: rOp
        })
      );
      /* 刻度齿：线的一端均匀短竖齿 */
      var tickN = 14 + Math.floor(rnd() * 12);
      var tickFrom = rnd() > 0.5;
      var tx0 = tickFrom ? W * (0.66 + rnd() * 0.16) : W * (0.05 + rnd() * 0.1);
      for (var tk = 0; tk < tickN; tk++) {
        var tx = tx0 + tk * (6 + rnd() * 3);
        var th2 = 4 + rnd() * 7;
        root.appendChild(
          node("line", {
            x1: tx, y1: ry, x2: tx, y2: ry - th2,
            stroke: rCol, "stroke-width": 1.3, opacity: rOp
          })
        );
      }
    }

    /* ---------- 第 7 层：十字标记 ---------- */
    var crossN = 6 + Math.floor(rnd() * 4);
    for (var cr = 0; cr < crossN; cr++) {
      var cx2 = rnd() * W;
      var cy2 = rnd() * H;
      var cs = 4 + rnd() * 11;
      var cCol = rnd() > 0.5 ? "#ffffff" : NEON;
      var cOp = 0.3 + rnd() * 0.4;
      root.appendChild(
        node("line", {
          x1: cx2 - cs, y1: cy2, x2: cx2 + cs, y2: cy2,
          stroke: cCol, "stroke-width": 1.2, opacity: cOp
        })
      );
      root.appendChild(
        node("line", {
          x1: cx2, y1: cy2 - cs, x2: cx2, y2: cy2 + cs,
          stroke: cCol, "stroke-width": 1.2, opacity: cOp
        })
      );
    }

    svg.appendChild(root);

    /* 滚动视差 */
    if (!REDUCED) {
      var ticking = false;
      var onScroll = function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () {
          var y = window.pageYOffset || document.documentElement.scrollTop;
          var shift = Math.min(y, 1100) * 0.07;
          svg.style.transform = "translate3d(0," + shift + "px,0) scale(1.05)";
          ticking = false;
        });
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }
  }

  /* ---------- 故障字图层 ---------- */

  function initGlitch() {
    var targets = document.querySelectorAll("[data-glitch]");
    Array.prototype.forEach.call(targets, function (host) {
      var text = host.getAttribute("data-glitch") || host.textContent;
      if (!host.classList.contains("glitch")) host.classList.add("glitch");
      ["a", "b"].forEach(function (variant) {
        var layer = document.createElement("span");
        layer.className = "glitch__layer glitch__layer--" + variant;
        layer.setAttribute("aria-hidden", "true");
        layer.textContent = text;
        host.appendChild(layer);
      });
    });
  }

  /* ---------- 滚动揭示 ---------- */

  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || REDUCED) {
      Array.prototype.forEach.call(items, function (n) {
        n.classList.add("is-in");
      });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var delay = entry.target.getAttribute("data-delay") || 0;
          setTimeout(function () {
            entry.target.classList.add("is-in");
          }, parseInt(delay, 10));
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
    );
    Array.prototype.forEach.call(items, function (n) {
      io.observe(n);
    });
  }

  /* ---------- 技能条 ---------- */

  function initSkills() {
    var fills = document.querySelectorAll(".skill__fill");
    if (!fills.length) return;
    if (!("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(fills, function (f) {
        f.classList.add("is-in");
      });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.5 }
    );
    Array.prototype.forEach.call(fills, function (f) {
      io.observe(f);
    });
  }

  /* ---------- 导航 ---------- */

  function initNav() {
    var nav = document.querySelector(".nav");
    if (!nav) return;

    var toggle = nav.querySelector(".nav__toggle");
    var links = nav.querySelector(".nav__links");

    var onScroll = function () {
      if (window.pageYOffset > 24) nav.classList.add("is-stuck");
      else nav.classList.remove("is-stuck");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    if (toggle && links) {
      toggle.addEventListener("click", function () {
        var open = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
      links.addEventListener("click", function (e) {
        if (e.target.closest("a")) {
          nav.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
        }
      });
    }
  }

  /* ---------- 文章筛选 ---------- */

  function initFilters() {
    var bar = document.querySelector("[data-filters]");
    if (!bar) return;
    var cards = document.querySelectorAll("[data-cat]");

    bar.addEventListener("click", function (e) {
      var btn = e.target.closest(".filter");
      if (!btn) return;
      var want = btn.getAttribute("data-filter");

      Array.prototype.forEach.call(bar.querySelectorAll(".filter"), function (f) {
        f.classList.toggle("is-active", f === btn);
      });

      Array.prototype.forEach.call(cards, function (card) {
        var cats = (card.getAttribute("data-cat") || "").split(",");
        var show = want === "all" || cats.indexOf(want) !== -1;
        card.style.display = show ? "" : "none";
      });
    });
  }

  /* ---------- 年份 ---------- */

  function initYear() {
    var nodes = document.querySelectorAll("[data-year]");
    var y = String(new Date().getFullYear());
    Array.prototype.forEach.call(nodes, function (n) {
      n.textContent = y;
    });
  }

  /* ---------- 启动 ---------- */

  function boot() {
    var fields = document.querySelectorAll("[data-shard-field]");
    Array.prototype.forEach.call(fields, function (svg) {
      var opts = {};
      var raw = svg.getAttribute("data-shard-field");
      if (raw) {
        try {
          opts = JSON.parse(raw);
        } catch (err) {
          opts = {};
        }
      }
      shardField(svg, opts);
    });

    initGlitch();
    initNav();
    initReveal();
    initSkills();
    initFilters();
    initYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.MOSS = { shardField: shardField };
})();
