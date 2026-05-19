/**
 * Sinfonia das Almas — Item Sheet
 */
export class SinfoniaItemSheet extends ItemSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["sinfonia-das-almas", "sheet", "item"],
      width: 560,
      height: 480,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "detalhes" }]
    });
  }

  get template() {
    return `systems/sinfonia-das-almas/templates/item/${this.item.type}-sheet.hbs`;
  }

  async getData() {
    const context = await super.getData();
    context.system   = this.item.system;
    context.item     = this.item;
    context.isOwner  = this.item.isOwner;
    context.descricaoEnriquecida = await TextEditor.enrichHTML(
      this.item.system.descricao ?? "", { async: true }
    );

    // Configs específicas por tipo
    if (this.item.type === "magia") {
      context.escolasConfig  = SINFONIA.ESCOLAS;
      context.circuloLabel   = `${this.item.system.circulo}º Círculo`;
    }
    if (this.item.type === "arma") {
      context.categoriasArma = SINFONIA.CATEGORIAS_ARMA;
    }
    if (this.item.type === "habilidade") {
      context.classesConfig  = SINFONIA.CLASSES;
    }

    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
  }
}
