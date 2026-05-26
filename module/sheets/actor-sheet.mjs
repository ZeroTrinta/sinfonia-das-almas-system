/**
 * Sinfonia das Almas — Actor Sheet v2
 * DocumentSheetV2 — sem re-render no update, sem flickering
 */

const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SinfoniaActorSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["sinfonia-das-almas", "sheet", "actor"],
    position: { width: 1100, height: 820 },
    window: { resizable: true },
    // ✦ ABORDAGEM B (ATIVA): submitOnChange desligado. Cada campo é salvo
    //    manualmente via listener no _onRender com {render:false}.
    //    Para usar a ABORDAGEM A: troque por { submitOnChange: true, closeOnSubmit: false }
    //    e descomente o bloco _canRender/_processSubmitData mais abaixo.
    form: { submitOnChange: false, closeOnSubmit: false },
    // Habilita drag-and-drop de items (de outras sheets, sidebar, compendiums)
    dragDrop: [{ dragSelector: "[data-item-id]", dropSelector: null }],
    actions: {
      rolarPericia: SinfoniaActorSheet._onRolarPericia,
      usarItem:     SinfoniaActorSheet._onUsarItem,
      criarItem:    SinfoniaActorSheet._onCriarItem,
      deletarItem:  SinfoniaActorSheet._onDeletarItem,
      editarItem:   SinfoniaActorSheet._onEditarItem,
      alternarDet:  SinfoniaActorSheet._onAlternarDet,
      abrirArvore:  SinfoniaActorSheet._onAbrirArvore,
      corromper:    SinfoniaActorSheet._onCorromper,
      descansar:    SinfoniaActorSheet._onDescansar,
      resetEstilhacos: SinfoniaActorSheet._onResetEstilhacos,
      verTodasPericias: SinfoniaActorSheet._onVerTodasPericias,
      atacarArma:      SinfoniaActorSheet._onAtacarArma,
      rolarDanoArma:   SinfoniaActorSheet._onRolarDanoArma,
      toggleFavorito:  SinfoniaActorSheet._onToggleFavorito
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

    // Resumo de perícias com maestria (Iniciante/Treinado/Experiente).
    // Cada entrada inclui o config (label, atribA, atribB) pra montar o botão de rolar.
    const periciasComMaestria = [];
    for (const [key, cfg] of Object.entries(SINFONIA.PERICIAS)) {
      const maestria = sys.pericias?.[key];
      if (maestria) periciasComMaestria.push({ key, maestria, ...cfg });
    }

    // ── Aba Habilidades: agrupa nós ativos da árvore por classe ──────────────
    const ativos = doc.getFlag("sinfonia-das-almas", "arvoreAtiva") ?? {};
    const nodesAtivos = (SINFONIA.NODES || []).filter(n => ativos[n.id] === true);
    const ptsUsados = nodesAtivos.reduce((acc, n) => acc + (n.cost || 0), 0);
    const ptsTotal = sys.progressao?.pontosHabilidade ?? 0;
    // Agrupa por classe usando CLS_META (label, color)
    const ordemClasses = ["guerreiro", "gatuno", "arqueiro", "mago"];
    const porClasse = ordemClasses
      .map(cls => {
        const meta = SINFONIA.CLS_META?.[cls] ?? { label: cls, color: "#888" };
        const nodes = nodesAtivos
          .filter(n => n.cls === cls)
          .map(n => ({ ...n, color: meta.color }));
        return { cls, label: meta.label, color: meta.color, nodes };
      })
      .filter(g => g.nodes.length > 0);
    const habArvore = {
      ptsUsados,
      ptsLivres: Math.max(0, ptsTotal - ptsUsados),
      porClasse
    };

    return {
      actor:           doc,
      system:          sys,
      isOwner:         doc.isOwner,
      isEditable:      this.isEditable,
      atributosConfig: SINFONIA.ATRIBUTOS,
      periciasConfig:  SINFONIA.PERICIAS,
      periciasComMaestria,
      habArvore,
      habilidades:     doc.items.filter(i => i.type === "habilidade"),
      magias:          doc.items.filter(i => i.type === "magia").sort((a,b) => a.system.circulo - b.system.circulo),
      magiasArcanas:   doc.items.filter(i => i.type === "magia" && i.system.tipo === "arcana").sort((a,b) => a.system.circulo - b.system.circulo),
      magiasSagradas:  doc.items.filter(i => i.type === "magia" && i.system.tipo === "sagrada").sort((a,b) => a.system.circulo - b.system.circulo),
      armas:           doc.items.filter(i => i.type === "arma"),
      armaduras:       doc.items.filter(i => i.type === "armadura"),
      inventario:      doc.items.filter(i => i.type === "inventario"),
      // Tudo que pode ser favoritado, marcado pelo usuário
      favoritos:       doc.items.filter(i => i.system?.favorito === true),
      detPct:          (sys.alma?.determinacao ?? 7) * 10,
      corPct:          (sys.alma?.corrupcao    ?? 3) * 10,
    };
  }

  // ── Render ─────────────────────────────────────────────────
  _onRender(context, options) {
    super._onRender?.(context, options);

    // Tabs manuais
    const activateTab = (name) => {
      // Suporta tanto layout antigo (.sheet-tabs .item) quanto novo (.right-tabs .vtab)
      this.element.querySelectorAll(".sheet-tabs .item, .right-tabs .vtab")
        .forEach(t => t.classList.toggle("active", t.dataset.tab === name));
      this.element.querySelectorAll(".sheet-body .tab")
        .forEach(c => c.classList.toggle("active", c.dataset.tab === name));
      this._activeTab = name;
    };
    this.element.querySelectorAll(".sheet-tabs .item, .right-tabs .vtab").forEach(tab => {
      tab.addEventListener("click", () => activateTab(tab.dataset.tab));
    });
    activateTab(this._activeTab ?? "principal");

    // ── Salvamento manual (sem re-render) ──────────────────────────────────
    // Helper que lê o valor de um input e persiste no documento.
    const salvarCampo = async (t) => {
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

      // Evita updates redundantes (lendo o valor atual do documento).
      const atual = foundry.utils.getProperty(this.document, name);
      if (atual === value) return;

      try {
        await this.document.update({ [name]: value }, { render: false });
      } catch (err) {
        console.error("Sinfonia | Falha ao salvar campo", name, err);
        ui.notifications.error(`Não foi possível salvar ${name}.`);
      }
    };

    // Persiste em DOIS gatilhos para cobrir todos os casos:
    //   • change — dispara quando o input perde o foco (clique fora).
    //   • input — dispara a cada tecla; necessário porque se o usuário digita
    //     num input e clica direto em "Abrir Árvore" ou fecha a janela, o
    //     navegador pode NÃO disparar change a tempo. Usamos debounce em input
    //     pra não spammar o servidor.
    const debouncers = new WeakMap();
    this.element.querySelectorAll("input, select, textarea").forEach(el => {
      el.addEventListener("change", (ev) => salvarCampo(ev.currentTarget));
      el.addEventListener("input",  (ev) => {
        const t = ev.currentTarget;
        clearTimeout(debouncers.get(t));
        debouncers.set(t, setTimeout(() => salvarCampo(t), 150));
      });
    });

    // Guarda referência ao helper para reaproveitá-lo em _preClose.
    this._salvarCampo = salvarCampo;

    // ── Drag & Drop: conecta os listeners no DOM ──
    // ApplicationV2 não liga sozinho como ApplicationV1, precisa configurar aqui.
    this.element.addEventListener("dragover", (ev) => this._onDragOver(ev));
    this.element.addEventListener("drop", (ev) => this._onDrop(ev));

    // Drag de items pra fora da sheet (pra arrastar pra outra sheet ou hotbar)
    this.element.querySelectorAll("[data-item-id]").forEach(el => {
      el.setAttribute("draggable", "true");
      el.addEventListener("dragstart", (ev) => this._onDragStart(ev));
    });
  }

  // ── PreClose: salva qualquer campo pendente antes da janela fechar ─────────────
  // Cobre o caso onde o usuário digita e clica direto no X sem disparar blur.
  async _preClose(options) {
    if (this._salvarCampo && this.element) {
      const inputs = this.element.querySelectorAll("input, select, textarea");
      await Promise.all(Array.from(inputs).map(el => this._salvarCampo(el)));
    }
    return super._preClose?.(options);
  }

  /* ============================================================
     DRAG & DROP
     DocumentSheetV2 não tem drop nativo, então implementamos manualmente.
     Foundry chama _onDrop quando algo é dropado na sheet.
  ============================================================ */

  /**
   * Handler chamado automaticamente pelo Foundry quando algo é dropado.
   * Identifica o tipo do dado e direciona pro handler apropriado.
   */
  async _onDrop(event) {
    event.preventDefault();
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch (err) {
      return false;
    }

    // Dispara hook do Foundry, caso algum módulo queira interceptar
    const allowed = Hooks.call("dropActorSheetData", this.document, this, data);
    if (allowed === false) return false;

    if (data.type === "Item") return this._onDropItem(event, data);
    if (data.type === "ActiveEffect") return this._onDropActiveEffect(event, data);
    if (data.type === "Folder") return this._onDropFolder(event, data);

    return false;
  }

  /**
   * Cria uma cópia do item no actor.
   * Funciona tanto pra items vindos de compendiums quanto de outras sheets.
   */
  async _onDropItem(event, data) {
    if (!this.document.isOwner) return false;

    // Resolve o documento Item a partir do uuid (Foundry passa { type:"Item", uuid:"..." })
    const item = await Item.implementation.fromDropData(data);
    if (!item) return false;

    const itemData = item.toObject();

    // Se está movendo dentro do próprio actor, não cria duplicata, apenas reordena
    if (this.document.uuid === item.parent?.uuid) {
      return this._onSortItem(event, itemData);
    }

    // Cria item novo no actor
    const created = await this.document.createEmbeddedDocuments("Item", [itemData]);
    ui.notifications.info(`${item.name} adicionado a ${this.document.name}.`);
    return created;
  }

  /**
   * Reordena items quando dropados dentro do próprio actor.
   * Implementação simples — sem reordenação por agora, apenas no-op.
   * (Ordem visual é controlada pelo sort no _prepareContext.)
   */
  async _onSortItem(event, itemData) {
    // Por enquanto, não fazemos nada — a ordem é dada por sort em _prepareContext.
    return false;
  }

  /**
   * Drop de ActiveEffect (não usado por enquanto, mas previne erros).
   */
  async _onDropActiveEffect(event, data) {
    if (!this.document.isOwner) return false;
    const effect = await ActiveEffect.implementation.fromDropData(data);
    if (!effect || (this.document.uuid === effect.parent?.uuid)) return false;
    return ActiveEffect.create(effect.toObject(), { parent: this.document });
  }

  /**
   * Drop de Folder — cria todos os items da pasta de uma vez.
   * Útil pra arrastar uma pasta inteira de armas/magias do compendium.
   */
  async _onDropFolder(event, data) {
    if (!this.document.isOwner) return false;
    const folder = await Folder.implementation.fromDropData(data);
    if (!folder || folder.type !== "Item") return false;
    const itemsData = folder.contents.map(i => i.toObject());
    return this.document.createEmbeddedDocuments("Item", itemsData);
  }

  /**
   * Inicia drag de items DENTRO da própria sheet (pra mover entre sheets).
   * Chamado automaticamente quando o usuário arrasta algo do dragSelector.
   */
  _onDragStart(event) {
    const itemId = event.target.closest("[data-item-id]")?.dataset.itemId;
    if (!itemId) return;
    const item = this.document.items.get(itemId);
    if (!item) return;
    event.dataTransfer.setData("text/plain", JSON.stringify(item.toDragData()));
  }

  /** Permite drop — chamado durante dragover */
  _onDragOver(event) {
    event.preventDefault();
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
    const opcoes = await SinfoniaActorSheet._dialogND(this.document, atribA, atribB);
    if (!opcoes) return;
    await this.document.rolarPericia(pericia, atribA, atribB, opcoes.nd, opcoes);
  }

  /**
   * Dialog rico para rolagem de perícia.
   * Permite escolher: ND, penalidade, Empenho, Perseverança, Origem, Corrupção.
   *
   * Retorna um objeto { nd, penalidade, empenho, perseveranca, origem, origemTipo, corrupcao }
   * ou null se cancelado.
   */
  static async _dialogND(actor, atribA, atribB) {
    const sys = actor.system;
    const det = sys.alma.determinacao;
    const cor = sys.alma.corrupcao;
    const atribAUpper = (atribA || "A").toUpperCase();
    const atribBUpper = (atribB || "B").toUpperCase();
    const eventoUsado   = sys.origem?.eventoMarcante?.usadoNaSessao;
    const ocupacaoUsada = sys.origem?.ocupacao?.usadoNaSessao;

    // Helper pra desabilitar option de origem se já usada ou não definida
    const eventoDesc   = sys.origem?.eventoMarcante?.descricao || "";
    const ocupacaoDesc = sys.origem?.ocupacao?.descricao || "";
    const eventoDisabled   = eventoUsado   || !eventoDesc;
    const ocupacaoDisabled = ocupacaoUsada || !ocupacaoDesc;

    const content = `
      <div class="sinfonia-dialog-rolagem">
        <div class="linha">
          <label>ND (dificuldade)</label>
          <input type="number" name="nd" value="12" min="1" max="40" autofocus/>
        </div>
        <div class="linha">
          <label>Penalidade do Mestre</label>
          <input type="number" name="penalidade" value="0" min="0" max="20"/>
        </div>

        <fieldset class="alma-bloco">
          <legend>★ Determinação (${det} disponíveis)</legend>
          <label class="check ${det < 1 ? 'disabled' : ''}">
            <input type="checkbox" name="empenhoA" ${det < 1 ? 'disabled' : ''}/>
            <b>Empenho em ${atribAUpper}</b> — 1 Det: dado extra no atributo A, usa o maior
          </label>
          <label class="check ${det < 1 ? 'disabled' : ''}">
            <input type="checkbox" name="empenhoB" ${det < 1 ? 'disabled' : ''}/>
            <b>Empenho em ${atribBUpper}</b> — 1 Det: dado extra no atributo B, usa o maior
          </label>
          <label class="check ${det < 1 ? 'disabled' : ''}">
            <input type="checkbox" name="perseveranca" ${det < 1 ? 'disabled' : ''}/>
            <b>Perseverança</b> — 1 Det: ignora a penalidade acima
          </label>
          <p class="aviso">Falha após usar Determinação = +1 Corrupção (exceto se usar Origem).</p>
        </fieldset>

        <fieldset class="alma-bloco">
          <legend>⚭ Origem (−1 sessão cada)</legend>
          <label class="radio">
            <input type="radio" name="origem" value="" checked/>
            Nenhuma
          </label>
          <label class="radio ${eventoDisabled ? 'disabled' : ''}">
            <input type="radio" name="origem" value="eventoMarcante" ${eventoDisabled ? 'disabled' : ''}/>
            <b>Evento Marcante</b>${eventoDesc ? `: <em>${eventoDesc}</em>` : ' (não definido)'}
            ${eventoUsado ? ' <span class="used">(usado)</span>' : ''}
          </label>
          <label class="radio ${ocupacaoDisabled ? 'disabled' : ''}">
            <input type="radio" name="origem" value="ocupacao" ${ocupacaoDisabled ? 'disabled' : ''}/>
            <b>Ocupação</b>${ocupacaoDesc ? `: <em>${ocupacaoDesc}</em>` : ' (não definida)'}
            ${ocupacaoUsada ? ' <span class="used">(usada)</span>' : ''}
          </label>
          <p class="aviso">ND reduzida em 5. Falha NÃO causa corrupção.</p>
        </fieldset>

        <fieldset class="alma-bloco">
          <legend>☠ Corrupção (${cor}/10)</legend>
          <label class="radio"><input type="radio" name="corrupcao" value="" checked/> Nenhuma</label>
          <label class="radio ${cor >= 10 ? 'disabled' : ''}">
            <input type="radio" name="corrupcao" value="+5" ${cor >= 10 ? 'disabled' : ''}/>
            <b>+5 no teste</b> (gasta 1 Det → 1 Cor)
          </label>
          <label class="radio ${cor >= 10 ? 'disabled' : ''}">
            <input type="radio" name="corrupcao" value="rerolar" ${cor >= 10 ? 'disabled' : ''}/>
            <b>Rerolar</b> (rola de novo, fica com o maior total)
          </label>
          <label class="radio ${cor >= 10 ? 'disabled' : ''}">
            <input type="radio" name="corrupcao" value="passoDado" ${cor >= 10 ? 'disabled' : ''}/>
            <b>Passo de Dado</b> (sobe 1 passo em cada atributo desta rolagem)
          </label>
        </fieldset>
      </div>
    `;

    return new Promise(resolve => {
      foundry.applications.api.DialogV2.prompt({
        window: { title: "Rolagem de Perícia" },
        content,
        ok: {
          label: "Rolar",
          icon: "fa-dice",
          callback: (ev, btn) => {
            const f = btn.form.elements;
            const origemValor = f.origem.value;
            resolve({
              nd:           parseInt(f.nd.value)         || 12,
              penalidade:   parseInt(f.penalidade.value) || 0,
              empenhoA:     f.empenhoA.checked,
              empenhoB:     f.empenhoB.checked,
              perseveranca: f.perseveranca.checked,
              origem:       !!origemValor,
              origemTipo:   origemValor || null,
              corrupcao:    f.corrupcao.value || null
            });
          }
        },
        cancel: { label: "Cancelar", callback: () => resolve(null) }
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
    // Ajuste manual de Determinação (setas +/-). NÃO dispara Estilhaço automático
    // — esse é considerado ajuste do Mestre. Para corrupção que conta no cabo de
    // guerra, use o botão "Corromper Alma" (chama document.corromper()).
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

  static async _onAbrirArvore(event, target) {
    // Força salvamento de qualquer campo pendente antes de abrir a árvore,
    // senão uma digitação ainda no debounce de 150ms pode se perder
    // quando o foco for pra outra janela.
    if (this._salvarCampo && this.element) {
      const inputs = this.element.querySelectorAll("input, select, textarea");
      await Promise.all(Array.from(inputs).map(el => this._salvarCampo(el)));
    }
    new ArvoreHabilidades(this.document).render(true);
  }

  static async _onCorromper(event, target) {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Corromper a Alma" },
      content: `<p>Você irá corromper sua alma em <b>1 ponto</b>.</p>
               <p>Se a Determinação zerar, você recebe um <b>Estilhaço da Alma</b>.</p>
               <p>Continuar?</p>`
    });
    if (ok) await this.document.corromper();
  }

  static async _onDescansar(event, target) {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Descanso Longo" },
      content: `<p>Restaurar PV, PE e usos de Origem ao máximo?</p>
               <p><em>Estilhaços da Alma permanecem.</em></p>`
    });
    if (ok) await this.document.descansar();
  }

  static async _onResetEstilhacos(event, target) {
    if (!game.user.isGM) {
      ui.notifications.warn("Apenas o Mestre pode resetar Estilhaços da Alma.");
      return;
    }
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Resetar Estilhaços (GM)" },
      content: `<p><b>Ação de Mestre.</b> Zerar os Estilhaços da Alma deste personagem?</p>
               <p>Isso reabre o teto máximo da Determinação.</p>`
    });
    if (!ok) return;
    await this.document.update({
      "system.alma.estilhacos": 0,
      "system.alma.determinacao": 7
    }, { render: false });
    ui.notifications.info(`${this.document.name}: Estilhaços resetados.`);
  }

  /**
   * Abre um dialog com todas as perícias, agrupadas pelo grau de maestria.
   * Cada linha permite rolar diretamente.
   */
  static async _onVerTodasPericias(event, target) {
    const actor = this.document;
    const sys = actor.system;

    const linhas = Object.entries(SINFONIA.PERICIAS).map(([key, cfg]) => {
      const m = sys.pericias?.[key] || "";
      const cls = m ? `maestria-${m}` : "sem-maestria";
      const optSel = (v) => m === v ? "selected" : "";
      return `
        <tr class="pericia-row ${cls}" data-key="${key}" data-atriba="${cfg.atribA}" data-atribb="${cfg.atribB}">
          <td class="col-nome">${cfg.label}</td>
          <td class="col-atrib">${cfg.atribA.toUpperCase()} + ${cfg.atribB.toUpperCase()}</td>
          <td class="col-maestria">
            <select class="sel-maestria" data-key="${key}">
              <option value=""           ${optSel("")}>—</option>
              <option value="iniciante"  ${optSel("iniciante")}>Iniciante (+2)</option>
              <option value="treinado"   ${optSel("treinado")}>Treinado (+4)</option>
              <option value="experiente" ${optSel("experiente")}>Experiente (+6)</option>
            </select>
          </td>
          <td class="col-acao"><button type="button" class="btn-rolar-pericia">⚂</button></td>
        </tr>`;
    }).join("");

    const content = `
      <div class="sinfonia-todas-pericias">
        <table>
          <thead>
            <tr><th>Perícia</th><th>Atributos</th><th>Maestria</th><th></th></tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>
    `;

    const dlg = new foundry.applications.api.DialogV2({
      window: { title: "Todas as Perícias", resizable: true },
      content,
      buttons: [{ action: "fechar", label: "Fechar", default: true }],
      position: { width: 520 }
    });
    await dlg.render(true);

    // Listener: botões de rolar
    dlg.element.querySelectorAll(".btn-rolar-pericia").forEach(btn => {
      btn.addEventListener("click", async () => {
        const tr = btn.closest(".pericia-row");
        const { key, atriba, atribb } = tr.dataset;
        const opcoes = await SinfoniaActorSheet._dialogND(actor, atriba, atribb);
        if (!opcoes) return;
        await actor.rolarPericia(key, atriba, atribb, opcoes.nd, opcoes);
      });
    });

    // Listener: select de maestria
    dlg.element.querySelectorAll(".sel-maestria").forEach(sel => {
      sel.addEventListener("change", async (ev) => {
        const t = ev.currentTarget;
        const key = t.dataset.key;
        const valor = t.value;
        await actor.update({ [`system.pericias.${key}`]: valor }, { render: false });

        // Atualiza a classe da linha para refletir a nova cor visual
        const tr = t.closest(".pericia-row");
        tr.classList.remove("sem-maestria", "maestria-iniciante", "maestria-treinado", "maestria-experiente");
        tr.classList.add(valor ? `maestria-${valor}` : "sem-maestria");
      });
    });
  }

  /* ============================================================
     COMBATE — Atacar com arma / Rolar dano
  ============================================================ */

  /**
   * Click no ícone de espada de uma arma na lista. Abre um dialog
   * específico de ataque (com modificadores de Alma + alvo).
   */
  static async _onAtacarArma(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const arma = this.document.items.get(itemId);
    if (!arma) return;

    const opcoes = await SinfoniaActorSheet._dialogAtaque(this.document, arma);
    if (!opcoes) return;
    await this.document.rolarAtaque(arma, opcoes);
  }

  /**
   * Click direto no botão de dano da ficha (sem passar por ataque).
   * Pergunta apenas se é crítico.
   */
  static async _onRolarDanoArma(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const arma = this.document.items.get(itemId);
    if (!arma) return;

    const critico = await foundry.applications.api.DialogV2.confirm({
      window: { title: `Dano — ${arma.name}` },
      content: `<p>Esta rolagem é um <b>crítico</b> (dados dobrados)?</p>`,
      yes: { label: "Sim, crítico" },
      no:  { label: "Não, dano normal", default: true }
    });

    await this.document.rolarDano(arma, { critico: !!critico });
  }

  /**
   * Alterna o flag `favorito` no item, atualizando a UI da estrela e
   * a lista de Favoritos da aba Principal.
   */
  static async _onToggleFavorito(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const item = this.document.items.get(itemId);
    if (!item) return;
    const atual = item.system?.favorito === true;
    await item.update({ "system.favorito": !atual });
    this.render(false);
  }

  /**
   * Dialog rico de ataque com arma. Reaproveita os mesmos modificadores
   * de Alma do dialog de perícia, mas lê o ND do alvo selecionado
   * automaticamente (Defesa do token alvo) ou pede ND manual.
   */
  static async _dialogAtaque(actor, arma) {
    const sys = actor.system;
    const det = sys.alma.determinacao;
    const cor = sys.alma.corrupcao;
    const eventoUsado   = sys.origem?.eventoMarcante?.usadoNaSessao;
    const ocupacaoUsada = sys.origem?.ocupacao?.usadoNaSessao;
    const eventoDesc    = sys.origem?.eventoMarcante?.descricao || "";
    const ocupacaoDesc  = sys.origem?.ocupacao?.descricao || "";
    const eventoDisabled   = eventoUsado   || !eventoDesc;
    const ocupacaoDisabled = ocupacaoUsada || !ocupacaoDesc;

    const categoria = arma.system.categoria;
    // Mapeamento embutido pra evitar import dinamico
    const periciaMap = {
      leve: "armasBrancas", espada: "armasBrancas", haste: "armasBrancas", pesada: "armasBrancas",
      precisao: "armasDeFogo", fogo: "armasDeFogo"
    };
    const pericia = periciaMap[categoria] ?? "armasBrancas";
    const cfg     = SINFONIA.PERICIAS[pericia];

    // Tenta pegar o alvo via game.user.targets (token targeted com 'T')
    const alvos = Array.from(game.user.targets ?? []);
    const alvo = alvos[0] ?? null;
    const nomeAlvo = alvo?.actor?.name ?? null;
    const defesaAlvo = alvo?.actor?.system?.combate?.defesa ?? null;

    const alvoInfo = alvo
      ? `<div class="alvo-info"><b>Alvo:</b> ${nomeAlvo} — Defesa ${defesaAlvo}</div>`
      : `<div class="alvo-info sem-alvo">Nenhum alvo selecionado. ND manual abaixo.</div>`;

    const ndDefault = defesaAlvo ?? 10;
    const bonusArma = Number(arma.system.bonus) || 0;

    const content = `
      <div class="sinfonia-dialog-rolagem">
        <div class="arma-info">
          <b>${arma.name}</b> (${SINFONIA.CATEGORIAS_ARMA[categoria] ?? categoria}) —
          perícia <b>${cfg?.label ?? pericia}</b>${bonusArma ? ` — bônus +${bonusArma}` : ""}
        </div>
        ${alvoInfo}

        <div class="linha">
          <label>${alvo ? "ND (Defesa)" : "ND manual"}</label>
          <input type="number" name="nd" value="${ndDefault}" min="1" max="40" autofocus/>
        </div>
        <div class="linha">
          <label>Penalidade do Mestre</label>
          <input type="number" name="penalidade" value="0" min="0" max="20"/>
        </div>

        <fieldset class="alma-bloco">
          <legend>★ Determinação (${det} disponíveis)</legend>
          <label class="check ${det < 1 ? 'disabled' : ''}">
            <input type="checkbox" name="empenhoA" ${det < 1 ? 'disabled' : ''}/>
            <b>Empenho ${cfg.atribA.toUpperCase()}</b> — 1 Det: dado extra em ${cfg.atribA.toUpperCase()}
          </label>
          <label class="check ${det < 1 ? 'disabled' : ''}">
            <input type="checkbox" name="empenhoB" ${det < 1 ? 'disabled' : ''}/>
            <b>Empenho ${cfg.atribB.toUpperCase()}</b> — 1 Det: dado extra em ${cfg.atribB.toUpperCase()}
          </label>
          <label class="check ${det < 1 ? 'disabled' : ''}">
            <input type="checkbox" name="perseveranca" ${det < 1 ? 'disabled' : ''}/>
            <b>Perseverança</b> — 1 Det: ignora a penalidade
          </label>
        </fieldset>

        <fieldset class="alma-bloco">
          <legend>⚭ Origem</legend>
          <label class="radio">
            <input type="radio" name="origem" value="" checked/> Nenhuma
          </label>
          <label class="radio ${eventoDisabled ? 'disabled' : ''}">
            <input type="radio" name="origem" value="eventoMarcante" ${eventoDisabled ? 'disabled' : ''}/>
            <b>Evento</b>${eventoDesc ? `: <em>${eventoDesc}</em>` : ' (não definido)'}
            ${eventoUsado ? ' <span class="used">(usado)</span>' : ''}
          </label>
          <label class="radio ${ocupacaoDisabled ? 'disabled' : ''}">
            <input type="radio" name="origem" value="ocupacao" ${ocupacaoDisabled ? 'disabled' : ''}/>
            <b>Ocupação</b>${ocupacaoDesc ? `: <em>${ocupacaoDesc}</em>` : ' (não definida)'}
            ${ocupacaoUsada ? ' <span class="used">(usada)</span>' : ''}
          </label>
        </fieldset>

        <fieldset class="alma-bloco">
          <legend>☠ Corrupção (${cor}/10)</legend>
          <label class="radio"><input type="radio" name="corrupcao" value="" checked/> Nenhuma</label>
          <label class="radio ${cor >= 10 ? 'disabled' : ''}">
            <input type="radio" name="corrupcao" value="+5" ${cor >= 10 ? 'disabled' : ''}/>
            <b>+5 no teste</b>
          </label>
          <label class="radio ${cor >= 10 ? 'disabled' : ''}">
            <input type="radio" name="corrupcao" value="rerolar" ${cor >= 10 ? 'disabled' : ''}/>
            <b>Rerolar</b>
          </label>
          <label class="radio ${cor >= 10 ? 'disabled' : ''}">
            <input type="radio" name="corrupcao" value="passoDado" ${cor >= 10 ? 'disabled' : ''}/>
            <b>Passo de Dado</b>
          </label>
        </fieldset>
      </div>
    `;

    return new Promise(resolve => {
      foundry.applications.api.DialogV2.prompt({
        window: { title: `Atacar com ${arma.name}` },
        content,
        ok: {
          label: "Atacar",
          icon: "fa-crosshairs",
          callback: (ev, btn) => {
            const f = btn.form.elements;
            const origemValor = f.origem.value;
            resolve({
              nd:           parseInt(f.nd.value) || ndDefault,
              penalidade:   parseInt(f.penalidade.value) || 0,
              empenhoA:     f.empenhoA.checked,
              empenhoB:     f.empenhoB.checked,
              perseveranca: f.perseveranca.checked,
              origem:       !!origemValor,
              origemTipo:   origemValor || null,
              corrupcao:    f.corrupcao.value || null,
              alvo:         alvo ? { name: nomeAlvo, defesa: defesaAlvo } : null
            });
          }
        },
        cancel: { label: "Cancelar", callback: () => resolve(null) }
      });
    });
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
