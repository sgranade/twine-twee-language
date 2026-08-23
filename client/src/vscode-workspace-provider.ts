import { workspace } from "vscode";

import { WorkspaceProvider } from "./workspace-provider";
import { URI } from "vscode-uri";

export class VSCodeWorkspaceProvider implements WorkspaceProvider {
    findFiles = workspace.findFiles;
    getConfigurationItem<T>(section: string, item: string) {
        return workspace.getConfiguration(section).get(item) as T;
    }
    rootWorkspaceUri(): URI | undefined {
        if (
            workspace.workspaceFolders === undefined ||
            workspace.workspaceFolders.length === 0
        ) {
            return undefined;
        }
        return workspace.workspaceFolders[0].uri;
    }
    fs = {
        stat: workspace.fs.stat,
        readDirectory: workspace.fs.readDirectory,
        createDirectory: workspace.fs.createDirectory,
        readFile: workspace.fs.readFile,
        writeFile: workspace.fs.writeFile,
        copy: workspace.fs.copy,
    };
}
