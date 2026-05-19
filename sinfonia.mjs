/**
 * Sinfonia das Almas — Entry Point
 * Inicializa todo o sistema no Foundry VTT
 */

import {
  PersonagemDataModel,
  NpcDataModel,
  HabilidadeDataModel,
  MagiaDataModel,
  ArmaDataModel,
  ArmaduraDataModel,
  InventarioDataModel
} from "./module/data-models.mjs";

import { SinfoniaActor } from "./module/documents.mjs";
import { SinfoniaItem  } from "./module/documents.mjs";

import { SinfoniaActorSheet, SinfoniaNpcSheet } from "./module/sheets/actor-sheet.mjs";
import { SinfoniaItemSheet }                   from "./module/sheets/item-sheet.mjs";

/* ============================================================
   CONSTANTES GLOBAIS
============================================================ */
globalThis.SINFONIA = {
  ATRIBUTOS: {
    pod: { label: "Poder",      abbr: "POD" },
    agi: { label: "Agilidade",  abbr: "AGI" },
    int: { label: "Intelecto",  abbr: "INT" },
    car: { label: "Carisma",    abbr: "CAR" },
    mis: { label: "Misticismo", abbr: "MIS" }
  },
  CLASSES: {
    guerreiro: "Guerreiro",
    gatuno:    "Gatuno",
    arqueiro:  "Arqueiro",
    mago:      "Mago"
  },
  ESCOLAS: {
    abjuracao:    "Abjuração",
    conjuracao:   "Conjuração",
    adivinhacao:  "Adivinhação",
    encantamento: "Encantamento",
    evocacao:     "Evocação",
    ilusao:       "Ilusão",
    necromancia:  "Necromancia",
    transmutacao: "Transmutação",
    divina:       "Divina"
  },
  CATEGORIAS_ARMA: {
    leve:    "Leve",
    espada:  "Espada",
    haste:   "Haste",
    pesada:  "Pesada",
    precisao:"Precisão",
    fogo:    "Fogo"
  },
  MAESTRIA_BONUS: {
    "":          0,
    iniciante:   2,
    treinado:    4,
    experiente:  6
  },
  PERICIAS: {
    armasBrancas:   { label: "Armas Brancas",        atribA: "pod", atribB: "agi" },
    armasDeFogo:    { label: "Armas de Fogo",         atribA: "agi", atribB: "int" },
    atletismo:      { label: "Atletismo",             atribA: "pod", atribB: "agi" },
    briga:          { label: "Briga",                 atribA: "pod", atribB: "agi" },
    conducao:       { label: "Condução",              atribA: "agi", atribB: "int" },
    furtividade:    { label: "Furtividade",           atribA: "agi", atribB: "int" },
    fortitude:      { label: "Fortitude",             atribA: "pod", atribB: "pod" },
    forcaDeVontade: { label: "Força de Vontade",      atribA: "pod", atribB: "car" },
    reflexos:       { label: "Reflexos",              atribA: "agi", atribB: "agi" },
    ladinagem:      { label: "Ladinagem",             atribA: "agi", atribB: "int" },
    oficios:        { label: "Ofícios",               atribA: "int", atribB: "agi" },
    sobrevivencia:  { label: "Sobrevivência",         atribA: "pod", atribB: "int" },
    empatiaAnimais: { label: "Empatia c/ Animais",    atribA: "car", atribB: "car" },
    etiqueta:       { label: "Etiqueta",              atribA: "car", atribB: "int" },
    intimidacao:    { label: "Intimidação",           atribA: "car", atribB: "pod" },
    lideranca:      { label: "Liderança",             atribA: "car", atribB: "car" },
    malandragem:    { label: "Malandragem",           atribA: "int", atribB: "car" },
    performance:    { label: "Performance",           atribA: "car", atribB: "agi" },
    persuasao:      { label: "Persuasão",             atribA: "car", atribB: "car" },
    intuicao:       { label: "Intuição",              atribA: "int", atribB: "car" },
    subterfugio:    { label: "Subterfúgio",           atribA: "car", atribB: "int" },
    ciencia:        { label: "Ciência",               atribA: "int", atribB: "int" },
    erudicao:       { label: "Erudição",              atribA: "int", atribB: "int" },
    financas:       { label: "Finanças",              atribA: "int", atribB: "int" },
    investigacao:   { label: "Investigação",          atribA: "int", atribB: "int" },
    medicina:       { label: "Medicina",              atribA: "int", atribB: "mis" },
    arcanismo:      { label: "Arcanismo",             atribA: "mis", atribB: "mis" },
    percepcao:      { label: "Percepção",             atribA: "int", atribB: "mis" },
    politica:       { label: "Política",              atribA: "int", atribB: "car" },
    tecnologia:     { label: "Tecnologia",            atribA: "int", atribB: "int" }
  }
};

