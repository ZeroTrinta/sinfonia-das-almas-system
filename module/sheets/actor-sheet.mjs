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
    // ✦ ABORDAGEM B (ATIVA): submitOnChange desligado. Cada campo é salvo
    //    manualmente via listener no _onRender com {render:false}.
    //    Para usar a ABORDAGEM A: troque por { submitOnChange: true, closeOnSubmit: false }
    //    e descomente o bloco _canRender/_processSubmitData mais abaixo.
    form: { submitOnChange: false, closeOnSubmit: false },
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

    // ✦ ABORDAGEM B: salvamento manual no change SEM re-render.
    //    {render:false} é a chave — atualiza o documento mas não recria o HTML,
    //    então não há perda de foco, aba ativa, scroll, nem flicker.
    this.element.querySelectorAll("input, select, textarea").forEach(el => {
      el.addEventListener("change", async (ev) => {
        const t = ev.currentTarget;
        const name = t.name;
        if (!name) return;
        if (!name.startsWith("system.") && name !== "name") return;

        let value;
        if (t.type === "number") {
          value = t.value === "" ? null : Number(t.value);
          if (Number.isNaN(value)) return;
        } else if (t.type === "checkbox") {
          value = t.checked;
        } else {
          value = t.value;
        }

        try {
          await this.document.update({ [name]: value }, { render: false });
        } catch (err) {
          console.error("Sinfonia | Falha ao salvar campo", name, err);
          ui.notifications.error(`Não foi possível salvar ${name}.`);
        }
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // ✦ ABORDAGEM A — ALTERNATIVA (comentada).
  //
  // Se você quiser voltar ao modelo clássico de "o próprio Foundry submete
  // o form a cada change", basta:
  //   1. Em DEFAULT_OPTIONS, trocar:
  //        form: { submitOnChange: false, closeOnSubmit: false }
  //      por:
  //        form: { submitOnChange: true,  closeOnSubmit: false }
  //   2. Remover (ou comentar) o listener de "change" no _onRender que
  //      faz update manual com {render:false}.
  //   3. Descomentar os dois métodos abaixo. Eles funcionam assim:
  //      • _processSubmitData levanta uma flag antes do submit ocorrer.
  //      • _canRender vê a flag e cancela o próximo render automático.
  //      • Depois de 100ms a flag baixa, de forma que renders
  //        legítimos (mudança de outro usuário, tôpicos do GM, etc) voltem.
  //
  // /** Cancela re-render quando ele veio do nosso próprio submit */
  // _canRender(options) {
  //   if (this._submitting) return false;
  //   return super._canRender?.(options) ?? true;
  // }
  //
  // /** Marca a flag _submitting antes/depois do submit */
  // async _processSubmitData(event, form, submitData) {
  //   this._submitting = true;
  //   try {
  //     await super._processSubmitData(event, form, submitData);
  //   } finally {
  //     setTimeout(() => { this._submitting = false; }, 100);
  //   }
  // }
  // ─────────────────────────────────────────────────────────────────

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
    // {render:false} é essencial: sem ele, clicar nas setas refaz o HTML
    // e a barra "piscaria". O _onRender já redesenha as barras manualmente
    // via Handlebars na próxima abertura, e enquanto isso o valor já está
    // persistido. Se quiser feedback visual imediato, atualize as barras
    // aqui manualmente antes do update.
    await this.document.update({ "system.alma.determinacao": novo }, { render: false });

    // Atualiza as barras de alma na hora, sem re-render da ficha inteira
    const el = this.element;
    if (el) {
      const cor = 10 - novo;
      const detBar = el.querySelector(".det-fill");
      const corBar = el.querySelector(".cor-fill");
      const detVal = el.querySelector(".det-lado .alma-valor");
      const corVal = el.querySelector(".cor-lado .alma-valor");
      if (detBar) detBar.style.width = (novo * 10) + "%";
      if (corBar) corBar.style.width = (cor  * 10) + "%";
      if (detVal) detVal.textContent = novo;
      if (corVal) corVal.textContent = cor;
    }
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
