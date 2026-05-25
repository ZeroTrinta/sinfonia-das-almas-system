/**
 * Sinfonia das Almas — Custom Document Implementations
 */

/* ============================================================
   ACTOR
============================================================ */
export class SinfoniaActor extends Actor {

  /** Mapeamento de dado → valor numérico do dado */
  static DADO_VALOR = { d6: 6, d8: 8, d10: 10, d12: 12 };

  /** Retorna o valor numérico de um dado de atributo */
  dadoValor(atributo) {
    const dado = this.system.atributos?.[atributo] ?? "d6";
    return SinfoniaActor.DADO_VALOR[dado] ?? 6;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    if (this.type === "personagem") this._preparePersonagem();
    if (this.type === "npc") this._prepareNpc();
  }

  _preparePersonagem() {
    const sys = this.system;

    // PV máx: nível + 5 × dado de Poder
    const nivel = sys.progressao.nivel;
    const podValor = this.dadoValor("pod");
    const misValor = this.dadoValor("mis");
    sys.recursos.pv.max = nivel + (5 * podValor);
    sys.recursos.pe.max = nivel + (5 * misValor);

    // Defesa passiva = valor do dado de Agilidade
    sys.combate.defesa = this.dadoValor("agi");

    // Iniciativa = metade do dado de Agilidade (arredondado para baixo)
    sys.combate.iniciativa = Math.floor(this.dadoValor("agi") / 2);

    // ND Mística = 8 + valor dado de Misticismo
    sys.combate.ndMistica = 8 + misValor;
  }

  _prepareNpc() {
    const sys = this.system;
    const pv = sys.recursos.pv;
    pv.value = Math.clamp(pv.value, 0, pv.max);
  }

