# Configuration File

You can configure the extension's behavior by adding a `tt3.config.json` file to the top folder of your game. If you don't include one, the extension uses the following default configuration:

```json
{
    "build": {
        "storySourceFiles": [
            "src/**/*.{tw,twee}",
            "src/**/*.css",
            "src/**/*.js",
            "src/**/*.{otf,ttf,woff,woff2}",
            "src/**/*.{gif,jpeg,jpg,png,svg,tif,tiff,webp}",
            "src/**/*.{aac,flac,m4a,mp3,oga,ogg,opus,wav,wave,weba}",
            "src/**/*.{mp4,ogb,webm}",
            "src/**/*.vtt"
        ],
        "includeSourcePaths": ["include"],
        "outputPath": "build",
        "storyFormatPaths": [".storyformats"]
    },
    "tt3": {
        "disabledDiagnostics": []
    }
}
```

## Full Contents

```json
{
    "build": {
        "storySourceFiles": [
            "src/**/*.{tw,twee}",
            "src/**/*.css",
            "src/**/*.js",
            "src/**/*.{otf,ttf,woff,woff2}",
            "src/**/*.{gif,jpeg,jpg,png,svg,tif,tiff,webp}",
            "src/**/*.{aac,flac,m4a,mp3,oga,ogg,opus,wav,wave,weba}",
            "src/**/*.{mp4,ogb,webm}",
            "src/**/*.vtt"
        ],
        "includeSourcePaths": ["include"],
        "ignores": ["src/**/skip.tw"],
        "outputPath": "build",
        "outputFilename": "game.html",
        "startPassage": "Start"
    },
    "tt3": {
        "disabledDiagnostics": []
    }
}
```

### `build` Section

Settings for building the story.

- `storySourceFiles`: Files (relative to the project's root) to be included in the built story. Supports [glob patterns](https://code.visualstudio.com/docs/editor/glob-patterns). Allows any Tweego-supported files except for `.tw2`, `.twee2`, `.htm`, and `.html`.
- `includeSourcePaths`: Paths (relative to the project's root) whose contents will be included as-is alongside the built story.
- `ignores` (Optional): Paths to files (relative to the project's root) to be excluded from storySourceFiles and includeSourcePaths. Supports [glob patterns](https://code.visualstudio.com/docs/editor/glob-patterns).
- `outputPath` (Optional): Path (relative to the project's root) to write the story file to. If omitted, defaults to `build`.
- `outputFilename` (Optional): Name for the story file. If omitted, defaults to the game's filename from the StoryTitle passage, with spaces replaced by hyphens.
- `storyFormatPaths`: Path to story formats. Story formats are contained in subdirectories whose name matches the pattern `<format>-<major>-<minor>-<patch>`. Path is relative to the project's root.
- `startPassage` (Optional): Name of the starting passage. Will override the one set in the game's `StoryData` passage.

### `tt3` Section

Settings for the Twine (Twee 3) extension.

- `disabledDiagnostics`: A list of diagnostic codes to be disabled project-wide.
