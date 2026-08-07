/**
 * @fileoverview Tests for the SCSS syntax.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import assert from "node:assert";
import fs from "node:fs/promises";
import {
	fork,
	generate as cssGenerate,
	parse as cssParse,
} from "@eslint/css-tree";
import { scss } from "../src/scss.js";

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const fixtureFilename = "./tests/fixtures/scss.scss";

/**
 * Creates a fresh SCSS syntax.
 * @returns {any} The forked syntax.
 */
function createSyntax() {
	return fork(scss);
}

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("SCSS", () => {
	let parse, generate, toPlainObject, walk, lexer;

	beforeEach(() => {
		({ parse, generate, toPlainObject, walk, lexer } = createSyntax());
	});

	/**
	 * Parses source text, turning any recovered parse error into a thrown one.
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

	/**
	 * Asserts that source text parses and regenerates to a stable result.
	 * @param {string} code The source text to parse.
	 * @returns {any} The generated text.
	 */
	function roundTrip(code) {
		const output = generate(strictParse(code));

		assert.strictEqual(
			generate(strictParse(output)),
			output,
			`Generated output did not reparse to itself: ${output}`,
		);

		return output;
	}

	/**
	 * Finds the first node of a type in the AST.
	 * @param {string} code The source text to parse.
	 * @param {string} type The node type to look for.
	 * @returns {any} The plain object form of the node.
	 */
	function findNode(code, type) {
		let found = null;

		walk(strictParse(code), {
			visit: type,
			enter(node) {
				found ??= node;
			},
		});

		assert.ok(found, `No ${type} node was found in: ${code}`);

		return toPlainObject(found);
	}

	it("should be a valid syntax extension", () => {
		strictParse("a { color: var(--foo); }");
	});

	it("should not report broken type definitions", () => {
		assert.strictEqual(lexer.validate(), null);
	});

	describe("Comments", () => {
		it("should treat // as a comment through the end of the line", () => {
			assert.strictEqual(
				roundTrip("// comment\n.a { color: red; }"),
				".a{color:red}",
			);
		});

		it("should treat // as a comment at the end of a declaration", () => {
			assert.strictEqual(
				roundTrip(".a { color: red; // why\n background: blue; }"),
				".a{color:red;background:blue}",
			);
		});

		it("should treat // as a comment at the end of the file", () => {
			assert.strictEqual(
				roundTrip(".a { color: red; }\n// trailing"),
				".a{color:red}",
			);
		});

		it("should not treat // inside a string as a comment", () => {
			assert.strictEqual(
				roundTrip('.a { content: "// not a comment"; }'),
				'.a{content:"// not a comment"}',
			);
		});

		it("should not treat // inside a url as a comment", () => {
			assert.strictEqual(
				roundTrip(".a { background: url(//cdn.example.com/a.png); }"),
				".a{background:url(//cdn.example.com/a.png)}",
			);
		});

		it("should report // comments to onComment", () => {
			const comments = [];

			parse("// hello\n.a { color: red; }", {
				positions: true,
				onComment(value) {
					comments.push(value);
				},
			});

			assert.deepStrictEqual(comments, [" hello"]);
		});
	});

	describe("Variables", () => {
		it("should parse a top-level variable declaration", () => {
			assert.deepStrictEqual(
				findNode("$primary: #333;", "ScssVariableDeclaration"),
				{
					type: "ScssVariableDeclaration",
					loc: null,
					namespace: null,
					name: "primary",
					value: {
						type: "Value",
						loc: null,
						children: [
							{
								type: "Hash",
								loc: null,
								value: "333",
							},
						],
					},
					default: false,
					global: false,
				},
			);
		});

		it("should parse the !default flag", () => {
			const node = findNode(
				"$a: 1px !default;",
				"ScssVariableDeclaration",
			);

			assert.strictEqual(node.default, true);
			assert.strictEqual(node.global, false);
		});

		it("should parse the !global flag", () => {
			const node = findNode(
				".a { $b: 1px !global; }",
				"ScssVariableDeclaration",
			);

			assert.strictEqual(node.default, false);
			assert.strictEqual(node.global, true);
		});

		it("should parse both flags together", () => {
			const node = findNode(
				"$a: 1px !default !global;",
				"ScssVariableDeclaration",
			);

			assert.strictEqual(node.default, true);
			assert.strictEqual(node.global, true);
		});

		it("should parse a namespaced variable declaration", () => {
			const node = findNode("config.$a: 1px;", "ScssVariableDeclaration");

			assert.strictEqual(node.namespace, "config");
			assert.strictEqual(node.name, "a");
		});

		it("should parse a variable reference in a value", () => {
			assert.deepStrictEqual(
				findNode(".a { color: $primary; }", "ScssVariable"),
				{
					type: "ScssVariable",
					loc: null,
					name: "primary",
					namespace: null,
				},
			);
		});

		it("should parse a namespaced variable reference", () => {
			assert.deepStrictEqual(
				findNode(".a { color: colors.$primary; }", "ScssVariable"),
				{
					type: "ScssVariable",
					loc: null,
					name: "primary",
					namespace: "colors",
				},
			);
		});

		it("should parse a variable declaration inside a block", () => {
			assert.strictEqual(
				roundTrip(".a { $b: 1px; width: $b; }"),
				".a{$b:1px;width:$b}",
			);
		});

		it("should record locations for variable declarations", () => {
			const ast = strictParse("$a: 1px;", { positions: true });
			const declaration = ast.children.first;

			assert.strictEqual(declaration.loc.start.offset, 0);
			assert.strictEqual(declaration.loc.end.offset, 7);
		});
	});

	describe("Interpolation", () => {
		it("should parse interpolation in a value", () => {
			assert.deepStrictEqual(
				findNode(".a { width: #{$w}; }", "ScssInterpolation"),
				{
					type: "ScssInterpolation",
					loc: null,
					children: [
						{
							type: "ScssVariable",
							loc: null,
							name: "w",
							namespace: null,
						},
					],
				},
			);
		});

		it("should parse interpolation in a selector", () => {
			assert.strictEqual(
				roundTrip("#{$sel} .b { color: red; }"),
				"#{$sel} .b{color:red}",
			);
		});

		it("should parse interpolation in a class selector", () => {
			assert.strictEqual(
				findNode(".icon-#{$name} { color: red; }", "ClassSelector")
					.name,
				"icon-#{$name}",
			);
		});

		it("should parse interpolation in a property name", () => {
			assert.strictEqual(
				findNode(".a { border-#{$side}-width: 1px; }", "Declaration")
					.property,
				"border-#{$side}-width",
			);
		});

		it("should treat an interpolated property as a declaration", () => {
			assert.strictEqual(
				roundTrip(".a { #{$prop}: red; }"),
				".a{#{$prop}:red}",
			);
		});

		it("should treat an interpolated selector as a rule", () => {
			assert.strictEqual(
				roundTrip(".a { #{$sel} { color: red; } }"),
				".a{#{$sel}{color:red}}",
			);
		});

		it("should parse the parent selector inside interpolation", () => {
			assert.strictEqual(
				roundTrip('.a { content: "#{&}"; b: #{&}; }'),
				'.a{content:"#{&}";b:#{&}}',
			);
		});

		it("should parse interpolation inside a function", () => {
			assert.strictEqual(
				roundTrip(".a { width: calc(100% - #{$gutter}); }"),
				".a{width:calc(100% - #{$gutter})}",
			);
		});
	});

	describe("Selectors", () => {
		it("should parse a placeholder selector", () => {
			assert.deepStrictEqual(
				findNode("%button { border: 0; }", "ScssPlaceholderSelector"),
				{
					type: "ScssPlaceholderSelector",
					loc: null,
					name: "button",
				},
			);
		});

		it("should parse a nested placeholder selector", () => {
			assert.strictEqual(
				roundTrip(".a { %b { color: red; } }"),
				".a{%b{color:red}}",
			);
		});

		it("should parse a parent selector with a suffix", () => {
			assert.strictEqual(
				roundTrip(".block { &__element { color: red; } }"),
				".block{&__element{color:red}}",
			);
		});

		it("should parse a parent selector with a modifier", () => {
			assert.strictEqual(
				roundTrip(".block { &--modifier { color: red; } }"),
				".block{&--modifier{color:red}}",
			);
		});

		it("should parse a parent selector with a pseudo-class", () => {
			assert.strictEqual(
				roundTrip(".a { &:hover { color: red; } }"),
				".a{&:hover{color:red}}",
			);
		});

		it("should still parse a declaration that looks like a selector", () => {
			assert.strictEqual(
				roundTrip(".a { color: red; }"),
				".a{color:red}",
			);
		});
	});

	describe("Nested properties", () => {
		it("should parse a nested property block", () => {
			assert.deepStrictEqual(
				findNode(
					".a { font: { family: serif; } }",
					"ScssNestedProperty",
				),
				{
					type: "ScssNestedProperty",
					loc: null,
					property: "font",
					value: null,
					block: {
						type: "Block",
						loc: null,
						children: [
							{
								type: "Declaration",
								loc: null,
								important: false,
								property: "family",
								value: {
									type: "Value",
									loc: null,
									children: [
										{
											type: "Identifier",
											loc: null,
											name: "serif",
										},
									],
								},
							},
						],
					},
				},
			);
		});

		it("should parse a nested property block with a value", () => {
			const node = findNode(
				".a { font: 12px/1.5 { family: serif; } }",
				"ScssNestedProperty",
			);

			assert.strictEqual(node.property, "font");
			assert.strictEqual(node.value.type, "Value");
			assert.strictEqual(node.block.children.length, 1);
		});

		it("should not treat a custom property block as nested properties", () => {
			assert.strictEqual(
				findNode(":root { --a: { b: c }; }", "Declaration").property,
				"--a",
			);
		});
	});

	describe("Expressions", () => {
		const expressions = [
			[".a { width: 1px + 2px; }", ".a{width:1px + 2px}"],
			[".a { width: $a - 1px; }", ".a{width:$a - 1px}"],
			[".a { width: $a * 2; }", ".a{width:$a*2}"],
			[".a { width: $a % 2; }", ".a{width:$a%2}"],
			[".a { width: (1px + 2px) * 3; }", ".a{width:(1px + 2px)*3}"],
			[".a { width: math.div(1, 2); }", ".a{width:math.div(1,2)}"],
			['.a { width: map.get($m, "k"); }', '.a{width:map.get($m,"k")}'],
			["$m: (a: 1, b: 2);", "$m:(a:1,b:2)"],
			["$l: [1, 2, 3];", "$l:[1,2,3]"],
		];

		for (const [code, expected] of expressions) {
			it(`should parse ${code}`, () => {
				assert.strictEqual(roundTrip(code), expected);
			});
		}

		it("should fold the namespace into the function name", () => {
			assert.strictEqual(
				findNode(".a { b: math.div(1, 2); }", "Function").name,
				"math.div",
			);
		});
	});

	describe("At-rules", () => {
		const atrules = [
			['@use "sass:math";', '@use "sass:math";'],
			['@use "x" as y;', '@use "x"as y;'],
			['@use "x" as *;', '@use "x"as*;'],
			['@use "x" with ($a: 1);', '@use "x"with ($a:1);'],
			['@forward "x" show $a, b;', '@forward "x"show$a,b;'],
			['@forward "x" hide $a;', '@forward "x"hide$a;'],
			['@forward "x" as y-*;', '@forward "x"as y-*;'],
			['@import "a", "b";', '@import "a","b";'],
			['@import "a";', '@import "a";'],
			[
				"@mixin m($a, $b: 1px) { color: $a; }",
				"@mixin m($a,$b:1px){color:$a}",
			],
			[
				"@mixin m($args...) { color: red; }",
				"@mixin m($args...){color:red}",
			],
			[".a { @include m; }", ".a{@include m;}"],
			[".a { @include m(1px); }", ".a{@include m(1px);}"],
			[".a { @include m { color: red; } }", ".a{@include m{color:red}}"],
			[
				".a { @include m using ($x) { color: $x; } }",
				".a{@include m using ($x){color:$x}}",
			],
			["@mixin m { @content; }", "@mixin m{@content;}"],
			["@mixin m { @content(1px); }", "@mixin m{@content (1px);}"],
			["@function f($a) { @return $a; }", "@function f($a){@return$a;}"],
			[".a { @debug $x; }", ".a{@debug$x;}"],
			['.a { @warn "x"; }', '.a{@warn "x";}'],
			['.a { @error "x"; }', '.a{@error "x";}'],
			[".a { @extend .b; }", ".a{@extend.b;}"],
			[".a { @extend %b !optional; }", ".a{@extend%b!optional;}"],
			["@at-root .b { color: red; }", "@at-root.b{color:red}"],
			[
				".a { @at-root (without: media) { color: red; } }",
				".a{@at-root (without:media){color:red}}",
			],
		];

		for (const [code, expected] of atrules) {
			it(`should parse ${code}`, () => {
				assert.strictEqual(roundTrip(code), expected);
			});
		}

		it("should allow nested rules inside a mixin", () => {
			const ast = strictParse(
				"@mixin m { color: red; .b { color: blue; } }",
			);
			const types = [];

			walk(ast, {
				enter(node) {
					types.push(node.type);
				},
			});

			assert.ok(types.includes("Rule"), "Expected a nested Rule node");
		});

		it("should allow an at-rule to end a block without a semicolon", () => {
			assert.strictEqual(
				roundTrip(".a { @include m($b...) }"),
				".a{@include m($b...);}",
			);
		});

		it("should parse an @extend prelude as a selector list", () => {
			const atrule = findNode(".a { @extend .b, .c; }", "Atrule");
			const selectorList = atrule.prelude.children[0];

			assert.strictEqual(selectorList.type, "SelectorList");
			assert.strictEqual(selectorList.children.length, 2);
		});
	});

	describe("Flow control", () => {
		const flows = [
			[".a { @if $x == 1 { color: red; } }", ".a{@if$x==1{color:red}}"],
			[
				".a { @if $x != 1 { color: red; } @else { color: blue; } }",
				".a{@if$x!=1{color:red}@else{color:blue}}",
			],
			[
				".a { @if $x > 1 { color: red; } @else if $x <= 2 { color: blue; } }",
				".a{@if$x>1{color:red}@else if$x<=2{color:blue}}",
			],
			[
				".a { @if not $x and $y or $z { color: red; } }",
				".a{@if not$x and$y or$z{color:red}}",
			],
			[
				"@each $k, $v in $map { .a { b: $v; } }",
				"@each$k,$v in$map{.a{b:$v}}",
			],
			[
				"@for $i from 1 through 3 { .a { b: $i; } }",
				"@for$i from 1 through 3{.a{b:$i}}",
			],
			[
				"@for $i from 1 to 3 { .a { b: $i; } }",
				"@for$i from 1 to 3{.a{b:$i}}",
			],
			["@while $i > 0 { .a { b: $i; } }", "@while$i>0{.a{b:$i}}"],
		];

		for (const [code, expected] of flows) {
			it(`should parse ${code}`, () => {
				assert.strictEqual(roundTrip(code), expected);
			});
		}
	});

	describe("Media queries", () => {
		const queries = [
			[
				"@media (min-width: $w) { .a { b: c; } }",
				"@media (min-width:$w){.a{b:c}}",
			],
			[
				"@media (min-width: map.get($m, small)) { .a { b: c; } }",
				"@media (min-width:map.get($m,small)){.a{b:c}}",
			],
			["@media #{$q} { .a { b: c; } }", "@media#{$q}{.a{b:c}}"],
			[
				"@media screen and (min-width: $w) { .a { b: c; } }",
				"@media screen and (min-width:$w){.a{b:c}}",
			],
			[
				"@supports (display: $d) { .a { b: c; } }",
				"@supports (display:$d){.a{b:c}}",
			],
		];

		for (const [code, expected] of queries) {
			it(`should parse ${code}`, () => {
				assert.strictEqual(roundTrip(code), expected);
			});
		}
	});

	describe("Lexer", () => {
		/**
		 * Matches the first declaration in the source text.
		 * @param {string} code The source text to parse.
		 * @returns {any} The match result.
		 */
		function matchFirstDeclaration(code) {
			let result = null;

			walk(strictParse(code), {
				visit: "Declaration",
				enter(node) {
					result ??= lexer.matchDeclaration(node);
				},
			});

			return result;
		}

		const valid = [
			".a { color: $primary; }",
			".a { color: colors.$primary; }",
			".a { border: 1px solid $c; }",
			".a { width: math.div(100%, 3); }",
			".a { width: calc(100% - #{$g}); }",
			".a { color: rgba($c, 0.5); }",
			".a { color: red; }",
			".a { width: 1px; }",
		];

		for (const code of valid) {
			it(`should accept ${code}`, () => {
				assert.strictEqual(matchFirstDeclaration(code).error, null);
			});
		}

		const invalid = [".a { color: bogus; }", ".a { width: notalength; }"];

		for (const code of invalid) {
			it(`should reject ${code}`, () => {
				assert.ok(matchFirstDeclaration(code).error);
			});
		}

		it("should accept every SCSS at-rule prelude", () => {
			const code = [
				'@use "sass:math";',
				'@forward "x" show $a;',
				'@import "a", "b";',
				"@mixin m($a) { color: red; }",
				"@function f($a) { color: red; }",
				".a { @include m(1); }",
				".a { @extend .b !optional; }",
				"@mixin n { @content; }",
				".a { @if $x { color: red; } @else { color: blue; } }",
				"@each $k in $l { .a { b: c; } }",
				"@for $i from 1 through 3 { .a { b: c; } }",
				"@while $i { .a { b: c; } }",
				"@at-root { .a { b: c; } }",
				'.a { @debug "x"; @warn "x"; @error "x"; }',
			].join("\n");

			walk(strictParse(code), {
				visit: "Atrule",
				enter(node) {
					const { error } = lexer.matchAtrulePrelude(
						node.name,
						node.prelude,
					);

					assert.strictEqual(
						error,
						null,
						`@${node.name}: ${error?.message}`,
					);
				},
			});
		});
	});

	describe("CSS compatibility", () => {
		const css = [
			'@charset "utf-8";',
			'@import url("a.css") layer(base) supports(display: grid) screen and (min-width: 400px);',
			"@media screen and (min-width: 100px), print { .a > .b + .c ~ .d { color: red; } }",
			":root { --x: 1px; --y: { a: b }; }",
			'a:not(.b):nth-child(2n+1)::after { content: "x"; }',
			"@supports (display: grid) and (not (display: inline-grid)) { .a { color: red } }",
			'@font-face { font-family: "X"; src: url(a.woff2) format("woff2"); }',
			"@keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }",
			".hack { *zoom: 1; }",
			"@layer base, components;",
			'.grid { grid-template-areas: "a b"; grid-area: 1 / 2 / 3 / 4; }',
			".a { background: url(http://example.com/a.png) no-repeat; }",
		].join("\n");

		/*
		 * Plain `parse` is used here rather than `strictParse` because CSSTree
		 * recovers from a few things in this sample on its own. What matters is
		 * that SCSS recovers from exactly the same ones.
		 */
		it("should generate the same output as plain CSS", () => {
			assert.strictEqual(
				generate(parse(css)),
				cssGenerate(cssParse(css)),
			);
		});

		it("should recover from the same things as plain CSS", () => {
			const scssErrors = [];
			const cssErrors = [];

			parse(css, {
				onParseError(error) {
					scssErrors.push(error.message);
				},
			});
			cssParse(css, {
				onParseError(error) {
					cssErrors.push(error.message);
				},
			});

			assert.deepStrictEqual(scssErrors, cssErrors);
		});
	});

	describe("Fixture", () => {
		it("should parse without errors", async () => {
			const code = await fs.readFile(fixtureFilename, "utf8");
			const errors = [];

			const ast = parse(code, {
				filename: fixtureFilename,
				positions: true,
				onParseError(error) {
					errors.push(error);
				},
			});

			assert.deepStrictEqual(
				errors.map(
					error => `${error.line}:${error.column} ${error.message}`,
				),
				[],
			);

			assert.strictEqual(lexer.checkStructure(ast), false);
		});

		it("should regenerate to a stable result", async () => {
			const code = await fs.readFile(fixtureFilename, "utf8");

			roundTrip(code);
		});
	});
});
