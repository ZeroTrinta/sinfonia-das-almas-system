/**
 * Macro: deduplicar items duplicados do actor selecionado.
 * 
 * COMO USAR:
 *   1. Selecione o token do personagem no canvas (ou abra a ficha)
 *   2. Cole este código numa macro de Script e rode
 *   3. Vai manter apenas a primeira ocorrência de cada item por NOME+TIPO
 */

const actor = canvas.tokens.controlled[0]?.actor 
           ?? game.user.character 
           ?? Array.from(game.actors).find(a => a.testUserPermission(game.user, "OWNER") && a.type === "personagem");

if (!actor) {
  ui.notifications.warn("Selecione um token ou defina seu personagem em User Configuration.");
  return;
}

// Agrupa por chave "nome|tipo" e marca duplicatas pra deletar
const visto = new Map();
const paraDeletar = [];

for (const item of actor.items) {
  const chave = `${item.name}|${item.type}`;
  if (visto.has(chave)) {
    paraDeletar.push(item.id);
  } else {
    visto.set(chave, item.id);
  }
}

if (paraDeletar.length === 0) {
  ui.notifications.info(`${actor.name}: nenhuma duplicata encontrada.`);
  return;
}

const ok = await foundry.applications.api.DialogV2.confirm({
  window: { title: "Deduplicar Itens" },
  content: `<p>Encontradas <b>${paraDeletar.length}</b> duplicatas em <b>${actor.name}</b>.</p>
            <p>Manter apenas a primeira ocorrência de cada item por nome+tipo?</p>
            <p><em>Total atual: ${actor.items.size} items → após: ${actor.items.size - paraDeletar.length}</em></p>`
});

if (!ok) return;

await actor.deleteEmbeddedDocuments("Item", paraDeletar);
ui.notifications.info(`${actor.name}: ${paraDeletar.length} duplicatas removidas.`);
