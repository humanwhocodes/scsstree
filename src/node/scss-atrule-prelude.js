/**
 * @fileoverview Overrides `AtrulePrelude` parsing so that an at-rule may be the
 * last statement in a block without a trailing semicolon.
 *
 * SCSS treats `}` as a statement terminator the same way it treats `;`, so
 * `.a { @include b($c) }` is valid where the CSS equivalent isn't.
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

export const name = "AtrulePrelude";
export const walkContext = "atrulePrelude";

/** @type {NodeSyntaxConfig["structure"]} */
export const structure = {
	children: [[]],
};

/**
 * Parses an at-rule prelude.
 * @this {any}
 * @param {string|null} atruleName The name of the at-rule being parsed.
 * @returns {any} The `AtrulePrelude` node.
 */
export function parse(atruleName) {
	const lowerCaseName = atruleName === null ? null : atruleName.toLowerCase();
	let children = null;

	this.skipSC();

	if (
		lowerCaseName !== null &&
		Object.hasOwn(this.atrule, lowerCaseName) &&
		typeof this.atrule[lowerCaseName].prelude === "function"
	) {
		children = this.atrule[lowerCaseName].prelude.call(this);
	} else {
		children = this.readSequence(this.scope.AtrulePrelude);
	}

	this.skipSC();

	if (
		this.eof !== true &&
		this.tokenType !== tokenTypes.LeftCurlyBracket &&
		this.tokenType !== tokenTypes.Semicolon &&
		this.tokenType !== tokenTypes.RightCurlyBracket
	) {
		this.error("Semicolon or block is expected");
	}

	return {
		type: name,
		loc: this.getLocationFromList(children),
		children,
	};
}

/**
 * Generates the source text for an at-rule prelude.
 * @this {any}
 * @param {any} node The node to generate.
 * @returns {void}
 */
export function generate(node) {
	this.children(node);
}
