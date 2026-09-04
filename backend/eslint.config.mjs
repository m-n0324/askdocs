import js from "@eslint/js"
import { defineConfig, globalIgnores } from "eslint/config"
import tseslint from "typescript-eslint"

export default defineConfig([
    globalIgnores(["dist/**", "coverage/**", "src/generated/**"]),
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            // `_name` marks an intentionally unused variable (e.g. destructuring a field away)
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    destructuredArrayIgnorePattern: "^_",
                },
            ],
            "no-console": "error",
        },
    },
    {
        // env.ts runs before the logger exists, so it is the one place console is allowed
        files: ["src/config/env.ts"],
        rules: { "no-console": "off" },
    },
])
