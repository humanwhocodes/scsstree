/**
 * @fileoverview Overrides `ClassSelector` parsing to allow interpolation.
 * SCSS permits `.#{$name}` and `.icon-#{$name}-large` wherever a class
 * selector is allowed.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { tokenTypes } from "../token-types.js";
import { FULL_STOP } from "../char-codes.js";
import { isInterpolationStart, skipInterpolation } from "../util/parser.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @import { NodeSyntaxConfig } from "@eslint/css-tree";
 */

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export const name = "ClassSelector";

/** @type {NodeSyntaxConfig["structure"]} */
export const structure = {
	name: String,
};

/**
 * Parses a class selector.
 * @this {any}
 * @returns {any} The `ClassSelector` node.
 */
export function parse() {
	const start = this.tokenStart;

	this.eatDelim(FULL_STOP);

	const nameStart = this.tokenStart;

	do {
		if (isInterpolationStart(this)) {
			skipInterpolation(this);
		} else {
			this.eat(tokenTypes.Ident);
		}
	} while (this.tokenType === tokenTypes.Ident || isInterpolationStart(this));

	return {
		type: name,
		loc: this.getLocation(start, this.tokenStart),
		name: this.substrToCursor(nameStart),
	};
}

/**
 * Generates the source text for a class selector.
 * @this {any}
 * @param {any} node The node to generate.
 * @returns {void}
 */
export function generate(node) {
	this.token(tokenTypes.Delim, ".");
	this.token(tokenTypes.Ident, node.name);
}
