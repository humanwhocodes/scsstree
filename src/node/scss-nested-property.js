/**
 * @fileoverview The ScssNestedProperty node.
 * Represents the nested property shorthand, such as:
 *
 *     font: {
 *         family: serif;
 *         size: 30em;
 *     }
 *
 * A value may appear before the block (`font: 12px/1.5 { family: serif; }`),
 * in which case `value` is non-`null`.
 *
 * It's produced by the `Declaration` parser rather than parsed directly.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { tokenTypes } from "../token-types.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @import { NodeSyntaxConfig } from "@eslint/css-tree";
 */

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export const name = "ScssNestedProperty";

/** @type {NodeSyntaxConfig["structure"]} */
export const structure = {
	property: String,
	value: ["Value", "Raw", null],
	block: ["Block"],
};

/**
 * Generates the source text for a nested property.
 * @this {any}
 * @param {any} node The node to generate.
 * @returns {void}
 */
export function generate(node) {
	this.tokenize(node.property);
	this.token(tokenTypes.Colon, ":");

	if (node.value) {
		this.node(node.value);
	}

	this.node(node.block);
}
