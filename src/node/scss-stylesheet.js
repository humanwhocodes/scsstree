/**
 * @fileoverview Overrides `StyleSheet` parsing to support SCSS.
 *
 * SCSS allows variable declarations at the top level of a file, which CSS has
 * no equivalent for.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { tokenTypes } from "../token-types.js";
import { ASTERISK, EXCLAMATION_MARK } from "../char-codes.js";
import { isVariableStart } from "../util/parser.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @import { NodeSyntaxConfig } from "@eslint/css-tree";
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/** @this {any} */
function consumeRaw() {
	return this.Raw(null, false);
}

/** @this {any} */
function consumeRawDeclaration() {
	return this.Raw(this.consumeUntilSemicolonIncluded, true);
}

/** @this {any} */
function consumeDeclaration() {
	const node = this.parseWithFallback(
		this.Declaration,
		consumeRawDeclaration,
	);

	if (this.tokenType === tokenTypes.Semicolon) {
		this.next();
	}

	return node;
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export const name = "StyleSheet";
export const walkContext = "stylesheet";

/** @type {NodeSyntaxConfig["structure"]} */
export const structure = {
	children: [
		[
			"Comment",
			"CDO",
			"CDC",
			"Atrule",
			"Rule",
			"Raw",
			"ScssVariableDeclaration",
		],
	],
};

/**
 * Parses a stylesheet.
 * @this {any}
 * @returns {any} The `StyleSheet` node.
 */
export function parse() {
	const start = this.tokenStart;
	const children = this.createList();
	let child;

	while (!this.eof) {
		switch (this.tokenType) {
			case tokenTypes.WhiteSpace:
				this.next();
				continue;

			case tokenTypes.Comment:
				/*
				 * Only `/*! ... ` comments are preserved at the top level. A
				 * `//` comment is never one of those, so check the opener too.
				 */
				if (
					this.charCodeAt(this.tokenStart + 1) !== ASTERISK ||
					this.charCodeAt(this.tokenStart + 2) !== EXCLAMATION_MARK
				) {
					this.next();
					continue;
				}

				child = this.Comment();
				break;

			case tokenTypes.CDO:
				child = this.CDO();
				break;

			case tokenTypes.CDC:
				child = this.CDC();
				break;

			case tokenTypes.AtKeyword:
				child = this.parseWithFallback(this.Atrule, consumeRaw);
				break;

			default:
				child = isVariableStart(this)
					? consumeDeclaration.call(this)
					: this.parseWithFallback(this.Rule, consumeRaw);
		}

		children.push(child);
	}

	return {
		type: "StyleSheet",
		loc: this.getLocation(start, this.tokenStart),
		children,
	};
}

/**
 * Generates the source text for a stylesheet.
 * @this {any}
 * @param {any} node The node to generate.
 * @returns {void}
 */
export function generate(node) {
	this.children(node, (/** @type {any} */ prev) => {
		if (prev.type === "ScssVariableDeclaration") {
			this.token(tokenTypes.Semicolon, ";");
		}
	});
}
