/**
 * @fileoverview Overrides `MediaQuery` parsing so a query can be built out of
 * interpolation or a variable, as in `@media #{$phone}`.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { tokenTypes } from "../token-types.js";
import { isInterpolationStart, isVariableStart } from "../util/parser.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @import { NodeSyntaxConfig } from "@eslint/css-tree";
 */

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export const name = "MediaQuery";

/** @type {NodeSyntaxConfig["structure"]} */
export const structure = {
	modifier: [String, null],
	mediaType: [String, null],
	condition: ["Condition", null],
};

/**
 * Parses a media query.
 * @this {any}
 * @returns {any} The `MediaQuery` node.
 */
export function parse() {
	const start = this.tokenStart;
	let modifier = null;
	let mediaType = null;
	let condition = null;

	this.skipSC();

	if (
		this.tokenType === tokenTypes.Ident &&
		!isVariableStart(this) &&
		this.lookupTypeNonSC(1) !== tokenTypes.LeftParenthesis
	) {
		const ident = this.consume(tokenTypes.Ident);
		const identLowerCase = ident.toLowerCase();

		if (identLowerCase === "not" || identLowerCase === "only") {
			this.skipSC();
			modifier = identLowerCase;
			mediaType = this.consume(tokenTypes.Ident);
		} else {
			mediaType = ident;
		}

		switch (this.lookupTypeNonSC(0)) {
			case tokenTypes.Ident: {
				this.skipSC();
				this.eatIdent("and");
				condition = this.Condition("media");
				break;
			}

			case tokenTypes.LeftCurlyBracket:
			case tokenTypes.Semicolon:
			case tokenTypes.Comma:
			case tokenTypes.EOF:
				break;

			default:
				this.error("Identifier or parenthesis is expected");
		}
	} else {
		switch (this.tokenType) {
			case tokenTypes.Ident:
			case tokenTypes.LeftParenthesis:
			case tokenTypes.Function: {
				condition = this.Condition("media");
				break;
			}

			case tokenTypes.Delim:
				if (isInterpolationStart(this) || isVariableStart(this)) {
					condition = this.Condition("media");
					break;
				}

				this.error("Identifier or parenthesis is expected");
				break;

			case tokenTypes.LeftCurlyBracket:
			case tokenTypes.Semicolon:
			case tokenTypes.EOF:
				break;

			default:
				this.error("Identifier or parenthesis is expected");
		}
	}

	return {
		type: name,
		loc: this.getLocation(start, this.tokenStart),
		modifier,
		mediaType,
		condition,
	};
}

/**
 * Generates the source text for a media query.
 * @this {any}
 * @param {any} node The node to generate.
 * @returns {void}
 */
export function generate(node) {
	if (node.mediaType) {
		if (node.modifier) {
			this.token(tokenTypes.Ident, node.modifier);
		}

		this.token(tokenTypes.Ident, node.mediaType);

		if (node.condition) {
			this.token(tokenTypes.Ident, "and");
			this.node(node.condition);
		}
	} else if (node.condition) {
		this.node(node.condition);
	}
}
