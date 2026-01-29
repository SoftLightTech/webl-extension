/**
 * @copyright 2026
 * @autor SoftLightTech
 * @license CC-BY-SA-4.0
 * @see https://github.com/SoftLightTech/webl-extension
 */

import path from 'path';
import * as vscode from 'vscode';
import fs from 'fs';

/**
 * Provider for the project view.
 */
class ProjectViewProvider implements vscode.TreeDataProvider<ProjectViewItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ProjectViewItem | undefined | null | void> = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<ProjectViewItem | undefined | null | void> = this._onDidChangeTreeData.event;

  /**
   * Get the tree item for the given element.
   * @param element The element to get the tree item for.
   * @returns The tree item for the given element.
   */
  getTreeItem(element: ProjectViewItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get the children of the given element.
   * @param element The element to get the children for.
   * @returns The children of the given element.
   */
  async getChildren(element?: ProjectViewItem): Promise<ProjectViewItem[]> {
    const root: vscode.WorkspaceFolder | undefined = vscode.workspace.workspaceFolders?.[0];
    const items: ProjectViewItem[] = [];
    
    if (!root) {
        return items;
    }
    
    if(!element) {
        const folders: string[] = await vscode.workspace.fs.readDirectory(root.uri).then((folders) => {
            return folders.map((folder) => folder[0]);
        });

        if(folders.includes('project')) {
            const files: string[] = await vscode.workspace.fs.readDirectory(vscode.Uri.joinPath(root.uri, 'project')).then((files) => {
                return files.map((file) => file[0]);
            });
            
            if(files.includes('config.webl.ts')) {
                items.push(new ProjectViewItem(
                    'Configuration',
                    vscode.TreeItemCollapsibleState.None,
                    path.join(__dirname, '..', 'assets', 'icons', 'webl.svg'),
                    {
                        command: 'webl.config',
                        title: 'Edit Project Configuration',
                        tooltip: 'Edit Project Configuration'
                    },
                    true
                ));
            }
        }

        if(folders.includes('locales')) {
            items.push(new ProjectViewItem(
                'Languages', 
                vscode.TreeItemCollapsibleState.Collapsed,
                new vscode.ThemeIcon('quote'),
                undefined,
                true
            ));
        }

        if(folders.includes('src')) {
            items.push(new ProjectViewItem(
                'Server',
                vscode.TreeItemCollapsibleState.Collapsed,
                new vscode.ThemeIcon('server'),
                undefined,
                true
            ));
        }

        if(folders.includes('www')) {
            items.push(new ProjectViewItem(
                'Website',
                vscode.TreeItemCollapsibleState.Collapsed,
                new vscode.ThemeIcon('globe'),
                undefined,
                true
            ));
        }
    } else {
        switch (element.label) {
            case "Languages":
                const files: string[] = await fs.promises.readdir(path.join(root.uri.fsPath, 'locales'));
                
                for (const file of files) {
                    if (!file.endsWith('.ts')) {
                        continue;
                    }

                    items.push(new ProjectViewItem(
                        file.split('.')[0],
                        vscode.TreeItemCollapsibleState.None,
                        new vscode.ThemeIcon('file-code'),
                    ));
                }

                break;
            default:
                break;
        }
    }

    return items;
  }

  /**
   * Refresh the tree view.
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}

/**
 * Item for the project view.
 */
class ProjectViewItem extends vscode.TreeItem {
    /**
     * Initializes a new instance of the ProjectViewItem class.
     * @param label Name of the item.
     * @param collapsibleState Determines if the item can be collapsed.
     * @param iconPath Optional icon resource.
     * @param command Optional command to execute when the item is clicked.
     * @param wip Optional flag to indicate if the item is currently under development.
     */
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly iconPath?: string | vscode.IconPath,
        public readonly command?: vscode.Command,
        private wip: boolean = false
    ) {
        super(label, collapsibleState);
        this.iconPath = iconPath;
        this.command = command;
        this.description = this.wip ? '⚠ Work In Progress' : undefined;
    }
}

/**
 * Main class for the project view.
 */
export class ProjectView {
    /**
     * Initialize the project view using the provider.
     */
    constructor() {
        const version: string | undefined = vscode.workspace.getConfiguration('webl').get('project.version');

        if(version && version !== "5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9") {
            const provider: ProjectViewProvider = new ProjectViewProvider(); 
            
            vscode.window.createTreeView('webl.project', {
                treeDataProvider: provider
            });

            vscode.workspace.onDidCreateFiles(() => provider.refresh());
            vscode.workspace.onDidDeleteFiles(() => provider.refresh());
        }
    }
}