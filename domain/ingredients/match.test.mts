import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { matchIngredient } from "./match.ts";
import { normalizeIngredientName } from "./normalize.ts";
import {
  seedCanonicalIngredients,
  seedIngredientAliases,
} from "./seed.ts";
import type { IngredientAlias, IngredientSeparationRule } from "./types.ts";

function match(
  originalText: string,
  rules: IngredientSeparationRule[] = [],
  aliases: IngredientAlias[] = seedIngredientAliases,
) {
  return matchIngredient({
    originalText,
    householdId: "household-1",
    canonicalIngredients: seedCanonicalIngredients,
    aliases,
    separationRules: rules,
  });
}

describe("ingredient matching", () => {
  it("matches garlic exactly", () => {
    assert.equal(match("garlic").match?.canonicalName, "garlic");
  });

  it("matches garlic powder exactly", () => {
    assert.equal(match("garlic powder").match?.canonicalName, "garlic powder");
  });

  it("does not turn garlic into garlic powder", () => {
    assert.notEqual(match("garlic").match?.canonicalName, "garlic powder");
  });

  it("keeps fresh ginger and ground ginger distinct", () => {
    assert.equal(match("fresh ginger").match?.canonicalName, "fresh ginger");
    assert.equal(match("ground ginger").match?.canonicalName, "ground ginger");
  });

  it("keeps brown sugar and granulated sugar distinct", () => {
    assert.equal(match("brown sugar").match?.canonicalName, "brown sugar");
    assert.equal(
      match("granulated sugar").match?.canonicalName,
      "granulated sugar",
    );
  });

  it("keeps milk and almond milk distinct", () => {
    assert.equal(match("milk").match?.canonicalName, "milk");
    assert.equal(match("almond milk").match?.canonicalName, "almond milk");
  });

  it("maps dairy milk alias to milk", () => {
    assert.equal(match("dairy milk").match?.canonicalName, "milk");
  });

  it("maps cow's milk alias to milk", () => {
    assert.equal(match("cow's milk").match?.canonicalName, "milk");
  });

  it("keeps butter and margarine distinct", () => {
    assert.equal(match("butter").match?.canonicalName, "butter");
    assert.equal(match("margarine").match?.canonicalName, "margarine");
  });

  it("normalizes capitalization safely", () => {
    assert.equal(match("GARLIC").match?.canonicalName, "garlic");
  });

  it("normalizes repeated whitespace safely", () => {
    assert.equal(match("fresh   ginger").match?.canonicalName, "fresh ginger");
  });

  it("matches an exact approved alias", () => {
    const result = match("cloves of garlic");
    assert.equal(result.status, "approved_alias");
    assert.equal(result.match?.canonicalName, "garlic");
  });

  it("gives a household-approved alias precedence over a global alias", () => {
    const aliases: IngredientAlias[] = [
      {
        id: "global-alias",
        canonicalIngredientId: "garlic",
        alias: "kitchen garlic",
        normalizedAlias: "kitchen garlic",
        source: "app_seed",
        householdId: null,
      },
      {
        id: "household-alias",
        canonicalIngredientId: "garlic powder",
        alias: "kitchen garlic",
        normalizedAlias: "kitchen garlic",
        source: "owner_approved",
        householdId: "household-1",
      },
    ];

    assert.equal(match("kitchen garlic", [], aliases).match?.canonicalName, "garlic powder");
  });

  it("applies household-approved alias precedence deterministically", () => {
    const globalAlias: IngredientAlias = {
      id: "global-alias",
      canonicalIngredientId: "garlic",
      alias: "kitchen garlic",
      normalizedAlias: "kitchen garlic",
      source: "app_seed",
      householdId: null,
    };
    const householdAlias: IngredientAlias = {
      id: "household-alias",
      canonicalIngredientId: "garlic powder",
      alias: "kitchen garlic",
      normalizedAlias: "kitchen garlic",
      source: "owner_approved",
      householdId: "household-1",
    };

    assert.equal(
      match("kitchen garlic", [], [globalAlias, householdAlias]).match?.canonicalName,
      "garlic powder",
    );
    assert.equal(
      match("kitchen garlic", [], [householdAlias, globalAlias]).match?.canonicalName,
      "garlic powder",
    );
  });

  it("returns no_match for an unknown ingredient", () => {
    assert.equal(match("asafoetida").status, "no_match");
  });

  it("lets keep-separate block an otherwise approved alias mapping", () => {
    const result = match("garlic cloves", [
      {
        id: "rule-1",
        householdId: "household-1",
        normalizedInput: normalizeIngredientName("garlic cloves"),
        blockedCanonicalIngredientId: "garlic",
      },
    ]);

    assert.equal(result.status, "keep_separate");
  });

  it("lets keep-separate block an exact canonical match", () => {
    const result = match("garlic", [
      {
        id: "rule-1",
        householdId: "household-1",
        normalizedInput: "garlic",
        blockedCanonicalIngredientId: "garlic",
      },
    ]);

    assert.equal(result.status, "keep_separate");
  });

  it("normalizes NFKC Unicode while preserving original input text", () => {
    const originalText = "ＧＡＲＬＩＣ";
    const result = match(originalText);

    assert.equal(result.input.originalText, originalText);
    assert.equal(result.input.normalizedText, "garlic");
    assert.equal(result.match?.canonicalName, "garlic");
  });

  it("normalizes curly apostrophes while preserving original input text", () => {
    const originalText = "cow\u2019s milk";
    const result = match(originalText);

    assert.equal(result.input.originalText, originalText);
    assert.equal(result.input.normalizedText, "cow's milk");
    assert.equal(result.match?.canonicalName, "milk");
  });

  it("preserves meaningful internal hyphens and slashes", () => {
    const originalText = "  garlic-powder / ground  ";
    const result = match(originalText);

    assert.equal(result.input.originalText, originalText);
    assert.equal(result.input.normalizedText, "garlic-powder / ground");
    assert.equal(result.status, "no_match");
  });

  it("preserves original input text in the match result", () => {
    const result = match("  Fresh   Ginger  ");

    assert.equal(result.input.originalText, "  Fresh   Ginger  ");
    assert.equal(result.input.normalizedText, "fresh ginger");
  });
});
