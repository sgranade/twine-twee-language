import { expect } from 'chai';
import 'mocha';

import * as uut from '../utilities';

describe("Utilities", () => {
	describe("pairwise", () => {
		it("should yield iterable items in pairs", () => {
			const data = ["a", "b", "c"];

			const result = [...uut.pairwise(data)];

			expect(result).to.eql([["a", "b"], ["b", "c"]]);
		});

		it("should yield nothing if passed no contents", () => {
			const data: string[] = [];

			const result = [...uut.pairwise(data)];

			expect(result).to.be.empty;
		});
	});
});