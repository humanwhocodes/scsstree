/**
 * @fileoverview Overrides `Function` generation so that namespaced calls such
 * as `math.div(1, 2)` are emitted as the three tokens they were parsed from
 * rather than one function token named `math.div(`.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { tokenTypes } from "../token-types.js";

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export const name = "Function";
export const walkContext = "function";

/** @type {any} */
export const structure = {
	name: String,
	children: [[]],
};

/**
 * Generates the source text for a function call.
 * @this {any}
 * @param {any} node The node to generate.
 * @returns {void}
 */
export function generate(node) {
	const separator = node.name.lastIndexOf(".");

	if (separator === -1) {
		this.token(tokenTypes.Function, `${node.name}(`);
	} else {
		this.token(tokenTypes.Ident, node.name.slice(0, separator));
		this.token(tokenTypes.Delim, ".");
		this.token(tokenTypes.Function, `${node.name.slice(separator + 1)}(`);
	}

	this.children(node);
	this.token(tokenTypes.RightParenthesis, ")");
}
