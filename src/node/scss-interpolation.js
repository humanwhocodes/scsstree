/**
 * @fileoverview The ScssInterpolation node.
 * Represents `#{...}` interpolation, which SCSS allows in selectors, property
 * names, values, and at-rule preludes. The contents are always an SCSS
 * expression, regardless of where the interpolation appears.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { tokenTypes } from "../token-types.js";
import { NUMBER_SIGN } from "../char-codes.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @import { NodeSyntaxConfig } from "@eslint/css-tree";
 */

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export const name = "ScssInterpolation";

/** @type {NodeSyntaxConfig["structure"]} */
export const structure = {
	children: [[]],
};

/**
 * Parses an interpolation.
 * @this {any}
 * @returns {any} The `ScssInterpolation` node.
 */
export function parse() {
	const start = this.tokenStart;

	this.eatDelim(NUMBER_SIGN);
	this.eat(tokenTypes.LeftCurlyBracket);

	const children = this.readSequence(this.scope.Value);

	if (!this.eof) {
		this.eat(tokenTypes.RightCurlyBracket);
	}

	return {
		type: name,
		loc: this.getLocation(start, this.tokenStart),
		children,
	};
}

/**
 * Generates the source text for an interpolation.
 * @this {any}
 * @param {any} node The node to generate.
 * @returns {void}
 */
export function generate(node) {
	this.token(tokenTypes.Delim, "#");
	this.token(tokenTypes.LeftCurlyBracket, "{");
	this.children(node);
	this.token(tokenTypes.RightCurlyBracket, "}");
}
