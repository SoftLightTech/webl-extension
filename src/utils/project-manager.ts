/**
 * @copyright 2026
 * @autor SoftLightTech
 * @license CC-BY-SA-4.0
 * @see https://github.com/SoftLightTech/webl-extension
 */

import * as vscode from 'vscode';
import path from 'path';
import fs, { PathLike } from 'fs';
import AdmZip from 'adm-zip';

/**
 * Simple interface for the last release of the WebL Template repository.
 * @see https://github.com/SoftLightTech/webl-template
 */
type TemplateRelease = {
    hash: string, 
    zip: string
}

/**
 * Represents the WebL Template repository.
 * @see https://github.com/SoftLightTech/webl-template
 */
class WebLTemplate {
    /**
     * Get the latest release of the WebL Template repository.
     * @returns Instance of the TemplateRelease interface.
     */
    public static async get(): Promise<TemplateRelease> {
        const url: string = "https://api.github.com/repos/SoftLightTech/webl-template/releases/latest";
        const response: Response = await fetch(url);
        const json: any = await response.json();
        const hash: ArrayBuffer = await crypto.subtle.digest('SHA-256', Buffer.from(json.zipball_url));

        return {
            hash: Buffer.from(hash).toString('hex'),
            zip: json.zipball_url
        };
    }

    /**
     * Download the latest release of the WebL Template repository. 
     * @returns Path to the downloaded template.
     */
    public static async download(): Promise<PathLike> {
        const release: TemplateRelease = await WebLTemplate.get();
        const response: Response = await fetch(release.zip);
        const buffer: ArrayBuffer = await response.arrayBuffer();
        const temp: string = process.env.TEMP || '/tmp';
        const zipPath: PathLike = path.join(temp, 'webl.zip');
        
        await fs.promises.writeFile(zipPath, Buffer.from(buffer));

        const zip: AdmZip = new AdmZip(zipPath);
        const output: PathLike = path.join(temp, 'webl');

        zip.extractAllTo(output, true);

        await fs.promises.rm(zipPath);

        const folders: string[] = await fs.promises.readdir(output);
        const folder: string = folders[0];

        return path.join(output, folder);
    }
}

/**
 * Manage WebL projects.
 */
export class ProjectManager {
    /**
     * Register useful commands to create and manage WebL projects.
     * @param context The extension context used to register commands.
     */
    constructor(context: vscode.ExtensionContext) {
        const version: string | undefined = vscode.workspace.getConfiguration('webl').get('project.version');
    	const createDisposable: vscode.Disposable = vscode.commands.registerCommand('webl.create', () => {
            this.create();
        });
        
        if(version && version !== "5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9") {
            const checkUpdatesDisposable: vscode.Disposable = vscode.commands.registerCommand('webl.update.check', () => {
                this.checkUpdates();
            });

            const updateDisposable: vscode.Disposable = vscode.commands.registerCommand('webl.update', () => {
                this.update();
            });

            const debugDisposable: vscode.Disposable = vscode.commands.registerCommand('webl.debug', () => {
                vscode.window.terminals.find(terminal => terminal.name === 'WebL Project')?.sendText('deno task dev');
            });

            context.subscriptions.push(checkUpdatesDisposable);
            context.subscriptions.push(updateDisposable);
            context.subscriptions.push(debugDisposable);

            this.checkUpdates(Date.now());

            vscode.window.terminals.find(terminal => terminal.name === 'WebL Project Watcher')?.dispose();
            vscode.window.terminals.find(terminal => terminal.name === 'WebL Project')?.dispose();

            vscode.window.createTerminal('WebL Project Watcher').sendText('deno task webl watch');
            vscode.window.createTerminal('WebL Project').show();
        }

        context.subscriptions.push(createDisposable);
    }

