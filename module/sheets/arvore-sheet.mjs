/**
 * Sinfonia das Almas — Árvore de Habilidades (v0.7.2)
 *
 * Sistema:
 *   • Lista flat das habilidades da classe ativa
 *   • Cada habilidade tem NH (Nível de Habilidade) entre 0 e maxNH
 *   • Habilidades com `sublistaId` (Manobra, Truques, Venenos, Disparos) pedem
 *     pra escolher uma opção da SUBLISTA correspondente ao investir ponto.
 *
 * Armazenamento:
 *   • flag "arvoreNH" = { habId: nh }         — quantos pontos em cada habilidade
 *   • flag "sublistas" = { habId: [subId,...] } — escolhas feitas nas sublistas
 *
 * Pontos disponíveis = nível do personagem − soma de todos os NH gastos.
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
    position: { width: 760, height: 760 },
    actions: {
      incHab: ArvoreHabilidades._onIncHab,
      decHab: ArvoreHabilidades._onDecHab,
      resetar: ArvoreHabilidades._onResetar,
      verSubItem: ArvoreHabilidades._onVerSubItem,
      usarSubItem: ArvoreHabilidades._onUsarSubItem,
      usarHabilidade: ArvoreHabilidades._onUsarHabilidade
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

  _getSublistas() {
    return this.actor.getFlag("sinfonia-das-almas", "sublistas") ?? {};
  }

  async _setArvoreNH(novoMap) {
    if (Object.keys(novoMap).length === 0) {
      await this.actor.unsetFlag("sinfonia-das-almas", "arvoreNH");
    } else {
      await this.actor.unsetFlag("sinfonia-das-almas", "arvoreNH");
      await this.actor.setFlag("sinfonia-das-almas", "arvoreNH", novoMap);
    }
  }

  async _setSublistas(novoMap) {
    if (Object.keys(novoMap).length === 0) {
      await this.actor.unsetFlag("sinfonia-das-almas", "sublistas");
    } else {
      await this.actor.unsetFlag("sinfonia-das-almas", "sublistas");
      await this.actor.setFlag("sinfonia-das-almas", "sublistas", novoMap);
    }
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
    const sublistasEscolhidas = this._getSublistas();

    const classeMeta = globalThis.SINFONIA?.CLS_META?.[classe] ?? null;
    const habsDef = globalThis.SINFONIA?.HABILIDADES_CLASSE?.[classe] ?? [];
    const SUBLISTAS = globalThis.SINFONIA?.SUBLISTAS ?? {};

    // Monta lista de habilidades com NH atual e efeito resolvido
    const habilidades = habsDef.map(hab => {
      const nh = Math.max(0, Math.min(arvoreNH[hab.id] ?? 0, hab.maxNH));
      let efeitoAtual = "";
      if (typeof hab.efeito === "function") {
        try {
          efeitoAtual = nh > 0 ? hab.efeito(nh) : "";
        } catch (err) {
          console.error("Sinfonia | Erro no efeito da habilidade", hab.id, err);
        }
      }

      const tags = [];
      if (hab.custoPE) tags.push(`${hab.custoPE} PE`);
      if (hab.custoPI) tags.push(`${hab.custoPI} PI`);
      if (hab.passiva) tags.push("Passiva");

      // Pode ser usada como macro? (tem custo + não é passiva + não tem sublista)
      // Habilidades com sublista não são usadas direto — você usa cada sub-item.
      const podeUsar = nh > 0 && !hab.passiva && !hab.sublistaId
                       && ((hab.custoPE && hab.custoPE > 0) || (hab.custoPI && hab.custoPI > 0));

      // Sublista: se a habilidade tem sublistaId, mostra as escolhas atuais
      let sublistaItens = null;
      if (hab.sublistaId && SUBLISTAS[hab.sublistaId]) {
        const escolhidasIds = sublistasEscolhidas[hab.id] ?? [];
        const todasOpcoes = SUBLISTAS[hab.sublistaId];
        sublistaItens = escolhidasIds.map(subId => {
          const opcao = todasOpcoes.find(o => o.id === subId);
          return opcao
            ? { id: subId, label: opcao.label, custoPE: opcao.custoPE, custoPI: opcao.custoPI }
            : { id: subId, label: subId, custoPE: 0 };
        });
      }

      return {
        id: hab.id,
        label: hab.label,
        nh,
        maxNH: hab.maxNH,
        desc: hab.desc || "",
        efeitoAtual,
        tags,
        passiva: !!hab.passiva,
        sublistaId: hab.sublistaId ?? null,
        sublistaItens,
        podeUsar,
        canInc: nh < hab.maxNH && this._ptsLivres() > 0,
        canDec: nh > 0,
        progressoPct: hab.maxNH > 0 ? Math.round((nh / hab.maxNH) * 100) : 0,
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

    if (this._ptsLivres() < 1) {
      ui.notifications.warn(`Sem Pontos de Habilidade disponíveis (${this._ptsGastos()}/${this._ptsTotal()}).`);
      return;
    }

    // ── Se for habilidade com sublista, pede pra escolher uma opção ──
    if (hab.sublistaId) {
      const opcaoEscolhida = await ArvoreHabilidades._dialogEscolherSubItem(this.actor, hab);
      if (!opcaoEscolhida) return; // cancelou

      const subMap = { ...this._getSublistas() };
      const atuais = subMap[habId] ?? [];
      subMap[habId] = [...atuais, opcaoEscolhida];
      await this._setSublistas(subMap);
    }

    map[habId] = nhAtual + 1;
    await this._setArvoreNH(map);
    this.render(false);
  }

  static async _onDecHab(event, target) {
    event.preventDefault();
    const habId = target.closest("[data-hab-id]")?.dataset.habId;
    if (!habId) return;

    const classe = this.actor.system.progressao?.classe;
    const hab = globalThis.SINFONIA?.HABILIDADES_CLASSE?.[classe]?.find(h => h.id === habId);
    if (!hab) return;

    const map = { ...this._getArvoreNH() };
    const nhAtual = map[habId] ?? 0;
    if (nhAtual <= 0) return;

    // Se for sublista, pergunta qual item remover (ou remove o último)
    if (hab.sublistaId) {
      const subMap = { ...this._getSublistas() };
      const escolhasAtuais = subMap[habId] ?? [];
      if (escolhasAtuais.length > 0) {
        const idParaRemover = await ArvoreHabilidades._dialogRemoverSubItem(
          this.actor, hab, escolhasAtuais
        );
        if (!idParaRemover) return; // cancelou
        subMap[habId] = escolhasAtuais.filter(s => s !== idParaRemover);
        if (subMap[habId].length === 0) delete subMap[habId];
        await this._setSublistas(subMap);
      }
    }

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
    await this._setSublistas({});
    this.render(false);
    ui.notifications.info(`${this.actor.name}: árvore de habilidades resetada.`);
  }

  /**
   * Mostra o detalhe completo de uma opção da sublista (Manobra, Truque, etc.)
   * em um dialog de leitura. Usado quando o jogador clica num item já escolhido.
   */
  static async _onVerSubItem(event, target) {
    event.preventDefault();
    const habId = target.dataset.habId;
    const subId = target.dataset.subId;
    if (!habId || !subId) return;

    const classe = this.actor.system.progressao?.classe;
    const hab = globalThis.SINFONIA?.HABILIDADES_CLASSE?.[classe]?.find(h => h.id === habId);
    if (!hab?.sublistaId) return;

    const opcao = (globalThis.SINFONIA?.SUBLISTAS?.[hab.sublistaId] ?? []).find(o => o.id === subId);
    if (!opcao) return;

    const tags = [];
    if (opcao.custoPE)   tags.push(`<span class="sub-tag">${opcao.custoPE} PE</span>`);
    if (opcao.custoPI)   tags.push(`<span class="sub-tag">${opcao.custoPI} PI</span>`);
    if (opcao.acao === "parcial") tags.push(`<span class="sub-tag">Ação Parcial</span>`);
    if (opcao.acao === "inicial") tags.push(`<span class="sub-tag">Ação Inicial</span>`);
    if (opcao.acao === "reacao")  tags.push(`<span class="sub-tag">Reação</span>`);
    if (opcao.acao === "livre")   tags.push(`<span class="sub-tag">Ação Livre</span>`);

    const aprimorado = opcao.efeitoAprimorado
      ? `<div class="sub-aprimorado"><b>Efeito Aprimorado:</b> ${opcao.efeitoAprimorado}</div>`
      : "";

    await foundry.applications.api.DialogV2.prompt({
      window: { title: opcao.label },
      content: `
        <div class="sinfonia-subitem-detalhe">
          <div class="sub-tags">${tags.join(" ")}</div>
          <p class="sub-desc">${opcao.desc}</p>
          ${aprimorado}
        </div>`,
      ok: { label: "Fechar" }
    });
  }

  /**
   * Dialog para o jogador escolher uma opção da sublista ao investir um ponto.
   * Mostra todas as opções da sublista, com as já escolhidas marcadas como
   * "já conhecida" (disabled).
   */
  static async _dialogEscolherSubItem(actor, hab) {
    const SUBLISTAS = globalThis.SINFONIA?.SUBLISTAS ?? {};
    const opcoes = SUBLISTAS[hab.sublistaId] ?? [];
    if (opcoes.length === 0) {
      ui.notifications.warn(`Sublista ${hab.sublistaId} não cadastrada.`);
      return null;
    }

    const sublistasFlag = actor.getFlag("sinfonia-das-almas", "sublistas") ?? {};
    const jaConhece = sublistasFlag[hab.id] ?? [];

    // Lista de cards radio com cada opção
    const linhas = opcoes.map(opcao => {
      const conhece = jaConhece.includes(opcao.id);
      // Algumas habilidades permitem comprar a MESMA mais de uma vez (ex: Rude Buster [3X])
      const permiteRepetir = /\[\d+X\]/.test(opcao.label);
      const disabled = conhece && !permiteRepetir;

      const tags = [];
      if (opcao.custoPE) tags.push(`${opcao.custoPE} PE`);
      if (opcao.custoPI) tags.push(`${opcao.custoPI} PI`);
      if (opcao.acao === "parcial") tags.push("Parcial");
      if (opcao.acao === "inicial") tags.push("Inicial");
      if (opcao.acao === "reacao")  tags.push("Reação");
      if (opcao.acao === "livre")   tags.push("Livre");

      const aprimoradoHtml = opcao.efeitoAprimorado
        ? `<div class="sub-aprimorado"><b>Aprimorado:</b> ${opcao.efeitoAprimorado}</div>`
        : "";

      return `
        <label class="sub-opcao ${disabled ? 'disabled' : ''}">
          <input type="radio" name="subItem" value="${opcao.id}" ${disabled ? 'disabled' : ''}/>
          <div class="sub-opcao-content">
            <div class="sub-opcao-head">
              <span class="sub-opcao-nome">${opcao.label}</span>
              <span class="sub-opcao-tags">${tags.map(t => `<span class="sub-tag">${t}</span>`).join("")}</span>
              ${conhece ? '<span class="sub-conhecida">já conhecida</span>' : ''}
            </div>
            <p class="sub-opcao-desc">${opcao.desc}</p>
            ${aprimoradoHtml}
          </div>
        </label>`;
    }).join("");

    const content = `
      <div class="sinfonia-dialog-sublista">
        <p class="sub-intro">Escolha qual <b>${hab.label}</b> aprender:</p>
        <div class="sub-lista">${linhas}</div>
      </div>`;

    return new Promise(resolve => {
      foundry.applications.api.DialogV2.prompt({
        window: { title: `${hab.label} — Escolher` },
        content,
        position: { width: 600 },
        ok: {
          label: "Aprender",
          icon: "fa-check",
          callback: (ev, btn) => {
            const f = btn.form.elements.subItem;
            const escolhido = f?.value;
            if (!escolhido) {
              ui.notifications.warn("Você precisa escolher uma opção.");
              resolve(null);
              return;
            }
            resolve(escolhido);
          }
        },
        cancel: { label: "Cancelar", callback: () => resolve(null) }
      });
    });
  }

  /**
   * Dialog para escolher qual item da sublista REMOVER quando o jogador
   * clica em "−" numa habilidade com sublista.
   */
  static async _dialogRemoverSubItem(actor, hab, idsAtuais) {
    const SUBLISTAS = globalThis.SINFONIA?.SUBLISTAS ?? {};
    const opcoes = SUBLISTAS[hab.sublistaId] ?? [];

    const linhas = idsAtuais.map((subId, idx) => {
      const opcao = opcoes.find(o => o.id === subId);
      const label = opcao?.label ?? subId;
      return `
        <label class="sub-opcao">
          <input type="radio" name="subItem" value="${subId}" data-idx="${idx}" ${idx === idsAtuais.length - 1 ? 'checked' : ''}/>
          <span class="sub-opcao-nome">${label}</span>
        </label>`;
    }).join("");

    const content = `
      <div class="sinfonia-dialog-sublista compact">
        <p class="sub-intro">Qual <b>${hab.label}</b> esquecer?</p>
        <div class="sub-lista">${linhas}</div>
      </div>`;

    return new Promise(resolve => {
      foundry.applications.api.DialogV2.prompt({
        window: { title: `${hab.label} — Esquecer` },
        content,
        position: { width: 400 },
        ok: {
          label: "Esquecer",
          icon: "fa-trash",
          callback: (ev, btn) => {
            const f = btn.form.elements.subItem;
            resolve(f?.value ?? null);
          }
        },
        cancel: { label: "Cancelar", callback: () => resolve(null) }
      });
    });
  }

  /* ============================================================
     MACROS / EXECUÇÃO DE HABILIDADES (v0.7.4)
     Posta um card no chat com a descrição + gasta PE/PI quando aplicável.
  ============================================================ */

  /**
   * Executa um sub-item (Manobra, Truque Sujo, Veneno, Disparo Especial).
   * Verifica/gasta PE e PI, posta card no chat com a descrição completa.
   */
  static async _onUsarSubItem(event, target) {
    event.preventDefault();
    const habId = target.dataset.habId;
    const subId = target.dataset.subId;
    if (!habId || !subId) return;

    const classe = this.actor.system.progressao?.classe;
    const hab = globalThis.SINFONIA?.HABILIDADES_CLASSE?.[classe]?.find(h => h.id === habId);
    if (!hab?.sublistaId) return;

    const opcao = (globalThis.SINFONIA?.SUBLISTAS?.[hab.sublistaId] ?? []).find(o => o.id === subId);
    if (!opcao) return;

    await ArvoreHabilidades._executarMacro(this.actor, {
      nome: opcao.label,
      desc: opcao.desc,
      efeitoAprimorado: opcao.efeitoAprimorado,
      custoPE: opcao.custoPE,
      custoPI: opcao.custoPI,
      acao: opcao.acao,
      tipoMacro: "sub",
      origem: hab.label
    });
  }

  /**
   * Executa uma habilidade direta da árvore (sem sublista) que tenha custo.
   * Ex: Provocar, Lâmina Arcana, Lex Divina, Recuperação Arcana.
   */
  static async _onUsarHabilidade(event, target) {
    event.preventDefault();
    const habId = target.dataset.habId;
    if (!habId) return;

    const classe = this.actor.system.progressao?.classe;
    const hab = globalThis.SINFONIA?.HABILIDADES_CLASSE?.[classe]?.find(h => h.id === habId);
    if (!hab) return;

    const arvoreNH = this.actor.getFlag("sinfonia-das-almas", "arvoreNH") ?? {};
    const nh = arvoreNH[hab.id] ?? 0;
    if (nh <= 0) {
      ui.notifications.warn(`${hab.label} ainda não foi aprendida.`);
      return;
    }

    let efeitoAtual = "";
    if (typeof hab.efeito === "function") {
      try { efeitoAtual = hab.efeito(nh); } catch {}
    }

    await ArvoreHabilidades._executarMacro(this.actor, {
      nome: hab.label,
      desc: hab.desc,
      efeitoAtual,
      custoPE: hab.custoPE,
      custoPI: hab.custoPI,
      tipoMacro: "hab"
    });
  }

  /**
   * Helper compartilhado: verifica custos, gasta PE/PI e posta card no chat.
   */
  static async _executarMacro(actor, info) {
    const custoPE = Math.max(0, Number(info.custoPE) || 0);
    const custoPI = Math.max(0, Number(info.custoPI) || 0);

    // Verifica recursos
    if (custoPE > 0 && actor.system.recursos.pe.value < custoPE) {
      ui.notifications.warn(`${actor.name} não tem PE suficiente para usar ${info.nome} (precisa de ${custoPE}).`);
      return;
    }
    if (custoPI > 0 && actor.system.recursos.pi.value < custoPI) {
      ui.notifications.warn(`${actor.name} não tem PI suficientes para usar ${info.nome} (precisa de ${custoPI}).`);
      return;
    }

    // Gasta recursos
    const updates = {};
    if (custoPE > 0) updates["system.recursos.pe.value"] = actor.system.recursos.pe.value - custoPE;
    if (custoPI > 0) updates["system.recursos.pi.value"] = actor.system.recursos.pi.value - custoPI;
    if (Object.keys(updates).length > 0) {
      await actor.update(updates);
    }

    // Tags pro card
    const tags = [];
    if (custoPE > 0) tags.push(`<span class="hab-card-tag">⚡ ${custoPE} PE</span>`);
    if (custoPI > 0) tags.push(`<span class="hab-card-tag">◈ ${custoPI} PI</span>`);
    if (info.acao === "parcial") tags.push(`<span class="hab-card-tag">Ação Parcial</span>`);
    if (info.acao === "inicial") tags.push(`<span class="hab-card-tag">Ação Inicial</span>`);
    if (info.acao === "reacao")  tags.push(`<span class="hab-card-tag">Reação</span>`);
    if (info.acao === "livre")   tags.push(`<span class="hab-card-tag">Ação Livre</span>`);

    const aprimoradoHtml = info.efeitoAprimorado
      ? `<div class="hab-card-aprimorado"><b>Efeito Aprimorado:</b> ${info.efeitoAprimorado}</div>`
      : "";

    const efeitoHtml = info.efeitoAtual
      ? `<div class="hab-card-efeito"><i class="fas fa-bolt"></i> ${info.efeitoAtual}</div>`
      : "";

    const origemTag = info.origem ? `<span class="hab-card-origem">${info.origem}</span>` : "";

    const custoMsg = (custoPE > 0 || custoPI > 0)
      ? `<div class="hab-card-custo">− ${custoPE > 0 ? custoPE + " PE" : ""} ${custoPI > 0 ? (custoPE > 0 ? "· " : "") + custoPI + " PI" : ""}</div>`
      : "";

    await ChatMessage.implementation.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="sinfonia-hab-card">
          <div class="hab-card-header">
            <span class="hab-card-nome">${info.nome}</span>
            ${origemTag}
          </div>
          ${tags.length ? `<div class="hab-card-tags">${tags.join(" ")}</div>` : ""}
          <div class="hab-card-desc">${info.desc || ""}</div>
          ${efeitoHtml}
          ${aprimoradoHtml}
          ${custoMsg}
        </div>`
    });
  }
}
