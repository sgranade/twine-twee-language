import { URI } from "vscode-uri";

import { WorkspaceProvider, FileType } from "../workspace-provider";

export function buildWorkspaceProvider({
    files = ["/"],
    configurationItem = "",
    fileContents = "file contents",
}): WorkspaceProvider {
    return {
        findFiles: async () => files.map((f) => URI.parse(f)),
        getConfigurationItem: <T>() => {
            return configurationItem as T;
        },
        rootWorkspaceUri: () => URI.parse("file://placeholder"),
        fs: {
            createDirectory: async () => {},
            readDirectory: async () => [],
            readFile: async () => Buffer.from(fileContents),
            writeFile: async () => {},
            copy: async () => {},
            stat: async () => {
                return {
                    type: FileType.File,
                    ctime: 0,
                    mtime: 0,
                    size: 0,
                };
            },
        },
    };
}
