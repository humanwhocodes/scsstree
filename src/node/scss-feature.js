/**
 * @fileoverview Overrides `Feature` parsing so media and container features can
 * take an SCSS value, as in `@media (min-width: $breakpoint)`.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { tokenTypes } from "../token-types.js";
import { SOLIDUS } from "../char-codes.js";
import {
	isInterpolationStart,
	isNamespacedFunctionStart,
	isVariableStart,
} from "../util/parser.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @import { NodeSyntaxConfig } from "@eslint/css-tree";
 */

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export const name = "Feature";

/** @type {NodeSyntaxConfig["structure"]} */
export const structure = {
	kind: String,
	name: String,
	value: [
		"Identifier",
		"Number",
		"Dimension",
		"Ratio",
		"Function",
		"Value",
		null,
	],
};

/**
 * Parses a media or container feature.
 * @this {any}
 * @param {string} kind The kind of feature being parsed.
 * @returns {any} The `Feature` node.
 */
export function parse(kind) {
	const start = this.tokenStart;
	let value = null;

	this.eat(tokenTypes.LeftParenthesis);
	this.skipSC();

	const featureName = this.consume(tokenTypes.Ident);

	this.skipSC();

	if (this.tokenType !== tokenTypes.RightParenthesis) {
		this.eat(tokenTypes.Colon);
		this.skipSC();

		switch (this.tokenType) {
			case tokenTypes.Number:
				value =
					this.lookupNonWSType(1) === tokenTypes.Delim
						? this.Ratio()
						: this.Number();
				break;

			case tokenTypes.Dimension:
				value = this.Dimension();
				break;

			case tokenTypes.Ident:
				value =
					isVariableStart(this) || isNamespacedFunctionStart(this)
						? this.Value()
						: this.Identifier();
				break;

			case tokenTypes.Function:
				value = this.parseWithFallback(
					() => {
						const result = this.Function(
							this.readSequence,
							this.scope.Value,
						);

						this.skipSC();

						if (this.isDelim(SOLIDUS)) {
							this.error();
						}

						return result;
					},
					() => this.Ratio(),
				);
				break;

			default:
				if (isVariableStart(this) || isInterpolationStart(this)) {
					value = this.Value();
				} else {
					this.error(
						"Number, dimension, ratio or identifier is expected",
					);
				}
		}

		this.skipSC();
	}

	if (!this.eof) {
		this.eat(tokenTypes.RightParenthesis);
	}

	return {
		type: name,
		loc: this.getLocation(start, this.tokenStart),
		kind,
		name: featureName,
		value,
	};
}

/**
 * Generates the source text for a feature.
 * @this {any}
 * @param {any} node The node to generate.
 * @returns {void}
 */
export function generate(node) {
	this.token(tokenTypes.LeftParenthesis, "(");
	this.token(tokenTypes.Ident, node.name);

	if (node.value !== null) {
		this.token(tokenTypes.Colon, ":");
		this.node(node.value);
	}

	this.token(tokenTypes.RightParenthesis, ")");
}
