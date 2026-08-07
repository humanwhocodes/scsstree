import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import css from "@eslint/css";
import { scss } from "./src/scss.js";

export default defineConfig([
	globalIgnores(["dist"]),
	{
		files: ["**/*.js"],
		plugins: {
			js,
		},
		extends: ["js/recommended"],
	},
	{
		files: ["tests/**/*.js"],
		languageOptions: {
			globals: {
				describe: false,
				it: false,
				beforeEach: false,
				afterEach: false,
				setTimeout: false,
				AbortSignal: false,
				AbortController: false,
			},
		},
	},
	{
		files: ["**/*.css"],
		plugins: {
			css,
		},
		language: "css/css",
		extends: ["css/recommended"],
	},
	{
		files: ["tests/fixtures/*.scss"],
		plugins: {
			css,
		},
		language: "css/css",
		extends: ["css/recommended"],
		languageOptions: {
			customSyntax: scss,
		},
		rules: {
			/*
			 * These two rules reason about CSS semantics that SCSS doesn't
			 * share: `@use` and `@forward` legitimately precede `@import`, and
			 * SCSS's `@function` is unrelated to the CSS at-rule of the same
			 * name that browsers are still shipping.
			 */
			"css/no-invalid-at-rule-placement": "off",
			"css/use-baseline": "off",
		},
	},
]);
