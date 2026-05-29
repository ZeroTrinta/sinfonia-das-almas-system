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
   * Rola um ataque de MAGIA (Conjuração Mística) contra a Defesa do alvo.
   * Abre o dialog rico de Alma reaproveitando a lógica de _dialogAtaqueMagia
   * da sheet. Aqui, no actor, fazemos a rolagem em si.
   *
   * @param {Item}   magia    Item do tipo "magia"
   * @param {object} analise  resultado de SinfoniaItem.analisarMagia
   */
  async rolarAtaqueMagia(magia, analise) {
    if (this.type !== "personagem") return;
    if (!magia || magia.type !== "magia") return;

    // Perícia/atributos conforme arcana vs sagrada
    const conj = (await import("./documents.mjs")).SinfoniaItem.periciaConjuracao(magia.system.tipo);

    // Abre o dialog rico de Alma (mesma UX do ataque com arma)
    const opcoes = await this.sheet?.constructor?._dialogAtaqueMagia?.(this, magia, conj, analise);
    // Se a sheet não estiver disponível, usa um fluxo simplificado sem dialog
    const opts = opcoes ?? { nd: null, alvo: null };
    if (opcoes === null) return; // usuario cancelou

    // ND = Defesa do alvo (se houver) ou ND manual
    const nd = opts.alvo?.defesa ?? opts.nd ?? 10;

    const resultado = await this.rolarPericia(
      conj.pericia, conj.atribA, conj.atribB, nd,
      {
        empenhoA:     opts.empenhoA,
        empenhoB:     opts.empenhoB,
        perseveranca: opts.perseveranca,
        origem:       opts.origem,
        origemTipo:   opts.origemTipo,
        corrupcao:    opts.corrupcao,
        penalidade:   opts.penalidade
      }
    );
    if (!resultado) return;

    // Cabeçalho + botão de rolar dano (se a magia tiver dano)
    const nomeAlvo = opts.alvo?.name ? ` em <b>${opts.alvo.name}</b>` : "";
    const cabecalho = `
      <div class="sinfonia-ataque-header ${resultado.sucesso ? 'acerto' : 'erro'}">
        <i class="fas fa-wand-magic-sparkles"></i>
        <span><b>${this.name}</b> conjura${nomeAlvo} com <b>${magia.name}</b></span>
      </div>`;
    const acoesHtml = (resultado.sucesso && analise.dano)
      ? `<div class="sinfonia-ataque-acoes">
           <button type="button" class="btn-magia-dano"
             data-actor-id="${this.id}" data-item-id="${magia.id}">
             <i class="fas fa-dice-d20"></i> Rolar Dano (${analise.dano.formula}${analise.dano.tipoDano ? " " + analise.dano.tipoDano : ""})
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
   * Rola o dano de uma magia. A fórmula vem da análise (auto-detectada na
   * descrição). Resolve nada de @attr (magias usam dados fixos tipo 3d8),
   * mas adiciona o "Valor Fixo do Conduíte" se o texto mencionar (placeholder
   * tratado como 0 por enquanto, já que condíte não é modelado ainda).
   *
   * @param {Item}   magia
   * @param {object} [opts]
   * @param {string} [opts.formula]  sobrescreve a fórmula detectada
   * @param {string} [opts.tipoDano]
   * @param {boolean}[opts.critico]
   */
  async rolarDanoMagia(magia, opts = {}) {
    if (this.type !== "personagem") return;
    if (!magia || magia.type !== "magia") return;

    const analise = (await import("./documents.mjs")).SinfoniaItem.analisarMagia(magia.system);
    let formula = (opts.formula || analise.dano?.formula || "").trim();
    const tipoDano = opts.tipoDano || analise.dano?.tipoDano || "";

    if (!formula) {
      ui.notifications.warn(`Não detectei fórmula de dano em ${magia.name}. Edite a magia ou role manualmente.`);
      return;
    }

    // Crítico dobra os dados
    if (opts.critico) {
      formula = formula.replace(/(\d+)d(\d+)/gi, (_, n, f) => `${parseInt(n) * 2}d${f}`);
    }

    let roll;
    try {
      roll = new Roll(formula);
      await roll.evaluate();
    } catch (err) {
      ui.notifications.error(`Fórmula de dano inválida em ${magia.name}: ${formula}`);
      console.error(err);
      return;
    }

    const total = roll.total;
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
          <span class="dano-arma">${magia.name}${opts.critico ? ' — CRÍTICO!' : ''}</span>
        </div>
        <div class="dano-formula">${formula}${tipoDano ? " · " + tipoDano : ""}</div>
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
   * Aplica dano ao personagem.
   * Robusta a NaN/undefined: se o valor não for válido, mostra erro claro
   * em vez de quebrar silenciosamente no `update()` do Foundry.
   *
   * Implementa **Crepúsculo da Morte** (regra do doc):
   *   • Ao chegar a 0 PV: entra no Crepúsculo, Det atual vira a contagem regressiva.
   *   • Cada dano recebido no Crepúsculo: perde +1 Det (ou +2 se crítico).
   *   • Cada Det perdida vira Ponto de Corrupção.
   *
   * @param {number}  dano
   * @param {object}  [opts]
   * @param {boolean} [opts.critico]  Marca este dano como crítico (dobra penalidade de Det no Crepúsculo)
   */
  async aplicarDano(dano, opts = {}) {
    // Normaliza entrada — aceita string "15" ou número 15
    dano = Number(dano);
    if (!Number.isFinite(dano) || dano <= 0) {
      ui.notifications.warn(`Valor de dano inválido (${dano}). Verifique o card de dano.`);
      return;
    }
    dano = Math.max(1, Math.round(dano));

    const pv = this.system.recursos.pv ?? {};
    const pvValueAtual = Number.isFinite(pv.value) ? pv.value : 0;
    const pvMaxAtual   = Number.isFinite(pv.max)   ? pv.max   : 0;
    const pvTempAtual  = Number.isFinite(pv.temp)  ? pv.temp  : 0;
    const jaNoCrepusculo = this.type === "personagem" && this.system.alma?.crepusculo === true;

    let danoRestante = dano;
    const updates = {};

    // Absorve PVT primeiro (só se não estiver no Crepúsculo — lá o PV já é 0)
    if (pvTempAtual > 0 && !jaNoCrepusculo) {
      const absorvido = Math.min(pvTempAtual, danoRestante);
      danoRestante -= absorvido;
      updates["system.recursos.pv.temp"] = pvTempAtual - absorvido;
    }

    const novoValor = Math.max(0, pvValueAtual - danoRestante);
    updates["system.recursos.pv.value"] = novoValor;

    // ── Crepúsculo da Morte (só para personagens) ────────────────────
    let mensagemExtra = "";
    if (this.type === "personagem") {
      // Caso 1: Já estava no Crepúsculo → dano custa 1 Det (2 se crítico)
      if (jaNoCrepusculo) {
        const detAtual = this.system.alma.determinacao;
        const perda = opts.critico ? 2 : 1;
        const novaDet = Math.max(0, detAtual - perda);
        // Cor é derivada (10 - Det) no prepareDerivedData, então não setamos direto.
        updates["system.alma.determinacao"] = novaDet;

        mensagemExtra = `<p class="crep-aviso"><b>Crepúsculo:</b> ${this.name} perde ${perda} Determinação${opts.critico ? " (crítico!)" : ""}. Det: ${novaDet}.</p>`;
      }
      // Caso 2: Acabou de chegar a 0 PV → entra no Crepúsculo
      else if (novoValor === 0 && pvValueAtual > 0) {
        updates["system.alma.crepusculo"]    = true;
        updates["system.alma.testesVontade"] = 0;
        mensagemExtra = `
          <div class="crep-aviso entrou">
            <p><b>⚱ ${this.name} entra no Crepúsculo da Morte.</b></p>
            <p>Det atual (${this.system.alma.determinacao}) = turnos restantes antes da morte.</p>
            <p>No início de cada turno: –1 Determinação. Em Det 1: teste de Força de Vontade pra sobreviver.</p>
          </div>`;
      }
    }

    await this.update(updates);

    await ChatMessage.implementation.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="sinfonia-dano"><b>${this.name}</b> sofreu <b>${dano}</b> de dano! PV: ${novoValor}/${pvMaxAtual}</div>${mensagemExtra}`
    });
  }

  /**
   * Cura o personagem.
   * Se estava no Crepúsculo da Morte e recupera PV > 0, sai do Crepúsculo automaticamente.
   * @param {number} cura
   */
  async curar(cura) {
    cura = Number(cura);
    if (!Number.isFinite(cura) || cura <= 0) {
      ui.notifications.warn(`Valor de cura inválido (${cura}). Verifique o card de dano.`);
      return;
    }
    cura = Math.max(1, Math.round(cura));

    const pv = this.system.recursos.pv ?? {};
    const pvValueAtual = Number.isFinite(pv.value) ? pv.value : 0;
    const pvMaxAtual   = Number.isFinite(pv.max)   ? pv.max   : 0;
    const noCrepusculo = this.type === "personagem" && this.system.alma?.crepusculo === true;

    const novoValor = Math.min(pvMaxAtual, pvValueAtual + cura);
    const updates = { "system.recursos.pv.value": novoValor };

    let mensagemExtra = "";
    if (noCrepusculo && novoValor > 0) {
      // Sai do Crepúsculo (PV voltou)
      updates["system.alma.crepusculo"]    = false;
      updates["system.alma.testesVontade"] = 0;
      mensagemExtra = `<p class="crep-aviso saiu"><b>✨ ${this.name} retorna do Crepúsculo da Morte.</b></p>`;
    }

    await this.update(updates);

    await ChatMessage.implementation.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="sinfonia-cura"><b>${this.name}</b> recuperou <b>${cura}</b> PV! PV: ${novoValor}/${pvMaxAtual}</div>${mensagemExtra}`
    });
  }

  /**
   * Chamado no início do turno do personagem (via hook combatTurnChange).
   * Se estiver no Crepúsculo da Morte, perde 1 Det. Se chegou a 1, oferece
   * teste de Força de Vontade com ND escalonada (10 → 16 → 16 → 20 → 25 → 30).
   * Se chegou a 0 Det, o personagem morre.
   */
  async processarTurnoCrepusculo() {
    if (this.type !== "personagem") return;
    if (!this.system.alma?.crepusculo) return;

    const detAtual = this.system.alma.determinacao;

    // Det 0 → morte
    if (detAtual <= 0) {
      await ChatMessage.implementation.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `<div class="crep-aviso morte"><h3>☠ ${this.name} morreu.</h3><p>Sua alma se dissipou no Crepúsculo.</p></div>`
      });
      return;
    }

    // Det 1 → teste de Vontade
    if (detAtual === 1) {
      const NDS = [10, 16, 16, 20, 25, 30];
      const tentativa = this.system.alma.testesVontade ?? 0;
      const nd = NDS[Math.min(tentativa, NDS.length - 1)];

      await this.update({
        "system.alma.testesVontade": tentativa + 1
      }, { render: false });

      await ChatMessage.implementation.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `
          <div class="crep-aviso teste">
            <p><b>⚠ ${this.name} agarra-se à vida.</b></p>
            <p>Teste de <b>Força de Vontade</b> contra <b>ND ${nd}</b>. Em caso de falha, a alma se rompe e o personagem morre.</p>
            <button type="button" class="btn-rolar-resistencia"
              data-pericia="vontade" data-nd="${nd}"
              data-actor-id="${this.id}">
              <i class="fas fa-dice"></i> Rolar Vontade (ND ${nd})
            </button>
          </div>`
      });
      return;
    }

    // Caso normal: perde 1 Det (Cor sobe automaticamente via prepareDerivedData)
    const novaDet = detAtual - 1;
    await this.update({
      "system.alma.determinacao": novaDet
    }, { render: false });

    await ChatMessage.implementation.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="crep-aviso turno"><b>Crepúsculo:</b> ${this.name} perde 1 Determinação no início do turno. Det: ${novaDet}.</div>`
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

    // Analisa a descrição pra detectar tipo (ataque / resistência / utilitária),
    // perícia de resistência exigida e fórmula de dano.
    const analise = SinfoniaItem.analisarMagia(sys);

    // Despacha pro fluxo correto. Cada um cuida de gastar PE e postar no chat.
    if (analise.tipo === "ataque") {
      return this._conjurarAtaque(actor, analise);
    }
    if (analise.tipo === "resistencia") {
      return this._conjurarResistencia(actor, analise);
    }
    // Utilitária: apenas gasta PE e mostra o card descritivo.
    return this._conjurarUtilitaria(actor, analise);
  }

  /* ============================================================
     ANÁLISE DE MAGIA (auto-detecção pela descrição)
  ============================================================ */

  /**
   * Analisa o system de uma magia e detecta:
   *   • tipo: "ataque" | "resistencia" | "utilitaria"
   *   • resistencia: "reflexos" | "fortitude" | "vontade" | null
   *   • dano: { formula, tipoDano } | null
   *
   * A detecção usa primeiro o campo system.resistencia (se preenchido) e,
   * como fallback, faz regex na descrição em texto livre.
   *
   * @param {object} sys  system da magia
   * @returns {{tipo:string, resistencia:string|null, dano:object|null, raw:string}}
   */
  static analisarMagia(sys) {
    // Texto limpo (sem tags HTML) pra rodar regex
    const html = sys.descricao || "";
    const txt = html
      .replace(/<[^>]+>/g, " ")   // remove tags
      .replace(/&[a-z]+;/gi, " ") // remove entidades
      .replace(/\s+/g, " ")
      .trim();
    const lower = txt.toLowerCase();

    // ── 1. Detecta perícia de RESISTÊNCIA ──
    // Padrões: "teste de Reflexos", "realizar um teste de Fortitude", "teste de Vontade"
    // Também aceita "Força de Vontade".
    let resistencia = null;
    const mapaResist = [
      { re: /\bteste\s+de\s+reflexos\b/i,                         val: "reflexos"  },
      { re: /\bteste\s+de\s+fortitude\b/i,                        val: "fortitude" },
      { re: /\bteste\s+de\s+(?:for[çc]a\s+de\s+)?vontade\b/i,     val: "vontade"   }
    ];
    // Prioriza o campo estruturado, se existir
    const campoResist = (sys.resistencia || "").toLowerCase().trim();
    if (campoResist) {
      if (campoResist.includes("reflex"))   resistencia = "reflexos";
      else if (campoResist.includes("fort")) resistencia = "fortitude";
      else if (campoResist.includes("vont")) resistencia = "vontade";
    }
    if (!resistencia) {
      for (const m of mapaResist) {
        if (m.re.test(lower)) { resistencia = m.val; break; }
      }
    }

    // ── 2. Detecta ATAQUE místico (rola contra Defesa) ──
    // Padrões: "ataque de Conjuração", "contra a Defesa", "teste de acerto místico"
    const ehAtaque =
      /ataque\s+de\s+conjura[çc][ãa]o/i.test(lower) ||
      /teste\s+de\s+acerto\s+m[íi]stico/i.test(lower) ||
      /contra\s+a\s+defesa\s+do\s+alvo/i.test(lower);

    // ── 3. Detecta fórmula de DANO ──
    // Vários padrões cobrem arcanas e sagradas:
    //   • "1d6 de dano de ácido"           (arcanas — dano logo após o dado)
    //   • "4d6 + Valor do Conduíte de Dano" (sagradas — texto entre dado e "dano")
    //   • "sofre 3d8"                        (fallback — primeiro dado após "sofre")
    let dano = null;
    let mDano =
      txt.match(/(\d+\s*d\s*\d+)\s*de\s*dano(?:\s*de\s*([a-zçãéíóáúâêôà]+))?/i) ||
      txt.match(/(\d+\s*d\s*\d+)\s*\+[^.]{0,60}?de\s+dano(?:\s+de\s+([a-zçãéíóáúâêôà]+))?/i);
    if (!mDano) {
      const mFallback = txt.match(/sofre\s+(?:\*+)?(\d+\s*d\s*\d+)/i);
      if (mFallback) mDano = [mFallback[0], mFallback[1], ""];
    }
    if (mDano) {
      const formula = mDano[1].replace(/\s+/g, "");
      const tipoDano = (mDano[2] || "").trim();
      dano = { formula, tipoDano };
    }

    // ── 4. Decide o tipo final ──
    // Se exige teste de resistência → "resistencia" (mesmo que cause dano)
    // Senão se tem ataque místico → "ataque"
    // Senão → "utilitaria"
    let tipo;
    if (resistencia)    tipo = "resistencia";
    else if (ehAtaque)  tipo = "ataque";
    else                tipo = "utilitaria";

    return { tipo, resistencia, dano, raw: txt };
  }

  /* ============================================================
     FLUXOS DE CONJURAÇÃO
  ============================================================ */

  /**
   * Determina a perícia/atributos de ataque místico conforme o tipo da magia.
   *   • Arcana  → Conjuração Mística = Arcanismo (MIS + MIS)
   *   • Sagrada → Conjuração Divina  = CAR + INT
   * Retorna { pericia, atribA, atribB, label }.
   */
  static periciaConjuracao(tipoMagia) {
    if (tipoMagia === "sagrada") {
      return { pericia: "arcanismo", atribA: "car", atribB: "int", label: "Conjuração Divina (CAR+INT)" };
    }
    // Arcana (default)
    return { pericia: "arcanismo", atribA: "mis", atribB: "mis", label: "Conjuração Arcana (MIS+MIS)" };
  }

  /**
   * Conjura uma magia de ATAQUE: rola Conjuração Mística contra a Defesa do alvo.
   * Reaproveita rolarAtaqueMagia do actor (que abre dialog de Alma).
   */
  async _conjurarAtaque(actor, analise) {
    const sys = this.system;
    const pe = actor.system.recursos.pe;

    // Gasta PE
    await actor.update({ "system.recursos.pe.value": pe.value - sys.custoPE }, { render: false });

    // Posta o card descritivo da magia primeiro
    await this._postarCardMagia(actor, analise, "ataque");

    // Dispara o ataque místico (rola contra Defesa do alvo)
    await actor.rolarAtaqueMagia(this, analise);
  }

  /**
   * Conjura uma magia de RESISTÊNCIA: posta no chat o card + botão pro alvo
   * rolar a resistência contra a ND Mística do conjurador.
   */
  async _conjurarResistencia(actor, analise) {
    const sys = this.system;
    const pe = actor.system.recursos.pe;

    // Gasta PE
    await actor.update({ "system.recursos.pe.value": pe.value - sys.custoPE }, { render: false });

    // ND de resistência: arcana = 8 + MIS, sagrada = 8 + CAR (do doc)
    const ndResist = this.system.tipo === "sagrada"
      ? 8 + actor.dadoValor("car")
      : 8 + actor.dadoValor("mis");

    // Perícia que o alvo deve rolar
    const periciaResist = analise.resistencia; // reflexos | fortitude | vontade
    const labelResist = {
      reflexos:  "Reflexos",
      fortitude: "Fortitude",
      vontade:   "Força de Vontade"
    }[periciaResist] ?? periciaResist;

    // Card descritivo
    await this._postarCardMagia(actor, analise, "resistencia");

    // Mensagem com botão de rolar resistência + (se houver dano) rolar dano
    const danoBtn = analise.dano
      ? `<button type="button" class="btn-magia-dano"
           data-actor-id="${actor.id}" data-item-id="${this.id}">
           <i class="fas fa-dice-d20"></i> Rolar Dano (${analise.dano.formula}${analise.dano.tipoDano ? " " + analise.dano.tipoDano : ""})
         </button>`
      : "";

    const content = `
      <div class="sinfonia-magia-resist">
        <div class="magia-resist-header">
          <i class="fas fa-shield-halved"></i>
          <span><b>${actor.name}</b> conjura <b>${this.name}</b></span>
        </div>
        <div class="magia-resist-info">
          O alvo deve rolar <b>${labelResist}</b> contra <b>ND ${ndResist}</b> (Mística).
        </div>
        <div class="magia-resist-acoes">
          <button type="button" class="btn-rolar-resistencia"
            data-pericia="${periciaResist}" data-nd="${ndResist}">
            <i class="fas fa-dice"></i> Rolar ${labelResist} (alvo)
          </button>
          ${danoBtn}
        </div>
        <p class="magia-resist-dica">O jogador do alvo seleciona o próprio token e clica em "Rolar ${labelResist}".</p>
      </div>
    `;

    await ChatMessage.implementation.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content
    });
  }

  /**
   * Conjura uma magia UTILITÁRIA: só gasta PE e mostra o card descritivo.
   */
  async _conjurarUtilitaria(actor, analise) {
    const sys = this.system;
    const pe = actor.system.recursos.pe;
    await actor.update({ "system.recursos.pe.value": pe.value - sys.custoPE }, { render: false });
    await this._postarCardMagia(actor, analise, "utilitaria");

    // Se a utilitária tiver dano (ex: cura listada como "Xd dano"), oferece botão
    if (analise.dano) {
      const content = `
        <div class="sinfonia-magia-resist">
          <div class="magia-resist-acoes">
            <button type="button" class="btn-magia-dano"
              data-actor-id="${actor.id}" data-item-id="${this.id}">
              <i class="fas fa-dice-d20"></i> Rolar (${analise.dano.formula})
            </button>
          </div>
        </div>`;
      await ChatMessage.implementation.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content
      });
    }
  }

  /**
   * Posta o card visual padrão da magia (nome, círculo, custo, alcance, descrição).
   * @param {string} modo  "ataque" | "resistencia" | "utilitaria" (só pra uma tag visual)
   */
  async _postarCardMagia(actor, analise, modo) {
    const sys = this.system;
    const escolaLabel = game.i18n.localize(`SINFONIA.Escolas.${sys.escola}`) || sys.escola;
    const tipoLabel = sys.tipo === "sagrada" ? "Sagrada" : "Arcana";
    const modoTag = {
      ataque:      `<span class="magia-tag ataque">⚔ Ataque</span>`,
      resistencia: `<span class="magia-tag resist">🛡 Resistência</span>`,
      utilitaria:  `<span class="magia-tag util">✨ Utilitária</span>`
    }[modo] ?? "";

    const content = `
      <div class="sinfonia-magia">
        <div class="magia-header">
          <span class="magia-nome">${this.name}</span>
          <span class="magia-info">${sys.circulo}º Círculo — ${escolaLabel} · ${tipoLabel}</span>
        </div>
        <div class="magia-detalhes">
          <span>⚡ ${sys.custoPE} PE</span>
          <span>📏 ${sys.alcance}</span>
          <span>⏱ ${sys.duracao}</span>
          ${modoTag}
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
