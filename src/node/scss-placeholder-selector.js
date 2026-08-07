/**
 * @fileoverview The ScssPlaceholderSelector node.
 * Represents a placeholder selector such as `%button`, which is only emitted
 * into the compiled CSS when it's extended.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { tokenTypes } from "../token-types.js";
import { PERCENT_SIGN } from "../char-codes.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @import { NodeSyntaxConfig } from "@eslint/css-tree";
 */

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export const name = "ScssPlaceholderSelector";

/** @type {NodeSyntaxConfig["structure"]} */
export const structure = {
	name: String,
};

/**
 * Parses a placeholder selector.
 * @this {any}
 * @returns {any} The `ScssPlaceholderSelector` node.
 */
export function parse() {
	const start = this.tokenStart;

	this.eatDelim(PERCENT_SIGN);

	const selectorName = this.consume(tokenTypes.Ident);

	return {
		type: name,
		loc: this.getLocation(start, this.tokenStart),
		name: selectorName,
	};
}

/**
 * Generates the source text for a placeholder selector.
 * @this {any}
 * @param {any} node The node to generate.
 * @returns {void}
 */
export function generate(node) {
	// combined into one token so no whitespace is inserted after the `%`
	this.token(tokenTypes.Delim, "%" + node.name);
}
