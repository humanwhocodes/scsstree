/**
 * @fileoverview The ScssVariable node.
 * Represents an SCSS variable reference such as `$primary` or the namespaced
 * form `colors.$primary`.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { tokenTypes } from "../token-types.js";
import { DOLLAR_SIGN, FULL_STOP } from "../char-codes.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @import { NodeSyntaxConfig } from "@eslint/css-tree";
 */

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export const name = "ScssVariable";

/** @type {NodeSyntaxConfig["structure"]} */
export const structure = {
	name: String,
	namespace: [String, null],
};

/**
 * Parses a variable reference.
 * @this {any}
 * @returns {any} The `ScssVariable` node.
 */
export function parse() {
	const start = this.tokenStart;
	let namespace = null;

	if (this.tokenType === tokenTypes.Ident) {
		namespace = this.consume(tokenTypes.Ident);
		this.eatDelim(FULL_STOP);
	}

	this.eatDelim(DOLLAR_SIGN);

	const variableName = this.consume(tokenTypes.Ident);

	return {
		type: name,
		loc: this.getLocation(start, this.tokenStart),
		name: variableName,
		namespace,
	};
}

/**
 * Generates the source text for a variable reference.
 * @this {any}
 * @param {any} node The node to generate.
 * @returns {void}
 */
export function generate(node) {
	if (node.namespace) {
		this.token(tokenTypes.Ident, node.namespace);
		this.token(tokenTypes.Delim, ".");
	}

	this.token(tokenTypes.Delim, "$");
	this.token(tokenTypes.Ident, node.name);
}
