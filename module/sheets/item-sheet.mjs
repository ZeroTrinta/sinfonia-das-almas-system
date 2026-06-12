/**
 * Sinfonia das Almas — Item Sheet v2 (v0.8.1)
 * Estilo D&D 5e: header rico (imagem + nome + resumo) e abas Descrição/Detalhes.
 * Template ÚNICO para todos os tipos (arma, armadura, conduite, inventario,
 * magia, habilidade) — campos condicionais por tipo na aba Detalhes.
 */
export class SinfoniaItemSheet extends ItemSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["sinfonia-das-almas", "sheet", "item", "item-v2"],
      width: 580,
      height: 560,
      resizable: true,
      tabs: [{ navSelector: ".item-tabs", contentSelector: ".item-body", initial: "descricao" }]
    });
  }

  get template() {
    // Template único — os campos variam por tipo dentro dele
    return "systems/sinfonia-das-almas/templates/item/item-sheet.hbs";
  }

  async getData() {
    const context = await super.getData();
    const item = this.item;
    const sys  = item.system;
    context.system   = sys;
    context.item     = item;
    context.isOwner  = item.isOwner;
    context.editable = this.isEditable;

    // Editor de descrição (ProseMirror)
    const enrich = foundry.applications?.ux?.TextEditor?.implementation?.enrichHTML
      ?? TextEditor.enrichHTML;
    context.descricaoEnriquecida = await enrich.call(TextEditor, sys.descricao ?? "", { async: true });

    // Flags de tipo pro template
    context.isArma       = item.type === "arma";
    context.isArmadura   = item.type === "armadura";
    context.isConduite   = item.type === "conduite";
    context.isInventario = item.type === "inventario";
    context.isMagia      = item.type === "magia";
    context.isHabilidade = item.type === "habilidade";

    // Selects
    context.escolasConfig    = SINFONIA.ESCOLAS;
    context.categoriasArma   = SINFONIA.CATEGORIAS_ARMA;
    context.classesConfig    = SINFONIA.CLASSES;
    context.categoriasArmadura = { leve: "Leve", media: "Média", pesada: "Pesada", escudo: "Escudo" };
    context.tiposConduite    = { arcano: "Arcano", sagrado: "Sagrado" };
    context.tiposMagia       = { arcana: "Arcana", sagrada: "Sagrada" };
    context.categoriasInv    = { consumivel: "Consumível", ferramenta: "Ferramenta", equipamento: "Equipamento", valioso: "Valioso", outro: "Outro" };
    context.tiposEfeito      = { none: "Nenhum", cura: "Cura", dano: "Dano", resistencia: "Resistência", buff: "Buff" };
    context.circulos         = { 1: "1º Círculo", 2: "2º Círculo", 3: "3º Círculo", 4: "4º Círculo", 5: "5º Círculo" };

    // ── Header: tipo + tags de resumo (estilo dnd5e) ──
    const tipoLabels = {
      arma: "Arma", armadura: "Armadura", conduite: "Conduíte",
      inventario: "Item", magia: "Magia", habilidade: "Habilidade"
    };
    context.tipoLabel = tipoLabels[item.type] ?? item.type;

    const tags = [];
    if (context.isArma) {
      tags.push(SINFONIA.CATEGORIAS_ARMA[sys.categoria] ?? sys.categoria);
      if (sys.dano)     tags.push(`Dano ${sys.dano}`);
      if (sys.alcance)  tags.push(`${sys.alcance}m`);
      if (sys.duasMaos) tags.push("Duas Mãos");
    }
    if (context.isArmadura) {
      tags.push(context.categoriasArmadura[sys.categoria] ?? sys.categoria);
      if (sys.defesaFixa)  tags.push(`DEF ${sys.defesaFixa}`);
      if (sys.bonusDefesa) tags.push(`+${sys.bonusDefesa} DEF`);
      if (sys.reducaoDano) tags.push(`RD ${sys.reducaoDano}`);
    }
    if (context.isConduite) {
      tags.push(sys.tipo === "sagrado" ? "Sagrado" : "Arcano");
      tags.push(`+${sys.valorFixo} dano/cura`);
      if (sys.duasMaos) tags.push("Duas Mãos");
    }
    if (context.isInventario) {
      tags.push(context.categoriasInv[sys.categoria] ?? sys.categoria);
      if (sys.custoPI > 0)    tags.push(`${sys.custoPI} PI`);
      if (sys.quantidade > 1) tags.push(`×${sys.quantidade}`);
    }
    if (context.isMagia) {
      tags.push(`${sys.circulo}º Círculo`);
      tags.push(SINFONIA.ESCOLAS[sys.escola] ?? sys.escola);
      tags.push(sys.tipo === "sagrada" ? "Sagrada" : "Arcana");
      tags.push(`${sys.custoPE} PE`);
      if (sys.custoContinuo > 0) tags.push(`∞ ${sys.custoContinuo} PE/turno`);
    }
    if (context.isHabilidade) {
      if (sys.classe)  tags.push(SINFONIA.CLASSES[sys.classe] ?? sys.classe);
      if (sys.custoPE) tags.push(`${sys.custoPE} PE`);
    }
    context.headerTags = tags;

    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    // Clique na imagem do header abre FilePicker (já nativo do v1 via data-edit="img")
  }
}
