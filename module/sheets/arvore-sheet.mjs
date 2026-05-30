/**
 * Sinfonia das Almas — Árvore de Habilidades (v0.7.0)
 *
 * Sistema reformulado: lista flat das habilidades da classe ativa, cada uma
 * com botões +/− para investir/retirar Pontos de Habilidade (NH).
 *
 * Armazenamento: flag "arvoreNH" no actor = { [habId]: nh }.
 * Pontos disponíveis = nível do personagem − soma de todos os NH gastos.
 *
 * Habilidades passivas com `escala` (Vigor, Mente Expandida, etc) automaticamente
 * afetam o `prepareDerivedData` do actor.
 */
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ArvoreHabilidades extends HandlebarsApplicationMixin(ApplicationV2) {

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
  }

  static DEFAULT_OPTIONS = {
    id: "sinfonia-arvore",
    classes: ["sinfonia-das-almas", "arvore-window"],
    window: { title: "Árvore de Habilidades", resizable: true },
    position: { width: 720, height: 720 },
    actions: {
      incHab: ArvoreHabilidades._onIncHab,
      decHab: ArvoreHabilidades._onDecHab,
      resetar: ArvoreHabilidades._onResetar
    }
  };

  static PARTS = {
    main: { template: "systems/sinfonia-das-almas/templates/actor/tabs/arvore.hbs" }
  };

  get title() {
    return `Árvore de Habilidades — ${this.actor.name}`;
  }

  // ── Helpers ──────────────────────────────────────────────────
  _getArvoreNH() {
    return this.actor.getFlag("sinfonia-das-almas", "arvoreNH") ?? {};
  }

  async _setArvoreNH(novoMap) {
    await this.actor.setFlag("sinfonia-das-almas", "arvoreNH", novoMap);
  }

  _ptsTotal() {
    return this.actor.system.progressao?.nivel ?? 5;
  }

  _ptsGastos(arvoreNH = null) {
    const map = arvoreNH ?? this._getArvoreNH();
    return Object.values(map).reduce((acc, v) => acc + (Number(v) || 0), 0);
  }

  _ptsLivres() {
    return Math.max(0, this._ptsTotal() - this._ptsGastos());
  }

  // ── Context ──────────────────────────────────────────────────
  async _prepareContext() {
    const sys = this.actor.system;
    const classe = sys.progressao?.classe ?? "";
    const arvoreNH = this._getArvoreNH();

    const classeMeta = globalThis.SINFONIA?.CLS_META?.[classe] ?? null;
    const habsDef = globalThis.SINFONIA?.HABILIDADES_CLASSE?.[classe] ?? [];

    // Monta lista de habilidades com NH atual e efeito resolvido
    const habilidades = habsDef.map(hab => {
      const nh = Math.max(0, Math.min(arvoreNH[hab.id] ?? 0, hab.maxNH));
      // Texto do efeito atual (chamando a função se houver, ou usando desc base)
      let efeitoAtual = "";
      if (typeof hab.efeito === "function") {
        try {
          efeitoAtual = nh > 0 ? hab.efeito(nh) : "";
        } catch (err) {
          console.error("Sinfonia | Erro no efeito da habilidade", hab.id, err);
        }
      }

      // Custos exibidos como tags
      const tags = [];
      if (hab.custoPE) tags.push(`${hab.custoPE} PE`);
      if (hab.custoPI) tags.push(`${hab.custoPI} PI`);
      if (hab.passiva) tags.push("Passiva");

      return {
        id: hab.id,
        label: hab.label,
        nh,
        maxNH: hab.maxNH,
        desc: hab.desc || "",
        efeitoAtual,
        tags,
        passiva: !!hab.passiva,
        // Estado dos botões
        canInc: nh < hab.maxNH && this._ptsLivres() > 0,
        canDec: nh > 0,
        // Visual: barra de progresso (nh/maxNH)
        progressoPct: hab.maxNH > 0 ? Math.round((nh / hab.maxNH) * 100) : 0,
        // Slots visuais (bolinhas preenchidas até nh)
        slots: Array.from({ length: hab.maxNH }, (_, i) => ({
          preenchido: i < nh,
          indice: i + 1
        }))
      };
    });

    const ptsGastos = this._ptsGastos();
    const ptsTotal = this._ptsTotal();

    return {
      actor:    this.actor,
      classe,
      classeLabel: globalThis.SINFONIA?.CLASSES?.[classe] ?? "Nenhuma classe selecionada",
      classeMeta,
      semClasse: !classe,
      habilidades,
      ptsTotal,
      ptsGastos,
      ptsLivres: Math.max(0, ptsTotal - ptsGastos)
    };
  }

  // ── Actions ──────────────────────────────────────────────────
  static async _onIncHab(event, target) {
    event.preventDefault();
    const habId = target.closest("[data-hab-id]")?.dataset.habId;
    if (!habId) return;

    const classe = this.actor.system.progressao?.classe;
    const hab = globalThis.SINFONIA?.HABILIDADES_CLASSE?.[classe]?.find(h => h.id === habId);
    if (!hab) return;

    const map = { ...this._getArvoreNH() };
    const nhAtual = map[habId] ?? 0;

    if (nhAtual >= hab.maxNH) {
      ui.notifications.warn(`${hab.label} já está no NH máximo (${hab.maxNH}).`);
      return;
    }

    // Verifica pontos disponíveis
    if (this._ptsLivres() < 1) {
      ui.notifications.warn(`Sem Pontos de Habilidade disponíveis (${this._ptsGastos()}/${this._ptsTotal()}).`);
      return;
    }

    map[habId] = nhAtual + 1;
    await this._setArvoreNH(map);
    this.render(false);
  }

  static async _onDecHab(event, target) {
    event.preventDefault();
    const habId = target.closest("[data-hab-id]")?.dataset.habId;
    if (!habId) return;

    const map = { ...this._getArvoreNH() };
    const nhAtual = map[habId] ?? 0;
    if (nhAtual <= 0) return;

    if (nhAtual - 1 === 0) {
      delete map[habId];
    } else {
      map[habId] = nhAtual - 1;
    }
    await this._setArvoreNH(map);
    this.render(false);
  }

  static async _onResetar(event, target) {
    event.preventDefault();
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Resetar Árvore" },
      content: `<p>Devolver TODOS os pontos investidos? Esta ação não pode ser desfeita.</p>`
    });
    if (!ok) return;
    await this._setArvoreNH({});
    this.render(false);
    ui.notifications.info(`${this.actor.name}: árvore de habilidades resetada.`);
  }
}
