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
   * Rola uma perícia: dadoA + dadoB + modificador vs ND
   * @param {string} pericia  - chave da perícia (ex: "armasBrancas")
   * @param {string} atribA   - atributo A (ex: "pod")
   * @param {string} atribB   - atributo B (ex: "agi")
   * @param {number} nd       - nível de dificuldade
   */
  async rolarPericia(pericia, atribA, atribB, nd = 12) {
    if (this.type !== "personagem") return;
    const sys = this.system;

    const dadoA = sys.atributos[atribA] ?? "d6";
    const dadoB = sys.atributos[atribB] ?? "d6";
    const maestria = sys.pericias[pericia] ?? "";
    const modMap = { iniciante: 2, treinado: 4, experiente: 6 };
    const mod = modMap[maestria] ?? 0;

    const formula = `${dadoA} + ${dadoB} + ${mod}`;
    const roll = new Roll(formula);
    await roll.evaluate();

    const total = roll.total;
    const sucesso = total >= nd;

    const nomePericia = game.i18n.localize(`SINFONIA.Pericias.${pericia}`) || pericia;
    const nomeAtribA  = atribA.toUpperCase();
    const nomeAtribB  = atribB.toUpperCase();
    const maestriaLabel = maestria
      ? `<span class="maestria">${maestria} (+${mod})</span>`
      : `<span class="maestria sem-maestria">sem maestria</span>`;

    const content = `
      <div class="sinfonia-roll ${sucesso ? 'sucesso' : 'falha'}">
        <div class="roll-header">
          <span class="actor-name">${this.name}</span>
          <span class="pericia-nome">${nomePericia}</span>
        </div>
        <div class="roll-formula">${nomeAtribA} + ${nomeAtribB} ${maestriaLabel}</div>
        <div class="roll-resultado">
          <span class="total">${total}</span>
          <span class="nd">ND ${nd}</span>
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

    return { roll, sucesso, total };
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
   * Corrompe a alma em 1 ponto
   */
  async corromper() {
    if (this.type !== "personagem") return;
    const det = this.system.alma.determinacao;
    if (det <= 0) {
      ui.notifications.warn(`${this.name} não tem Determinação para corromper!`);
      return;
    }
    await this.gastarDeterminacao(1);
    ui.notifications.warn(`${this.name} corrompe a alma! Determinação: ${det - 1} | Corrupção: ${10 - (det - 1)}`);
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
