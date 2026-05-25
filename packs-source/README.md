# Pack de Armas — Sinfonia das Almas

Pasta com dados de armas pré-fabricadas para importação no Foundry.

## Como importar no Foundry

### Opção 1 — Macro (recomendado)

1. No Foundry, abra a aba **Macros** (na hotbar inferior, clique em qualquer slot vazio).
2. Crie uma nova macro do tipo **Script**.
3. Cole o conteúdo de `importar-armas.js` no campo de comando.
4. Salve e execute (clique na macro ou arraste pra hotbar).
5. As 12 armas vão aparecer na aba **Itens** do mundo.
6. Arraste qualquer uma pra ficha de um personagem.

### Opção 2 — Drag and drop manual

Não suportado nativamente pelo Foundry para JSON simples — use a Opção 1.

## Como adicionar/editar armas

Abra `armas.json` num editor de texto. Cada entrada tem:

```json
{
  "name": "Nome da Arma",
  "type": "arma",
  "img": "caminho/icone.webp",
  "system": {
    "categoria": "leve | espada | haste | pesada | precisao | fogo",
    "tipoDano": "corte | perfuracao | impacto | fogo | frio | trovao | acido | veneno | sagrado | profano",
    "dano": "1d10 + @pod + 2",
    "alcance": 1.5,
    "bonus": 0,
    "peso": 1.5,
    "equipado": false,
    "descricao": "<p>HTML aceito aqui.</p>"
  }
}
```

### Variáveis de atributo na fórmula de dano

- `@pod` — valor do dado de Poder
- `@agi` — valor do dado de Agilidade
- `@int` — valor do dado de Intelecto
- `@car` — valor do dado de Carisma
- `@mis` — valor do dado de Misticismo

Estes resolvem para o valor numérico do dado (d6=6, d8=8, d10=10, d12=12), não rolam o dado.

### Mapeamento categoria → perícia de ataque

- `leve`, `espada`, `haste`, `pesada` → **Armas Brancas** (POD + AGI)
- `precisao`, `fogo` → **Armas de Fogo** (AGI + INT)

### Ícones

Os caminhos `icons/...` referem-se aos ícones nativos do Foundry. Para usar ícones próprios, coloque em `systems/sinfonia-das-almas/icons/` e use esse caminho.

## Armas incluídas

| Nome | Categoria | Dano | Tipo |
|---|---|---|---|
| Adaga Enferrujada | leve | 1d4 + @agi | perfuração |
| Faca do Ladino | leve | 1d6 + @agi (+1) | perfuração |
| Espada Curta | espada | 1d8 + @pod | corte |
| Espada Longa | espada | 1d10 + @pod | corte |
| Lâmina do Penitente | espada | 1d10 + @pod + 2 (+2) | sagrado |
| Lança de Caça | haste | 1d8 + @pod | perfuração |
| Alabarda | haste | 1d10 + @pod + 1 | corte |
| Maça de Armas | pesada | 1d10 + @pod | impacto |
| Machado de Batalha | pesada | 1d12 + @pod | corte |
| Arco Curto | precisão | 1d8 + @agi | perfuração |
| Besta Pesada | precisão | 1d12 + @agi (+1) | perfuração |
| Pistola de Pederneira | fogo | 1d10 + @agi + 2 | perfuração |
