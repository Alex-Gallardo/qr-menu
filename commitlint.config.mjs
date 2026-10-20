/** Conventional Commits: feat(branches): crear sucursal con horarios */
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Los mensajes van en español y pueden empezar con mayúscula o nombre propio.
    "subject-case": [0],
  },
};

export default config;
