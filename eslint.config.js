import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import tseslintPlugin from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import pluginReact from "eslint-plugin-react";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import stylistic from "@stylistic/eslint-plugin";

export default [
	{
		languageOptions: {
			globals: globals.jasmine
		}
	},
	{
		ignores: ["package-lock.json", "**/node_modules/**", "**/dist/**", "**/build/**", "*/image/**"]
	},
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
		languageOptions: { globals: globals.node }
	},
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
		...js.configs.recommended
	},
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
		languageOptions: { globals: globals.browser }
	},
	...tseslint.configs.recommended.map(config => ({
		...config,
		files: ["**/*.{ts,tsx,mts,cts}"]
	})),
	{
		files: ["**/*.{jsx,tsx}"],
		...pluginReact.configs.flat.recommended,
		settings: {
			react: {
				version: "detect"
			}
		}
	},
	{
		...json.configs.recommended,
		files: ["**/*.json"],
		ignores: ["tsconfig.json"],
		language: "json/json"
	},
	...markdown.configs.recommended,
	{
		...css.configs.recommended,
		files: ["**/*.css"],
		language: "css/css"
	},
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
		plugins: {
			"@stylistic": stylistic
		}
	},
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
		rules: {
			"@stylistic/indent": ["error", "tab"],
			"@stylistic/quotes": ["error", "double"],
			"@stylistic/semi": ["error", "always"],
			"@stylistic/comma-dangle": ["error"],
			"@stylistic/member-delimiter-style": ["error", {
				multiline: {
					delimiter: "semi",
					requireLast: true
				},
				singleline: {
					delimiter: "semi",
					requireLast: false
				}
			}]
		}
	},
	{
		files: ["**/*.ts", "**/*.tsx"],
		rules: {
			"@typescript-eslint/no-unused-vars": ["error", {
				"argsIgnorePattern": "^_",
				"varsIgnorePattern": "^_",
				"caughtErrorsIgnorePattern": "^_"
			}]
		},
		languageOptions: {
			parser: tsparser
		},
		plugins: {
			"@typescript-eslint": tseslintPlugin
		}
	}
];
