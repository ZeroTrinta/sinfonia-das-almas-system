# Sinfonia das Almas — Sistema para Foundry VTT

Sistema homebrew de RPG de mesa com mecânicas únicas de Determinação e Corrupção da Alma.

## Instalação via Manifest (recomendado)

1. Abra o Foundry VTT
2. Vá em **Setup → Game Systems → Install System**
3. No campo **Manifest URL**, cole:
   ```
   https://raw.githubusercontent.com/ZeroTrinta/sinfonia-das-almas-system/main/system.json
   ```
4. Clique em **Install** — o Foundry baixa e instala tudo automaticamente

## Instalação Manual

1. Baixe o ZIP da [última release](https://github.com/ZeroTrinta/sinfonia-das-almas-system/releases/latest)
2. Extraia a pasta `sinfonia-das-almas` dentro de `{foundryData}/Data/systems/`
3. Reinicie o Foundry VTT

## Estrutura do Projeto

```
sinfonia-das-almas/
├── system.json                  ← Manifesto do sistema
├── sinfonia.mjs                 ← Entry point
├── module/
│   ├── data-models.mjs          ← Schemas de dados
│   ├── documents.mjs            ← Lógica de Actor/Item
│   └── sheets/
│       ├── actor-sheet.mjs
│       └── item-sheet.mjs
├── templates/
│   ├── actor/                   ← Fichas Handlebars
│   └── item/
├── styles/sinfonia.css
└── lang/pt-br.json
```

## Como publicar uma nova versão

1. Atualize `"version"` no `system.json`
2. Commit e push
3. Crie uma tag:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```
4. O GitHub Actions cria a Release e o ZIP automaticamente
5. O Foundry detecta a atualização via manifest

## Mecânicas Implementadas (v0.1.0)

- ✅ 5 atributos em dados (d6/d8/d10/d12)
- ✅ PV/PE calculados automaticamente (Nível + 5× dado)
- ✅ Defesa, Iniciativa e ND Mística derivados
- ✅ Cabo de guerra Determinação ↔ Corrupção (soma 10)
- ✅ Rolls de perícia com diálogo de ND
- ✅ 30 perícias com grau de maestria (+2/+4/+6)
- ✅ Usar magias, habilidades e consumíveis
- ✅ Dano, cura e PV temporários
- ✅ Chat messages com visual dark fantasy

## Próximas versões

- [ ] Árvore de habilidades dentro da ficha
- [ ] Compendiums de magias pré-populados
- [ ] Estilhaços da Alma com efeitos mecânicos
- [ ] Condições de combate
- [ ] Suporte a segundo nível de classe
# sinfonia-das-almas-system
