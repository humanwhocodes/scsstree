/**
 * @fileoverview The `@extend` at-rule parser.
 * The prelude is a selector list optionally followed by `!optional`.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { EXCLAMATION_MARK } from "../char-codes.js";

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
			const children = this.createList();

			children.push(this.SelectorList());
			this.skipSC();

			if (this.isDelim(EXCLAMATION_MARK)) {
				const start = this.tokenStart;

				this.next();

				children.push({
					type: "Operator",
					loc: this.getLocation(start, start + 1),
					value: "!",
				});

				this.skipSC();
				children.push(this.Identifier());
				this.skipSC();
			}

			return children;
		},

		block: null,
	},
};
