/**
 * @fileoverview The block consumer shared by the SCSS at-rules.
 *
 * CSSTree guesses whether an at-rule's block holds declarations or rules by
 * looking ahead in the token stream. Every SCSS at-rule that takes a block can
 * hold both at once, so they all use this consumer instead of the guess.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * Preserves the enclosing context when parsing a conditional at-rule block.
 * @this {any}
 * @param {boolean} [nested] Whether the at-rule is inside a declaration block.
 * @param {{allowNestedRules?: boolean}} [options] Parsing options.
 * @returns {any} The `Block` node.
 */
export function conditionalBlock(
	nested = false,
	{ allowNestedRules = false } = {},
) {
	return this.Block(nested, { allowNestedRules });
}

/**
 * Parses a block that may contain declarations, nested rules, and at-rules.
 * @this {any}
 * @returns {any} The `Block` node.
 */
export default function scssBlock() {
	return this.Block(true, { allowNestedRules: true });
}
