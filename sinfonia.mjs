/**
 * Sinfonia das Almas — Entry Point v0.2.0
 * Inclui Árvore de Habilidades integrada
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

import { SinfoniaActor, SinfoniaItem } from "./module/documents.mjs";
import { SinfoniaActorSheet, SinfoniaNpcSheet } from "./module/sheets/actor-sheet.mjs";
import { SinfoniaItemSheet } from "./module/sheets/item-sheet.mjs";
import { ArvoreHabilidades } from "./module/sheets/arvore-sheet.mjs";

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
  },

  // ── Árvore de Habilidades ──────────────────────────────────
  CLS_META: {
    guerreiro: { label:"Guerreiro", color:"#c84040", glow:"#ff6060", cx:-500, cy:-100 },
    gatuno:    { label:"Gatuno",    color:"#40b8c8", glow:"#80e8f8", cx: 500, cy:-100 },
    arqueiro:  { label:"Arqueiro",  color:"#58c858", glow:"#90f890", cx:-500, cy: 300 },
    mago:      { label:"Mago",      color:"#9060e8", glow:"#c090ff", cx: 500, cy: 300 },
  },

  NODES: [
    {id:"center",label:"Origem",type:"start",cls:"all",x:0,y:0,cost:0,passive:true,desc:"O ponto de partida de toda jornada."},
    {id:"g_start",label:"Despertar do Guerreiro",type:"start",cls:"guerreiro",x:-500,y:-100,cost:0,desc:"Você ouviu o chamado das batalhas."},
    {id:"g_espadas",label:"Perícia c/ Espadas",type:"major",cls:"guerreiro",x:-680,y:-100,cost:1,desc:"Espadas sem penalidade. +1 dano."},
    {id:"g_hastes",label:"Perícia c/ Hastes",type:"major",cls:"guerreiro",x:-500,y:-260,cost:1,desc:"Lanças e alabardas. Alcance +1,5m."},
    {id:"g_pesadas",label:"Perícia c/ Pesadas",type:"major",cls:"guerreiro",x:-500,y:60,cost:1,desc:"Maças e machados. Ignorar 2 RD."},
    {id:"g_vigor1",label:"Vigor I",type:"minor",cls:"guerreiro",x:-840,y:-100,cost:1,desc:"+9 PV máximos."},
    {id:"g_vigor2",label:"Vigor II",type:"minor",cls:"guerreiro",x:-960,y:-60,cost:1,desc:"+9 PV máximos."},
    {id:"g_vigor3",label:"Vigor III",type:"minor",cls:"guerreiro",x:-960,y:-140,cost:1,desc:"+9 PV máximos."},
    {id:"g_provocar",label:"Provocar",type:"major",cls:"guerreiro",x:-680,y:60,cost:1,desc:"5 PE: force inimigos a te atacar."},
    {id:"g_provocar2",label:"Provocar Aprimorado",type:"minor",cls:"guerreiro",x:-680,y:180,cost:1,desc:"Afeta +1 alvo. -2 no teste inimigo."},
    {id:"g_atq_extra",label:"Ataque Extra",type:"keystone",cls:"guerreiro",x:-840,y:-260,cost:2,desc:"Realize um segundo ataque no turno."},
    {id:"g_manobra1",label:"Golpe Giratório",type:"major",cls:"guerreiro",x:-340,y:-260,cost:1,desc:"10 PE: ataque em área de 3m."},
    {id:"g_manobra2",label:"Rude Buster",type:"major",cls:"guerreiro",x:-340,y:-140,cost:1,desc:"15 PE: ataque poderoso a 9m."},
    {id:"g_manobra3",label:"Postura de Aço",type:"major",cls:"guerreiro",x:-340,y:60,cost:1,desc:"Ação Parcial, 10 PE: -10 dano, +5 Defesa."},
    {id:"g_manobra4",label:"Contra Ataque",type:"minor",cls:"guerreiro",x:-340,y:180,cost:1,desc:"Dado PAR: reação para atacar."},
    {id:"g_milagre",label:"Iniciado em Milagres",type:"keystone",cls:"guerreiro",x:-660,y:-380,cost:2,desc:"Aprenda magias Sagradas de 1º Círculo."},
    {id:"g_lider",label:"Líder Inspirador",type:"major",cls:"guerreiro",x:-840,y:60,cost:1,desc:"15 PE: PVT a aliados = 3×dado POD."},
    {id:"r_start",label:"Despertar do Gatuno",type:"start",cls:"gatuno",x:500,y:-100,cost:0,desc:"Você abraçou as sombras."},
    {id:"r_leves",label:"Perícia c/ Leves",type:"major",cls:"gatuno",x:680,y:-100,cost:1,desc:"Adagas e facas sem penalidade."},
    {id:"r_precisao",label:"Perícia c/ Precisão",type:"major",cls:"gatuno",x:500,y:-260,cost:1,desc:"Bestas leves e pistolas."},
    {id:"r_reflexos",label:"Reflexos Apurados",type:"major",cls:"gatuno",x:500,y:60,cost:1,desc:"5 PE: +5 em testes de Reflexos."},
    {id:"r_esquiva",label:"Esquiva Implacável",type:"major",cls:"gatuno",x:680,y:60,cost:1,desc:"10 PE: reduza metade do dano."},
    {id:"r_esquiva2",label:"Esquiva Aprimorada",type:"minor",cls:"gatuno",x:840,y:60,cost:1,desc:"Esquiva custa apenas 5 PE."},
    {id:"r_atkvital",label:"Ataque Vital I",type:"keystone",cls:"gatuno",x:840,y:-100,cost:2,desc:"1d6 extra contra Desprevenidos."},
    {id:"r_atkvital2",label:"Ataque Vital II",type:"minor",cls:"gatuno",x:960,y:-60,cost:1,desc:"Dado de Ataque Vital: 2d6."},
    {id:"r_atkvital3",label:"Ataque Vital III",type:"minor",cls:"gatuno",x:960,y:-140,cost:1,desc:"Dado de Ataque Vital: 3d6."},
    {id:"r_veneno1",label:"Iniciado em Venenos",type:"major",cls:"gatuno",x:500,y:-380,cost:1,desc:"Fabrique e aplique toxinas básicas."},
    {id:"r_veneno2",label:"Corpo Resistente",type:"minor",cls:"gatuno",x:340,y:-380,cost:1,desc:"Vantagem vs venenos."},
    {id:"r_veneno3",label:"Venenos Avançados",type:"major",cls:"gatuno",x:660,y:-380,cost:1,desc:"Toxinas superiores. ND +2."},
    {id:"r_passo",label:"Passo das Sombras",type:"major",cls:"gatuno",x:340,y:-100,cost:1,desc:"10 PE: teleporte 6m sem ataques de oport."},
    {id:"r_finta",label:"Finta Ardilosa",type:"minor",cls:"gatuno",x:340,y:60,cost:1,desc:"5 PE: alvo Desprevenido para próx. ataque."},
    {id:"r_afanar",label:"Afanar Vitae",type:"keystone",cls:"gatuno",x:660,y:-260,cost:2,desc:"Zerando com Ataque Vital, cure metade do dano."},
    {id:"r_copiar",label:"Copiar Magia",type:"major",cls:"gatuno",x:840,y:-260,cost:1,desc:"Reação: replique conjuração. Uso único."},
    {id:"a_start",label:"Despertar do Arqueiro",type:"start",cls:"arqueiro",x:-500,y:300,cost:0,desc:"A distância é sua aliada."},
    {id:"a_arcos",label:"Perícia c/ Arcos",type:"major",cls:"arqueiro",x:-680,y:300,cost:1,desc:"Arcos curtos e longos sem penalidade."},
    {id:"a_bestas",label:"Perícia c/ Bestas",type:"major",cls:"arqueiro",x:-500,y:460,cost:1,desc:"Bestas sem penalidade de recarga."},
    {id:"a_aguia",label:"Olhos de Águia",type:"major",cls:"arqueiro",x:-500,y:140,cost:1,desc:"Visão 2×. Vê através de fumaça."},
    {id:"a_conc1",label:"Concentração I",type:"minor",cls:"arqueiro",x:-840,y:300,cost:1,desc:"+2 dano com Arcos/Bestas."},
    {id:"a_conc2",label:"Concentração II",type:"minor",cls:"arqueiro",x:-960,y:260,cost:1,desc:"+2 dano adicional. Total: +4."},
    {id:"a_conc3",label:"Concentração III",type:"minor",cls:"arqueiro",x:-960,y:340,cost:1,desc:"+2 dano adicional. Total: +6."},
    {id:"a_chuva",label:"Chuva de Flechas",type:"major",cls:"arqueiro",x:-680,y:460,cost:1,desc:"15 PE: saraivada em área Cubo 4,5m."},
    {id:"a_perfurante",label:"Tiro Perfurante",type:"major",cls:"arqueiro",x:-340,y:460,cost:1,desc:"10 PE: flecha atravessa linha de 9m."},
    {id:"a_fantasma",label:"Tiro Fantasma",type:"keystone",cls:"arqueiro",x:-680,y:140,cost:2,desc:"15 PE: ignora paredes. Alcance 12m."},
    {id:"a_armadilha",label:"Armadilha de Caça",type:"major",cls:"arqueiro",x:-340,y:300,cost:1,desc:"2 PI: armadilha ND 12. Falha = Imobilizado."},
    {id:"a_eleito",label:"Inimigo Eleito",type:"major",cls:"arqueiro",x:-340,y:140,cost:1,desc:"+2 acerto/dano vs alvo por 1 min."},
    {id:"a_marca",label:"Marca do Caçador",type:"major",cls:"arqueiro",x:-840,y:140,cost:1,desc:"5 PE: +2 acerto vs alvo para aliados."},
    {id:"a_intercepta",label:"Interceptação",type:"minor",cls:"arqueiro",x:-840,y:460,cost:1,desc:"Reação, 10 PE: cancela projétil PAR."},
    {id:"a_recuo",label:"Recuo Calculado",type:"keystone",cls:"arqueiro",x:-660,y:580,cost:2,desc:"Reação, 10 PE: salte 3m, dano dobrado."},
    {id:"a_encant",label:"Iniciado em Encantamento",type:"major",cls:"arqueiro",x:-340,y:580,cost:1,desc:"Aprenda 1 magia Arcana de Encantamento."},
    {id:"m_start",label:"Despertar do Mago",type:"start",cls:"mago",x:500,y:300,cost:0,desc:"A realidade se dobra à sua vontade."},
    {id:"m_conduite",label:"Perícia c/ Conduítes",type:"major",cls:"mago",x:680,y:300,cost:1,desc:"Cajados e varinhas sem penalidade."},
    {id:"m_mente",label:"Mente Expandida I",type:"minor",cls:"mago",x:500,y:460,cost:1,desc:"+10 PE máximos."},
    {id:"m_mente2",label:"Mente Expandida II",type:"minor",cls:"mago",x:340,y:460,cost:1,desc:"+10 PE. Total: +20."},
    {id:"m_mente3",label:"Mente Expandida III",type:"minor",cls:"mago",x:340,y:580,cost:1,desc:"+10 PE. Total: +30."},
    {id:"m_dom1",label:"Domínio Arcano NH1",type:"major",cls:"mago",x:500,y:140,cost:1,desc:"6 magias de 1º Círculo no Grimório."},
    {id:"m_dom2",label:"Domínio Arcano NH4",type:"major",cls:"mago",x:340,y:140,cost:1,desc:"Desbloqueie magias de 2º Círculo."},
    {id:"m_dom3",label:"Domínio Arcano NH8",type:"keystone",cls:"mago",x:180,y:140,cost:2,desc:"Ápice. Desbloqueie magias de 3º Círculo."},
    {id:"m_lamina",label:"Lâmina Arcana",type:"major",cls:"mago",x:680,y:140,cost:1,desc:"15 PE: arma de energia 1 min."},
    {id:"m_expansao",label:"Expansão Mística I",type:"minor",cls:"mago",x:840,y:140,cost:1,desc:"+1 ND Mística."},
    {id:"m_expansao2",label:"Expansão Mística II",type:"minor",cls:"mago",x:960,y:100,cost:1,desc:"+1 ND. Total: +2."},
    {id:"m_expansao3",label:"Expansão Mística III",type:"minor",cls:"mago",x:960,y:180,cost:1,desc:"+1 ND. Total: +3."},
    {id:"m_recup",label:"Recuperação Arcana I",type:"major",cls:"mago",x:840,y:300,cost:1,desc:"Ação Parcial: recupere 10 PE."},
    {id:"m_recup2",label:"Recuperação Arcana II",type:"minor",cls:"mago",x:960,y:260,cost:1,desc:"Recuperação restaura 20 PE."},
    {id:"m_recup3",label:"Recuperação Arcana III",type:"minor",cls:"mago",x:960,y:340,cost:1,desc:"Recuperação restaura 30 PE."},
    {id:"m_evoc1",label:"Escola: Evocação",type:"major",cls:"mago",x:680,y:460,cost:1,desc:"Evocação +2 dano por círculo."},
    {id:"m_necro1",label:"Escola: Necromancia",type:"major",cls:"mago",x:500,y:580,cost:1,desc:"Necromancia com duração estendida."},
    {id:"m_conj1",label:"Escola: Conjuração",type:"major",cls:"mago",x:660,y:580,cost:1,desc:"Conjuração custa -5 PE."},
    {id:"m_transmut",label:"Escola: Transmutação",type:"keystone",cls:"mago",x:840,y:460,cost:2,desc:"Transmutação concede +1 passo no dado de atributo."},
  ],

  EDGES: [
    ["center","g_start"],["center","r_start"],["center","a_start"],["center","m_start"],
    ["g_start","g_espadas"],["g_start","g_hastes"],["g_start","g_pesadas"],
    ["g_espadas","g_vigor1"],["g_vigor1","g_vigor2"],["g_vigor1","g_vigor3"],
    ["g_espadas","g_atq_extra"],["g_atq_extra","g_milagre"],["g_hastes","g_milagre"],
    ["g_pesadas","g_provocar"],["g_provocar","g_provocar2"],["g_provocar","g_lider"],
    ["g_hastes","g_manobra1"],["g_manobra1","g_manobra2"],["g_manobra2","g_manobra3"],["g_manobra3","g_manobra4"],
    ["r_start","r_leves"],["r_start","r_precisao"],["r_start","r_reflexos"],
    ["r_leves","r_atkvital"],["r_atkvital","r_atkvital2"],["r_atkvital","r_atkvital3"],
    ["r_reflexos","r_esquiva"],["r_esquiva","r_esquiva2"],
    ["r_precisao","r_veneno1"],["r_veneno1","r_veneno2"],["r_veneno1","r_veneno3"],
    ["r_precisao","r_afanar"],["r_afanar","r_copiar"],
    ["r_start","r_passo"],["r_passo","r_finta"],["r_atkvital","r_afanar"],
    ["a_start","a_arcos"],["a_start","a_bestas"],["a_start","a_aguia"],
    ["a_arcos","a_conc1"],["a_conc1","a_conc2"],["a_conc1","a_conc3"],
    ["a_bestas","a_chuva"],["a_chuva","a_intercepta"],
    ["a_start","a_armadilha"],["a_armadilha","a_perfurante"],["a_armadilha","a_eleito"],
    ["a_aguia","a_fantasma"],["a_aguia","a_marca"],
    ["a_arcos","a_recuo"],["a_bestas","a_recuo"],["a_perfurante","a_encant"],
    ["m_start","m_conduite"],["m_start","m_mente"],["m_mente","m_mente2"],["m_mente2","m_mente3"],
    ["m_start","m_dom1"],["m_dom1","m_dom2"],["m_dom2","m_dom3"],
    ["m_conduite","m_lamina"],["m_lamina","m_expansao"],["m_expansao","m_expansao2"],["m_expansao","m_expansao3"],
    ["m_conduite","m_recup"],["m_recup","m_recup2"],["m_recup","m_recup3"],
    ["m_conduite","m_evoc1"],["m_evoc1","m_transmut"],
    ["m_mente","m_necro1"],["m_necro1","m_conj1"],
  ],

  NODE_MAP: {}
};

/* ============================================================
   HOOK: INIT
============================================================ */
Hooks.once("init", () => {
  console.log("Sinfonia das Almas | Inicializando v0.2.0...");

  // Popula NODE_MAP para lookup O(1)
  SINFONIA.NODE_MAP = Object.fromEntries(SINFONIA.NODES.map(n => [n.id, n]));

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
    "systems/sinfonia-das-almas/templates/actor/tabs/arvore.hbs",
    "systems/sinfonia-das-almas/templates/actor/tabs/habilidades-arvore.hbs",
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
  globalThis.ArvoreHabilidades = ArvoreHabilidades;
  console.log("Sinfonia das Almas | Pronto. v0.4.0");

  // ── Listener delegado: botões dentro das mensagens de chat ──
  document.body.addEventListener("click", async (ev) => {
    const btn = ev.target.closest(".btn-rolar-dano, .btn-aplicar-dano, .btn-aplicar-cura");
    if (!btn) return;
    ev.preventDefault();

    // Rolar dano da arma (botão no cabeçalho de ataque)
    if (btn.classList.contains("btn-rolar-dano")) {
      const actorId = btn.dataset.actorId;
      const armaId  = btn.dataset.armaId;
      const actor = game.actors.get(actorId);
      const arma  = actor?.items?.get(armaId);
      if (!actor || !arma) {
        ui.notifications.warn("Ator ou arma não encontrados.");
        return;
      }
      const critico = await foundry.applications.api.DialogV2.confirm({
        window: { title: `Dano — ${arma.name}` },
        content: `<p>Esta rolagem é um <b>crítico</b> (dados dobrados)?</p>`,
        yes: { label: "Sim, crítico" },
        no:  { label: "Não, dano normal", default: true }
      });
      await actor.rolarDano(arma, { critico: !!critico });
      return;
    }

    // Aplicar dano nos tokens selecionados
    if (btn.classList.contains("btn-aplicar-dano")) {
      const dano = parseInt(btn.dataset.dano) || 0;
      const tokens = canvas.tokens?.controlled ?? [];
      if (!tokens.length) {
        ui.notifications.warn("Selecione um ou mais tokens para aplicar o dano.");
        return;
      }
      for (const t of tokens) await t.actor?.aplicarDano?.(dano);
      return;
    }

    // Aplicar cura nos tokens selecionados
    if (btn.classList.contains("btn-aplicar-cura")) {
      const cura = parseInt(btn.dataset.cura) || 0;
      const tokens = canvas.tokens?.controlled ?? [];
      if (!tokens.length) {
        ui.notifications.warn("Selecione um ou mais tokens para aplicar a cura.");
        return;
      }
      for (const t of tokens) await t.actor?.curar?.(cura);
      return;
    }
  });
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

  // Uppercase para abreviar atributos no template
  Handlebars.registerHelper("upper", (str) => String(str ?? "").toUpperCase());

  // Concatenar strings
  Handlebars.registerHelper("concat", (...args) => args.slice(0, -1).join(""));

  Handlebars.registerHelper("atribLabel", (key) => SINFONIA.ATRIBUTOS[key]?.label ?? key);
});
