/**
 * @copyright 2026
 * @autor SoftLightTech
 * @license CC-BY-SA-4.0
 * @see https://github.com/SoftLightTech/webl-extension
 */

import * as vscode from 'vscode';
import { ProjectManager } from './utils/project-manager';
import { ProjectView } from './utils/project-view';

/**
 * Initialize the extension
 * @param context The extension context
 */
export function activate(context: vscode.ExtensionContext) {
	new ProjectManager(context);
	new ProjectView();
}