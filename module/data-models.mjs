/**
 * Sinfonia das Almas — Data Models
 * Schemas de dados para Actors e Items baseados no Núcleo do Sistema
 */

const {
  HTMLField, NumberField, SchemaField, StringField,
  BooleanField, ArrayField
} = foundry.data.fields;

// ── Helpers ──────────────────────────────────────────────────
function dadoField(initial = "d6") {
  return new StringField({
    required: true, blank: false,
    choices: ["d6", "d8", "d10", "d12"],
    initial
  });
}

function periciaMaestriaField() {
  return new StringField({
    required: true, blank: true, initial: "",
    choices: ["", "iniciante", "treinado", "experiente"]
  });
}

/* ============================================================
   BASE ACTOR
============================================================ */
class BaseActorModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      recursos: new SchemaField({
        pv: new SchemaField({
          value: new NumberField({ required: true, integer: true, min: 0, initial: 30 }),
          max:   new NumberField({ required: true, integer: true, min: 0, initial: 30 }),
          temp:  new NumberField({ required: true, integer: true, min: 0, initial: 0 })
        }),
        pe: new SchemaField({
          value: new NumberField({ required: true, integer: true, min: 0, initial: 30 }),
          max:   new NumberField({ required: true, integer: true, min: 0, initial: 30 })
        }),
        pi: new SchemaField({
          value: new NumberField({ required: true, integer: true, min: 0, initial: 6 }),
          max:   new NumberField({ required: true, integer: true, min: 0, initial: 6 })
        })
      })
    };
  }
}

/* ============================================================
   PERSONAGEM (PC)
============================================================ */
export class PersonagemDataModel extends BaseActorModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),

      // Atributos ─────────────────────────────────────────────
      atributos: new SchemaField({
        pod: dadoField("d8"),
        agi: dadoField("d8"),
        int: dadoField("d8"),
        car: dadoField("d8"),
        mis: dadoField("d6")
      }),

      // Combate ───────────────────────────────────────────────
      combate: new SchemaField({
        defesa:       new NumberField({ required: true, integer: true, min: 0, initial: 8 }),
        iniciativa:   new NumberField({ required: true, integer: true, min: 0, initial: 4 }),
        ndMistica:    new NumberField({ required: true, integer: true, min: 0, initial: 8 }),
        deslocamento: new NumberField({ required: true, integer: true, min: 0, initial: 9 }),
        estilhacos:   new NumberField({ required: true, integer: true, min: 0, initial: 0 })
      }),

      // Progressão ────────────────────────────────────────────
      progressao: new SchemaField({
        nivel:            new NumberField({ required: true, integer: true, min: 1, initial: 5 }),
        pontosHabilidade: new NumberField({ required: true, integer: true, min: 0, initial: 5 }),
        classe:      new StringField({ required: true, blank: true, initial: "" }),
        segundaClasse: new StringField({ required: true, blank: true, initial: "" })
      }),

      // Eixo da Alma ──────────────────────────────────────────
      alma: new SchemaField({
        determinacao: new NumberField({ required: true, integer: true, min: 0, max: 10, initial: 7 }),
        corrupcao:    new NumberField({ required: true, integer: true, min: 0, max: 10, initial: 3 }),
        // Estilhaços acumulados — cada um abaixa o teto da Determinação em 1.
        estilhacos:   new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        pilar:      new StringField({ required: true, blank: true, initial: "" }),
        qualidades: new StringField({ required: true, blank: true, initial: "" }),
        defeitos:   new StringField({ required: true, blank: true, initial: "" })
      }),

      // Origem ────────────────────────────────────────────────
      origem: new SchemaField({
        eventoMarcante: new SchemaField({
          descricao:     new StringField({ required: true, blank: true, initial: "" }),
          usadoNaSessao: new BooleanField({ required: true, initial: false })
        }),
        ocupacao: new SchemaField({
          descricao:     new StringField({ required: true, blank: true, initial: "" }),
          usadoNaSessao: new BooleanField({ required: true, initial: false })
        })
      }),

      // Perícias ──────────────────────────────────────────────
      pericias: new SchemaField({
        armasBrancas:   periciaMaestriaField(),
        armasDeFogo:    periciaMaestriaField(),
        atletismo:      periciaMaestriaField(),
        briga:          periciaMaestriaField(),
        conducao:       periciaMaestriaField(),
        furtividade:    periciaMaestriaField(),
        fortitude:      periciaMaestriaField(),
        forcaDeVontade: periciaMaestriaField(),
        reflexos:       periciaMaestriaField(),
        ladinagem:      periciaMaestriaField(),
        oficios:        periciaMaestriaField(),
        sobrevivencia:  periciaMaestriaField(),
        empatiaAnimais: periciaMaestriaField(),
        etiqueta:       periciaMaestriaField(),
        intimidacao:    periciaMaestriaField(),
        lideranca:      periciaMaestriaField(),
        malandragem:    periciaMaestriaField(),
        performance:    periciaMaestriaField(),
        persuasao:      periciaMaestriaField(),
        intuicao:       periciaMaestriaField(),
        subterfugio:    periciaMaestriaField(),
        ciencia:        periciaMaestriaField(),
        erudicao:       periciaMaestriaField(),
        financas:       periciaMaestriaField(),
        investigacao:   periciaMaestriaField(),
        medicina:       periciaMaestriaField(),
        arcanismo:      periciaMaestriaField(),
        percepcao:      periciaMaestriaField(),
        politica:       periciaMaestriaField(),
        tecnologia:     periciaMaestriaField()
      }),

      biografia: new HTMLField({ required: true, blank: true }),
      notas:     new HTMLField({ required: true, blank: true })
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    // Cabo de guerra: det + cor = 10
    this.alma.corrupcao = 10 - this.alma.determinacao;
    // Clamp recursos
    const { pv, pe } = this.recursos;
    pv.value = Math.clamp(pv.value, 0, pv.max);
    pe.value = Math.clamp(pe.value, 0, pe.max);
  }
}

