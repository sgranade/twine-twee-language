import { URI } from "vscode-uri";

import { WorkspaceProvider } from "../workspace-provider";

export function buildWorkspaceProvider({
    files = ["/"],
    configurationItem = "",
    fileContents = "file contents",
}): WorkspaceProvider {
    return {
        findFiles: async () => files.map((f) => URI.parse(f)),
        getConfigurationItem: () => configurationItem,
        rootWorkspaceUri: () => URI.parse("file://placeholder"),
        fs: {
            createDirectory: async () => {},
            readDirectory: async () => [],
            readFile: async () => Buffer.from(fileContents),
            writeFile: async () => {},
            copy: async () => {},
        },
    };
}
