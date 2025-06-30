import js from "@eslint/js"
import { globalIgnores } from "eslint/config"
import tseslint from 'typescript-eslint'

export default tseslint.config(
  globalIgnores(['dist']),
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  // tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['vitest.config.ts', 'eslint.config.ts']
        },
        tsconfigRootDir: import.meta.dirname
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", {
        destructuredArrayIgnorePattern: "^_",
        ignoreRestSiblings: true,
      }],
    }
  },
  {
    files: ['tests/**/*'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
    }
  }
)
