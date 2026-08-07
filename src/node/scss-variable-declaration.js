/**
 * @fileoverview The ScssVariableDeclaration node.
 * Represents `$name: value`, optionally namespaced (`config.$name: value`) and
 * optionally flagged with `!default` and `!global`.
 *
 * This is deliberately a separate node type from `Declaration` because a
 * variable assignment isn't a CSS property and shouldn't be validated as one.
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

export const name = "ScssVariableDeclaration";

/** @type {NodeSyntaxConfig["structure"]} */
export const structure = {
	name: String,
	namespace: [String, null],
	value: ["Value", "Raw"],
	default: Boolean,
	global: Boolean,
};

/**
 * Generates the source text for a variable declaration.
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
	this.token(tokenTypes.Colon, ":");
	this.node(node.value);

	if (node.default) {
		this.token(tokenTypes.Delim, "!");
		this.token(tokenTypes.Ident, "default");
	}

	if (node.global) {
		this.token(tokenTypes.Delim, "!");
		this.token(tokenTypes.Ident, "global");
	}
}