/* ============================================================
   HOOK: INIT
============================================================ */
Hooks.once("init", () => {
  console.log("Sinfonia das Almas | Inicializando sistema...");

  // Document implementations
  CONFIG.Actor.documentClass = SinfoniaActor;
  CONFIG.Item.documentClass  = SinfoniaItem;

  // Data Models
  CONFIG.Actor.dataModels = {
    personagem: PersonagemDataModel,
    npc:        NpcDataModel
  };
  CONFIG.Item.dataModels = {
    habilidade: HabilidadeDataModel,
    magia:      MagiaDataModel,
    arma:       ArmaDataModel,
    armadura:   ArmaduraDataModel,
    inventario: InventarioDataModel
  };

  // Desregistra sheets padrão e registra as nossas
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("sinfonia-das-almas", SinfoniaActorSheet, {
    types: ["personagem"],
    makeDefault: true,
    label: "Ficha de Personagem — Sinfonia das Almas"
  });
  Actors.registerSheet("sinfonia-das-almas", SinfoniaNpcSheet, {
    types: ["npc"],
    makeDefault: true,
    label: "Ficha de NPC — Sinfonia das Almas"
  });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("sinfonia-das-almas", SinfoniaItemSheet, {
    makeDefault: true,
    label: "Item — Sinfonia das Almas"
  });

  // Atributos rastreáveis nos tokens
  CONFIG.Actor.trackableAttributes = {
    personagem: {
      bar:   ["recursos.pv", "recursos.pe"],
      value: ["progressao.nivel", "alma.determinacao", "alma.corrupcao"]
    },
    npc: {
      bar:   ["recursos.pv"],
      value: []
    }
  };

  // Templates de Handlebars
  loadTemplates([
    "systems/sinfonia-das-almas/templates/actor/personagem-sheet.hbs",
    "systems/sinfonia-das-almas/templates/actor/npc-sheet.hbs",
    "systems/sinfonia-das-almas/templates/actor/tabs/principal.hbs",
    "systems/sinfonia-das-almas/templates/actor/tabs/pericias.hbs",
    "systems/sinfonia-das-almas/templates/actor/tabs/inventario.hbs",
    "systems/sinfonia-das-almas/templates/actor/tabs/alma.hbs",
    "systems/sinfonia-das-almas/templates/actor/tabs/bio.hbs",
    "systems/sinfonia-das-almas/templates/item/habilidade-sheet.hbs",
    "systems/sinfonia-das-almas/templates/item/magia-sheet.hbs",
    "systems/sinfonia-das-almas/templates/item/arma-sheet.hbs",
    "systems/sinfonia-das-almas/templates/item/armadura-sheet.hbs",
    "systems/sinfonia-das-almas/templates/item/inventario-sheet.hbs"
  ]);

  console.log("Sinfonia das Almas | Sistema inicializado.");
});

/* ============================================================
   HOOK: READY
============================================================ */
Hooks.once("ready", () => {
  console.log("Sinfonia das Almas | Pronto.");
});

/* ============================================================
   HANDLEBARS HELPERS
============================================================ */
Hooks.once("init", () => {
  // Bônus de maestria
  Handlebars.registerHelper("maestriaBonus", (maestria) => {
    return SINFONIA.MAESTRIA_BONUS[maestria] ?? 0;
  });

  // Label de perícia
  Handlebars.registerHelper("periciaNome", (key) => {
    return SINFONIA.PERICIAS[key]?.label ?? key;
  });

  // Label de atributo
  Handlebars.registerHelper("atribLabel", (key) => {
    return SINFONIA.ATRIBUTOS[key]?.label ?? key;
  });

  // Barra percentual (para alma)
  Handlebars.registerHelper("pct", (value, max) => {
    if (!max) return 0;
    return Math.round((value / max) * 100);
  });

  // Comparação simples
  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("gt", (a, b) => a > b);

  // Concatenar strings
  Handlebars.registerHelper("concat", (...args) => args.slice(0, -1).join(""));
});
