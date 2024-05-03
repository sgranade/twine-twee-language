// For interfaces and constants that need to be the same on client and server side

export enum CustomMessages {
    UpdatedStoryFormat = "twee3/storyformat",
}

export interface StoryFormat {
    format: string;
    formatVersion?: string;
}
