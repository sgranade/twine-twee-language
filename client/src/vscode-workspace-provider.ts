import { workspace } from "vscode";

import { WorkspaceProvider } from "./workspace-provider";

export class VSCodeWorkspaceProvider implements WorkspaceProvider {
    findFiles = workspace.findFiles;
    getConfigurationItem(section: string, item: string) {
        return workspace.getConfiguration(section).get(item);
    }
    fs = {
        readFile: workspace.fs.readFile,
    };
}
