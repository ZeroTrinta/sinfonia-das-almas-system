/**
 * Sinfonia das Almas — Macro: Ativar Token Ring em todos os personagens
 *
 * Atualiza o prototypeToken de TODOS os atores do tipo "personagem" para usar
 * o Dynamic Token Ring (anel dourado em volta do avatar) e o tamanho/disposition
 * padrão do sistema.
 *
 * USO:
 *   1. Copie todo este código.
 *   2. No Foundry, clique-duplo na barra de macros (hotbar) pra criar uma macro nova.
 *   3. Type: Script. Cole o código. Salve. Execute.
 *
 * Para aplicar também em TOKENS JÁ COLOCADOS na cena: depois de rodar isso,
 * pra cada token na cena, clique-direito → "Refresh from Prototype Token"
 * (ou use a opção do menu Tokens > Refresh All).
 */

(async () => {
  if (!game.user.isGM) {
    ui.notifications.warn("Apenas o Mestre pode rodar esta macro.");
    return;
  }

  const personagens = game.actors.filter(a => a.type === "personagem");
  if (!personagens.length) {
    ui.notifications.info("Nenhum personagem encontrado.");
    return;
  }

  const ok = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Ativar Token Ring" },
    content: `<p>Ativar o anel dourado em <b>${personagens.length}</b> personagem(ns)?</p>
              <p><em>Os tokens já colocados na cena precisam de "Refresh from Prototype" depois.</em></p>`
  });
  if (!ok) return;

  let atualizados = 0;
  for (const actor of personagens) {
    await actor.update({
      "prototypeToken.ring.enabled": true,
      "prototypeToken.ring.colors.ring": "#c8972a",
      "prototypeToken.ring.colors.background": "#1a1a1a",
      "prototypeToken.ring.effects": 1,
      "prototypeToken.actorLink": true,
      "prototypeToken.disposition": 1,
      "prototypeToken.sight.enabled": true,
      "prototypeToken.displayName": 30,
      "prototypeToken.displayBars": 20
    });
    atualizados++;
  }

  // Tenta atualizar tokens já colocados nas cenas
  let tokensAtualizados = 0;
  for (const scene of game.scenes) {
    const tokensSinfonia = scene.tokens.filter(t =>
      t.actor?.type === "personagem"
    );
    for (const token of tokensSinfonia) {
      await token.update({
        "ring.enabled": true,
        "ring.colors.ring": "#c8972a",
        "ring.colors.background": "#1a1a1a",
        "ring.effects": 1
      });
      tokensAtualizados++;
    }
  }

  ui.notifications.info(
    `Sinfonia: ${atualizados} ator(es) e ${tokensAtualizados} token(s) atualizados com anel dourado.`
  );
})();
