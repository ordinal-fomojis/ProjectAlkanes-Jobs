import js from "@eslint/js"
import { defineConfig, globalIgnores } from "eslint/config"
import tseslint from 'typescript-eslint'

export default defineConfig(
  globalIgnores(['dist', 'coverage']),
  js.configs.recommended,
  tseslint.configs.stylisticTypeChecked,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['vitest.config.ts', 'eslint.config.ts', 'plopfile.ts']
        },
        tsconfigRootDir: import.meta.dirname
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", {
        destructuredArrayIgnorePattern: "^_",
        ignoreRestSiblings: true,
      }],
      "@typescript-eslint/restrict-template-expressions": ["error", {
        allowNumber: true
      }]
    }
  },
  {
    files: ['tests/**/*'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
    }
  }
)
