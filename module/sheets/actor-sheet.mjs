/**
 * Sinfonia das Almas — Actor Sheet v2
 * Usa DocumentSheetV2 (Foundry v13) para evitar re-render no update
 */

const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SinfoniaActorSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["sinfonia-das-almas", "sheet", "actor"],
    position: { width: 800, height: 900 },
    window: { resizable: true },
    form: {
      submitOnChange: true,   // salva automaticamente ao mudar qualquer campo
      closeOnSubmit:  false
    },
    actions: {
      rolarPericia:     SinfoniaActorSheet._onRolarPericia,
      usarItem:         SinfoniaActorSheet._onUsarItem,
      criarItem:        SinfoniaActorSheet._onCriarItem,
      deletarItem:      SinfoniaActorSheet._onDeletarItem,
      editarItem:       SinfoniaActorSheet._onEditarItem,
      alternarDet:      SinfoniaActorSheet._onAlternarDet,
      toggleOrigem:     SinfoniaActorSheet._onToggleOrigem,
      abrirArvore:      SinfoniaActorSheet._onAbrirArvore
    }
  };

  static PARTS = {
    form: {
      template: "systems/sinfonia-das-almas/templates/actor/personagem-sheet.hbs",
      scrollable: [".sheet-body"]
    }
  };

  get title() {
    return this.document.name;
  }

  // ── Context ────────────────────────────────────────────────
  async _prepareContext(options) {
    const doc = this.document;
    const sys = doc.system;
    const enricher = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;

    return {
      actor:            doc,
      system:           sys,
      isOwner:          doc.isOwner,
      isEditable:       this.isEditable,
      atributosConfig:  SINFONIA.ATRIBUTOS,
      periciasConfig:   SINFONIA.PERICIAS,
      maestriaBonus:    { iniciante:2, treinado:4, experiente:6 },
      habilidades:      doc.items.filter(i => i.type === "habilidade"),
      magias:           doc.items.filter(i => i.type === "magia").sort((a,b) => a.system.circulo - b.system.circulo),
      armas:            doc.items.filter(i => i.type === "arma"),
      armaduras:        doc.items.filter(i => i.type === "armadura"),
      inventario:       doc.items.filter(i => i.type === "inventario"),
      detPct:           (sys.alma?.determinacao ?? 7) * 10,
      corPct:           (sys.alma?.corrupcao    ?? 3) * 10,
      bioEnriquecida:   await enricher.enrichHTML(sys.biografia ?? "", { async: true }),
      notasEnriquecidas:await enricher.enrichHTML(sys.notas     ?? "", { async: true })
    };
  }

  // ── Tabs ──────────────────────────────────────────────────
  _onRender(context, options) {
    super._onRender?.(context, options);

    // Tab switching manual (DocumentSheetV2 não tem sistema de tabs embutido)
    const tabs     = this.element.querySelectorAll(".sheet-tabs .item");
    const contents = this.element.querySelectorAll(".sheet-body .tab");

    const activateTab = (name) => {
      tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === name));
      contents.forEach(c => c.classList.toggle("active", c.dataset.tab === name));
      this._activeTab = name;
    };

    tabs.forEach(tab => {
      tab.addEventListener("click", () => activateTab(tab.dataset.tab));
    });

    // Restaura a tab ativa
    activateTab(this._activeTab ?? "principal");
  }

  // ── Actions ────────────────────────────────────────────────
  static async _onRolarPericia(event, target) {
    const { pericia, atribA, atribB } = target.dataset;
    const nd = await SinfoniaActorSheet._dialogND();
    if (nd === null) return;
    await this.document.rolarPericia(pericia, atribA, atribB, nd);
  }

  static async _dialogND() {
    return new Promise(resolve => {
      if (foundry.applications?.api?.DialogV2) {
        foundry.applications.api.DialogV2.prompt({
          window: { title: "Nível de Dificuldade" },
          content: `<div style="padding:8px">
            <label style="font-family:'Cinzel',serif;font-size:11px">ND</label>
            <input type="number" name="nd" value="12" min="1" max="30" autofocus
              style="width:100%;margin-top:4px;font-size:18px;text-align:center;"/>
          </div>`,
          ok: { label: "Rolar", icon: "fa-dice",
            callback: (ev, btn) => resolve(parseInt(btn.form.elements.nd.value) || 12) },
          cancel: { label: "Cancelar", callback: () => resolve(null) }
        });
      } else {
        resolve(12);
      }
    });
  }

  static async _onUsarItem(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const item   = this.document.items.get(itemId);
    if (item) await item.usar(this.document);
  }

  static async _onCriarItem(event, target) {
    const tipo = target.dataset.tipo || "inventario";
    await Item.implementation.create(
      { name: `Novo ${tipo}`, type: tipo },
      { parent: this.document }
    );
  }

  static async _onDeletarItem(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const item   = this.document.items.get(itemId);
    if (!item) return;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Deletar Item" },
      content: `<p>Deletar <strong>${item.name}</strong>?</p>`
    });
    if (ok) await item.delete();
  }

  static _onEditarItem(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    this.document.items.get(itemId)?.sheet.render(true);
  }

  static async _onAlternarDet(event, target) {
    const delta = parseInt(target.dataset.delta) || 0;
    const det   = this.document.system.alma.determinacao;
    const novo  = Math.clamp(det + delta, 0, 10);
    await this.document.update({ "system.alma.determinacao": novo });
  }

  static async _onToggleOrigem(event, target) {
    const tipo  = target.dataset.tipo;
    const atual = this.document.system.origem[tipo].usadoNaSessao;
    await this.document.update({ [`system.origem.${tipo}.usadoNaSessao`]: !atual });
  }

  static _onAbrirArvore(event, target) {
    const arvore = new ArvoreHabilidades(this.document);
    arvore.render(true);
  }
}

/* ── NPC Sheet (mantém V1 por simplicidade) ── */
export class SinfoniaNpcSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["sinfonia-das-almas", "sheet", "actor", "npc"],
      template: "systems/sinfonia-das-almas/templates/actor/npc-sheet.hbs",
      width: 600, height: 600
    });
  }
  async getData() {
    const ctx = await super.getData();
    ctx.system = this.actor.system;
    const enricher = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
    ctx.descricaoEnriquecida = await enricher.enrichHTML(this.actor.system.descricao ?? "", { async: true });
    return ctx;
  }
}
