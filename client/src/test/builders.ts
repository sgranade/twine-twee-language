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
        fs: {
            readFile: async () => Buffer.from(fileContents),
        },
    };
}
