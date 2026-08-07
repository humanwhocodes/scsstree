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
 * Parses a block that may contain declarations, nested rules, and at-rules.
 * @this {any}
 * @returns {any} The `Block` node.
 */
export default function scssBlock() {
	return this.Block(true, { allowNestedRules: true });
}