    /**
     * Creates a new WebL project in the selected folder.
     */
    private async create() {
        const folder: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title: 'Create WebL Project',
            openLabel: 'Select Folder'
        });
        
        if (folder) {
            const files: [string, vscode.FileType][] = await vscode.workspace.fs.readDirectory(folder[0]);
            if (files.length > 0) {
               vscode.window.showErrorMessage('Folder is not empty');
               return;
            }

            const progressOptions: vscode.ProgressOptions = {
                location: vscode.ProgressLocation.Notification,
                title: 'Creating WebL Project',
                cancellable: false
            };

            await vscode.window.withProgress(progressOptions, async () => {
                const webl: PathLike = await WebLTemplate.download();
                const files: string[] = await fs.promises.readdir(webl, { recursive: true });

                for (const file of files) {
                    const filePath: PathLike = path.join(webl.toString(), file);
                    const fileStat: fs.Stats = await fs.promises.stat(filePath);

                    if(file.endsWith('.gitkeep')) {
                        await fs.promises.rm(filePath);
                        continue;
                    }

                    if(fileStat.isDirectory()) {
                        await fs.promises.mkdir(path.join(folder[0].fsPath, file), { recursive: true });
                    } else {
                        await fs.promises.copyFile(filePath, path.join(folder[0].fsPath, file));
                    }
                }

                await fs.promises.rm(webl, { recursive: true });

                const version: TemplateRelease = await WebLTemplate.get(); 
                
                await fs.promises.mkdir(path.join(folder[0].fsPath, '.vscode'), { recursive: true });
                await fs.promises.writeFile(path.join(folder[0].fsPath, '.vscode', 'settings.json'), JSON.stringify({
                    "webl.project.version": version.hash,
                    "deno.enable": true
                }, null, 4), { encoding: 'utf-8' });
            });

            if(folder[0].fsPath !== vscode.workspace.workspaceFolders?.[0].uri.fsPath){
                await vscode.commands.executeCommand('vscode.openFolder', folder[0]);
            } else {
                await vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
        }
    }

    /**
     * Update the WebL Template of the current project to the latest version.
     */
    private async update() {
        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('webl');
        const folder: vscode.WorkspaceFolder | undefined = vscode.workspace.workspaceFolders?.[0];

        if(!folder) {
            return;
        }

        const progressOptions: vscode.ProgressOptions = {
            location: vscode.ProgressLocation.Notification,
            title: 'Updating WebL Project',
            cancellable: false
        };

        await vscode.window.withProgress(progressOptions, async () => {
            const webl: PathLike = await WebLTemplate.download();

            await fs.promises.cp(webl.toString(), folder.uri.fsPath, { recursive: true, force: true, filter: (src: string): boolean => {
                switch (true) {
                    case src === webl.toString():
                        return true;
                    case src.endsWith('.gitkeep'):
                        return false;
                    case src.includes('src') && config.get('project.update.core'):
                        return true;
                    case src.includes('@webl') && config.get('project.update.cli'):
                        return true;
                    case src.includes('www') && config.get('project.update.website'):
                        return true;
                    default:
                        return false;
                }
            }});

            await fs.promises.rm(webl, { recursive: true });

            const version: TemplateRelease = await WebLTemplate.get(); 
            await config.update('project.version', version.hash);
        });
    }

    /**
     * Check periodically if a new version of the WebL Template is available.
     * @param timestamp Value used to avoid duplication of the check.
     */
    private async checkUpdates(timestamp?: number) {
        const currentVersion: string | undefined = vscode.workspace.getConfiguration('webl').get('project.version');
        const version: TemplateRelease = await WebLTemplate.get();

        if(currentVersion && currentVersion !== version.hash && currentVersion !== "5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9") {
            const update: string | undefined = await vscode.window.showInformationMessage(`A new WebL version is available, do you want to update your project?`, 'Update', 'Ignore');
            
            if(update === 'Update') {
                await this.update();
            }
        }

        if(timestamp && timestamp < Date.now() - 15 * 60 * 1000) {
            setTimeout(() => this.checkUpdates(timestamp), 15 * 60 * 1000);
        }
    }
}