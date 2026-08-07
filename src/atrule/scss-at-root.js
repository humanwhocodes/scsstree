/**
 * @fileoverview The `@at-root` at-rule parser.
 *
 * The prelude is either a selector (`@at-root .child { ... }`) or a query
 * (`@at-root (without: media) { ... }`), and may be omitted entirely.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { tokenTypes } from "../token-types.js";
import scssBlock from "./scss-block.js";

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export default {
	parse: {
		/**
		 * @this {any}
		 * @returns {any} The prelude children.
		 */
		prelude() {
			this.skipSC();

			if (
				this.tokenType === tokenTypes.LeftParenthesis ||
				this.tokenType === tokenTypes.Function
			) {
				return this.readSequence(this.scope.AtrulePrelude);
			}

			const children = this.createList();

			children.push(this.SelectorList());

			return children;
		},

		block: scssBlock,
	},
};