/* ============================================================
   NPC
============================================================ */
export class NpcDataModel extends BaseActorModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      combate: new SchemaField({
        defesa:       new NumberField({ required: true, integer: true, min: 0, initial: 8 }),
        iniciativa:   new NumberField({ required: true, integer: true, min: 0, initial: 4 }),
        deslocamento: new NumberField({ required: true, integer: true, min: 0, initial: 9 })
      }),
      cr:       new NumberField({ required: true, min: 0, initial: 1 }),
      tipo:     new StringField({ required: true, blank: true, initial: "" }),
      descricao: new HTMLField({ required: true, blank: true })
    };
  }
}

/* ============================================================
   ITEMS
============================================================ */
class BaseItemModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      descricao: new HTMLField({ required: true, blank: true }),
      peso:      new NumberField({ required: true, min: 0, initial: 0 }),
      // Marca de favorito — exibido em destaque na aba Principal
      favorito:  new BooleanField({ required: true, initial: false })
    };
  }
}

export class HabilidadeDataModel extends BaseItemModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      classe:          new StringField({ required: true, blank: true, initial: "" }),
      tipo:            new StringField({ required: true, blank: true, initial: "major" }),
      custoPE:         new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      custoHabilidade: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
      nivelHabilidade: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
      nivelMax:        new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
      requisito:       new StringField({ required: true, blank: true, initial: "" }),
      ativo:           new BooleanField({ required: true, initial: false })
    };
  }
}

export class MagiaDataModel extends BaseItemModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      tipo: new StringField({
        required: true, blank: false, initial: "arcana",
        choices: ["arcana", "sagrada"]
      }),
      circulo: new NumberField({ required: true, integer: true, min: 1, max: 5, initial: 1 }),
      escola:  new StringField({
        required: true, blank: false, initial: "evocacao",
        choices: ["abjuracao","conjuracao","adivinhacao","encantamento",
                  "evocacao","ilusao","necromancia","transmutacao","divina"]
      }),
      custoPE:       new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
      custoContinuo: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      tempoCon:      new StringField({ required: true, blank: true, initial: "1 Ação Inicial" }),
      alcance:       new StringField({ required: true, blank: true, initial: "18 metros" }),
      duracao:       new StringField({ required: true, blank: true, initial: "Instantânea" }),
      areaEfeito:    new StringField({ required: true, blank: true, initial: "" }),
      resistencia:   new StringField({ required: true, blank: true, initial: "" })
    };
  }
}

export class ArmaDataModel extends BaseItemModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      categoria: new StringField({
        required: true, blank: false, initial: "leve",
        choices: ["leve","espada","haste","pesada","precisao","fogo"]
      }),
      dano:     new StringField({ required: true, blank: true, initial: "1d6" }),
      tipoDano: new StringField({ required: true, blank: true, initial: "corte" }),
      alcance:  new NumberField({ required: true, min: 0, initial: 1.5 }),
      bonus:    new NumberField({ required: true, integer: true, initial: 0 }),
      equipado: new BooleanField({ required: true, initial: false }),
      // Propriedades especiais
      duasMaos:        new BooleanField({ required: true, initial: false }),
      duplaEmpunhadura: new BooleanField({ required: true, initial: false }),
      propriedades:    new StringField({ required: true, blank: true, initial: "" })
    };
  }
}

export class ArmaduraDataModel extends BaseItemModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      bonusDefesa: new NumberField({ required: true, integer: true, initial: 0 }),
      equipada:    new BooleanField({ required: true, initial: false })
    };
  }
}

export class InventarioDataModel extends BaseItemModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      quantidade: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      custoPI:    new NumberField({ required: true, integer: true, min: 0, initial: 1 })
    };
  }
}
