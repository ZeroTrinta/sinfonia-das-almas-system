/**
 * Sinfonia das Almas — Actor Sheet v2
 * DocumentSheetV2 — sem re-render no update, sem flickering
 */

const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SinfoniaActorSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["sinfonia-das-almas", "sheet", "actor"],
    position: { width: 800, height: 900 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      rolarPericia: SinfoniaActorSheet._onRolarPericia,
      usarItem:     SinfoniaActorSheet._onUsarItem,
      criarItem:    SinfoniaActorSheet._onCriarItem,
      deletarItem:  SinfoniaActorSheet._onDeletarItem,
      editarItem:   SinfoniaActorSheet._onEditarItem,
      alternarDet:  SinfoniaActorSheet._onAlternarDet,
      abrirArvore:  SinfoniaActorSheet._onAbrirArvore
    }
  };

  static PARTS = {
    form: {
      template: "systems/sinfonia-das-almas/templates/actor/personagem-sheet.hbs",
      scrollable: [".sheet-body"]
    }
  };

  get title() { return this.document.name; }

  // ── Context ────────────────────────────────────────────────
  async _prepareContext(options) {
    const doc = this.document;
    const sys = doc.system;
    return {
      actor:           doc,
      system:          sys,
      isOwner:         doc.isOwner,
      isEditable:      this.isEditable,
      atributosConfig: SINFONIA.ATRIBUTOS,
      periciasConfig:  SINFONIA.PERICIAS,
      habilidades:     doc.items.filter(i => i.type === "habilidade"),
      magias:          doc.items.filter(i => i.type === "magia").sort((a,b) => a.system.circulo - b.system.circulo),
      armas:           doc.items.filter(i => i.type === "arma"),
      armaduras:       doc.items.filter(i => i.type === "armadura"),
      inventario:      doc.items.filter(i => i.type === "inventario"),
      detPct:          (sys.alma?.determinacao ?? 7) * 10,
      corPct:          (sys.alma?.corrupcao    ?? 3) * 10,
    };
  }

  // ── Render ─────────────────────────────────────────────────
  _onRender(context, options) {
    super._onRender?.(context, options);

    // Tabs manuais
    const activateTab = (name) => {
      this.element.querySelectorAll(".sheet-tabs .item")
        .forEach(t => t.classList.toggle("active", t.dataset.tab === name));
      this.element.querySelectorAll(".sheet-body .tab")
        .forEach(c => c.classList.toggle("active", c.dataset.tab === name));
      this._activeTab = name;
    };
    this.element.querySelectorAll(".sheet-tabs .item").forEach(tab => {
      tab.addEventListener("click", () => activateTab(tab.dataset.tab));
    });
    activateTab(this._activeTab ?? "principal");
  }

  // ── Bloqueia re-render ao salvar campos locais ─────────────
  // O Foundry chama render() quando o documento é atualizado.
  // Interceptamos aqui: se a mudança veio do próprio usuário,
  // apenas patchamos os valores sem recriar o HTML.
  _onChangeDocument(change, options, userId) {
    if (userId === game.user.id) {
      // Mudança local — só atualiza valores dinâmicos
      this._patchValues();
    } else {
      // Mudança de outro usuário — re-render normal
      super._onChangeDocument?.(change, options, userId);
    }
  }

  _patchValues() {
    const el  = this.element;
    const sys = this.document.system;
    if (!el) return;

    // Atualiza inputs sem tirar o foco do usuário
    const patch = (name, val) => {
      const inp = el.querySelector(`input[name="${name}"]`);
      if (inp && document.activeElement !== inp) inp.value = val;
    };
    const patchSel = (name, val) => {
      const sel = el.querySelector(`select[name="${name}"]`);
      if (sel && document.activeElement !== sel) sel.value = val;
    };

    patch("system.recursos.pv.value", sys.recursos.pv.value);
    patch("system.recursos.pv.max",   sys.recursos.pv.max);
    patch("system.recursos.pe.value", sys.recursos.pe.value);
    patch("system.recursos.pe.max",   sys.recursos.pe.max);
    patch("system.recursos.pi.value", sys.recursos.pi.value);
    patch("system.recursos.pi.max",   sys.recursos.pi.max);
    patch("system.combate.estilhacos", sys.combate.estilhacos);
    patch("system.progressao.pontosHabilidade", sys.progressao.pontosHabilidade);
    patch("system.combate.defesa",     sys.combate.defesa);
    patch("system.combate.iniciativa", sys.combate.iniciativa);
    patch("system.combate.ndMistica",  sys.combate.ndMistica);
    patch("system.alma.determinacao",  sys.alma.determinacao);

    patchSel("system.progressao.classe", sys.progressao.classe);
    Object.keys(sys.atributos ?? {}).forEach(k =>
      patchSel(`system.atributos.${k}`, sys.atributos[k])
    );

    // Barras de alma
    const det = sys.alma?.determinacao ?? 7;
    const cor = sys.alma?.corrupcao    ?? 3;
    const detBar = el.querySelector(".det-fill");
    const corBar = el.querySelector(".cor-fill");
    const detVal = el.querySelector(".det-lado .alma-valor");
    const corVal = el.querySelector(".cor-lado .alma-valor");
    if (detBar) detBar.style.width = (det * 10) + "%";
    if (corBar) corBar.style.width = (cor * 10) + "%";
    if (detVal) detVal.textContent = det;
    if (corVal) corVal.textContent = cor;
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
      foundry.applications.api.DialogV2.prompt({
        window: { title: "Nível de Dificuldade" },
        content: `<div style="padding:8px">
          <label style="font-family:'Cinzel',serif;font-size:11px">ND</label>
          <input type="number" name="nd" value="12" min="1" max="30" autofocus
            style="width:100%;margin-top:4px;font-size:18px;text-align:center;"/>
        </div>`,
        ok:     { label:"Rolar",    icon:"fa-dice", callback: (ev,btn) => resolve(parseInt(btn.form.elements.nd.value)||12) },
        cancel: { label:"Cancelar",                callback: () => resolve(null) }
      });
    });
  }

  static async _onUsarItem(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (item) await item.usar(this.document);
  }

  static async _onCriarItem(event, target) {
    await Item.implementation.create(
      { name:`Novo ${target.dataset.tipo||"inventario"}`, type: target.dataset.tipo||"inventario" },
      { parent: this.document }
    );
  }

  static async _onDeletarItem(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (!item) return;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Deletar Item" },
      content: `<p>Deletar <strong>${item.name}</strong>?</p>`
    });
    if (ok) await item.delete();
  }

  static _onEditarItem(event, target) {
    this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId)?.sheet.render(true);
  }

  static async _onAlternarDet(event, target) {
    const det  = this.document.system.alma.determinacao;
    const novo = Math.clamp(det + (parseInt(target.dataset.delta)||0), 0, 10);
    await this.document.update({ "system.alma.determinacao": novo });
  }

  static _onAbrirArvore(event, target) {
    new ArvoreHabilidades(this.document).render(true);
  }
}

/* ── NPC Sheet ── */
export class SinfoniaNpcSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["sinfonia-das-almas","sheet","actor","npc"],
      template: "systems/sinfonia-das-almas/templates/actor/npc-sheet.hbs",
      width: 600, height: 600
    });
  }
  async getData() {
    const ctx = await super.getData();
    ctx.system = this.actor.system;
    const e = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
    ctx.descricaoEnriquecida = await e.enrichHTML(this.actor.system.descricao ?? "", { async: true });
    return ctx;
  }
}
