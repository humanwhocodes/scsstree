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

	it("should still parse a CSS @import", () => {
		assert.strictEqual(
			generate(parse('@import url("a.css") layer(base) screen;')),
			"@import url(a.css)layer(base) screen;",
		);
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
