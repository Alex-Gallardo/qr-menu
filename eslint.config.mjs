import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    // Zod siempre desde lib/zod: registra los mensajes en español antes de crear esquemas.
    ignores: ["lib/zod.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "zod", message: 'Importa z desde "@/lib/zod" (mensajes en español).' },
            { name: "zod/v4", message: 'Importa z desde "@/lib/zod" (mensajes en español).' },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "generated/**",
    "next-env.d.ts",
    "tests/e2e/.data/**",
    "tests/e2e/.results/**",
    "tests/e2e/.report/**",
    ".lighthouseci/**",
  ]),
]);

export default eslintConfig;
