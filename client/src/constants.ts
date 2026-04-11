/**
 * Extension configuration items.
 */
export enum Configuration {
    BaseSection = "twineTweeLanguage",
    ProjectCreate = "project.create",
    DownloadStoryFormat = "project.downloadStoryFormat",
    StoryFilesDirectory = "project.storyFilesDirectory",
    StoryFormatsDirectory = "project.storyFormatsDirectory",
    OutputFile = "build.outputFile",
    RunningGameUpdate = "build.runningGameUpdate",
    BuildDirectory = "build.buildDirectory",
    IncludeDirectory = "build.includeDirectory",
    Twee3WarningUnknownMacro = "twee-3.warning.unknownMacro",
}

export type RunningGameUpdateOptions = "live reload" | "restart" | "no update";

/**
 * Extension custom commands.
 */
export enum CustomCommands {
    BuildGame = "twineTweeLanguage.buildGame",
    BuildGameTest = "twineTweeLanguage.buildGameTest",
    RunGame = "twineTweeLanguage.runGame",
    ReloadGame = "twineTweeLanguage.reloadGame",
    DownloadStoryFormat = "twineTweeLanguage.downloadStoryFormat",
}

/**
 * Custom [when-clause contexts](https://code.visualstudio.com/api/extension-guides/command#using-a-custom-when-clause-context)
 * to control when custom commands are available.
 */
export enum CustomWhenContext {
    Building = "twineTweeLanguage.building",
    Running = "twineTweeLanguage.running",
}