  /**
   * Rola uma perícia com modificadores da Alma.
   *
   * @param {string} pericia
   * @param {string} atribA
   * @param {string} atribB
   * @param {number} nd
   * @param {object} [opts]
   * @param {boolean} [opts.empenho]       Gasta 1 Det — rola dado extra e usa o maior em CADA atributo
   * @param {boolean} [opts.perseveranca]  Gasta 1 Det — ignora penalidade externa (informativo no chat)
   * @param {boolean} [opts.origem]        Ativa uma Origem — reduz ND em 5, sem corrupção em falha
   * @param {string}  [opts.origemTipo]    "eventoMarcante" | "ocupacao" (qual marcar como usada)
   * @param {string}  [opts.corrupcao]     null | "+5" | "rerolar" | "passoDado"
   * @param {number}  [opts.penalidade]    Penalidade numérica imposta pelo Mestre (0 se nenhuma)
   */
  async rolarPericia(pericia, atribA, atribB, nd = 12, opts = {}) {
    if (this.type !== "personagem") return;
    const sys = this.system;

    const empenhoA     = !!opts.empenhoA;
    const empenhoB     = !!opts.empenhoB;
    const perseveranca = !!opts.perseveranca;
    const origem       = !!opts.origem;
    const origemTipo   = opts.origemTipo ?? null;
    const corrupcao    = opts.corrupcao ?? null;   // "+5" | "rerolar" | "passoDado" | null
    const penalidade   = Math.max(0, Number(opts.penalidade) || 0);

    // ── Valida ───────────────────────────────────────────────────────
    const usosDet = (empenhoA ? 1 : 0) + (empenhoB ? 1 : 0) + (perseveranca ? 1 : 0);
    if (usosDet > 0 && sys.alma.determinacao < usosDet) {
      ui.notifications.warn(`${this.name} não tem Determinação suficiente.`);
      return;
    }
    if (origem && origemTipo) {
      if (sys.origem?.[origemTipo]?.usadoNaSessao) {
        ui.notifications.warn(`Esta Origem já foi usada nesta sessão.`);
        return;
      }
    }
    if (corrupcao && sys.alma.corrupcao >= 10) {
      ui.notifications.warn(`${this.name} já está totalmente corrompido.`);
      return;
    }

    // ── Aplica gastos ──────────────────────────────────────────────
    if (usosDet > 0) {
      await this.update({
        "system.alma.determinacao": sys.alma.determinacao - usosDet
      }, { render: false });
    }
    if (origem && origemTipo) {
      await this.update({
        [`system.origem.${origemTipo}.usadoNaSessao`]: true
      }, { render: false });
    }

    // ── Calcula ND efetiva ───────────────────────────────────────────
    let ndEfetivo = nd;
    if (origem) ndEfetivo = Math.max(1, ndEfetivo - 5);
    if (!perseveranca) ndEfetivo += penalidade; // Perseverança anula a penalidade

    // ── Monta os dados (com Empenho e Passo de Corrupção) ───────────────────
    const passoDado = (dado) => {
      // Corrupção "passoDado": sobe 1 passo em cada atributo, teto d12
      const seq = ["d6", "d8", "d10", "d12"];
      const i = seq.indexOf(dado);
      return i === -1 ? dado : seq[Math.min(i + 1, seq.length - 1)];
    };

    let dadoA = sys.atributos[atribA] ?? "d6";
    let dadoB = sys.atributos[atribB] ?? "d6";
    if (corrupcao === "passoDado") {
      dadoA = passoDado(dadoA);
      dadoB = passoDado(dadoB);
    }

    // Empenho por atributo: "2dN kh1" rola 2 dados e mantém o maior 1.
    const fmtA = empenhoA ? `2${dadoA}kh1` : `1${dadoA}`;
    const fmtB = empenhoB ? `2${dadoB}kh1` : `1${dadoB}`;

    const maestria = sys.pericias[pericia] ?? "";
    const modMap   = { iniciante: 2, treinado: 4, experiente: 6 };
    const mod      = modMap[maestria] ?? 0;
    const bonusCorrupcao = corrupcao === "+5" ? 5 : 0;

    const formula = `${fmtA} + ${fmtB} + ${mod}${bonusCorrupcao ? ` + ${bonusCorrupcao}` : ""}`;
    let roll = new Roll(formula);
    await roll.evaluate();

    // Corrupção "rerolar": rola de novo e fica com o maior total
    if (corrupcao === "rerolar") {
      const roll2 = new Roll(formula);
      await roll2.evaluate();
      if (roll2.total > roll.total) roll = roll2;
    }

    const total   = roll.total;
    const sucesso = total >= ndEfetivo;

    // ── Corrupção automática em falha pós-Determinação (regra do doc) ────────────────
    // Origem é "Segurança da Alma": falha pós-Origem NÃO gera corrupção.
    let ganhouCorrupcao = false;
    if (!sucesso && usosDet > 0 && !origem) {
      const det = this.system.alma.determinacao; // após o gasto anterior
      await this.update({
        "system.alma.determinacao": Math.max(0, det - 1)
      }, { render: false });
      ganhouCorrupcao = true;
    }

    // Aplica corrupção explicitamente escolhida (botoes) — 1 ponto por uso
    if (corrupcao) {
      const det = this.system.alma.determinacao;
      if (det > 0) {
        await this.update({
          "system.alma.determinacao": Math.max(0, det - 1)
        }, { render: false });
      }
    }

    // ── Monta detalhamento visual dos dados caídos ───────────────────────────────────
    // Cada termo de dado (DiceTerm) tem `.results[]` com {result, active, discarded}.
    // Em "2d8kh1" o dado descartado fica com active:false e discarded:true.
    const dadosHtml = roll.dice.map(term => {
      const faces = term.faces;
      const pills = term.results.map(r => {
        const cls = r.active ? "dado-pill ativo" : "dado-pill descartado";
        return `<span class="${cls}" title="d${faces}">${r.result}</span>`;
      }).join("");
      return `<span class="dado-grupo"><span class="dado-tipo">d${faces}</span>${pills}</span>`;
    }).join("");

    // ── Monta chat ────────────────────────────────────────────────────
    const nomePericia = game.i18n.localize(`SINFONIA.Pericias.${pericia}`) || pericia;
    const labelMaestria = maestria
      ? `<span class="maestria">${maestria} (+${mod})</span>`
      : `<span class="maestria sem-maestria">sem maestria</span>`;

    const tags = [];
    if (empenhoA)       tags.push(`<span class="tag tag-det">★ Empenho ${atribA.toUpperCase()}</span>`);
    if (empenhoB)       tags.push(`<span class="tag tag-det">★ Empenho ${atribB.toUpperCase()}</span>`);
    if (perseveranca)   tags.push(`<span class="tag tag-det">★ Perseverança</span>`);
    if (origem)         tags.push(`<span class="tag tag-origem">⚭ Origem</span>`);
    if (corrupcao === "+5")        tags.push(`<span class="tag tag-cor">☠ +5</span>`);
    if (corrupcao === "rerolar")   tags.push(`<span class="tag tag-cor">☠ Rerolar</span>`);
    if (corrupcao === "passoDado") tags.push(`<span class="tag tag-cor">☠ Passo de Dado</span>`);
    if (ganhouCorrupcao)           tags.push(`<span class="tag tag-cor">+1 Corrupção (falha)</span>`);

    const ndLabel = nd === ndEfetivo
      ? `ND ${nd}`
      : `ND ${nd} → <b>${ndEfetivo}</b>`;

    const content = `
      <div class="sinfonia-roll ${sucesso ? 'sucesso' : 'falha'}">
        <div class="roll-header">
          <span class="actor-name">${this.name}</span>
          <span class="pericia-nome">${nomePericia}</span>
        </div>
        <div class="roll-formula">${atribA.toUpperCase()} + ${atribB.toUpperCase()} ${labelMaestria}</div>
        <div class="roll-dados">${dadosHtml}${mod ? `<span class="dado-mod">+${mod}</span>` : ""}${bonusCorrupcao ? `<span class="dado-mod cor">+${bonusCorrupcao}</span>` : ""}</div>
        ${tags.length ? `<div class="roll-tags">${tags.join(" ")}</div>` : ""}
        <div class="roll-resultado">
          <span class="total">${total}</span>
          <span class="nd">${ndLabel}</span>
          <span class="resultado-label">${sucesso ? '✦ Sucesso' : '✕ Falha'}</span>
        </div>
      </div>
    `;

    await ChatMessage.implementation.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content,
      rolls: [roll],
      type: CONST.CHAT_MESSAGE_TYPES.ROLL
    });

    return { roll, sucesso, total, ndEfetivo, ganhouCorrupcao };
  }

  /* ============================================================
     COMBATE — Ataque e Dano
  ============================================================ */

  /**
   * Mapeia uma categoria de arma para a perícia usada no ataque.
   * Conforme o documento de regras:
   *   leve / espada / haste / pesada → Armas Brancas (POD+AGI)
   *   precisao / fogo                → Armas de Fogo (AGI+INT)
   * "Briga" (sem arma) cai num caso separado.
   */
  static periciaDeAtaque(categoria) {
    const map = {
      leve:     "armasBrancas",
      espada:   "armasBrancas",
      haste:    "armasBrancas",
      pesada:   "armasBrancas",
      precisao: "armasDeFogo",
      fogo:     "armasDeFogo"
    };
    return map[categoria] ?? "armasBrancas";
  }

  /**
   * Rola um ataque com uma arma.
   * Usa a perícia correspondente à categoria contra a Defesa do alvo.
   * Aceita os mesmos modificadores de Alma que rolarPericia.
   *
   * @param {Item} arma             Item do tipo "arma"
   * @param {object} [opts]
   * @param {number} [opts.nd]      ND manual (se não houver alvo). Default 10.
   * @param {object} [opts.alvo]    { name, defesa } extraído de um Token alvo
   * @param {boolean} [opts.empenhoA]
   * @param {boolean} [opts.empenhoB]
   * @param {boolean} [opts.perseveranca]
   * @param {boolean} [opts.origem]
   * @param {string}  [opts.origemTipo]
   * @param {string}  [opts.corrupcao]
   * @param {number}  [opts.penalidade]
   */
  async rolarAtaque(arma, opts = {}) {
    if (this.type !== "personagem") return;
    if (!arma || arma.type !== "arma") return;

    const categoria = arma.system.categoria;
    const pericia   = SinfoniaActor.periciaDeAtaque(categoria);
    const cfg       = SINFONIA.PERICIAS[pericia];
    if (!cfg) return;

    // ND = Defesa do alvo (se houver) ou ND manual
    const nd = opts.alvo?.defesa ?? opts.nd ?? 10;

    // Bônus da arma vira penalidade negativa (ajuda no ataque)
    // rolarPericia já adiciona `penalidade` à ND; se bonus>0, devemos diminuir a ND.
    const bonusArma = Number(arma.system.bonus) || 0;
    const penalidade = Math.max(0, (opts.penalidade || 0) - bonusArma);

    const resultado = await this.rolarPericia(
      pericia, cfg.atribA, cfg.atribB, nd,
      {
        empenhoA:     opts.empenhoA,
        empenhoB:     opts.empenhoB,
        perseveranca: opts.perseveranca,
        origem:       opts.origem,
        origemTipo:   opts.origemTipo,
        corrupcao:    opts.corrupcao,
        penalidade
      }
    );

    if (!resultado) return;

    // Mensagem extra no chat: "X ataca Y com Z" + botão de rolar dano
    const nomeAlvo = opts.alvo?.name ? ` em <b>${opts.alvo.name}</b>` : "";
    const cabecalho = `
      <div class="sinfonia-ataque-header ${resultado.sucesso ? 'acerto' : 'erro'}">
        <i class="fas fa-crosshairs"></i>
        <span><b>${this.name}</b> ataca${nomeAlvo} com <b>${arma.name}</b></span>
      </div>`;
    const acoesHtml = resultado.sucesso
      ? `<div class="sinfonia-ataque-acoes">
           <button type="button" class="btn-rolar-dano"
             data-actor-id="${this.id}" data-arma-id="${arma.id}">
             <i class="fas fa-dice-d20"></i> Rolar Dano
           </button>
         </div>`
      : "";

    await ChatMessage.implementation.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: cabecalho + acoesHtml
    });

    return resultado;
  }

  /**
   * Rola dano de uma arma. Resolve @pod/@agi/@int/@car/@mis
   * para o valor do dado de atributo correspondente.
   *
   * @param {Item} arma
   * @param {object} [opts]
   * @param {boolean} [opts.critico]  Se true, dobra os dados
   */
  async rolarDano(arma, opts = {}) {
    if (this.type !== "personagem") return;
    if (!arma || arma.type !== "arma") return;

    let formula = (arma.system.dano || "1d6").trim();

    // Substitui @attr pelos valores numéricos dos dados
    const subs = {
      pod: this.dadoValor("pod"),
      agi: this.dadoValor("agi"),
      int: this.dadoValor("int"),
      car: this.dadoValor("car"),
      mis: this.dadoValor("mis")
    };
    for (const [k, v] of Object.entries(subs)) {
      formula = formula.replaceAll(`@${k}`, v);
    }

    // Crítico: dobra todos os termos de dado (ex: 1d10 → 2d10)
    if (opts.critico) {
      formula = formula.replace(/(\d+)d(\d+)/gi, (_, n, f) => `${parseInt(n) * 2}d${f}`);
    }

    let roll;
    try {
      roll = new Roll(formula);
      await roll.evaluate();
    } catch (err) {
      ui.notifications.error(`Fórmula de dano inválida em ${arma.name}: ${formula}`);
      console.error(err);
      return;
    }

    const total = roll.total;
    const tipoDano = arma.system.tipoDano || "";

    // Detalhamento dos dados
    const dadosHtml = roll.dice.map(term => {
      const pills = term.results.map(r =>
        `<span class="dado-pill ativo" title="d${term.faces}">${r.result}</span>`
      ).join("");
      return `<span class="dado-grupo"><span class="dado-tipo">d${term.faces}</span>${pills}</span>`;
    }).join("");

    const content = `
      <div class="sinfonia-dano-roll ${opts.critico ? 'critico' : ''}">
        <div class="dano-header">
          <span class="actor-name">${this.name}</span>
          <span class="dano-arma">${arma.name}${opts.critico ? ' — CRÍTICO!' : ''}</span>
        </div>
        <div class="dano-formula">${arma.system.dano || ""}</div>
        <div class="roll-dados">${dadosHtml}</div>
        <div class="dano-total">
          <span class="total">${total}</span>
          <span class="dano-tipo">${tipoDano}</span>
        </div>
        <div class="dano-acoes">
          <button type="button" class="btn-aplicar-dano" data-dano="${total}">
            <i class="fas fa-heart-broken"></i> Aplicar Dano
          </button>
          <button type="button" class="btn-aplicar-cura" data-cura="${total}">
            <i class="fas fa-heart"></i> Aplicar Cura
          </button>
        </div>
      </div>
    `;

    await ChatMessage.implementation.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content,
      rolls: [roll],
      type: CONST.CHAT_MESSAGE_TYPES.ROLL
    });

    return { roll, total };
  }

  /**
   * Gasta pontos de Determinação
   * @param {number} quantidade
   */
  async gastarDeterminacao(quantidade = 1) {
    if (this.type !== "personagem") return;
    const det = this.system.alma.determinacao;
    const novo = Math.max(0, det - quantidade);
    await this.update({ "system.alma.determinacao": novo });
    ui.notifications.info(`${this.name} gastou ${quantidade} ponto(s) de Determinação. Restam: ${novo}`);
  }

  /**
   * Corrompe a alma em 1 ponto. Detecta Estilhaço da Alma se Det chegar a 0.
   * Quando isso acontece, o cabo de guerra reinicia favorecendo a Corrupção:
   * Determinação cai para (10 − estilhacos − 1) e Corrupção sobe pra (estilhacos + 1).
   */
  async corromper() {
    if (this.type !== "personagem") return;
    const det = this.system.alma.determinacao;
    if (det <= 0) {
      // Já zerada — estilhaço imediato
      return this._estilhacarAlma();
    }
    const novaDet = det - 1;
    await this.update({ "system.alma.determinacao": novaDet }, { render: false });

    if (novaDet === 0) {
      await this._estilhacarAlma();
    } else {
      ui.notifications.warn(
        `${this.name} corrompe a alma! Determinação: ${novaDet} | Corrupção: ${10 - novaDet}`
      );
    }
  }

  /**
   * Aplica um Estilhaço da Alma e reinicia o cabo de guerra pendendo pra Corrupção.
   * Conforme o doc: exemplo de 7–3 que vira 6–4 após 1 estilhaço.
   * Generalizando: após N estilhaços, o novo ponto de partida é (7−N) Det / (3+N) Cor,
   * clamped a 0–10.
   */
  async _estilhacarAlma() {
    const sys = this.system;
    const novoEstilhacos = (sys.alma.estilhacos ?? 0) + 1;
    const novaDet = Math.max(0, 7 - novoEstilhacos);

    await this.update({
      "system.alma.estilhacos":   novoEstilhacos,
      "system.alma.determinacao": novaDet
    }, { render: false });

    await ChatMessage.implementation.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `
        <div class="sinfonia-estilhaco">
          <h3>☠ Estilhaço da Alma ☠</h3>
          <p><b>${this.name}</b> sucumbe à corrupção. A alma se quebra, e algo se perde.</p>
          <p>Estilhaços acumulados: <b>${novoEstilhacos}</b></p>
          <p>O cabo de guerra recomeça com Determinação ${novaDet} / Corrupção ${10 - novaDet}.</p>
          <p><em>O Mestre deve aplicar uma mutação (benigna ou maligna) ao personagem.</em></p>
        </div>
      `
    });

    ui.notifications.error(`☠ ${this.name} ganhou um Estilhaço da Alma! Total: ${novoEstilhacos}`);
  }

  /**
   * Descanso longo: restaura PV/PE ao máximo e devolve os usos de Origem.
   * NÃO zera Estilhaços nem altera o cabo de guerra — esses são cicatrizes permanentes.
   */
  async descansar() {
    if (this.type !== "personagem") return;
    const sys = this.system;
    await this.update({
      "system.recursos.pv.value": sys.recursos.pv.max,
      "system.recursos.pe.value": sys.recursos.pe.max,
      "system.recursos.pv.temp": 0,
      "system.origem.eventoMarcante.usadoNaSessao": false,
      "system.origem.ocupacao.usadoNaSessao":      false
    }, { render: false });

    await ChatMessage.implementation.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="sinfonia-descanso"><b>${this.name}</b> descansa. PV, PE e usos de Origem restaurados.</div>`
    });
    ui.notifications.info(`${this.name} descansou.`);
  }

  /**
   * Aplica dano ao personagem
   * @param {number} dano
   */
  async aplicarDano(dano) {
    dano = Math.max(1, Math.round(dano));
    const pv = this.system.recursos.pv;
    // Absorve PVT primeiro
    if (pv.temp > 0) {
      const absorvido = Math.min(pv.temp, dano);
      dano -= absorvido;
      await this.update({ "system.recursos.pv.temp": pv.temp - absorvido });
    }
    const novoValor = Math.max(0, pv.value - dano);
    await this.update({ "system.recursos.pv.value": novoValor });

    await ChatMessage.implementation.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="sinfonia-dano"><b>${this.name}</b> sofreu <b>${dano}</b> de dano! PV: ${novoValor}/${pv.max}</div>`
    });
  }

  /**
   * Cura o personagem
   * @param {number} cura
   */
  async curar(cura) {
    cura = Math.max(1, Math.round(cura));
    const pv = this.system.recursos.pv;
    const novoValor = Math.min(pv.max, pv.value + cura);
    await this.update({ "system.recursos.pv.value": novoValor });

    await ChatMessage.implementation.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="sinfonia-cura"><b>${this.name}</b> recuperou <b>${cura}</b> PV! PV: ${novoValor}/${pv.max}</div>`
    });
  }
}

/* ============================================================
   ITEM
============================================================ */
export class SinfoniaItem extends Item {

  /** True se é uma magia de alto círculo (2+) */
  get isAltaCirculo() {
    return this.type === "magia" && this.system.circulo >= 2;
  }

  /** Custo real de PE considerando círculo */
  get custoPEEfetivo() {
    if (this.type !== "magia") return this.system.custoPE ?? 0;
    return this.system.custoPE;
  }

  /**
   * Usa um item — magia, habilidade ou consumível
   * @param {SinfoniaActor} actor
   */
  async usar(actor) {
    if (!actor) return;

    if (this.type === "magia") return this._usarMagia(actor);
    if (this.type === "habilidade") return this._usarHabilidade(actor);
    if (this.type === "inventario") return this._usarConsumivel(actor);
  }

  async _usarMagia(actor) {
    const sys = this.system;
    const pe = actor.system.recursos.pe;

    if (pe.value < sys.custoPE) {
      ui.notifications.warn(`${actor.name} não tem PE suficiente para conjurar ${this.name}!`);
      return;
    }

    await actor.update({ "system.recursos.pe.value": pe.value - sys.custoPE });

    const escolaLabel = game.i18n.localize(`SINFONIA.Escolas.${sys.escola}`) || sys.escola;
    const content = `
      <div class="sinfonia-magia">
        <div class="magia-header">
          <span class="magia-nome">${this.name}</span>
          <span class="magia-info">${sys.circulo}º Círculo — ${escolaLabel}</span>
        </div>
        <div class="magia-detalhes">
          <span>⚡ ${sys.custoPE} PE</span>
          <span>📏 ${sys.alcance}</span>
          <span>⏱ ${sys.duracao}</span>
        </div>
        <div class="magia-desc">${sys.descricao || ""}</div>
      </div>
    `;

    await ChatMessage.implementation.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content
    });
  }

  async _usarHabilidade(actor) {
    const sys = this.system;
    if (sys.custoPE > 0) {
      const pe = actor.system.recursos.pe;
      if (pe.value < sys.custoPE) {
        ui.notifications.warn(`${actor.name} não tem PE suficiente para usar ${this.name}!`);
        return;
      }
      await actor.update({ "system.recursos.pe.value": pe.value - sys.custoPE });
    }

    await ChatMessage.implementation.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="sinfonia-habilidade"><b>${actor.name}</b> usa <b>${this.name}</b>!${sys.custoPE > 0 ? ` (-${sys.custoPE} PE)` : ""}</div>`
    });
  }

  async _usarConsumivel(actor) {
    const sys = this.system;
    if (sys.quantidade <= 0) {
      ui.notifications.warn(`${this.name} está esgotado!`);
      return;
    }
    await this.update({ "system.quantidade": sys.quantidade - 1 });
    await ChatMessage.implementation.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="sinfonia-consumivel"><b>${actor.name}</b> usa <b>${this.name}</b>. Restam: ${sys.quantidade - 1}</div>`
    });
  }
}
