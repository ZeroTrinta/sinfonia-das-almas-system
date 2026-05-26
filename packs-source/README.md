# packs-source

Fonte editável dos Compendium Packs do sistema **Sinfonia das Almas**.

## Como funciona (v0.5.0+)

Os arquivos `.json` nesta pasta são a **fonte de verdade** das armas e magias. O build script (`tools/build-packs.mjs`) compila esses JSONs em **Compendium Packs (LevelDB)** que ficam em `packs/` e aparecem automaticamente dentro do Foundry quando o sistema é instalado.

### Estrutura

| Arquivo | Pack gerado | Conteúdo |
|---------|-------------|----------|
| `armas.json`  | `packs/armas-nucleo/`  | 4 armas oficiais |
| `magias.json` | `packs/magias-nucleo/` | 67 magias |

### Como adicionar/editar items

1. Edite o JSON correspondente em `packs-source/`
2. Rode `npm run build:packs` localmente para testar (precisa de Node 20+)
3. Commit e push — o workflow do GitHub Actions reconstrói no release

### Build local

```bash
npm install
npm run build:packs   # gera packs/armas-nucleo e packs/magias-nucleo
npm run clean:packs   # limpa pasta packs/
```

## Macros legadas (`importar-*.js`)

As macros `importar-armas.js` e `importar-magias.js` ainda funcionam, mas com Compendium Packs você **não precisa mais delas**. Basta arrastar items direto do Compendium pra ficha. Estão aqui como backup caso queira importar via macro em mundos antigos.

## Schema das Armas

```json
{
  "name": "Long Sword",
  "type": "arma",
  "img": "icons/weapons/swords/sword-guard-gold.webp",
  "system": {
    "categoria": "espada",        // leve, espada, haste, pesada, precisao, fogo
    "dano": "@pod+@agi+8",        // @pod, @agi, @int, @car, @mis (valor do dado)
    "tipoDano": "fisico",
    "alcance": 1.5,
    "bonus": 0,
    "equipado": false,
    "duasMaos": false,
    "duplaEmpunhadura": false,
    "propriedades": "Uma mão",
    "descricao": "<p>...</p>",
    "peso": 3
  }
}
```

## Schema das Magias

```json
{
  "name": "Dardo de Fogo",
  "type": "magia",
  "img": "icons/magic/fire/projectile-fireball.webp",
  "system": {
    "tipo": "arcana",       // arcana ou sagrada
    "circulo": 1,           // 1 a 5
    "escola": "evocacao",
    "custoPE": 10,
    "custoContinuo": 0,
    "tempoCon": "1 Ação Inicial",
    "alcance": "18 metros",
    "duracao": "Instantânea",
    "areaEfeito": "",
    "resistencia": "",
    "descricao": "<p>...</p>",
    "peso": 0
  }
}
```
