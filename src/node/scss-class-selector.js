/**
 * @fileoverview Overrides `ClassSelector` parsing to allow interpolation.
 * SCSS permits `.#{$name}`, `.icon-#{$name}-large`, and `.#{$prefix}-2x`
 * wherever a class selector is allowed.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { tokenTypes } from "../token-types.js";
import { FULL_STOP, HYPHEN_MINUS } from "../char-codes.js";
import {
	identifierFragment,
	isInterpolationStart,
	skipInterpolation,
} from "../util/parser.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @import { NodeSyntaxConfig } from "@eslint/css-tree";
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * Determines if the current token is a number or dimension that continues a
 * class name, as in `.#{$prefix}-2x`. The CSS tokenizer only produces one of
 * those inside a class name when it directly follows an interpolation.
 * @param {any} parser The parser to inspect.
 * @param {number} nameStart The offset where the class name starts.
 * @returns {boolean} `true` when the token continues the class name.
 */
function isNumericNamePart(parser, nameStart) {
	return (
		parser.tokenStart > nameStart &&
		(parser.tokenType === tokenTypes.Number ||
			parser.tokenType === tokenTypes.Dimension) &&
		identifierFragment.test(
			parser.substring(parser.tokenStart, parser.tokenEnd),
		)
	);
}

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
		} else if (
			(this.tokenStart > nameStart && this.isDelim(HYPHEN_MINUS)) ||
			isNumericNamePart(this, nameStart)
		) {
			this.next();
		} else {
			this.eat(tokenTypes.Ident);
		}
	} while (
		this.tokenType === tokenTypes.Ident ||
		isInterpolationStart(this) ||
		this.isDelim(HYPHEN_MINUS) ||
		isNumericNamePart(this, nameStart)
	);

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
