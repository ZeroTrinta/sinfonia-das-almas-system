/**
 * Sinfonia das Almas — Árvore de Habilidades
 * Usa ApplicationV2 (Foundry v13+)
 */
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ArvoreHabilidades extends HandlebarsApplicationMixin(ApplicationV2) {

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this._cam  = { x: 0, y: 0, zoom: 1 };
    this._drag = false;
    this._lastMX = 0;
    this._lastMY = 0;
    this._particles = [];
    this._beams     = [];
    this._filter    = "all";
    this._hoveredNode = null;
    this._animId    = null;
    this._lastTime  = 0;
  }

  static DEFAULT_OPTIONS = {
    id:       "sinfonia-arvore",
    window: {
      title:    "Árvore de Habilidades",
      resizable: true
    },
    position: { width: 1000, height: 700 },
    classes:  ["sinfonia-das-almas", "arvore-window"]
  };

  static PARTS = {
    main: {
      template: "systems/sinfonia-das-almas/templates/actor/tabs/arvore.hbs"
    }
  };

  async _prepareContext() {
    return {
      actorName: this.actor.name,
      pts: this.actor.system.progressao.pontosHabilidade,
      ptsUsados: this._calcPtsUsados()
    };
  }

  _calcPtsUsados() {
    return SINFONIA.NODES
      .filter(n => n.cost > 0 && this._isNodeActive(n.id))
      .reduce((acc, n) => acc + n.cost, 0);
  }

  _isNodeActive(id) {
    const ativos = this.actor.getFlag("sinfonia-das-almas", "arvoreAtiva") ?? {};
    return ativos[id] === true;
  }

  async _toggleNode(node) {
    const ativos = foundry.utils.deepClone(
      this.actor.getFlag("sinfonia-das-almas", "arvoreAtiva") ?? {}
    );
    const pts       = this.actor.system.progressao.pontosHabilidade;
    const ptsUsados = this._calcPtsUsados();
    const ptsLivres = pts - ptsUsados;

    if (this._isNodeActive(node.id) && node.cost > 0 && !node.passive) {
      const temFilhoAtivo = SINFONIA.EDGES
        .filter(e => e[0] === node.id)
        .some(e => ativos[e[1]]);
      if (temFilhoAtivo) {
        ui.notifications.warn("Desative primeiro os nós que dependem deste.");
        return;
      }
      delete ativos[node.id];
      await this.actor.setFlag("sinfonia-das-almas", "arvoreAtiva", ativos);
      this._soundDeactivate();
    } else if (!this._isNodeActive(node.id) && this._isAvailable(node)) {
      if (ptsLivres < node.cost) {
        ui.notifications.warn(`Pontos insuficientes! Você tem ${ptsLivres} ponto(s) livre(s).`);
        this._soundError();
        return;
      }
      ativos[node.id] = true;
      await this.actor.setFlag("sinfonia-das-almas", "arvoreAtiva", ativos);
      if (node.type === "keystone") this._soundKeystone();
      else this._soundActivate(node.type);
      // Spawn beam from parent
      const parentEdge = SINFONIA.EDGES.find(e => e[1] === node.id && this._isNodeActive(e[0]));
      if (parentEdge) {
        const parentNode = SINFONIA.NODE_MAP[parentEdge[0]];
        if (parentNode) {
          const sa = this._w2s(parentNode.x, parentNode.y);
          const sb = this._w2s(node.x, node.y);
          this._spawnBeam(parentNode, node);
        }
      } else {
        const sa = this._w2s(node.x, node.y);
        const cnt = node.type === "keystone" ? 38 : 32;
        this._spawnParticles(sa.x, sa.y, this._nodeColor(node), this._nodeGlow(node), cnt);
      }
    } else if (!this._isNodeActive(node.id) && !this._isAvailable(node)) {
      this._soundError();
      ui.notifications.warn("Desbloqueie o nó anterior primeiro.");
    }

    this._render();
  }

  _isAvailable(node) {
    if (this._isNodeActive(node.id)) return false;
    if (node.cost === 0) return true;
    return SINFONIA.EDGES
      .filter(e => e[1] === node.id)
      .some(e => this._isNodeActive(e[0]));
  }

  _onRender(context, options) {
    const html = this.element;
    // ApplicationV2: element pode ser o .window-content ou o próprio root
    const canvas = html.querySelector("#arvore-canvas")
               ?? document.getElementById("arvore-canvas");
    if (!canvas) return;

    this._canvas = canvas;
    this._ctx    = canvas.getContext("2d");
    this._resizeCanvas();

    // Limpa listeners antigos para evitar duplicatas em re-renders
    if (this._boundMouseMove) window.removeEventListener("mousemove", this._boundMouseMove);
    if (this._boundMouseUp)   window.removeEventListener("mouseup",   this._boundMouseUp);
    this._boundMouseMove = e => this._onMouseMove(e);
    this._boundMouseUp   = () => { this._drag = false; canvas.style.cursor = "crosshair"; };

    canvas.addEventListener("mousedown", e => {
      this._drag = true;
      this._lastMX = e.clientX;
      this._lastMY = e.clientY;
      this._movedDist = 0;
      canvas.style.cursor = "grabbing";
    });
    window.addEventListener("mouseup",   this._boundMouseUp);
    window.addEventListener("mousemove", this._boundMouseMove);

    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      const f  = e.deltaY < 0 ? 1.12 : 0.89;
      const nz = Math.min(2.5, Math.max(0.2, this._cam.zoom * f));
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left - canvas.width  / 2;
      const my = e.clientY - rect.top  - canvas.height / 2;
      this._cam.x = mx - (mx - this._cam.x) * (nz / this._cam.zoom);
      this._cam.y = my - (my - this._cam.y) * (nz / this._cam.zoom);
      this._cam.zoom = nz;
      this._render();
    }, { passive: false });

    canvas.addEventListener("click", e => {
      if (this._movedDist > 8) return;
      const node = this._getNodeAt(e);
      if (node) this._toggleNode(node);
    });

    html.querySelectorAll(".arvore-tab").forEach(tab => {
      tab.addEventListener("click", e => {
        html.querySelectorAll(".arvore-tab").forEach(t => t.classList.remove("active"));
        e.currentTarget.classList.add("active");
        this._filter = e.currentTarget.dataset.cls;
        const cm = SINFONIA.CLS_META[this._filter];
        if (cm) {
          this._cam.x = -cm.cx * this._cam.zoom;
          this._cam.y = -cm.cy * this._cam.zoom;
        } else {
          this._cam.x = 0; this._cam.y = 0; this._cam.zoom = 1;
        }
        this._render();
      });
    });

    html.querySelector("#arvore-reset")?.addEventListener("click", async () => {
      const ok = await foundry.applications.api.DialogV2.confirm({
        window: { title: "Resetar Árvore" },
        content: "<p>Desativar todos os nós?</p>"
      });
      if (ok) {
        await this.actor.setFlag("sinfonia-das-almas", "arvoreAtiva", {});
        this._particles = [];
        this._beams = [];
        this._soundReset();
        this._render();
      }
    });

    if (this._resizeObserver) this._resizeObserver.disconnect();
    this._resizeObserver = new ResizeObserver(() => {
      this._resizeCanvas();
      this._render();
    });
    this._resizeObserver.observe(canvas.parentElement);

    // Só inicia o loop de animação uma vez
    if (!this._animId) this._startAnim();
    this._render();
  }

  async close(options = {}) {
    if (this._animId) { cancelAnimationFrame(this._animId); this._animId = null; }
    if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }
    if (this._boundMouseMove) window.removeEventListener("mousemove", this._boundMouseMove);
    if (this._boundMouseUp)   window.removeEventListener("mouseup",   this._boundMouseUp);
    return super.close(options);
  }

  _resizeCanvas() {
    if (!this._canvas) return;
    const parent = this._canvas.parentElement;
    this._canvas.width  = parent.clientWidth  || 960;
    this._canvas.height = parent.clientHeight || 560;
  }

  _w2s(wx, wy) {
    const { x, y, zoom } = this._cam;
    const W = this._canvas.width, H = this._canvas.height;
    return { x: wx * zoom + W / 2 + x, y: wy * zoom + H / 2 + y };
  }

  _s2w(sx, sy) {
    const { x, y, zoom } = this._cam;
    const W = this._canvas.width, H = this._canvas.height;
    return { x: (sx - W / 2 - x) / zoom, y: (sy - H / 2 - y) / zoom };
  }

  _nodeRadius(n) {
    if (n.type === "start")    return 28;
    if (n.type === "keystone") return 22;
    if (n.type === "major")    return 16;
    return 10;
  }

  _nodeColor(n) {
    if (n.cls === "all") return "#c8972a";
    return SINFONIA.CLS_META[n.cls]?.color ?? "#aaa";
  }

  _nodeGlow(n) {
    if (n.cls === "all") return "#f0c060";
    return SINFONIA.CLS_META[n.cls]?.glow ?? "#fff";
  }

  _getNodeAt(e) {
    const rect = this._canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const w  = this._s2w(sx, sy);
    const vis = new Set(SINFONIA.NODES
      .filter(n => this._filter === "all" || n.cls === "all" || n.cls === this._filter)
      .map(n => n.id));
    let best = null, bd = Infinity;
    for (const n of SINFONIA.NODES) {
      if (!vis.has(n.id)) continue;
      const r = this._nodeRadius(n) + 8;
      const d = Math.hypot(n.x - w.x, n.y - w.y);
      if (d < r && d < bd) { best = n; bd = d; }
    }
    return best;
  }

  _onMouseMove(e) {
    if (!this._canvas) return;
    const rect = this._canvas.getBoundingClientRect();
    if (this._drag) {
      const dx = e.clientX - this._lastMX;
      const dy = e.clientY - this._lastMY;
      this._cam.x += dx; this._cam.y += dy;
      this._lastMX = e.clientX; this._lastMY = e.clientY;
      this._movedDist = (this._movedDist ?? 0) + Math.abs(dx) + Math.abs(dy);
      this._render();
    }
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const node = this._getNodeAt({ clientX: e.clientX, clientY: e.clientY });
    if (node !== this._hoveredNode) {
      this._hoveredNode = node;
      this._updateTooltip(node, sx, sy);
      this._render();
    }
  }

  _updateTooltip(node, sx, sy) {
    const tip = document.getElementById("arvore-tooltip");
    if (!tip) return;
    if (!node) { tip.style.display = "none"; return; }

    const active = this._isNodeActive(node.id);
    const avail  = this._isAvailable(node);
    const cm     = node.cls === "all"
      ? { label: "Todos", color: "#c8972a" }
      : SINFONIA.CLS_META[node.cls];

    tip.querySelector(".tt-cls").textContent  = cm?.label?.toUpperCase() ?? "";
    tip.querySelector(".tt-cls").style.color  = cm?.color ?? "#c8972a";
    tip.querySelector(".tt-name").textContent = node.label;
    const tmap = { start:"Nó de Início", major:"Habilidade Maior", minor:"Habilidade Menor", keystone:"Pedra Angular" };
    tip.querySelector(".tt-type").textContent = tmap[node.type] ?? "";
    tip.querySelector(".tt-desc").textContent = node.desc;
    tip.querySelector(".tt-cost").textContent = node.cost === 0
      ? "Custo: Gratuito"
      : `Custo: ${node.cost} ponto${node.cost > 1 ? "s" : ""}`;

    const st = tip.querySelector(".tt-status");
    if (active) { st.textContent = "✦ ATIVO"; st.className = "tt-status active"; }
    else if (avail) { st.textContent = "◈ Clique para ativar"; st.className = "tt-status available"; }
    else { st.textContent = "✕ Bloqueado"; st.className = "tt-status locked"; }

    tip.style.borderColor = cm?.color ?? "#c8972a";
    const rect = this._canvas.getBoundingClientRect();
    let tx = rect.left + sx + 16, ty = rect.top + sy - 10;
    if (tx + 280 > window.innerWidth)  tx = rect.left + sx - 296;
    if (ty + 220 > window.innerHeight) ty = window.innerHeight - 230;
    tip.style.left    = tx + "px";
    tip.style.top     = ty + "px";
    tip.style.display = "block";
  }

  _startAnim() {
    const loop = (ts) => {
      const dt = Math.min((ts - this._lastTime) / 1000, 0.05);
      this._lastTime = ts;
      if (this._particles.length > 0 || this._beams.length > 0) {
        this._updateParticles(dt);
        this._updateBeams(dt);
        this._render();
      }
      this._animId = requestAnimationFrame(loop);
    };
    this._animId = requestAnimationFrame(loop);
  }

  _spawnParticles(sx, sy, col, glow, count = 22) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 3.5;
      const size  = 1.5 + Math.random() * 3;
      const life  = 0.55 + Math.random() * 0.55;
      this._particles.push({ x: sx, y: sy,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        size, col, glow, alpha: 1, life, maxLife: life,
        spark: Math.random() < 0.4 });
    }
  }

  _updateParticles(dt) {
    this._particles = this._particles.filter(p => p.alpha > 0.01);
    for (const p of this._particles) {
      p.x += p.vx * dt * 60; p.y += p.vy * dt * 60;
      p.vx *= 0.92; p.vy *= 0.92;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
    }
  }

  _drawParticles() {
    const ctx = this._ctx;
    for (const p of this._particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.shadowBlur  = p.spark ? 6 : 14;
      ctx.shadowColor = p.glow;
      ctx.fillStyle   = p.spark ? "#ffffff" : p.col;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.alpha, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  _spawnBeam(fromNode, toNode) {
    this._beams.push({
      fromNode, toNode,
      col: this._nodeColor(toNode), glow: this._nodeGlow(toNode),
      t: 0, duration: 0.38, elapsed: 0, done: false
    });
  }

  _updateBeams(dt) {
    for (const b of this._beams) {
      if (b.done) continue;
      b.elapsed += dt;
      b.t = Math.min(1, b.elapsed / b.duration);
      b.tEased = 1 - Math.pow(1 - b.t, 3);
      if (b.t >= 1) {
        b.done = true;
        const sa = this._w2s(b.toNode.x, b.toNode.y);
        const cnt = b.toNode.type === "keystone" ? 38 : b.toNode.type === "start" ? 32 : 22;
        this._spawnParticles(sa.x, sa.y, b.col, b.glow, cnt);
      }
    }
    this._beams = this._beams.filter(b => !b.done);
  }

  _drawBeams() {
    const ctx  = this._ctx;
    const zoom = this._cam.zoom;
    for (const b of this._beams) {
      if (b.done) continue;
      const sa = this._w2s(b.fromNode.x, b.fromNode.y);
      const sb = this._w2s(b.toNode.x,   b.toNode.y);
      const tx = sa.x + (sb.x - sa.x) * b.tEased;
      const ty = sa.y + (sb.y - sa.y) * b.tEased;
      const tailT = Math.max(0, b.tEased - 0.18);
      const tailX = sa.x + (sb.x - sa.x) * tailT;
      const tailY = sa.y + (sb.y - sa.y) * tailT;
      // Guarda contra coordenadas não-finitas
      if (!isFinite(tx) || !isFinite(ty) || !isFinite(tailX) || !isFinite(tailY)) continue;
      if (Math.hypot(tx - tailX, ty - tailY) < 1) continue;
      ctx.save();
      const g = ctx.createLinearGradient(tailX, tailY, tx, ty);
      g.addColorStop(0, b.col + "00"); g.addColorStop(0.4, b.col + "88"); g.addColorStop(1, b.glow + "ff");
      ctx.strokeStyle = g; ctx.lineWidth = 4 * zoom;
      ctx.shadowBlur = 18 * zoom; ctx.shadowColor = b.glow; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.fillStyle = "#ffffff"; ctx.shadowBlur = 20 * zoom; ctx.shadowColor = b.glow;
      ctx.beginPath(); ctx.arc(tx, ty, 3 * zoom, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  _render() {
    if (!this._ctx || !this._canvas) return;
    const ctx  = this._ctx;
    const zoom = this._cam.zoom;
    const W    = this._canvas.width;
    const H    = this._canvas.height;

    ctx.fillStyle = "#06080d";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(200,151,42,0.03)";
    ctx.lineWidth = 1;
    for (let x = (this._cam.x % 40 + 40) % 40; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = (this._cam.y % 40 + 40) % 40; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    const vis = SINFONIA.NODES.filter(n =>
      this._filter === "all" || n.cls === "all" || n.cls === this._filter
    );
    const visSet = new Set(vis.map(n => n.id));

    for (const [a, b] of SINFONIA.EDGES) {
      if (!visSet.has(a) || !visSet.has(b)) continue;
      const na = SINFONIA.NODE_MAP[a], nb = SINFONIA.NODE_MAP[b];
      const sa = this._w2s(na.x, na.y), sb = this._w2s(nb.x, nb.y);
      const actA = this._isNodeActive(a), actB = this._isNodeActive(b);
      const active    = actA && actB;
      const available = (actA && this._isAvailable(nb)) || (actB && this._isAvailable(na));
      ctx.save();
      if (active) {
        const gr = ctx.createLinearGradient(sa.x, sa.y, sb.x, sb.y);
        gr.addColorStop(0, this._nodeColor(na) + "cc");
        gr.addColorStop(1, this._nodeColor(nb) + "cc");
        ctx.strokeStyle = gr; ctx.lineWidth = 2.5 * zoom;
        ctx.shadowBlur = 8 * zoom; ctx.shadowColor = this._nodeGlow(na);
      } else if (available) {
        ctx.strokeStyle = "rgba(180,160,80,0.45)"; ctx.lineWidth = 1.5 * zoom;
        ctx.setLineDash([5 * zoom, 5 * zoom]);
      } else {
        ctx.strokeStyle = "rgba(80,90,110,0.28)"; ctx.lineWidth = 1 * zoom;
      }
      ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y); ctx.stroke();
      ctx.restore();
    }

    for (const n of vis) {
      const s      = this._w2s(n.x, n.y);
      const r      = this._nodeRadius(n) * zoom;
      const col    = this._nodeColor(n);
      const glow   = this._nodeGlow(n);
      const active = this._isNodeActive(n.id);
      const avail  = this._isAvailable(n);
      const hov    = this._hoveredNode?.id === n.id;
      ctx.save();

      if (n.type === "keystone") {
        const d = r * 1.3;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - d); ctx.lineTo(s.x + d, s.y);
        ctx.lineTo(s.x, s.y + d); ctx.lineTo(s.x - d, s.y); ctx.closePath();
        if (active) {
          ctx.shadowBlur = 24 * zoom; ctx.shadowColor = glow;
          const gr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, d);
          gr.addColorStop(0, col + "ff"); gr.addColorStop(0.6, col + "aa"); gr.addColorStop(1, col + "22");
          ctx.fillStyle = gr;
        } else if (avail) {
          ctx.fillStyle = "#1a2030"; ctx.shadowBlur = hov ? 14 * zoom : 10 * zoom; ctx.shadowColor = col;
        } else { ctx.fillStyle = "#0f1218"; }
        ctx.fill();
        ctx.strokeStyle = active ? glow : avail ? col : "#2a3040";
        ctx.lineWidth = (active ? 2 : 1.5) * zoom; ctx.stroke();
        const d2 = d * 0.5;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - d2); ctx.lineTo(s.x + d2, s.y);
        ctx.lineTo(s.x, s.y + d2); ctx.lineTo(s.x - d2, s.y); ctx.closePath();
        ctx.strokeStyle = active ? glow + "88" : avail ? col + "44" : "#1a2030";
        ctx.lineWidth = 1 * zoom; ctx.stroke();

      } else if (n.type === "start") {
        if (active) {
          const gr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 2.5);
          gr.addColorStop(0, col + "44"); gr.addColorStop(1, col + "00");
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(s.x, s.y, r * 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 30 * zoom; ctx.shadowColor = glow;
        }
        ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        const bgr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
        bgr.addColorStop(0, active ? col + "ff" : avail ? "#1e2840" : "#0f1218");
        bgr.addColorStop(1, active ? col + "66" : "#080b12");
        ctx.fillStyle = bgr; ctx.fill();
        ctx.strokeStyle = active ? glow : avail ? col : "#2a3040";
        ctx.lineWidth = (active ? 3 : 2) * zoom; ctx.stroke();
        ctx.beginPath(); ctx.arc(s.x, s.y, r * 0.65, 0, Math.PI * 2);
        ctx.strokeStyle = active ? glow + "aa" : avail ? col + "55" : "#1a2030";
        ctx.lineWidth = 1.5 * zoom; ctx.stroke();

      } else {
        if (active || hov) {
          const gr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 2);
          gr.addColorStop(0, col + (active ? "33" : "18")); gr.addColorStop(1, col + "00");
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(s.x, s.y, r * 2, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 16 * zoom; ctx.shadowColor = glow;
        }
        ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        const bgr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
        bgr.addColorStop(0, active ? col + "ee" : avail ? "#1e2840" : "#0f1218");
        bgr.addColorStop(1, active ? col + "55" : "#080b12");
        ctx.fillStyle = bgr; ctx.fill();
        ctx.strokeStyle = active ? glow : avail ? col : "#2a3040";
        ctx.lineWidth = (active ? 2 : 1.5) * zoom; ctx.stroke();
        if (n.type === "major") {
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const ang = (Math.PI / 3) * i - Math.PI / 6;
            const hx = s.x + (r + 5 * zoom) * Math.cos(ang);
            const hy = s.y + (r + 5 * zoom) * Math.sin(ang);
            i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
          }
          ctx.closePath();
          ctx.strokeStyle = active ? col + "55" : avail ? col + "33" : "#1a2030";
          ctx.lineWidth = 1 * zoom; ctx.stroke();
        }
      }

      if (zoom > 0.55) {
        const fs    = Math.max(7, Math.min(11, 10 * zoom));
        const alpha = Math.min(1, (zoom - 0.55) / 0.25);
        ctx.globalAlpha = alpha;
        ctx.font         = `${fs}px Cinzel, serif`;
        ctx.textAlign    = "center";
        ctx.textBaseline = "top";
        const ly = s.y + r + 5 * zoom;
        ctx.fillStyle = "#000";
        ctx.fillText(n.label, s.x + 1, ly + 1);
        ctx.fillStyle = active ? glow : avail ? "#8899bb" : "#3a4050";
        ctx.fillText(n.label, s.x, ly);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    this._drawBeams();
    this._drawParticles();

    const ptsTotal  = this.actor.system.progressao.pontosHabilidade;
    const ptsUsados = this._calcPtsUsados();
    const ptsLivres = ptsTotal - ptsUsados;
    ctx.save();
    ctx.font = "11px Cinzel, serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "#f0c060";
    ctx.fillText(`✦ Pontos: ${ptsLivres} / ${ptsTotal}`, W - 14, 14);
    ctx.restore();
  }

  _ac() {
    if (!this.__ac) this.__ac = new (window.AudioContext || window.webkitAudioContext)();
    return this.__ac;
  }
  _mg(ac) { const g = ac.createGain(); g.gain.value = 0.3; g.connect(ac.destination); return g; }

  _soundActivate(type) {
    try {
      const ac = this._ac(), now = ac.currentTime, out = this._mg(ac);
      const freqs = { minor:[440,660], major:[523,784], start:[349,523] };
      const [f1,f2] = freqs[type] ?? freqs.major;
      [[f1,0.09,0.45],[f2,0.045,0.4],[f2*2.8,0.018,0.2]].forEach(([f,g,d],i) => {
        const o = ac.createOscillator(), gn = ac.createGain();
        o.connect(gn); gn.connect(out); o.type = "sine";
        o.frequency.setValueAtTime(f, now+i*0.01);
        gn.gain.setValueAtTime(0,now+i*0.01);
        gn.gain.linearRampToValueAtTime(g,now+i*0.01+0.03);
        gn.gain.exponentialRampToValueAtTime(0.0001,now+i*0.01+d);
        o.start(now+i*0.01); o.stop(now+i*0.01+d+0.05);
      });
    } catch(e) {}
  }

  _soundKeystone() {
    try {
      const ac = this._ac(), now = ac.currentTime, out = this._mg(ac);
      [392,494,587].forEach((f,i) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.connect(g); g.connect(out); o.type = "sine";
        o.frequency.setValueAtTime(f, now+i*0.06);
        g.gain.setValueAtTime(0,now+i*0.06); g.gain.linearRampToValueAtTime(0.06,now+i*0.06+0.04);
        g.gain.exponentialRampToValueAtTime(0.0001,now+i*0.06+0.7);
        o.start(now+i*0.06); o.stop(now+i*0.06+0.75);
      });
    } catch(e) {}
  }

  _soundDeactivate() {
    try {
      const ac = this._ac(), now = ac.currentTime, out = this._mg(ac);
      const o = ac.createOscillator(), g = ac.createGain();
      o.connect(g); g.connect(out); o.type = "sine";
      o.frequency.setValueAtTime(520,now); o.frequency.exponentialRampToValueAtTime(280,now+0.28);
      g.gain.setValueAtTime(0,now); g.gain.linearRampToValueAtTime(0.055,now+0.02);
      g.gain.exponentialRampToValueAtTime(0.0001,now+0.32);
      o.start(now); o.stop(now+0.35);
    } catch(e) {}
  }

  _soundError() {
    try {
      const ac = this._ac(), now = ac.currentTime, out = this._mg(ac);
      [0,0.1].forEach(off => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.connect(g); g.connect(out); o.type = "sine";
        o.frequency.setValueAtTime(220,now+off); o.frequency.exponentialRampToValueAtTime(180,now+off+0.1);
        g.gain.setValueAtTime(0,now+off); g.gain.linearRampToValueAtTime(0.04,now+off+0.01);
        g.gain.exponentialRampToValueAtTime(0.0001,now+off+0.13);
        o.start(now+off); o.stop(now+off+0.15);
      });
    } catch(e) {}
  }

  _soundReset() {
    try {
      const ac = this._ac(), now = ac.currentTime, out = this._mg(ac);
      [523,440,349,262].forEach((f,i) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.connect(g); g.connect(out); o.type = "sine";
        o.frequency.setValueAtTime(f,now+i*0.08);
        g.gain.setValueAtTime(0,now+i*0.08); g.gain.linearRampToValueAtTime(0.045,now+i*0.08+0.02);
        g.gain.exponentialRampToValueAtTime(0.0001,now+i*0.08+0.2);
        o.start(now+i*0.08); o.stop(now+i*0.08+0.22);
      });
    } catch(e) {}
  }
}
