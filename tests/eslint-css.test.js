/**
 * @fileoverview Tests for use with the ESLint CSS plugin.
 *
 * The plugin doesn't hand the extension the syntax it's extending. It calls it
 * with just the CSS definition data and merges whatever comes back into the
 * default syntax, so the extension has to hold up without a complete `prev`.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import assert from "node:assert";
import fs from "node:fs/promises";
import { fork } from "@eslint/css-tree";
import definitionSyntaxData from "@eslint/css-tree/definition-syntax-data";
import { ESLint } from "eslint";
import css from "@eslint/css";
import { scss } from "../src/scss.js";

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const fixtureFilename = "./tests/fixtures/scss.scss";

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("ESLint CSS plugin compatibility", () => {
	let parse, generate, lexer;

	beforeEach(() => {
		// this is what @eslint/css does with a `customSyntax` function
		({ parse, generate, lexer } = fork(scss(definitionSyntaxData)));
	});

	/**
	 * Parses without allowing recovery to hide invalid syntax.
	 * @param {string} code The source text to parse.
	 * @param {object} [options] Options to pass to the parser.
	 * @returns {any} The AST.
	 */
	function strictParse(code, options = {}) {
		return parse(code, {
			...options,
			onParseError(error) {
				throw error;
			},
		});
	}

	it("should produce a syntax with no broken types", () => {
		assert.strictEqual(lexer.validate(), null);
	});

	it("should parse SCSS", () => {
		assert.strictEqual(
			generate(parse("$a: 1px; .b { width: $a; }")),
			"$a:1px;.b{width:$a}",
		);
	});

	it("should support single-line comments", () => {
		assert.strictEqual(
			generate(parse("// comment\n.a { color: red; }")),
			".a{color:red}",
		);
	});

	it("should preserve rules after unmatched quotes and CSS constructs in line comments (#2)", async () => {
		const code = '// unmatched " quote\r\n// /*\n.a { color: red; }';
		const ast = strictParse(code, { positions: true });

		assert.strictEqual(generate(ast), ".a{color:red}");
		assert.strictEqual(
			generate(strictParse(generate(ast))),
			".a{color:red}",
		);
		assert.strictEqual(
			ast.children.first.loc.start.offset,
			code.indexOf(".a"),
		);

		const eslint = new ESLint({
			overrideConfigFile: true,
			overrideConfig: [
				{
					files: ["**/*.scss"],
					plugins: { css },
					language: "css/css",
					languageOptions: { customSyntax: scss },
					rules: { "css/no-invalid-at-rules": "error" },
				},
			],
		});
		const [result] = await eslint.lintText(code, { filePath: "test.scss" });

		assert.deepStrictEqual(result.messages, []);
	});

	it("should preserve complete interpolated class names and selector boundaries (#3)", () => {
		const code = ".#{$prefix}-#{$name} > .child { color: red; }";
		const ast = strictParse(code, { positions: true });
		const selector = ast.children.first.prelude.children.first;
		const first = selector.children.first;
		const output = generate(ast);

		assert.strictEqual(first.type, "ClassSelector");
		assert.strictEqual(first.name, "#{$prefix}-#{$name}");
		assert.strictEqual(first.loc.end.offset, code.indexOf(" >"));
		assert.strictEqual(selector.children.last.name, "child");
		assert.strictEqual(output, ".#{$prefix}-#{$name}>.child{color:red}");
		assert.strictEqual(generate(strictParse(output)), output);
	});

	const names = [
		"--#{$prefix}form-invalid-border-color",
		"--#{$prefix}2-color",
		"--#{$prefix}-#{$name}",
		"--#{$prefix}2",
		"--#{$prefix}-",
		"--#{$prefix}2e-3",
		"--#{$prefix}2\\32 color",
		'-#{"-theme-color"}',
		"-#{$name}-color",
	];

	for (const name of names) {
		it(`should strictly round-trip var(${name})`, () => {
			const code = `.a { border-color: var(${name}); }`;

			for (const parseCustomProperty of [false, true]) {
				const options = { parseCustomProperty };
				const ast = strictParse(code, options);
				const value = ast.children.first.block.children.first.value;
				const fn = value.children.first;
				const output = generate(ast);

				assert.strictEqual(value.type, "Value");
				assert.strictEqual(fn.type, "Function");
				assert.strictEqual(fn.children.first.type, "Identifier");
				assert.strictEqual(fn.children.first.name, name);
				assert.strictEqual(output, `.a{border-color:var(${name})}`);
				assert.strictEqual(
					generate(strictParse(output, options)),
					output,
				);
			}
		});
	}

	for (const value of [
		"var(--#{$prefix}+2)",
		"var(--#{$prefix}2.5px)",
		"var(--#{$prefix}/**/color)",
		"var(--#{foo)})",
		"var(--#{$prefix)",
		"var(- #{$name})",
		"var(-/**/#{$name})",
	]) {
		it(`should report invalid var() syntax: ${value}`, () => {
			assert.throws(() => strictParse(`.a { color: ${value}; }`));
		});
	}

	it("should parse nested interpolated var() fallbacks", () => {
		const code =
			".a { color: var(--#{$prefix}2-color, var(--#{$prefix}-#{$name}, red)); }";
		const options = { parseCustomProperty: true };
		const ast = strictParse(code, options);
		const fn = ast.children.first.block.children.first.value.children.first;
		const fallback = fn.children.last;
		const output = generate(ast);

		assert.strictEqual(fallback.type, "Value");
		assert.strictEqual(fallback.children.first.type, "Function");
		assert.strictEqual(
			fallback.children.first.children.first.name,
			"--#{$prefix}-#{$name}",
		);
		assert.strictEqual(generate(strictParse(output, options)), output);
	});

	it("should lint interpolated var() names using the reported ESLint configuration", async () => {
		const eslint = new ESLint({
			overrideConfigFile: true,
			overrideConfig: [
				{
					files: ["**/*.scss"],
					plugins: { css },
					language: "css/css",
					languageOptions: { customSyntax: scss },
				},
			],
		});

		for (const name of names) {
			const [result] = await eslint.lintText(
				`.a { border-color: var(${name}); }`,
				{ filePath: "test.scss" },
			);

			assert.deepStrictEqual(result.messages, [], name);
			assert.strictEqual(result.fatalErrorCount, 0);
		}

		const [invalid] = await eslint.lintText(
			".a { color: var(--#{foo)}); }",
			{ filePath: "test.scss" },
		);
		assert.ok(invalid.fatalErrorCount > 0);
	});

	it("should distinguish unknown-variable lint diagnostics from parsing errors", async () => {
		for (const allowUnknownVariables of [false, true]) {
			const eslint = new ESLint({
				overrideConfigFile: true,
				overrideConfig: [
					{
						files: ["**/*.scss"],
						plugins: { css },
						language: "css/css",
						languageOptions: { customSyntax: scss },
						rules: {
							"css/no-invalid-properties": [
								"error",
								{ allowUnknownVariables },
							],
						},
					},
				],
			});
			const [result] = await eslint.lintText(
				".a { border-color: var(--#{$prefix}2-color); }",
				{ filePath: "test.scss" },
			);

			assert.strictEqual(result.fatalErrorCount, 0);
			if (allowUnknownVariables) {
				assert.deepStrictEqual(result.messages, []);
			} else {
				assert.strictEqual(result.messages.length, 1);
				assert.strictEqual(
					result.messages[0].ruleId,
					"css/no-invalid-properties",
				);
				assert.strictEqual(result.messages[0].messageId, "unknownVar");
			}
		}
	});

	for (const query of [
		"media (min-width: 10px)",
		"supports (display: grid)",
		"container (min-width: 10px)",
	]) {
		it(`should parse mixed conditional blocks with definition-only input: @${query} (#4)`, () => {
			const code = `.parent { @${query} { color: blue; .child { color: red; } } }`;
			const ast = strictParse(code);
			const block = ast.children.first.block.children.first.block;
			const output = generate(ast);

			assert.deepStrictEqual(
				block.children.toArray().map(node => node.type),
				["Declaration", "Rule"],
			);
			assert.strictEqual(
				block.children.last.prelude.children.first.children.first.name,
				"child",
			);
			assert.strictEqual(generate(strictParse(output)), output);
		});
	}

	it("should still parse a CSS @import", () => {
		assert.strictEqual(
			generate(parse('@import url("a.css") layer(base) screen;')),
			"@import url(a.css)layer(base) screen;",
		);
	});

	for (const [query, nodeType] of [
		["supports ((display: grid) or (display: flex))", "Condition"],
		["container style(--theme: dark)", "GeneralEnclosed"],
		["container scroll-state(stuck: top)", "GeneralEnclosed"],
		["container (min(100px, 10vw) <= width)", "FeatureRange"],
	]) {
		it(`should parse condition grammar with definition-only input: @${query} (#5/#6)`, async () => {
			const code = `@${query} { .a { color: red; } }`;
			const ast = strictParse(code);
			const term =
				ast.children.first.prelude.children.first.children.first;
			const output = generate(ast);

			assert.strictEqual(term.type, nodeType);
			assert.strictEqual(lexer.checkStructure(ast), false);
			assert.strictEqual(generate(strictParse(output)), output);

			const eslint = new ESLint({
				overrideConfigFile: true,
				overrideConfig: [
					{
						files: ["**/*.scss"],
						plugins: { css },
						language: "css/css",
						languageOptions: { customSyntax: scss },
						rules: { "css/no-invalid-at-rules": "error" },
					},
				],
			});
			const [result] = await eslint.lintText(code, {
				filePath: "test.scss",
			});

			assert.deepStrictEqual(result.messages, []);
		});
	}

	for (const code of [
		'// unmatched " quote\n.a { color: red; }',
		"//****\n// Section\n//****\n.a { color: red; }",
		".#{$prefix}-#{$name} { color: red; }",
		".#{$fa-css-prefix}-2x { color: red; }",
		".#{$prefix}-2\u00e9:hover { color: red; }",
		String.raw`.#{$prefix}-2\78:hover { color: red; }`,
		String.raw`.#{$prefix}-2\000078 :hover { color: red; }`,
		".#{$prefix}1e2\u00e9.b { color: red; }",
		".parent { @media (min-width: 10px) { color: blue; .child { color: red; } } }",
		".parent { @supports (display: grid) { color: blue; .child { color: red; } } }",
		".parent { @container (min-width: 10px) { color: blue; .child { color: red; } } }",
		"@supports ((display: grid) or (display: flex)) { .a { color: red; } }",
		"@container theme style(--theme: dark) { .a { color: red; } }",
		"@container scroll-state(stuck: top) { .a { color: red; } }",
		"@media (calc(1px + 2px) < width) { .a { color: red; } }",
		"@container (min(100px, 10vw) <= width) { .a { color: red; } }",
	]) {
		it(`should produce identical ASTs through both syntax input shapes: ${code}`, () => {
			const direct = fork(scss);
			const definitionOnly = fork(scss(definitionSyntaxData));
			const options = {
				positions: true,
				onParseError(error) {
					throw error;
				},
			};

			assert.deepStrictEqual(
				direct.toPlainObject(direct.parse(code, options)),
				definitionOnly.toPlainObject(
					definitionOnly.parse(code, options),
				),
			);
		});
	}

	it("should use the same conditional at-rule preludes for both input shapes", () => {
		let fullSyntax;

		fork(prev => {
			fullSyntax = prev;
			return scss(prev);
		});

		const direct = scss(fullSyntax);
		const definitionOnly = scss(definitionSyntaxData);

		for (const name of ["media", "supports", "container"]) {
			assert.strictEqual(
				direct.atrule[name].parse.prelude,
				definitionOnly.atrule[name].parse.prelude,
				`@${name} uses a different prelude parser`,
			);
		}
	});

	it("should parse the fixture without errors", async () => {
		const code = await fs.readFile(fixtureFilename, "utf8");
		const errors = [];

		parse(code, {
			filename: fixtureFilename,
			positions: true,
			onParseError(error) {
				errors.push(`${error.line}:${error.column} ${error.message}`);
			},
		});

		assert.deepStrictEqual(errors, []);
	});
});
