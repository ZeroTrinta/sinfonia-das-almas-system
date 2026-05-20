/**
 * Sinfonia das Almas — Actor Sheet
 * Ficha de personagem no Foundry VTT
 */
export class SinfoniaActorSheet extends ActorSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["sinfonia-das-almas", "sheet", "actor"],
      template: "systems/sinfonia-das-almas/templates/actor/personagem-sheet.hbs",
      width: 780,
      height: 900,
      tabs: [
        { navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "principal" }
      ],
      scrollY: [".sheet-body"]
    });
  }

  get template() {
    return `systems/sinfonia-das-almas/templates/actor/${this.actor.type}-sheet.hbs`;
  }

  /** Prepara os dados para o template Handlebars */
  async getData() {
    const context = await super.getData();
    const sys = this.actor.system;

    context.system    = sys;
    context.actor     = this.actor;
    context.isOwner   = this.actor.isOwner;
    context.isEditable = this.isEditable;
    context.rollData  = this.actor.getRollData();

    // Enriquece campos HTML (compatível v12 e v13)
    const enricher = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
    context.bioEnriquecida    = await enricher.enrichHTML(sys.biografia ?? "", { async: true });
    context.notasEnriquecidas = await enricher.enrichHTML(sys.notas     ?? "", { async: true });

    // Labels de perícias
    context.periciasConfig = SINFONIA.PERICIAS;

    // Dados de atributos com labels
    context.atributosConfig = SINFONIA.ATRIBUTOS;

    // Bônus de maestria
    context.maestriaBonus = { iniciante: 2, treinado: 4, experiente: 6 };

    // Dados de escolhas de dado
    context.dadoChoices = { d6: "d6", d8: "d8", d10: "d10", d12: "d12" };

    // Classes disponíveis
    context.classesChoices = SINFONIA.CLASSES;

    // Itens organizados por tipo
    context.habilidades = this.actor.items.filter(i => i.type === "habilidade");
    context.magias      = this.actor.items.filter(i => i.type === "magia")
      .sort((a, b) => a.system.circulo - b.system.circulo);
    context.armas       = this.actor.items.filter(i => i.type === "arma");
    context.armaduras   = this.actor.items.filter(i => i.type === "armadura");
    context.inventario  = this.actor.items.filter(i => i.type === "inventario");

    // Porcentagem das barras de alma
    context.detPct = (sys.alma?.determinacao ?? 7) * 10;
    context.corPct = (sys.alma?.corrupcao    ?? 3) * 10;

    return context;
  }

  /** Registra os event listeners */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // Rolls de perícia
    html.find(".pericia-roll").click(this._onRolarPericia.bind(this));

    // Usar itens
    html.find(".item-usar").click(this._onUsarItem.bind(this));

    // Criar item inline
    html.find(".item-create").click(this._onCriarItem.bind(this));

    // Deletar item
    html.find(".item-delete").click(this._onDeletarItem.bind(this));

    // Editar item
    html.find(".item-edit").click(this._onEditarItem.bind(this));

    // Determinação +/-
    html.find(".det-btn").click(this._onAlternarDeterminacao.bind(this));

    // Origem toggle
    html.find(".origem-toggle").click(this._onToggleOrigem.bind(this));

    // Abrir Árvore de Habilidades
    html.find(".btn-arvore").click(() => {
      const arvore = new ArvoreHabilidades(this.actor);
      arvore.render(true);
    });

    // Drag & drop de itens
    html.find(".item").each((i, li) => {
      li.setAttribute("draggable", true);
      li.addEventListener("dragstart", this._onDragStart.bind(this), false);
    });
  }

  async _onRolarPericia(event) {
    event.preventDefault();
    const el = event.currentTarget;
    const { pericia, atribA, atribB } = el.dataset;

    // Diálogo para definir ND
    const nd = await this._dialogND();
    if (nd === null) return;

    await this.actor.rolarPericia(pericia, atribA, atribB, nd);
  }

  async _dialogND() {
    return new Promise(resolve => {
      new Dialog({
        title: "Nível de Dificuldade",
        content: `
          <form>
            <div class="form-group">
              <label>ND</label>
              <input type="number" id="nd-value" value="12" min="1" max="30" autofocus/>
            </div>
          </form>
        `,
        buttons: {
          rolar: {
            icon: "<i class='fas fa-dice'></i>",
            label: "Rolar",
            callback: html => resolve(parseInt(html.find("#nd-value").val()) || 12)
          },
          cancelar: {
            label: "Cancelar",
            callback: () => resolve(null)
          }
        },
        default: "rolar"
      }).render(true);
    });
  }

  async _onUsarItem(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item   = this.actor.items.get(itemId);
    if (item) await item.usar(this.actor);
  }

  async _onCriarItem(event) {
    event.preventDefault();
    const tipo = event.currentTarget.dataset.tipo || "inventario";
    await Item.implementation.create(
      { name: `Novo ${tipo}`, type: tipo },
      { parent: this.actor }
    );
  }

  async _onDeletarItem(event) {
    event.preventDefault();
    const li     = event.currentTarget.closest(".item");
    const itemId = li.dataset.itemId;
    const item   = this.actor.items.get(itemId);
    if (!item) return;
    const confirmed = await Dialog.confirm({
      title: "Deletar Item",
      content: `<p>Deletar <strong>${item.name}</strong>?</p>`
    });
    if (confirmed) await item.delete();
  }

  _onEditarItem(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item   = this.actor.items.get(itemId);
    if (item) item.sheet.render(true);
  }

  async _onAlternarDeterminacao(event) {
    event.preventDefault();
    const delta = parseInt(event.currentTarget.dataset.delta) || 0;
    const det   = this.actor.system.alma.determinacao;
    const novo  = Math.clamp(det + delta, 0, 10);
    await this.actor.update({ "system.alma.determinacao": novo });
  }

  async _onToggleOrigem(event) {
    event.preventDefault();
    const tipo  = event.currentTarget.dataset.tipo; // eventoMarcante | ocupacao
    const atual = this.actor.system.origem[tipo].usadoNaSessao;
    await this.actor.update({ [`system.origem.${tipo}.usadoNaSessao`]: !atual });
  }
}

/* ── NPC Sheet ── */
export class SinfoniaNpcSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["sinfonia-das-almas", "sheet", "actor", "npc"],
      template: "systems/sinfonia-das-almas/templates/actor/npc-sheet.hbs",
      width: 600,
      height: 600
    });
  }

  async getData() {
    const context = await super.getData();
    context.system = this.actor.system;
    context.descricaoEnriquecida = await TextEditor.enrichHTML(
      this.actor.system.descricao ?? "", { async: true }
    );
    return context;
  }
}
