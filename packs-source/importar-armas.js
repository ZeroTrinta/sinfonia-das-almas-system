/**
 * Macro de Importação — Pack de Armas de Sinfonia das Almas
 *
 * Cola este código numa Macro do Foundry (tipo "Script") e executa.
 * Vai criar 12 armas no diretório de Itens do mundo, prontas pra
 * arrastar pra qualquer ficha de personagem.
 *
 * Rode novamente para criar duplicatas (não verifica se já existe).
 */

const URL = "systems/sinfonia-das-almas/packs-source/armas.json";

try {
  const response = await fetch(URL);
  if (!response.ok) {
    ui.notifications.error(`Não consegui carregar ${URL} (HTTP ${response.status})`);
    return;
  }
  const armas = await response.json();

  // Cria todos os itens de uma vez (mais rápido que um a um)
  const criados = await Item.createDocuments(armas);

  ui.notifications.info(`✦ ${criados.length} armas importadas com sucesso!`);
  console.log("Sinfonia | Armas importadas:", criados.map(i => i.name));

  // Opcional: já abre o diretório de Itens
  ui.sidebar.activateTab("items");
} catch (err) {
  ui.notifications.error("Erro ao importar armas. Veja o console (F12).");
  console.error("Sinfonia | Falha na importação:", err);
}
