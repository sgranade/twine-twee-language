/**
 * Extension configuration items.
 */
export enum Configuration {
    BaseSection = "twineTweeLanguage",
    FilesInclude = "files.include",
    FilesExclude = "files.exclude",
    ProjectCreate = "project.create",
    DownloadStoryFormat = "project.downloadStoryFormat",
    StoryFilesDirectory = "project.storyFilesDirectory",
    BuildDirectory = "project.buildDirectory",
    IncludeDirectory = "project.includeDirectory",
    OutputFile = "project.outputFile",
    StoryFormatsDirectory = "project.storyFormatsDirectory",
    Twee3WarningUnknownMacro = "twee-3.warning.unknownMacro",
}

/**
 * Extension custom commands.
 */
export enum CustomCommands {
    BuildGame = "twineTweeLanguage.buildGame",
    BuildGameTest = "twineTweeLanguage.buildGameTest",
    RunGame = "twineTweeLanguage.runGame",
    DownloadStoryFormat = "twineTweeLanguage.downloadStoryFormat",
}

/**
 * Custom [when-clause contexts](https://code.visualstudio.com/api/extension-guides/command#using-a-custom-when-clause-context)
 * to control when custom commands are available.
 */
export enum CustomWhenContext {
    Building = "twineTweeLanguage.building",
}
