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
  ConduiteDataModel,
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
    mago:      "Mago",
    sacerdote: "Sacerdote"
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
    sacerdote: { label:"Sacerdote", color:"#f0c060", glow:"#ffe080", cx: 0,   cy: 400 },
  },

  /* ============================================================
     ÁRVORE DE HABILIDADES — v0.7.0
     Lista de habilidades por classe. Cada habilidade tem:
       • id          — identificador único
       • label       — nome exibido
       • maxNH       — máximo de Pontos de Habilidade que pode investir (1, 2, 3, 5 ou 10)
       • custoPI/custoPE — (opcional) custo de ativação
       • efeito      — função que recebe o NH atual e retorna o texto do efeito atual
       • passiva     — true = aplica automático em estatísticas; false = ativa manual
       • escala      — (opcional) código de escala numérica que prepareDerivedData usa:
           • pvBonus: +N PV por ponto (Vigor: 3)
           • peBonus: +N PE por ponto (Mente Expandida, Fé Expandida: 10)
           • ndMisticaBonus: +1 ND Mística por ponto (Expansão Mística)
           • danoArcoBesta: +N dano em ataques c/ Arco/Besta (Concentração: 2)
       • desc        — descrição base (mostrada antes do efeito atual)
  ============================================================ */
  HABILIDADES_CLASSE: {
    guerreiro: [
      { id: "g_per_espadas",  label: "Perícia com Espadas",     maxNH: 1, passiva: true,
        desc: "Você se torna capaz de utilizar Espadas sem penalidade." },
      { id: "g_per_hastes",   label: "Perícia com Armas de Haste", maxNH: 1, passiva: true,
        desc: "Você se torna capaz de utilizar armas de Haste sem penalidade." },
      { id: "g_per_pesadas",  label: "Perícia com Armas Pesadas",  maxNH: 1, passiva: true,
        desc: "Você se torna capaz de utilizar armas Pesadas sem penalidade." },
      { id: "g_vigor",        label: "Vigor",                     maxNH: 3, passiva: true,
        escala: { pvBonus: 3 },
        efeito: (nh) => `+${nh * 3} PV Máximos.`,
        desc: "Aumenta seus pontos de vida Máximo em [3 × NH]." },
      { id: "g_manobra",      label: "Manobra de Combate",        maxNH: 10, passiva: false,
        sublistaId: "g_manobra",
        efeito: (nh) => `Conhece ${nh} manobra(s) de combate da lista.`,
        desc: "Cada ponto aprende uma manobra nova. Lista no final da classe." },
      { id: "g_milagre",      label: "Iniciado em Milagres",      maxNH: 5, passiva: false,
        efeito: (nh) => nh < 5
          ? `Aprende magias Sagradas de 1º Círculo. (${nh}/5)`
          : `Acesso a 2 magias de 2º Círculo Sagrado.` ,
        desc: "Comunhão com divindades. Aprende magias Sagradas." },
      { id: "g_provocar",     label: "Provocar",                  maxNH: 5, passiva: false, custoPE: 5,
        efeito: (nh) => `Custa 5 PE. Afeta até ${nh} alvo(s). Teste de Intimidação vs Intuição.`,
        desc: "Provoca inimigos a te atacarem. Falha = condição Provocado." },
      { id: "g_ataque_extra", label: "Ataque Extra",              maxNH: 2, passiva: true,
        efeito: (nh) => nh === 1 ? "Realiza um segundo ataque em sequência." : "Realiza dois ataques extras em sequência.",
        desc: "Quando tomar a ação de atacar, realiza ataque(s) extra(s). Comprar pela 2ª vez custa 2 pontos." },
      { id: "g_arcano",       label: "Iniciado em Magia Arcana",  maxNH: 5, passiva: false,
        efeito: (nh) => nh < 5
          ? `Aprende magias Arcanas de 1º Círculo. (${nh}/5)`
          : `Acesso a 2 magias de 2º Círculo Arcano.`,
        desc: "Estudo do arcano. Aprende magias Arcanas." }
    ],

    gatuno: [
      { id: "r_per_leves",    label: "Perícia com Armas Leves",   maxNH: 1, passiva: true,
        desc: "Adagas, Facas e Espadas Curtas sem penalidade." },
      { id: "r_per_precisao", label: "Perícia com Armas de Precisão", maxNH: 1, passiva: true,
        desc: "Bestas Leves, Pistolas e Facas de Arremesso sem penalidade. Use a perícia Armas de Fogo para atacar." },
      { id: "r_reflexos",     label: "Reflexos Apurados",         maxNH: 1, passiva: false, custoPE: 5,
        efeito: () => "5 PE: +5 em testes de Reflexos.",
        desc: "Reflexos afiados como navalha." },
      { id: "r_esquiva",      label: "Esquiva Implacável",        maxNH: 1, passiva: false, custoPE: 10,
        efeito: () => "10 PE: reduz pela metade o dano recebido.",
        desc: "Escapa por um triz de perigos mortais." },
      { id: "r_venenos",      label: "Iniciado em Venenos",       maxNH: 5, passiva: false,
        sublistaId: "r_venenos",
        efeito: (nh) => `Fabrica e aplica ${nh} tipo(s) de veneno básico.`,
        desc: "Compreende toxinas. Fabrica venenos em Áreas de Descanso (2 PI cada, teste de Ofício ND 12)." },
      { id: "r_truques",      label: "Truques Sujos",             maxNH: 10, passiva: false,
        sublistaId: "r_truques",
        efeito: (nh) => `Conhece ${nh} truque(s) sujo(s) da lista.`,
        desc: "Cada ponto aprende um Truque Sujo da lista." },
      { id: "r_prodigio",     label: "Prodígio",                  maxNH: 2, passiva: true,
        efeito: (nh) => `${nh} perícia(s) considerada(s) Experiente.`,
        desc: "Escolha uma perícia para ser considerado Experiente." },
      { id: "r_resist_veneno",label: "Corpo Resistente a Venenos", maxNH: 1, passiva: true,
        desc: "Vantagem em testes de resistência contra venenos." },
      { id: "r_ataque_extra", label: "Ataque Extra",              maxNH: 1, passiva: true,
        desc: "Quando tomar a ação de atacar, realiza um segundo ataque em sequência." }
    ],

    arqueiro: [
      { id: "a_per_arcos",    label: "Perícia com Arcos",         maxNH: 1, passiva: true,
        desc: "Arcos Curtos e Longos sem penalidade de empunhadura/distância." },
      { id: "a_per_bestas",   label: "Perícia com Bestas",        maxNH: 1, passiva: true,
        desc: "Bestas Leves e Pesadas sem penalidade de recarga." },
      { id: "a_olhos_aguia",  label: "Olhos de Águia",            maxNH: 1, passiva: true,
        desc: "Visão 2× normal. Vê através de fumaças e lugares obscurecidos em combate." },
      { id: "a_encantamento", label: "Iniciado em Magia de Encantamento", maxNH: 5, passiva: false,
        efeito: (nh) => `Conhece ${nh} magia(s) Arcana de Encantamento.`,
        desc: "Cada ponto aprende uma magia Arcana de Encantamento." },
      { id: "a_armadilha",    label: "Armadilha de Caça",         maxNH: 1, passiva: false, custoPI: 2,
        efeito: () => "2 PI: arma armadilha camuflada ND 12. Dano: 2×AGI + 12. Falha = Imobilizado.",
        desc: "Carrega e arma dispositivos táticos mecânicos." },
      { id: "a_concentracao", label: "Concentração",              maxNH: 3, passiva: true,
        escala: { danoArcoBesta: 2 },
        efeito: (nh) => `+${nh * 2} dano fixo em ataques com Arco/Besta.`,
        desc: "Maior precisão e letalidade." },
      { id: "a_ataque_extra", label: "Ataque Extra",              maxNH: 1, passiva: true,
        desc: "Quando tomar a ação de atacar, realiza um segundo ataque em sequência." },
      { id: "a_disparos",     label: "Disparos Especiais",        maxNH: 10, passiva: false,
        sublistaId: "a_disparos",
        efeito: (nh) => `Conhece ${nh} disparo(s) especial(is) da lista.`,
        desc: "Cada ponto aprende um Disparo Especial." }
    ],

    mago: [
      { id: "m_per_conduites",label: "Perícia com Conduítes Arcanos", maxNH: 1, passiva: true,
        desc: "Cajados, Varinhas e Tomos Místicos sem penalidade de conjuração." },
      { id: "m_mente",        label: "Mente Expandida",           maxNH: 3, passiva: true,
        escala: { peBonus: 10 },
        efeito: (nh) => `+${nh * 10} PE Máximos.`,
        desc: "Estudos e meditações expandem sua capacidade mental." },
      { id: "m_dominio_arc",  label: "Domínio das Magias Arcanas", maxNH: 10, passiva: false,
        efeito: (nh) => {
          if (nh < 1) return "";
          if (nh === 1) return "6 magias iniciais de 1º Círculo (qualquer escola).";
          if (nh < 4)  return `6 + ${nh - 1} magia(s) adicional(is). (1º Círculo)`;
          if (nh < 8)  return `6 + ${nh - 1} magias. Desbloqueia 2º Círculo.`;
          return `6 + ${nh - 1} magias. Desbloqueia 3º Círculo.`;
        },
        desc: "Grimório pessoal. NH 4: desbloqueia 2º Círculo. NH 8: desbloqueia 3º Círculo." },
      { id: "m_lamina",       label: "Lâmina Arcana",             maxNH: 1, passiva: false, custoPE: 15,
        efeito: () => "15 PE, Ação Parcial: manifesta arma de energia por 1 min. Acerto: Arcanismo vs Defesa. Dano: dado MIS + 15 (místico).",
        desc: "Canaliza fluxo místico em uma lâmina de energia." },
      { id: "m_expansao",     label: "Expansão Mística",          maxNH: 3, passiva: true,
        escala: { ndMisticaBonus: 1 },
        efeito: (nh) => `+${nh} na ND Mística.`,
        desc: "Condensa e intensifica a pressão de sua energia mística." },
      { id: "m_recuperacao",  label: "Recuperação Arcana",        maxNH: 5, passiva: false,
        efeito: (nh) => `Ação Parcial: recupera ${nh * 10} PE.`,
        desc: "Comunhão com fluxos místicos pra reabastecer energia." }
    ],

    sacerdote: [
      { id: "s_per_simbolos", label: "Perícia com Símbolos Sagrados", maxNH: 1, passiva: true,
        desc: "Rosários, Símbolos Sagrados e Relíquias Místicas sem penalidade de conjuração." },
      { id: "s_fe",           label: "Fé Expandida",              maxNH: 3, passiva: true,
        escala: { peBonus: 10 },
        efeito: (nh) => `+${nh * 10} PE Máximos.`,
        desc: "Devoção e comunhão com o divino expandem capacidade espiritual." },
      { id: "s_dominio_sag",  label: "Domínio das Magias Sagradas", maxNH: 10, passiva: false,
        efeito: (nh) => {
          if (nh < 1) return "";
          if (nh === 1) return "6 magias iniciais de 1º Círculo (qualquer escola sagrada).";
          if (nh < 4)  return `6 + ${nh - 1} magia(s) adicional(is). (1º Círculo)`;
          if (nh < 8)  return `6 + ${nh - 1} magias. Desbloqueia 2º Círculo.`;
          return `6 + ${nh - 1} magias. Desbloqueia 3º Círculo.`;
        },
        desc: "Preces e Orações. NH 4: 2º Círculo. NH 8: 3º Círculo." },
      { id: "s_kyrie",        label: "Kyrie Eleison",             maxNH: 3, passiva: false, custoPE: 20,
        efeito: (nh) => `20 PE, Ação Parcial: escudo de PVT = dado CAR + 15 + ${nh * 5} extra. Imune a empurrão/derrubada.`,
        desc: "Barreira de luz sagrada que absorve impactos físicos." },
      { id: "s_magnificat",   label: "Magnificat",                maxNH: 5, passiva: false, custoPE: 25,
        efeito: (nh) => `25 PE, Ação Inicial: aura por 1 min. Alvos recuperam ${5 + (nh - 1) * 2} PE/turno.`,
        desc: "Hino sagrado que acelera recuperação de energia." },
      { id: "s_lex_divina",   label: "Lex Divina",                maxNH: 1, passiva: false, custoPE: 15,
        efeito: () => "15 PE, Ação Padrão: alvo testa Vontade vs ND Mística. Falha = Silenciado por 1 rodada.",
        desc: "Silência um conjurador inimigo." },
      { id: "s_exorcizar",    label: "Exorcizar",                 maxNH: 3, passiva: false, custoPE: 20,
        efeito: (nh) => {
          const danoExtra = nh * 10;
          const margem = ["1/4", "1/3", "1/2"][Math.min(nh - 1, 2)];
          return `20 PE, Ação Padrão: morto-vivo testa Fortitude vs ND Mística. Dano Luz: dado MIS + ${20 + danoExtra}. Execução se PV < ${margem}.`;
        },
        desc: "Luz divina concentrada que purga corrompidos e mortos-vivos." }
    ]
  },

  /* ============================================================
     SUBLISTAS — v0.7.2
     Cada habilidade do tipo "desbloqueio" (Manobra de Combate, Truques
     Sujos, Disparos Especiais, Venenos) tem uma lista de opções que o
     jogador escolhe ao investir um ponto. O NH da habilidade-mãe dita
     quantas opções ele pode aprender.

     Cada entrada tem:
       • id        — identificador único
       • label     — nome exibido
       • custoPE   — (opcional) custo de ativação em PE
       • custoPI   — (opcional) custo em Pontos de Inventário
       • acao     — "parcial" | "inicial" | "reacao" | "livre" | "" (reação conta como reação)
       • desc      — descrição do efeito
       • efeitoAprimorado — (opcional) variante com custo extra de PE
     Armazenamento no actor: flag "sublistas" = { habId: [subId, subId, ...] }
  ============================================================ */
  SUBLISTAS: {
    // ── GUERREIRO: Manobras de Combate ──
    g_manobra: [
      { id: "giratorio",   label: "Golpe Giratório", custoPE: 10, acao: "livre",
        desc: "Ataque corpo-a-corpo em área de 3m. Alvos atingidos recebem seu Dado de Poder de dano adicional.",
        efeitoAprimorado: "+5 PE e todas as ações (Inicial+Parcial+Movimento): área aumenta para 6m, alvos testam Fortitude vs seu Acerto ou ficam Atordoados." },
      { id: "rude_buster", label: "Rude Buster [3X]", custoPE: 15, acao: "livre",
        desc: "Canaliza energia na arma e ataca um alvo a 9m. Pode ser comprado mais de uma vez — adiciona +1 dado de dano por NH.",
        efeitoAprimorado: "+5 PE: alveja mais um alvo no alcance de 9m." },
      { id: "rompe_defesas", label: "Rompe Defesas", custoPE: 10, acao: "livre",
        desc: "Próximo ataque acertado reduz a Defesa do alvo em −2." },
      { id: "contra_ataque", label: "Contra Ataque", custoPE: 0, acao: "reacao",
        desc: "Quando um inimigo acerta ou erra ataque corpo-a-corpo contra você e o valor do dado de ataque for PAR, use sua reação para atacar o alvo." },
      { id: "ripostar", label: "Ripostar", custoPE: 0, acao: "reacao",
        desc: "Quando um inimigo ataca corpo-a-corpo e o dado for ÍMPAR, você bloqueia (sem dano) e inflige Enfraquecido até o início do turno dele." },
      { id: "ataque_descuidado", label: "Ataque Descuidado", custoPE: 10, acao: "livre",
        desc: "Durante o turno inteiro: +5 acerto e dano, −5 Defesa até o início da próxima rodada." },
      { id: "postura_aco", label: "Postura de Aço", custoPE: 10, acao: "parcial",
        desc: "Adota postura defensiva: −10 dano recebido e +5 Defesa até o final do próximo turno." },
      { id: "precisao", label: "Precisão", custoPE: 10, acao: "livre",
        desc: "No próximo ataque: +5 de acerto." },
      { id: "retomar_folego", label: "Retomar o Fôlego", custoPE: 10, acao: "parcial",
        desc: "Cura igual ao resultado de 5 dados de Poder rolados." },
      { id: "lider_inspirador", label: "Líder Inspirador", custoPE: 15, acao: "livre",
        desc: "Dá PVT a aliaíos = 3× seu dado de Poder. Enquanto têm PVT: +5 contra Amedrontado." }
    ],

    // ── GATUNO: Truques Sujos ──
    r_truques: [
      { id: "ataque_vital", label: "Ataque Vital [5X]", custoPE: 0, acao: "livre",
        desc: "Reserva de dados d6 = NH desta habilidade. Contra Desprevenido ou alvo com aliado adjacente, gaste dados desta reserva para +dano. Reserva restaura no início do seu turno." },
      { id: "passo_sombras", label: "Passo das Sombras", custoPE: 10, acao: "parcial",
        desc: "Move 6m (4 quadrados) instantaneamente sem provocar ataques de oportunidade. Em quadrado com cobertura, teste de Furtividade imediato." },
      { id: "bomba_fumaca", label: "Bomba de Fumaça", custoPE: 15, acao: "livre",
        desc: "Esfera de 3m de raio com cobertura total e bloqueio de linha de visão.",
        efeitoAprimorado: "+10 PE: fumaça tóxica por 2 rodadas. Escolha um veneno fabricado que exija teste de resistência. Inimigos no início do turno testam contra a ND do veneno." },
      { id: "mao_leve", label: "Mão Leve", custoPE: 0, acao: "reacao",
        desc: "Se o dado de ataque corpo-a-corpo do inimigo contra você for ÍMPAR: teste de Ladinagem. Sucesso = rouba 2 PI do alvo." },
      { id: "areia_olhos", label: "Areia nos Olhos", custoPE: 10, acao: "parcial",
        desc: "Teste de Ladinagem vs Reflexos (AGI+AGI) do alvo adjacente. Sucesso = Cego por uma rodada." },
      { id: "redirecionar", label: "Redirecionar Ataque", custoPE: 10, acao: "reacao",
        desc: "Se o dado de ataque contra você for PAR: puxa um alvo adjacente para a trajetória. Ataque resolve contra a Defesa dele." },
      { id: "finta", label: "Finta Ardilosa", custoPE: 5, acao: "parcial",
        desc: "Teste de Ladinagem vs Percepção do alvo adjacente. Sucesso = alvo Desprevenido contra seu próximo ataque (ativa Ataque Vital)." },
      { id: "espinhos", label: "Espinhos de Bolso", custoPI: 1, acao: "parcial",
        desc: "Área 3×3m a até 4m vira Terreno Difícil até o fim do combate. Inimigos que cruzam sofrem 1d6 de dano físico por quadrado atravessado." },
      { id: "canelada", label: "Canelada de Interrupção", custoPE: 5, acao: "reacao",
        desc: "Ataque de Oportunidade modificado. Se acertar, o deslocamento restante do alvo vira 0 metros, ele para imediatamente." },
      { id: "afanar_vitae", label: "Afanar Vitae", custoPE: 0, acao: "reacao",
        desc: "Se você reduzir um inimigo a 0 PV com Ataque Vital, gaste sua reação para curar metade do dano causado." },
      { id: "copiar_magia", label: "Copiar Magia", custoPE: 0, acao: "reacao",
        desc: "Quando uma criatura conjura magia em seu campo de visão: reação + teste de Misticismo vs ND do Mestre. Sucesso = aprende a magia para usar UMA vez (segue regras originais)." }
    ],

    // ── GATUNO: Venenos ──
    r_venenos: [
      { id: "peconha_estagnante", label: "Peçonha Estagnante", custoPE: 0, acao: "",
        desc: "Alvo testa Fortitude vs ND do seu ataque. Falha = Atordoado até o final do próximo turno + deslocamento reduzido a 0m." },
      { id: "beladona", label: "Extrato de Beladona", custoPE: 0, acao: "",
        desc: "Alvo testa Fortitude vs ND do seu ataque. Falha = Enfraquecido até o final do próximo turno." },
      { id: "lagrima_nevoa", label: "Lágrima de Névoa", custoPE: 0, acao: "",
        desc: "Alvo testa Reflexos vs ND do seu ataque. Falha = Ofuscado até o final do próximo turno." },
      { id: "toxina_vibora", label: "Toxina da Víbora", custoPE: 0, acao: "",
        desc: "Ignora armaduras/escudos. Ao acertar: +1 Dado de Agilidade no dano. Por 5 rodadas, alvo sofre 10 de dano de Ácido." },
      { id: "soro_raiva", label: "Soro da Raiva", custoPE: 0, acao: "",
        desc: "Alvo testa Vontade vs ND do seu ataque. Falha = Provocado (ataca quem estiver próximo dele)." },
      { id: "essencia_pesadelo", label: "Essência do Pesadelo", custoPE: 0, acao: "",
        desc: "Alvo testa Vontade vs ND do seu ataque. Falha = Amedrontado de você (se você estiver escondido, do alvo mais próximo)." },
      { id: "soro_letargico", label: "Soro Letárgico", custoPE: 0, acao: "",
        desc: "Alvo testa Fortitude vs ND do seu ataque. Falha = perde Ação Inicial e iniciativa cai −3 permanentemente para o resto da cena." }
    ],

    // ── ARQUEIRO: Disparos Especiais ──
    a_disparos: [
      { id: "chuva_flechas", label: "Chuva de Flechas", custoPE: 15, acao: "inicial",
        desc: "Saraivada para o alto, cai em Cubo 4,5×4,5m até 12m de você. Inimigos testam Reflexos ND 12 ou sofrem dano da arma + perdem metade do deslocamento." },
      { id: "tiro_perfurante", label: "Tiro Perfurante", custoPE: 10, acao: "inicial",
        desc: "Linha de 9m. Alvos testam Reflexos vs ND do seu acerto ou sofrem dobro do dano padrão.",
        efeitoAprimorado: "+5 PE: alvos que falharem têm Defesa reduzida em −2 até o final do turno dos acertados." },
      { id: "tiro_intercepta", label: "Tiro de Interceptação", custoPE: 10, acao: "reacao",
        desc: "Se o valor de um ataque à distância contra alvo for PAR: dispare um projetil de aviso. Se acertar, cancela o ataque." },
      { id: "recuo", label: "Recuo Calculado", custoPE: 10, acao: "reacao",
        desc: "Se o ataque/aproximação do oponente for ÍMPAR: salte 3m para trás sem provocar ataques. Pode atacar à distância: se acertar, role dobro de dados de dano." },
      { id: "marca_cacador", label: "Marca do Caçador", custoPE: 5, acao: "parcial",
        desc: "Flecha sinalizadora. Teste de ataque vs Defesa. Sucesso = você e aliados +2 em acerto contra o alvo até o fim da cena.",
        efeitoAprimorado: "+5 PE e Ação Inicial: alvo perde camuflagem/invisibilidade/furtividade, posição exata revelada." },
      { id: "flecha_estilhacadora", label: "Flecha Estilhaçadora", custoPE: 15, acao: "inicial",
        desc: "Projétil com ponta fragilizável. Se acertar: dano normal + condição Frágil no alvo." },
      { id: "disparo_violento", label: "Disparo Violento", custoPE: 0, acao: "reacao",
        desc: "Tiro fatal focado em finalizar alvos debilitados. Ao eliminar um alvo, recupera 15 PE." },
      { id: "tiro_fantasma", label: "Tiro Fantasma", custoPE: 15, acao: "",
        desc: "Ignora paredes, coberturas totais ou obstáculos sólidos. Alcance 12m, requer teste prévio de Percepção para saber a posição do alvo." },
      { id: "flecha_armadilha", label: "Flecha Armadilha", custoPE: 10, acao: "inicial",
        desc: "Projétil projetado para fixar-se ao solo/travar vítima. Se acertar: dano + Imobilizado (deslocamento 0m)." },
      { id: "inimigo_eleito", label: "Inimigo Eleito", custoPE: 0, acao: "parcial",
        desc: "Foca total atenção em 1 oponente por 1 minuto. +2 acerto e dano contra ele. Ao reduzir ele a 0 PV: +20 PV imediato. Transferir marca: ação livre + 5 PE." }
    ]
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
    conduite:   ConduiteDataModel,
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

  // ── Defaults do prototypeToken: token com Ring dourado automático ──
  // Para todo Actor novo criado, o token vem com o Dynamic Token Ring (anel
  // colorido em volta do retrato). Quem já existia precisa abrir as configurações
  // do prototype token e ativar manualmente — ou usar a macro de "converter tokens".
  Hooks.on("preCreateActor", (actor, data, options, userId) => {
    // Só mexe se for personagem (não em NPCs, a não ser que o GM queira)
    if (actor.type !== "personagem") return;

    actor.updateSource({
      prototypeToken: {
        // Liga o anel dinâmico de Foundry v12+
        ring: {
          enabled: true,
          colors: {
            ring: "#c8972a",        // dourado da ficha
            background: "#1a1a1a"   // preto sutil atrás
          },
          // Sem efeitos especiais por padrão; subsystem ativa o anel
          effects: 1
        },
        // Outros defaults sensatos
        actorLink: true,            // token reflete a ficha em tempo real
        disposition: 1,              // amigável
        sight: { enabled: true },    // jogador vê através do token
        displayName: 30,             // hover sobre o token mostra nome
        displayBars: 20              // hover mostra barras
      }
    });
  });

  // Templates de Handlebars
  loadTemplates([
    "systems/sinfonia-das-almas/templates/actor/personagem-sheet.hbs",
    "systems/sinfonia-das-almas/templates/actor/npc-sheet.hbs",
    "systems/sinfonia-das-almas/templates/actor/tabs/principal.hbs",
    "systems/sinfonia-das-almas/templates/actor/tabs/pericias.hbs",
    "systems/sinfonia-das-almas/templates/actor/tabs/magias.hbs",
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
  console.log("Sinfonia das Almas | Pronto. v0.8.1");

  // Hook de combate: no início do turno do personagem, processa Crepúsculo da Morte
  // (perde 1 Det/turno, oferece teste de Vontade quando Det = 1).
  // Também processa magias contínuas (cobra PE de cada uma; se faltar, dispersa).
  Hooks.on("combatTurnChange", async (combat, prior, current) => {
    const combatant = combat?.combatants?.get(current?.combatantId);
    const actor = combatant?.actor;
    if (!actor) return;
    if (actor.processarTurnoCrepusculo) {
      await actor.processarTurnoCrepusculo();
    }
    if (actor.processarMagiasContinuas) {
      await actor.processarMagiasContinuas();
    }
  });

  // ── Reatividade global: re-renderiza a sheet quando o actor muda externamente ──
  // (aplicar dano/cura, hook de turno, ativar magia contínua, etc).
  // Garante que campos derivados (DEF/INIT/ND M./PV/PE) sempre refletem o estado atual.
  //
  // IMPORTANTE: o `salvarCampo` da actor-sheet faz update com {render:false, sinfoniaFromSheet:true}
  // pra evitar flicker enquanto o jogador digita. Só re-renderizamos quando o update
  // NÃO veio do próprio formulário (ou seja, mudança externa: chat, hook, outra sheet).
  Hooks.on("updateActor", (actor, changes, options, userId) => {
    if (options?.sinfoniaFromSheet) return; // não re-renderiza se foi o próprio form
    if (actor.sheet?.rendered) actor.sheet.render(false);
  });
  Hooks.on("updateItem", (item, changes, options, userId) => {
    if (options?.sinfoniaFromSheet) return;
    if (item.parent?.sheet?.rendered) item.parent.sheet.render(false);
  });
  Hooks.on("createItem", (item) => {
    if (item.parent?.sheet?.rendered) item.parent.sheet.render(false);
  });
  Hooks.on("deleteItem", (item) => {
    if (item.parent?.sheet?.rendered) item.parent.sheet.render(false);
  });

  // ── Listener delegado: botões dentro das mensagens de chat ──
  document.body.addEventListener("click", async (ev) => {
    const btn = ev.target.closest(".btn-rolar-dano, .btn-aplicar-dano, .btn-aplicar-cura, .btn-magia-dano, .btn-rolar-resistencia, .btn-toggle-continua");
    if (!btn) return;
    ev.preventDefault();

    // Ativar/desativar magia contínua
    if (btn.classList.contains("btn-toggle-continua")) {
      const actorUuid = btn.dataset.actorUuid;
      const actorId   = btn.dataset.actorId;
      const magiaId   = btn.dataset.magiaId;
      let actor = null;
      if (actorUuid) { try { actor = fromUuidSync(actorUuid); } catch {} }
      if (!actor && actorId) actor = game.actors.get(actorId);
      const magia = actor?.items?.get(magiaId);
      if (!actor || !magia) {
        ui.notifications.warn("Ator ou magia não encontrados.");
        return;
      }
      await actor.toggleMagiaContinua?.(magia);
      return;
    }

    // Rolar dano da arma (botão no cabeçalho de ataque)
    if (btn.classList.contains("btn-rolar-dano")) {
      // v0.7.3: aceita actorUuid (token unlinked) OU actorId (legado)
      const actorUuid = btn.dataset.actorUuid;
      const actorId   = btn.dataset.actorId;
      const armaId    = btn.dataset.armaId;
      let actor = null;
      if (actorUuid) {
        try { actor = fromUuidSync(actorUuid); } catch {}
      }
      if (!actor && actorId) actor = game.actors.get(actorId);
      const arma = actor?.items?.get(armaId);
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

    // Rolar dano de MAGIA (botão no card de ataque/resistência mística)
    if (btn.classList.contains("btn-magia-dano")) {
      const actorUuid = btn.dataset.actorUuid;
      const actorId   = btn.dataset.actorId;
      const itemId    = btn.dataset.itemId;
      let actor = null;
      if (actorUuid) { try { actor = fromUuidSync(actorUuid); } catch {} }
      if (!actor && actorId) actor = game.actors.get(actorId);
      const magia = actor?.items?.get(itemId);
      if (!actor || !magia) {
        ui.notifications.warn("Ator ou magia não encontrados.");
        return;
      }
      const critico = await foundry.applications.api.DialogV2.confirm({
        window: { title: `Dano — ${magia.name}` },
        content: `<p>Esta rolagem é um <b>crítico</b> (dados dobrados)?</p>`,
        yes: { label: "Sim, crítico" },
        no:  { label: "Não, dano normal", default: true }
      });
      await actor.rolarDanoMagia(magia, { critico: !!critico });
      return;
    }

    // Rolar RESISTÊNCIA (o jogador do alvo seleciona o token e clica)
    if (btn.classList.contains("btn-rolar-resistencia")) {
      const periciaKey = btn.dataset.pericia; // reflexos | fortitude | vontade
      const nd = parseInt(btn.dataset.nd) || 10;

      // Pega o token selecionado do jogador (o alvo)
      const tokens = canvas.tokens?.controlled ?? [];
      if (!tokens.length) {
        ui.notifications.warn("Selecione o token do seu personagem (o alvo) antes de rolar a resistência.");
        return;
      }
      const alvo = tokens[0].actor;
      if (!alvo) return;

      // Mapeia a perícia de resistência pra chave + atributos do SINFONIA.PERICIAS
      // reflexos → reflexos (AGI+AGI); fortitude → fortitude (POD+POD); vontade → forcaDeVontade (POD+CAR)
      const mapaPericia = {
        reflexos:  "reflexos",
        fortitude: "fortitude",
        vontade:   "forcaDeVontade"
      };
      const pKey = mapaPericia[periciaKey] ?? periciaKey;
      const cfg = SINFONIA.PERICIAS[pKey];
      if (!cfg) {
        ui.notifications.error(`Perícia de resistência desconhecida: ${periciaKey}`);
        return;
      }

      // Abre o dialog rico de Alma do alvo e rola
      const opcoes = await SinfoniaActorSheet._dialogND(alvo, cfg.atribA, cfg.atribB);
      if (!opcoes) return;
      // Força o ND informado pelo card (ND Mística do conjurador), mas respeita
      // a redução por Origem etc do próprio dialog.
      await alvo.rolarPericia(pKey, cfg.atribA, cfg.atribB, nd, opcoes);
      return;
    }

    // Aplicar dano nos tokens-alvo (com fallback para selecionados)
    if (btn.classList.contains("btn-aplicar-dano")) {
      const dano = parseInt(btn.dataset.dano) || 0;
      // Propriedades da arma: Contundente ignora RD leve; Crítico afeta Crepúsculo
      const contundente = btn.dataset.contundente === "1";
      const critico     = btn.dataset.critico === "1";
      // Prioriza tokens targetados (jogador apontou com 'T'). Se vazio, cai
      // pros selecionados como fallback (útil quando o Mestre clica o próprio token).
      const targets = Array.from(game.user.targets ?? []);
      const tokens = targets.length
        ? targets
        : (canvas.tokens?.controlled ?? []);
      if (!tokens.length) {
        ui.notifications.warn("Aponte com 'T' um ou mais tokens (ou selecione) para aplicar o dano.");
        return;
      }
      for (const t of tokens) await t.actor?.aplicarDano?.(dano, { contundente, critico });
      return;
    }

    // Aplicar cura nos tokens-alvo (com fallback para selecionados)
    if (btn.classList.contains("btn-aplicar-cura")) {
      const cura = parseInt(btn.dataset.cura) || 0;
      const targets = Array.from(game.user.targets ?? []);
      const tokens = targets.length
        ? targets
        : (canvas.tokens?.controlled ?? []);
      if (!tokens.length) {
        ui.notifications.warn("Aponte com 'T' um ou mais tokens (ou selecione) para aplicar a cura.");
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

  // Comparação simples — funciona como FUNCTION helper {{eq a b}} (retorna true/false)
  // E como BLOCK helper {{#eq a b}}...{{else}}...{{/eq}} (renderiza bloco condicional)
  Handlebars.registerHelper("eq", function(a, b, options) {
    const result = a === b;
    // Se foi chamado como block helper, `options.fn` existe
    if (options && typeof options.fn === "function") {
      return result ? options.fn(this) : options.inverse(this);
    }
    return result;
  });
  Handlebars.registerHelper("gt", function(a, b, options) {
    const result = a > b;
    if (options && typeof options.fn === "function") {
      return result ? options.fn(this) : options.inverse(this);
    }
    return result;
  });

  // Uppercase para abreviar atributos no template
  Handlebars.registerHelper("upper", (str) => String(str ?? "").toUpperCase());

  // Concatenar strings
  Handlebars.registerHelper("concat", (...args) => args.slice(0, -1).join(""));

  Handlebars.registerHelper("atribLabel", (key) => SINFONIA.ATRIBUTOS[key]?.label ?? key);
});
