import type { ZxcvbnFactory, ZxcvbnResult } from "@zxcvbn-ts/core";

/**
 * zxcvbn strength meter (common-password, keyboard-pattern and Spanish
 * dictionaries). Loaded on demand: the dictionaries weigh several hundred KB
 * and only the register and change-password forms need them.
 */
let factory: Promise<ZxcvbnFactory> | null = null;

function load(): Promise<ZxcvbnFactory> {
  factory ??= Promise.all([
    import("@zxcvbn-ts/core"),
    import("@zxcvbn-ts/language-common"),
    import("@zxcvbn-ts/language-es-es"),
  ]).then(([core, common, es]) => new core.ZxcvbnFactory({
    translations: es.translations,
    graphs: common.adjacencyGraphs,
    dictionary: { ...common.dictionary, ...es.dictionary },
  }));
  return factory;
}

export type Strength = { score: 0 | 1 | 2 | 3 | 4; warning: string | null; suggestions: string[] };

export async function estimateStrength(password: string, userInputs: string[] = []): Promise<Strength> {
  const zxcvbn = await load();
  const result: ZxcvbnResult = zxcvbn.check(password.slice(0, 128), [...userInputs, "landing", "landingia"]);
  return { score: result.score, warning: result.feedback.warning, suggestions: result.feedback.suggestions };
}
