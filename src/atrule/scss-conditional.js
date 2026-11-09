/**
 * @fileoverview Conditional at-rule preludes for definition-only syntax input.
 * @author Nicholas C. Zakas
 */

import { tokenTypes } from "../token-types.js";

const nonContainerNames = new Set(["none", "and", "not", "or"]);

/** @type {Record<string, (this: any) => any>} */
export const conditionalPreludes = {
	media() {
		return this.createSingleNodeList(this.MediaQueryList());
	},

	supports() {
		return this.createSingleNodeList(this.Condition("supports"));
	},

	container() {
		const children = this.createList();

		if (this.tokenType === tokenTypes.Ident) {
			const name = this.substring(this.tokenStart, this.tokenEnd);

			if (!nonContainerNames.has(name.toLowerCase())) {
				children.push(this.Identifier());
			}
		}

		children.push(this.Condition("container"));
		return children;
	},
};
