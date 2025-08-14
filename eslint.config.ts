import js from "@eslint/js"
import { globalIgnores } from "eslint/config"
import tseslint from 'typescript-eslint'

export default tseslint.config(
  globalIgnores(['dist', 'coverage']),
  js.configs.recommended,
  tseslint.configs.stylisticTypeChecked,
  tseslint.configs.strictTypeChecked,
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
