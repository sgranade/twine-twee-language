import { expect } from 'chai';
import 'mocha';
import { Range } from 'vscode-languageserver';

import * as uut from '../index';

function buildPassage({
	name = "Passage",
	location = {
		uri: "fake-uri",
		range: Range.create(1, 1, 2, 2)
	},
	scope = Range.create(3, 3, 4, 4),
	isScript = false,
	isStylesheet = false,
	tags = undefined,
	metadata = undefined,
	varsSection = undefined
}): uut.Passage {
	return {
		name: name,
		location: location,
		scope: scope,
		isScript: isScript,
		isStylesheet: isStylesheet,
		tags: tags,
		metadata: metadata,
		varsSection: varsSection
	};
}

describe("Project Index", () => {
	describe("Index", () => {
		describe("Story Data", () => {
			it("should return undefined if no story data has been set", () => {
				const index = new uut.Index();
	
				const result = index.getStoryData();
	
				expect(result).to.be.undefined;
			});
			
			it("should set the story data", () => {
				const index = new uut.Index();
				index.setStoryData({
					ifid: "fake-ifid",
					format: "Fake Format",
				}, "fake-uri");
	
				const result = index.getStoryData();
	
				expect(result).to.eql({
					ifid: "fake-ifid",
					format: "Fake Format",
				});
			});	
		});

		describe("Passages", () => {
			it("should return undefined for unindexed files", () => {
				const index = new uut.Index();

				const result = index.getPassages("nopers");

				expect(result).to.be.undefined;
			});

			it("should return passages for indexed files", () => {
				const passages = [ 
					buildPassage({ name: "Passage 1" }),
					buildPassage({ name: "Passage 2" })
				];
				const index = new uut.Index();
				index.setPassages("fake-uri", passages);

				const result = index.getPassages("fake-uri");

				expect(result).to.eql(passages);
			});
		});

		describe("Passage Names", () => {
			it("should return passage names across all indexed files", () => {
				const passages1 = [ 
					buildPassage({ name: "F1 P1" }),
					buildPassage({ name: "F1 P2" })
				];
				const passages2 = [ 
					buildPassage({ name: "F2 P1" }),
					buildPassage({ name: "F2 P2" })
				];
				const index = new uut.Index();
				index.setPassages("file1", passages1);
				index.setPassages("file2", passages2);

				const result = index.getPassageNames();

				expect(result).to.have.all.keys(
					"F1 P1", "F1 P2", "F2 P1", "F2 P2"
				);
			});

			it("should return passage names with no duplicates", () => {
				const passages1 = [ 
					buildPassage({ name: "F1 P1" }),
					buildPassage({ name: "spoiler" })
				];
				const passages2 = [ 
					buildPassage({ name: "spoiler" }),
					buildPassage({ name: "F2 P2" })
				];
				const index = new uut.Index();
				index.setPassages("file1", passages1);
				index.setPassages("file2", passages2);

				const result = index.getPassageNames();

				expect(result).to.have.all.keys(
					"F1 P1", "spoiler", "F2 P2"
				);
			});
		});

		describe("Removing Documents", () => {
			it("should remove passages from with a deleted document", () => {
				const passages1 = [ 
					buildPassage({ name: "F1 P1" }),
					buildPassage({ name: "F1 P2" })
				];
				const passages2 = [ 
					buildPassage({ name: "F2 P1" }),
					buildPassage({ name: "F2 P2" })
				];
				const index = new uut.Index();
				index.setPassages("file1", passages1);
				index.setPassages("file2", passages2);

				index.removeDocument("file1");
				const result = index.getPassageNames();

				expect(result).to.have.all.keys(
					"F2 P1", "F2 P2"
				);
			});

			it("should remove story data if a deleted document contained it", () => {
				const index = new uut.Index();
				index.setStoryData({
					ifid: "fake-ifid",
					format: "Fake Format",
				}, "storydata-uri");

				index.removeDocument("storydata-uri");
				const result = index.getStoryData();

				expect(result).to.be.undefined;
			});

			it("should leave story data alone if a deleted document didn't contain it", () => {
				const index = new uut.Index();
				index.setStoryData({
					ifid: "fake-ifid",
					format: "Fake Format",
				}, "storydata-uri");

				index.removeDocument("other-uri");
				const result = index.getStoryData();

				expect(result).not.to.be.undefined;
			});
		});
	});
});