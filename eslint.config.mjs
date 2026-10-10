import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Zod must be configured for the CSP first (src/lib/zod.ts); type-only imports are fine.
      "@typescript-eslint/no-restricted-imports": [
        "error",
        { paths: [{ name: "zod", message: 'Import { z } from "@/lib/zod".', allowTypeImports: true }] },
      ],
    },
  },
  {
    files: ["src/lib/zod.ts"],
    rules: { "@typescript-eslint/no-restricted-imports": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "src/types/database.ts", "supabase/.temp/**"]),
]);

export default eslintConfig;
