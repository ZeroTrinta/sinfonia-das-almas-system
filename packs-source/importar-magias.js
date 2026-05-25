/**
 * Macro de Importação — Pack de Magias de Sinfonia das Almas
 *
 * Cola este código numa Macro do Foundry (tipo "Script") e executa.
 * Vai criar todas as magias no diretório de Itens do mundo, prontas pra
 * arrastar pra qualquer ficha de personagem.
 *
 * Rode novamente para criar duplicatas (não verifica se já existe).
 */

const URL = "systems/sinfonia-das-almas/packs-source/magias.json";

try {
  const response = await fetch(URL);
  if (!response.ok) {
    ui.notifications.error(`Não consegui carregar ${URL} (HTTP ${response.status})`);
    return;
  }
  const magias = await response.json();

  // Cria todos os itens de uma vez (mais rápido que um a um)
  const criados = await Item.createDocuments(magias);

  ui.notifications.info(`✦ ${criados.length} magias importadas com sucesso!`);
  console.log("Sinfonia | Magias importadas:", criados.map(i => i.name));

  // Opcional: já abre o diretório de Itens
  ui.sidebar.activateTab("items");
} catch (err) {
  ui.notifications.error("Erro ao importar magias. Veja o console (F12).");
  console.error("Sinfonia | Falha na importação:", err);
}
