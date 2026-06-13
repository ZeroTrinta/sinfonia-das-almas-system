/**
 * Sinfonia das Almas — Actor Sheet v2
 * DocumentSheetV2 — sem re-render no update, sem flickering
 */

const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Gera uma versão RECORTADA EM CÍRCULO de uma imagem (webp transparente)
 * e salva em worlds/<id>/tokens-circulares/. Retorna o path ou null se falhar.
 * O Foundry não recorta imagens opacas no Dynamic Ring — a arte retangular
 * cobre o anel. Com o recorte, a arte fica DENTRO do anel e o anel POR CIMA.
 */
async function gerarTokenCircular(srcPath, actorId) {
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("load fail: " + srcPath));
      i.src = srcPath;
    });
    const SIZE = 512;
    const c = document.createElement("canvas");
    c.width = c.height = SIZE;
    const ctx = c.getContext("2d");
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    const ratio = Math.max(SIZE / img.width, SIZE / img.height);
    ctx.drawImage(img, (SIZE - img.width * ratio) / 2, (SIZE - img.height * ratio) / 2, img.width * ratio, img.height * ratio);
    const blob = await new Promise(res => c.toBlob(res, "image/webp", 0.92));
    if (!blob) return null;
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
    if (!FP?.upload) return null;
    const dir = `worlds/${game.world.id}/tokens-circulares`;
    try { await FP.createDirectory("data", dir); } catch (e) {}
    const file = new File([blob], `token-${actorId}.webp`, { type: "image/webp" });
    const up = await FP.upload("data", dir, file, {}, { notify: false });
    return up?.path ?? null;
  } catch (err) {
    console.warn("Sinfonia | recorte circular falhou, usando original:", err);
    return null;
  }
}

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
      alternarEquipado: SinfoniaActorSheet._onAlternarEquipado,
      toggleFavorito:  SinfoniaActorSheet._onToggleFavorito,
      rolarTesteCrepusculo: SinfoniaActorSheet._onRolarTesteCrepusculo,
      colocarToken:    SinfoniaActorSheet._onColocarToken,
      reviverPersonagem: SinfoniaActorSheet._onReviverPersonagem
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

    // Lista plana de TODAS as perícias para o grid (3 colunas).
    // Inclui a maestria atual já resolvida (evita lookup aninhado no Handlebars,
    // que estava quebrando o template).
    const periciasTodas = Object.entries(SINFONIA.PERICIAS).map(([key, cfg]) => {
      const maestria = sys.pericias?.[key] || "";
      return {
        key,
        label: cfg.label,
        atribA: cfg.atribA,
        atribB: cfg.atribB,
        maestria,
        // Pra simplificar template: flags booleanas pra cada nível
        isNone:       maestria === "",
        isIniciante:  maestria === "iniciante",
        isTreinado:   maestria === "treinado",
        isExperiente: maestria === "experiente"
      };
    });

    // Lista plana de atributos para os cards do topo (mesmo motivo: evita lookup).
    const atributosTodos = Object.entries(SINFONIA.ATRIBUTOS).map(([key, cfg]) => {
      const dado = sys.atributos?.[key] || "d6";
      return {
        key,
        label: cfg.label,
        abbr: cfg.abbr,
        dado,
        isD6:  dado === "d6",
        isD8:  dado === "d8",
        isD10: dado === "d10",
        isD12: dado === "d12"
      };
    });

    // ── Aba Habilidades: lista as habilidades investidas (v0.7.0 reformulado) ──
    const arvoreNH = doc.getFlag("sinfonia-das-almas", "arvoreNH") ?? {};
    const classe = sys.progressao?.classe ?? "";
    const habsDef = (globalThis.SINFONIA?.HABILIDADES_CLASSE?.[classe]) ?? [];
    const classeMeta = globalThis.SINFONIA?.CLS_META?.[classe];

    // Lista só habilidades com NH > 0, com efeito atual já resolvido
    const investidas = habsDef
      .filter(h => (arvoreNH[h.id] ?? 0) > 0)
      .map(h => {
        const nh = Math.max(0, Math.min(arvoreNH[h.id] ?? 0, h.maxNH));
        let efeitoAtual = "";
        if (typeof h.efeito === "function") {
          try { efeitoAtual = h.efeito(nh); } catch {}
        }
        return {
          id: h.id,
          label: h.label,
          nh,
          maxNH: h.maxNH,
          desc: h.desc || "",
          efeitoAtual,
          passiva: !!h.passiva
        };
      });

    // ── Resistências elementais (mesma RES_META do NPC) ──
    const RES_META = {
      fisico: { label: "Físico", icon: "⚔", cor: "#c0c0c0" },
      fogo:   { label: "Fogo",   icon: "🔥", cor: "#ff6b35" },
      gelo:   { label: "Gelo",   icon: "❄", cor: "#5bc8ff" },
      trovao: { label: "Trovão", icon: "⚡", cor: "#ffd23f" },
      acido:  { label: "Ácido",  icon: "⚗", cor: "#7fff5b" },
      luz:    { label: "Luz",    icon: "✦", cor: "#fff4c0" },
      sombra: { label: "Sombra", icon: "●", cor: "#9060e8" }
    };
    const resistList = Object.entries(RES_META).map(([key, meta]) => ({
      key, ...meta, valor: sys.resistencias?.[key] ?? ""
    }));

    const ptsTotal = sys.progressao?.nivel ?? 5;
    const ptsUsados = Object.values(arvoreNH).reduce((acc, v) => acc + (Number(v) || 0), 0);
    const habArvore = {
      ptsTotal,
      ptsUsados,
      ptsLivres: Math.max(0, ptsTotal - ptsUsados),
      semClasse: !classe,
      classe,
      classeLabel: globalThis.SINFONIA?.CLASSES?.[classe] ?? "",
      classeColor: classeMeta?.color ?? "#c8972a",
      investidas
    };

    return {
      actor:           doc,
      system:          sys,
      isOwner:         doc.isOwner,
      isEditable:      this.isEditable,
      atributosConfig: SINFONIA.ATRIBUTOS,
      atributosTodos,
      periciasConfig:  SINFONIA.PERICIAS,
      periciasComMaestria,
      periciasTodas,
      habArvore,
      resistList,
      habilidades:     doc.items.filter(i => i.type === "habilidade"),
      magias:          doc.items.filter(i => i.type === "magia").sort((a,b) => a.system.circulo - b.system.circulo),
      magiasArcanas:   doc.items.filter(i => i.type === "magia" && i.system.tipo === "arcana").sort((a,b) => a.system.circulo - b.system.circulo),
      magiasSagradas:  doc.items.filter(i => i.type === "magia" && i.system.tipo === "sagrada").sort((a,b) => a.system.circulo - b.system.circulo),
      armas:           doc.items.filter(i => i.type === "arma"),
      armaduras:       doc.items.filter(i => i.type === "armadura"),
      conduites:       doc.items.filter(i => i.type === "conduite"),
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

    // ✶ CRITICAL: aborta TODOS os listeners do render anterior antes de
    // adicionar novos. Sem isso, cada re-render duplica handlers e
    // operações (ex: drop cria N cópias do item).
    // O AbortSignal é passado pra TODOS os addEventListener abaixo.
    if (this._listenerAbort) this._listenerAbort.abort();
    this._listenerAbort = new AbortController();
    const sig = this._listenerAbort.signal;

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
      tab.addEventListener("click", () => activateTab(tab.dataset.tab), { signal: sig });
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
        await this.document.update({ [name]: value }, { render: false, sinfoniaFromSheet: true });
        // Atualiza stats derivados (INIT/DEF/ND M.) manualmente sempre que algo do combate ou atributos muda.
        if (name.startsWith("system.atributos.") || name.startsWith("system.combate.") || name.startsWith("system.progressao.")) {
          this._atualizarStatsDerivados();
        }
        // Trocar de CLASSE muda o tema visual inteiro (cores da ficha)
        // E sincroniza a cor do anel do token (prototype + tokens nas cenas).
        if (name === "system.progressao.classe") {
          this.render(false);
          const corAnel = this.document.corClasse;
          // Prototype (tokens futuros)
          await this.document.update(
            { "prototypeToken.ring.colors.ring": corAnel },
            { render: false, sinfoniaFromSheet: true }
          );
          // Tokens já colocados nas cenas (só os que têm anel ativo)
          for (const scene of game.scenes) {
            const tokensDeste = scene.tokens.filter(t =>
              t.actorId === this.document.id && t.ring?.enabled
            );
            for (const token of tokensDeste) {
              await token.update({ "ring.colors.ring": corAnel });
            }
          }
        }
      } catch (err) {
        console.error("Sinfonia | Falha ao salvar campo", name, err);
        ui.notifications.error(`Não foi possível salvar ${name}.`);
      }
    };

    // Persiste em DOIS gatilhos para cobrir todos os casos:
    //   • change — dispara quando o input perde o foco (clique fora). Para SELECTs,
    //     dispara imediatamente quando a escolha muda — então salvamos SEM debounce.
    //   • input — dispara a cada tecla em inputs de texto; usamos debounce 150ms
    //     pra não spammar o servidor.
    const debouncers = new WeakMap();
    this.element.querySelectorAll("input, select, textarea").forEach(el => {
      // change: salva IMEDIATAMENTE (sem debounce). Crítico para selects (classe,
      // dado de atributo, maestria) — se debouncasse, fechar a ficha antes dos
      // 150ms perderia a mudança.
      el.addEventListener("change", async (ev) => {
        const t = ev.currentTarget;
        // Cancela qualquer debounce pendente do input
        clearTimeout(debouncers.get(t));
        await salvarCampo(t);
      }, { signal: sig });
      // input: só pra inputs/textareas (com debounce). Selects já são cobertos pelo change.
      if (el.tagName !== "SELECT") {
        el.addEventListener("input",  (ev) => {
          const t = ev.currentTarget;
          clearTimeout(debouncers.get(t));
          debouncers.set(t, setTimeout(() => salvarCampo(t), 150));
        }, { signal: sig });
      }
    });

    // ── Imagens editáveis: retrato da ficha + imagem do token ──
    // DocumentSheetV2 não conecta isso automaticamente, então fazemos manual.
    // Dois alvos distintos:
    //   • [data-edit="img"]       → muda actor.img (retrato grande, lado esquerdo)
    //   • [data-edit="token-img"] → muda prototypeToken.texture.src + sincroniza
    //                                tokens já colocados nas cenas (banner pequeno, círculo)
    // Fallback robusto: tenta o caminho v13 (foundry.applications.apps.FilePicker.implementation)
    // e, se não existir, usa o FilePicker global (v12).
    const FilePickerClass =
      foundry.applications?.apps?.FilePicker?.implementation ??
      globalThis.FilePicker;

    // Helper compartilhado: abre o FilePicker e roda o callback
    const abrirFilePicker = (currentPath, callback) => {
      if (!FilePickerClass) {
        ui.notifications.error("FilePicker indisponível nesta versão do Foundry.");
        return;
      }
      const fp = new FilePickerClass({
        type: "image",
        current: currentPath,
        callback,
        top:  (this.position?.top  ?? 100) + 40,
        left: (this.position?.left ?? 100) + 10
      });
      fp.browse();
    };

    // Retrato da ficha (rail esquerda + qualquer outro [data-edit="img"])
    this.element.querySelectorAll('[data-edit="img"]').forEach(el => {
      el.style.cursor = "pointer";
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        abrirFilePicker(this.document.img, async (path) => {
          await this.document.update({ img: path });
        });
      }, { signal: sig });
    });

    // Imagem do TOKEN (círculo do banner superior)
    this.element.querySelectorAll('[data-edit="token-img"]').forEach(el => {
      el.style.cursor = "pointer";
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const current = this.document.prototypeToken?.texture?.src ?? this.document.img;
        abrirFilePicker(current, async (path) => {
          // Cor do anel = cor da CLASSE do personagem (dourado se sem classe)
          const corAnel = this.document.corClasse;
          // Gera versão recortada em círculo da imagem escolhida
          const circ = await gerarTokenCircular(path, this.document.id);
          const tex = circ ?? path;
          // 1) Atualiza o prototypeToken inteiro de uma vez:
          //    • texture.src — imagem principal exibida (afeta tokens FUTUROS)
          //    • ring.enabled + ring.subject.texture — anel dinâmico em v12.
          //      O `subject.texture` deve apontar pra MESMA imagem, senão o anel
          //      fica desenhado mas o conteúdo fica invisível.
          //    • ring.colors.ring — cor temática da classe
          //    • ring.effects — valor 1 = anel básico (visualizado)
          //    • actorLink — token sincronizado com a ficha (recomendado pra PCs)
          await this.document.update({
            "prototypeToken.texture.src":              tex,
            "prototypeToken.ring.enabled":             true,
            "prototypeToken.ring.subject.texture":     tex,
            "prototypeToken.ring.colors.ring":         corAnel,
            "prototypeToken.ring.colors.background":   "#1a1a1a",
            "prototypeToken.ring.effects":             1,
            "prototypeToken.actorLink":                true
          });

          // 2) Sincroniza tokens JÁ colocados em TODAS as cenas
          //    Para o anel funcionar nos tokens existentes, precisa atualizar
          //    cada um deles individualmente — mudanças no prototype NÃO propagam
          //    pra tokens já instanciados.
          let count = 0;
          for (const scene of game.scenes) {
            const tokensDeste = scene.tokens.filter(t => t.actorId === this.document.id);
            for (const token of tokensDeste) {
              await token.update({
                "texture.src":              tex,
                "ring.enabled":             true,
                "ring.subject.texture":     tex,
                "ring.colors.ring":         corAnel,
                "ring.colors.background":   "#1a1a1a",
                "ring.effects":             1
              });
              count++;
            }
          }
          if (count > 0) {
            ui.notifications.info(`Imagem do token + anel da classe atualizados em ${count} token(s) das cenas.`);
          } else {
            ui.notifications.info(`Imagem do token + anel da classe salvos no prototype.`);
          }
        });
      }, { signal: sig });
    });

    // Guarda referência ao helper para reaproveitá-lo em _preClose.
    this._salvarCampo = salvarCampo;

    // ── Drag & Drop: conecta os listeners no DOM ──
    // ApplicationV2 não liga sozinho como ApplicationV1, precisa configurar aqui.
    // ✶ signal: sig é CRÍTICO aqui — sem o abort, cada re-render adiciona
    // outro listener de drop, fazendo o item ser criado múltiplas vezes.
    this.element.addEventListener("dragover", (ev) => this._onDragOver(ev), { signal: sig });
    this.element.addEventListener("drop",     (ev) => this._onDrop(ev),     { signal: sig });

    // Drag de items pra fora da sheet (pra arrastar pra outra sheet ou hotbar)
    this.element.querySelectorAll("[data-item-id]").forEach(el => {
      el.setAttribute("draggable", "true");
      el.addEventListener("dragstart", (ev) => this._onDragStart(ev), { signal: sig });
    });
  }

  // Aborta listeners pendentes ao fechar a ficha (limpeza de memória)
  async _onClose(options) {
    if (this._listenerAbort) this._listenerAbort.abort();
    return super._onClose?.(options);
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
   *
   * Tem um lock simples (_dropInFlight) pra evitar processamento duplicado
   * em cenários onde dois eventos de drop chegam quase simultaneamente.
   */
  async _onDrop(event) {
    event.preventDefault();
    if (this._dropInFlight) return false;
    this._dropInFlight = true;

    try {
      let data;
      try {
        data = JSON.parse(event.dataTransfer.getData("text/plain"));
      } catch (err) {
        return false;
      }

      // Dispara hook do Foundry, caso algum módulo queira interceptar
      const allowed = Hooks.call("dropActorSheetData", this.document, this, data);
      if (allowed === false) return false;

      if (data.type === "Item") return await this._onDropItem(event, data);
      if (data.type === "ActiveEffect") return await this._onDropActiveEffect(event, data);
      if (data.type === "Folder") return await this._onDropFolder(event, data);

      return false;
    } finally {
      // Libera o lock no próximo tick, garantindo que listeners duplicados
      // (caso tenham vazado) não vejam o flag baixo ainda.
      setTimeout(() => { this._dropInFlight = false; }, 50);
    }
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
    // — esse é considerado ajuste do Mestre.
    const det  = this.document.system.alma.determinacao;
    const novo = Math.clamp(det + (parseInt(target.dataset.delta)||0), 0, 10);
    await this.document.update({ "system.alma.determinacao": novo }, { render: false });
    // Atualiza as barras na hora com transição CSS suave
    this._atualizarBarrasAlma();
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
    if (!ok) return;
    await this.document.corromper();

    // ✨ Animação manual das barras (sem re-render da sheet inteira).
    // O método corromper() usa {render:false}, então atualizamos o DOM
    // diretamente — isso dispara as transições CSS das barras.
    this._atualizarBarrasAlma();
  }

  /**
   * Atualiza as barras de Determinação/Corrupção e os contadores numéricos
   * no DOM após mudança no eixo da alma, sem re-render completo da sheet.
   * Dispara a transição CSS `width 0.4s ease` ao trocar `style.width`.
   */
  _atualizarBarrasAlma() {
    const el = this.element;
    if (!el) return;
    const det = this.document.system.alma.determinacao;
    const cor = 10 - det;
    const detBar = el.querySelector(".det-fill");
    const corBar = el.querySelector(".cor-fill");
    const detVal = el.querySelector(".det-lado .alma-valor");
    const corVal = el.querySelector(".cor-lado .alma-valor");
    const detNum = el.querySelector("input[name='system.alma.determinacao']");
    if (detBar) detBar.style.width = (det * 10) + "%";
    if (corBar) corBar.style.width = (cor * 10) + "%";
    if (detVal) detVal.textContent = det;
    if (corVal) corVal.textContent = cor;
    if (detNum) detNum.value = det;
  }

  /**
   * Atualiza os 3 stats derivados na rail (INIT, DEF, ND M.) após mudança
   * de atributo — sem re-render completo. O document.system já foi atualizado
   * pelo prepareDerivedData internamente do Foundry, então só lemos os valores.
   *
   * INIT = floor(dado AGI / 2)
   * DEF  = dado AGI
   * ND M.= 8 + dado MIS
   */
  _atualizarStatsDerivados() {
    const el = this.element;
    if (!el) return;
    const c = this.document.system.combate;
    const stats = el.querySelectorAll(".rail-stat.derived .rail-stat-value");
    // Ordem: INIT, DEF, ND M. (mesma do template)
    if (stats[0]) stats[0].textContent = c.iniciativa;
    if (stats[1]) stats[1].textContent = c.defesa;
    if (stats[2]) stats[2].textContent = c.ndMistica;

    // Atualiza também a fração de Pts Hab. no banner (livres/total = Nível)
    const arvoreNH = this.document.getFlag("sinfonia-das-almas", "arvoreNH") ?? {};
    const ptsTotal = this.document.system.progressao?.nivel ?? 5;
    const ptsUsados = Object.values(arvoreNH).reduce((acc, v) => acc + (Number(v) || 0), 0);
    const ptsLivres = Math.max(0, ptsTotal - ptsUsados);
    const livresEl = el.querySelector(".banner-pts-fracao .pts-livres");
    const totalEl  = el.querySelector(".banner-pts-fracao .pts-total");
    if (livresEl) livresEl.textContent = ptsLivres;
    if (totalEl)  totalEl.textContent  = ptsTotal;
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
   * Alterna o estado equipado/desequipado de uma arma, armadura ou conduíte.
   * Reflete imediatamente nas estatísticas derivadas (DEF, INIT, ND Mística).
   *
   * Regras de conflito:
   *   • Armaduras de corpo: desequipa outras armaduras não-escudo antes
   *   • Conduítes: desequipa outros conduítes do mesmo tipo (arcano/sagrado)
   */
  static async _onAlternarEquipado(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const item = this.document.items.get(itemId);
    if (!item) return;

    // Define o campo correto e qual conflitar com
    const tipo = item.type;
    const campo = tipo === "armadura" ? "equipada" : "equipado";
    const atual = item.system?.[campo] === true;
    const novo  = !atual;

    // Se está equipando, desequipa conflitantes primeiro
    if (novo) {
      let conflitantes = [];
      if (tipo === "armadura") {
        // Só desequipa outras armaduras de corpo (escudos podem coexistir)
        if (item.system.categoria !== "escudo") {
          conflitantes = this.document.items.filter(i =>
            i.type === "armadura"
            && i.id !== item.id
            && i.system.categoria !== "escudo"
            && i.system.equipada === true
          );
        }
      } else if (tipo === "conduite") {
        // Só 1 conduíte por tipo (arcano XOR sagrado)
        conflitantes = this.document.items.filter(i =>
          i.type === "conduite"
          && i.id !== item.id
          && i.system.tipo === item.system.tipo
          && i.system.equipado === true
        );
      }
      // Armas não têm limite (pode equipar várias — estoque/cinturão)

      for (const c of conflitantes) {
        const campoC = c.type === "armadura" ? "equipada" : "equipado";
        await c.update({ [`system.${campoC}`]: false }, { render: false });
      }
    }

    // Aplica o toggle no item alvo (com render pra atualizar a ficha)
    await item.update({ [`system.${campo}`]: novo });
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
   * Rola o teste de Vontade do Crepúsculo da Morte com a ND escalada do doc:
   *   1ª: 10 · 2ª-3ª: 16 · 4ª: 20 · 5ª: 25 · 6ª+: 30
   * Falha = morte (estilhaço + zera Det). Sucesso = sai do Crepúsculo.
   * O contador `system.alma.testesVontade` registra quantas vezes já rolou
   * nesta queda — a ND escala com base nele.
   */
  static async _onRolarTesteCrepusculo(event, target) {
    event.preventDefault();
    const actor = this.document;
    if (!actor.system.alma?.crepusculo) {
      ui.notifications.warn("O personagem não está no Crepúsculo da Morte.");
      return;
    }

    // ND escalada conforme o doc oficial
    const NDS = [10, 16, 16, 20, 25, 30];
    const tentativa = actor.system.alma.testesVontade ?? 0;
    const nd = NDS[Math.min(tentativa, NDS.length - 1)];

    // Confirmação antes de rolar
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Teste de Vontade — Crepúsculo da Morte" },
      content: `
        <p><b>${actor.name}</b> agarra-se à vida pela <b>${tentativa + 1}ª vez</b>.</p>
        <p>Teste de Força de Vontade contra <b>ND ${nd}</b>.</p>
        <p><em>Em caso de falha, a alma se rompe e o personagem morre.</em></p>
        <p><em>Em caso de sucesso, o personagem sai do Crepúsculo.</em></p>`
    });
    if (!ok) return;

    // Incrementa contador de tentativas (ND aumenta na próxima)
    await actor.update({ "system.alma.testesVontade": tentativa + 1 }, { render: false });

    // Rola usando o dialog enxuto de perícia (Força de Vontade: POD+CAR)
    const cfg = SINFONIA.PERICIAS.forcaDeVontade;
    const opcoes = await SinfoniaActorSheet._dialogND(actor, cfg.atribA, cfg.atribB);
    if (!opcoes) {
      // Reverte contador se cancelou (não deveria rolar)
      await actor.update({ "system.alma.testesVontade": tentativa }, { render: false });
      return;
    }

    const resultado = await actor.rolarPericia("forcaDeVontade", cfg.atribA, cfg.atribB, nd, opcoes);

    if (!resultado) return;

    if (resultado.sucesso) {
      // Sucesso: sai do Crepúsculo
      await actor.update({
        "system.alma.crepusculo":    false,
        "system.alma.testesVontade": 0
      });
      await ChatMessage.implementation.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="crep-aviso saiu"><b>✨ ${actor.name} resiste e retorna do Crepúsculo da Morte.</b></div>`
      });
    } else {
      // Falha: morte definitiva — mensagem dramática
      await ChatMessage.implementation.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `
          <div class="crep-aviso morte">
            <h2>☠ ${actor.name} morreu ☠</h2>
            <p>A alma se rompeu no Crepúsculo. O cabo de guerra foi perdido.</p>
            <p><em>O corpo cessa. O que restava da vontade, dissipa-se em silêncio.</em></p>
          </div>`
      });
      // Zera Det e marca como morto. Mantém crep=true pra continuar mostrando estado.
      await actor.update({
        "system.alma.determinacao": 0,
        "system.alma.morto":       true
      });
    }
  }

  /**
   * Coloca o token deste personagem na cena ativa, no centro da view atual
   * (snapped ao grid). Se já existir um token deste ator na cena, apenas
   * seleciona e centraliza a câmera nele — evita duplicatas acidentais.
   * Usa o prototypeToken (imagem, anel dourado, actorLink) automaticamente.
   */
  static async _onColocarToken(event, target) {
    event.preventDefault();
    const actor = this.document;

    const scene = canvas?.scene;
    if (!scene || !canvas?.ready) {
      ui.notifications.warn("Nenhuma cena ativa. Abra uma cena primeiro.");
      return;
    }

    // Permissão: precisa poder criar tokens na cena (GM ou jogador com permissão)
    if (!game.user.can("TOKEN_CREATE")) {
      ui.notifications.warn("Você não tem permissão para criar tokens. Peça ao Mestre.");
      return;
    }

    // Já existe token deste ator na cena? Seleciona, centraliza e sincroniza o anel.
    const existente = canvas.tokens.placeables.find(t => t.actor?.id === actor.id);
    if (existente) {
      // Força o anel completo + recorte circular (mesmo se estava desligado)
      const texOrig = existente.document.texture?.src || actor.img;
      // Evita re-recortar uma imagem já circular gerada por nós
      const jaCircular = /tokens-circulares\//.test(texOrig);
      const texCirc = jaCircular ? texOrig : (await gerarTokenCircular(texOrig, actor.id)) ?? texOrig;
      await existente.document.update({
        "texture.src":             texCirc,
        "ring.enabled":            true,
        "ring.subject.texture":    texCirc,
        "ring.colors.ring":        actor.corClasse,
        "ring.colors.background":  "#1a1a1a",
        "ring.effects":            1
      });
      existente.control({ releaseOthers: true });
      canvas.animatePan({ x: existente.center.x, y: existente.center.y, duration: 400 });
      ui.notifications.info(`${actor.name} já está nesta cena — token selecionado.`);
      return;
    }

    // Centro da view atual, snapped ao grid
    const grid = scene.grid.size;
    const { x: px, y: py } = canvas.stage.pivot;
    const x = Math.round(px / grid) * grid;
    const y = Math.round(py / grid) * grid;

    // getTokenDocument aplica o prototypeToken. Como o prototype pode NÃO ter
    // o anel configurado (atores antigos), FORÇAMOS o anel completo aqui:
    // enabled + subject.texture (mesma imagem, senão o retrato some) + cor da classe.
    const tokenDoc = await actor.getTokenDocument({ x, y });
    // Gera versão recortada em círculo (arte dentro do anel, anel por cima)
    const texOriginal = tokenDoc.texture?.src || actor.img;
    const texCircular = await gerarTokenCircular(texOriginal, actor.id);
    const tex = texCircular ?? texOriginal;
    tokenDoc.updateSource({
      "texture.src":             tex,
      "ring.enabled":            true,
      "ring.subject.texture":    tex,
      "ring.colors.ring":        actor.corClasse,
      "ring.colors.background":  "#1a1a1a",
      "ring.effects":            1
    });
    await scene.createEmbeddedDocuments("Token", [tokenDoc.toObject()]);

    ui.notifications.info(`⛨ Token de ${actor.name} colocado na cena "${scene.name}".`);
  }

  /**
   * Reviver: tira o personagem do estado MORTO (ação do Mestre ou owner).
   * Restaura: morto=false, crepusculo=false, testesVontade=0, Det=10, PV=1.
   * O cabo de guerra volta ao início (Cor é derivada: 10 − Det).
   * Estilhaços permanecem — são cicatrizes permanentes.
   */
  static async _onReviverPersonagem(event, target) {
    event.preventDefault();
    const actor = this.document;
    if (!actor.system.alma?.morto) return;

    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Reviver — " + actor.name },
      content: `
        <p>Trazer <b>${actor.name}</b> de volta à vida?</p>
        <p>Restaura: Determinação 10, PV 1, sai do Crepúsculo.</p>
        <p><em>Estilhaços da Alma permanecem — cicatrizes não somem.</em></p>`
    });
    if (!ok) return;

    await actor.update({
      "system.alma.morto":         false,
      "system.alma.crepusculo":    false,
      "system.alma.testesVontade": 0,
      "system.alma.determinacao":  10,
      "system.recursos.pv.value":  1
    });
    this.render(false);

    await ChatMessage.implementation.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="crep-aviso saiu reviveu">
          <h3>✨ ${actor.name} retorna à vida ✨</h3>
          <p>A alma encontra o caminho de volta. O coração volta a bater.</p>
          <p><em>PV 1 · Determinação 10 · fora do Crepúsculo.</em></p>
        </div>`
    });
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

  /**
   * Dialog rico de ataque com MAGIA. Igual ao de arma, mas usa a perícia de
   * conjuração (Arcanismo MIS+MIS pra arcana, CAR+INT pra sagrada) passada em `conj`.
   * É chamado de SinfoniaActor.rolarAtaqueMagia via this.sheet.constructor.
   */
  static async _dialogAtaqueMagia(actor, magia, conj, analise) {
    const sys = actor.system;
    const det = sys.alma.determinacao;
    const cor = sys.alma.corrupcao;
    const eventoUsado   = sys.origem?.eventoMarcante?.usadoNaSessao;
    const ocupacaoUsada = sys.origem?.ocupacao?.usadoNaSessao;
    const eventoDesc    = sys.origem?.eventoMarcante?.descricao || "";
    const ocupacaoDesc  = sys.origem?.ocupacao?.descricao || "";
    const eventoDisabled   = eventoUsado   || !eventoDesc;
    const ocupacaoDisabled = ocupacaoUsada || !ocupacaoDesc;

    const atribA = conj.atribA, atribB = conj.atribB;

    // Alvo via targets
    const alvos = Array.from(game.user.targets ?? []);
    const alvo = alvos[0] ?? null;
    const nomeAlvo = alvo?.actor?.name ?? null;
    const defesaAlvo = alvo?.actor?.system?.combate?.defesa ?? null;
    const alvoInfo = alvo
      ? `<div class="alvo-info"><b>Alvo:</b> ${nomeAlvo} — Defesa ${defesaAlvo}</div>`
      : `<div class="alvo-info sem-alvo">Nenhum alvo selecionado. ND manual abaixo.</div>`;
    const ndDefault = defesaAlvo ?? 10;

    const danoInfo = analise.dano
      ? `<div class="arma-info">Dano detectado: <b>${analise.dano.formula}${analise.dano.tipoDano ? " " + analise.dano.tipoDano : ""}</b></div>`
      : "";

    const content = `
      <div class="sinfonia-dialog-rolagem">
        <div class="arma-info">
          <b>${magia.name}</b> (${magia.system.circulo}º Círculo) — ${conj.label}
        </div>
        ${danoInfo}
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
            <b>Empenho ${atribA.toUpperCase()}</b> — 1 Det: dado extra
          </label>
          <label class="check ${det < 2 ? 'disabled' : ''}">
            <input type="checkbox" name="empenhoB" ${det < 1 ? 'disabled' : ''}/>
            <b>Empenho ${atribB.toUpperCase()}</b> — 1 Det: dado extra
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
        window: { title: `Conjurar ${magia.name}` },
        content,
        ok: {
          label: "Conjurar",
          icon: "fa-wand-magic-sparkles",
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

/* ── NPC Sheet (v0.8.2 — ficha de monstro completa) ── */
export class SinfoniaNpcSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["sinfonia-das-almas","sheet","actor","npc","npc-v2"],
      template: "systems/sinfonia-das-almas/templates/actor/npc-sheet.hbs",
      width: 720, height: 760,
      resizable: true
    });
  }

  async getData() {
    const ctx = await super.getData();
    const sys = this.actor.system;
    ctx.system = sys;
    const e = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
    ctx.descricaoEnriquecida = await e.enrichHTML(sys.descricao ?? "", { async: true });

    // Resistências como lista pro template (com cor e label)
    const RES_META = {
      fisico: { label: "Físico", icon: "⚔", cor: "#c0c0c0" },
      fogo:   { label: "Fogo",   icon: "🔥", cor: "#ff6b35" },
      gelo:   { label: "Gelo",   icon: "❄", cor: "#5bc8ff" },
      trovao: { label: "Trovão", icon: "⚡", cor: "#ffd23f" },
      acido:  { label: "Ácido",  icon: "⚗", cor: "#7fff5b" },
      luz:    { label: "Luz",    icon: "✦", cor: "#fff4c0" },
      sombra: { label: "Sombra", icon: "●", cor: "#9060e8" }
    };
    ctx.resistList = Object.entries(RES_META).map(([key, meta]) => ({
      key, ...meta, valor: sys.resistencias?.[key] ?? ""
    }));

    ctx.acoes  = sys.acoes ?? [];
    ctx.tracos = sys.tracos ?? [];
    ctx.atributosList = Object.entries(SINFONIA.ATRIBUTOS).map(([k, m]) => ({
      key: k, abbr: m.abbr, dado: sys.atributos?.[k] ?? "d6"
    }));
    return ctx;
  }

  activateListeners(html) {
    super.activateListeners(html);
    const root = html[0] ?? html;

    // Adicionar ação
    root.querySelector(".btn-add-acao")?.addEventListener("click", async () => {
      const acoes = foundry.utils.deepClone(this.actor.system.acoes ?? []);
      acoes.push({ nome: "Nova Ação", tipo: "acao", custoPE: 0, rolavel: false, formula: "", desc: "" });
      await this.actor.update({ "system.acoes": acoes });
    });
    // Remover ação
    root.querySelectorAll(".btn-del-acao").forEach(btn => {
      btn.addEventListener("click", async () => {
        const idx = Number(btn.dataset.idx);
        const acoes = foundry.utils.deepClone(this.actor.system.acoes ?? []);
        acoes.splice(idx, 1);
        await this.actor.update({ "system.acoes": acoes });
      });
    });
    // Adicionar traço
    root.querySelector(".btn-add-traco")?.addEventListener("click", async () => {
      const tracos = foundry.utils.deepClone(this.actor.system.tracos ?? []);
      tracos.push({ nome: "Novo Traço", desc: "" });
      await this.actor.update({ "system.tracos": tracos });
    });
    // Remover traço
    root.querySelectorAll(".btn-del-traco").forEach(btn => {
      btn.addEventListener("click", async () => {
        const idx = Number(btn.dataset.idx);
        const tracos = foundry.utils.deepClone(this.actor.system.tracos ?? []);
        tracos.splice(idx, 1);
        await this.actor.update({ "system.tracos": tracos });
      });
    });
    // Rolar ação (ataque ou dano)
    root.querySelectorAll(".btn-rolar-acao").forEach(btn => {
      btn.addEventListener("click", () => this._rolarAcao(Number(btn.dataset.idx)));
    });
    // Rolar atributo
    root.querySelectorAll(".npc-atrib-roll").forEach(btn => {
      btn.addEventListener("click", () => this._rolarAtributo(btn.dataset.attr));
    });
  }

  async _rolarAtributo(attr) {
    const dado = this.actor.system.atributos?.[attr] ?? "d6";
    const roll = await new Roll(`1${dado}`).roll();
    const abbr = SINFONIA.ATRIBUTOS[attr]?.abbr ?? attr.toUpperCase();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `${this.actor.name} — teste de ${abbr}`
    });
  }

  async _rolarAcao(idx) {
    const acao = this.actor.system.acoes?.[idx];
    if (!acao) return;
    // Substitui @attr pelos dados do monstro
    let formula = (acao.formula || "").trim();
    if (!formula) {
      // Sem fórmula: só posta o card descritivo
      await ChatMessage.implementation.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="sinfonia-hab-card"><div class="hab-card-header"><span class="hab-card-nome">${acao.nome}</span></div><div class="hab-card-desc">${acao.desc || ""}</div></div>`
      });
      return;
    }
    const subs = {
      pod: `1${this.actor.system.atributos?.pod ?? "d6"}`,
      agi: `1${this.actor.system.atributos?.agi ?? "d6"}`,
      int: `1${this.actor.system.atributos?.int ?? "d6"}`,
      car: `1${this.actor.system.atributos?.car ?? "d6"}`,
      mis: `1${this.actor.system.atributos?.mis ?? "d6"}`
    };
    for (const [k, v] of Object.entries(subs)) formula = formula.replaceAll(`@${k}`, v);

    let roll;
    try {
      roll = await new Roll(formula).roll();
    } catch (err) {
      ui.notifications.warn(`Fórmula inválida em "${acao.nome}": ${acao.formula}`);
      return;
    }
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `<b>${acao.nome}</b>${acao.desc ? ` — ${acao.desc}` : ""}`
    });
  }
}
