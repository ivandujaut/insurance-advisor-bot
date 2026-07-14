/**
 * Convención de commits del proyecto: gitmoji + tipo conventional.
 *
 *   <emoji> <tipo>(scope opcional): <descripción>
 *   ej: ✨ feat: add hybrid conversation engine
 *
 * El config-conventional estándar rechaza emojis, por eso el parser es custom.
 * Reglas: tipo de la lista gitmoji, subject obligatorio, en minúscula y sin
 * punto final, header acotado.
 */

const types = [
  "tada", "release", "feat", "refactor", "fix", "patch", "perf", "style", "ui",
  "ux", "remove", "construction", "add", "upgrade", "downgrade", "revert",
  "accessibility", "merge", "test", "config", "script", "typos", "resources",
  "assets", "gitignore", "responsive", "experiment", "docs", "comments", "seo",
  "seeds", "chore", "ci", "security", "secrets", "linter", "internationalization",
  "alien", "db", "types", "animations", "auth", "dead", "business", "validation",
];

export default {
  parserPreset: {
    parserOpts: {
      headerPattern: /^(\S+) (\w+)(?:\(([\w-]+)\))?: (.+)$/u,
      headerCorrespondence: ["emoji", "type", "scope", "subject"],
    },
  },
  rules: {
    "type-enum": [2, "always", types],
    "type-empty": [2, "never"],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "subject-case": [2, "never", ["sentence-case", "start-case", "pascal-case", "upper-case"]],
    "header-max-length": [2, "always", 72],
  },
};
