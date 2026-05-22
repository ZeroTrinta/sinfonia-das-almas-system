/**
 * Sinfonia das Almas — Actor Sheet v2
 * DocumentSheetV2 — sem re-render no update, sem flickering
 */

const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SinfoniaActorSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["sinfonia-das-almas", "sheet", "actor"],
    position: { width: 800, height: 900 },
    window: { resizable: true },
    // ✦ ABORDAGEM B (ATIVA): submitOnChange desligado. Cada campo é salvo
    //    manualmente via listener no _onRender com {render:false}.
    //    Para usar a ABORDAGEM A: troque por { submitOnChange: true, closeOnSubmit: false }
    //    e descomente o bloco _canRender/_processSubmitData mais abaixo.
    form: { submitOnChange: false, closeOnSubmit: false },
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
      verTodasPericias: SinfoniaActorSheet._onVerTodasPericias
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

    return {
      actor:           doc,
      system:          sys,
      isOwner:         doc.isOwner,
      isEditable:      this.isEditable,
      atributosConfig: SINFONIA.ATRIBUTOS,
      periciasConfig:  SINFONIA.PERICIAS,
      periciasComMaestria,
      habilidades:     doc.items.filter(i => i.type === "habilidade"),
      magias:          doc.items.filter(i => i.type === "magia").sort((a,b) => a.system.circulo - b.system.circulo),
      armas:           doc.items.filter(i => i.type === "arma"),
      armaduras:       doc.items.filter(i => i.type === "armadura"),
      inventario:      doc.items.filter(i => i.type === "inventario"),
      detPct:          (sys.alma?.determinacao ?? 7) * 10,
      corPct:          (sys.alma?.corrupcao    ?? 3) * 10,
    };
  }

  // ── Render ─────────────────────────────────────────────────
  _onRender(context, options) {
    super._onRender?.(context, options);

    // Tabs manuais
    const activateTab = (name) => {
      this.element.querySelectorAll(".sheet-tabs .item")
        .forEach(t => t.classList.toggle("active", t.dataset.tab === name));
      this.element.querySelectorAll(".sheet-body .tab")
        .forEach(c => c.classList.toggle("active", c.dataset.tab === name));
      this._activeTab = name;
    };
    this.element.querySelectorAll(".sheet-tabs .item").forEach(tab => {
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
      const tag = m ? `<span class="tag-m ${cls}">${m}</span>` : `<span class="tag-m sem-maestria">—</span>`;
      return `
        <tr class="pericia-row ${cls}" data-key="${key}" data-atriba="${cfg.atribA}" data-atribb="${cfg.atribB}">
          <td class="col-nome">${cfg.label}</td>
          <td class="col-atrib">${cfg.atribA.toUpperCase()} + ${cfg.atribB.toUpperCase()}</td>
          <td class="col-maestria">${tag}</td>
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

    // Anexa os listeners de rolar diretamente no DOM do dialog recém-renderizado.
    dlg.element.querySelectorAll(".btn-rolar-pericia").forEach(btn => {
      btn.addEventListener("click", async () => {
        const tr = btn.closest(".pericia-row");
        const { key, atriba, atribb } = tr.dataset;
        const opcoes = await SinfoniaActorSheet._dialogND(actor, atriba, atribb);
        if (!opcoes) return;
        await actor.rolarPericia(key, atriba, atribb, opcoes.nd, opcoes);
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
