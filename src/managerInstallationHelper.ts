/**
 * Manager Installation Helper
 * 
 * Provides user dialogs and automatic manager installation via PMON
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ManagerConfigWriter, ManagerEntry } from './managerConfigWriter';
import { ExtensionOutputChannel } from './extensionOutput';
import { PmonComponent, ProjEnvManagerOptions } from '@winccoa-tools-pack/npm-winccoa-core';

export class ManagerInstallationHelper {
    /**
     * Show dialog asking user if manager should be added automatically
     * @returns 'auto' | 'manual' | 'cancel'
     */
    static async askUserForInstallation(mcpServerPath: string): Promise<'auto' | 'manual' | 'cancel'> {
        const scriptPath = path.join(mcpServerPath, 'index_http.js');
        
        const message = [
            'MCP Server installation complete!',
            '',
            'To use the MCP Server, a WinCC OA manager must be added.',
            '',
            '⚠️ Note: After adding the manager, the project must be restarted.'
        ].join('\n');
        
        const choice = await vscode.window.showInformationMessage(
            message,
            {
                modal: true,
                detail: 'The manager will start automatically with the project (start mode: always, 3 retries).'
            },
            'Add Automatically',
            'Manual Instructions',
            'Cancel'
        );
        
        if (choice === 'Add Automatically') {
            return 'auto';
        } else if (choice === 'Manual Instructions') {
            return 'manual';
        } else {
            return 'cancel';
        }
    }
    
    /**
     * Add manager automatically via PMON (runtime) with fallback to config file
     */
    static async addManagerAutomatically(
        projectPath: string,
        mcpServerPath: string
    ): Promise<boolean> {
        ExtensionOutputChannel.info('=== Starting MCP Server Manager Installation ===');
        ExtensionOutputChannel.info(`Project Path: ${projectPath}`);
        ExtensionOutputChannel.info(`MCP Server Path: ${mcpServerPath}`);
        
        try {
            // Use relative path from project root
            const scriptPath = 'mcpServer\\\\index_http.js';
            ExtensionOutputChannel.info(`Manager script path: ${scriptPath}`);
            
            ExtensionOutputChannel.info('Adding MCP Server manager via npm-winccoa-core');
            
            // Step 1: Get project ID and WinCC OA version from Project Admin Extension
            let projectId: string | undefined;
            let winccOAVersion: string | undefined;
            
            ExtensionOutputChannel.info('Getting project info from Project Admin Extension...');
            const projectAdminExt = vscode.extensions.getExtension('richardjanisch.winccoa-project-admin');
            
            if (projectAdminExt) {
                ExtensionOutputChannel.info('Project Admin Extension found, activating...');
                try {
                    await projectAdminExt.activate();
                    const api = projectAdminExt.exports;
                    ExtensionOutputChannel.info(`Project Admin API available: ${!!api}`);
                    
                    if (api && api.getCurrentProject) {
                        const currentProject = api.getCurrentProject();
                        ExtensionOutputChannel.info(`Current project from API: ${JSON.stringify(currentProject)}`);
                        
                        if (currentProject) {
                            projectId = currentProject.id;
                            winccOAVersion = currentProject.version;
                            ExtensionOutputChannel.info(`✓ Using project from Project Admin Extension:`);
                            ExtensionOutputChannel.info(`  - Project ID: ${projectId}`);
                            ExtensionOutputChannel.info(`  - WinCC OA Version: ${winccOAVersion}`);
                        } else {
                            ExtensionOutputChannel.warn('getCurrentProject() returned null/undefined');
                        }
                    } else {
                        ExtensionOutputChannel.warn('Project Admin API or getCurrentProject() not available');
                    }
                } catch (error: any) {
                    ExtensionOutputChannel.error(`Could not get project from Project Admin Extension: ${error.message}`);
                    ExtensionOutputChannel.error(error.stack || error);
                }
            } else {
                ExtensionOutputChannel.warn('Project Admin Extension not found (richardjanisch.winccoa-project-admin)');
            }
            
            // Fallback for project ID: Extract from path
            if (!projectId) {
                projectId = path.basename(projectPath);
                ExtensionOutputChannel.info(`⚠ Using project name from path: ${projectId}`);
            }
            
            // Fallback for version: Try to extract from project config
            if (!winccOAVersion) {
                ExtensionOutputChannel.warn('WinCC OA version not available from Project Admin Extension');
                ExtensionOutputChannel.warn('Attempting to read from project config file...');
                
                try {
                    const configPath = path.join(projectPath, 'config', 'config');
                    const configContent = await vscode.workspace.fs.readFile(vscode.Uri.file(configPath));
                    const configText = Buffer.from(configContent).toString('utf-8');
                    
                    // Find pvss_path line with version
                    const pvssPathMatch = configText.match(/pvss_path\s*=\s*"([^"]*)"/i);
                    if (pvssPathMatch) {
                        const pvssPath = pvssPathMatch[1];
                        const versionMatch = pvssPath.match(/WinCC_OA[\\\\/]([\d\.]+)/);
                        if (versionMatch) {
                            winccOAVersion = versionMatch[1];
                            ExtensionOutputChannel.info(`⚠ Extracted version from project config: ${winccOAVersion}`);
                        }
                    }
                } catch (error: any) {
                    ExtensionOutputChannel.error(`Failed to read project config: ${error.message}`);
                }
            }
            
            if (!winccOAVersion) {
                throw new Error(
                    'Cannot determine WinCC OA version. Please ensure Project Admin Extension is installed and a project is selected.'
                );
            }
            
            // Step 2: Check if manager already exists
            ExtensionOutputChannel.info(`Initializing PMON component for project: ${projectId}`);
            ExtensionOutputChannel.info(`Using WinCC OA version: ${winccOAVersion}`);
            const pmon = new PmonComponent();
            pmon.setVersion(winccOAVersion);
            
            let managers;
            try {
                ExtensionOutputChannel.info('Fetching current manager list from PMON...');
                managers = await pmon.getManagerOptionsList(projectId);
                ExtensionOutputChannel.info(`Found ${managers.length} existing managers`);
                
                // Log all managers for debugging
                managers.forEach((m, idx) => {
                    ExtensionOutputChannel.debug(`Manager ${idx}: ${m.component} - ${m.startOptions || '(no options)'}`);
                });
                
                // Check for existing node manager with same script
                const exists = managers.some(m => 
                    m.component === 'node' && 
                    m.startOptions?.includes('mcpServer')
                );
                
                if (exists) {
                    ExtensionOutputChannel.info('✓ MCP Server manager already exists - skipping installation');
                    vscode.window.showWarningMessage(
                        'MCP Server manager already exists in project configuration.'
                    );
                    return true;
                }
                
                ExtensionOutputChannel.info('No existing MCP Server manager found - proceeding with installation');
            } catch (error: any) {
                ExtensionOutputChannel.error(`Failed to get manager list from PMON: ${error.message}`);
                ExtensionOutputChannel.error(error.stack || error);
                ExtensionOutputChannel.warn('Continuing with installation despite error...');
                managers = [];
            }
            
            // Step 3: Build manager options
            const managerOptions: ProjEnvManagerOptions = {
                component: 'node',
                startMode: 2, // always
                secondToKill: 30,
                resetMin: 1,
                resetStartCounter: 3,
                startOptions: scriptPath
            };
            
            ExtensionOutputChannel.info('Manager configuration:');
            ExtensionOutputChannel.info(`  - Component: ${managerOptions.component}`);
            ExtensionOutputChannel.info(`  - Start Mode: ${managerOptions.startMode} (2 = always)`);
            ExtensionOutputChannel.info(`  - Seconds to Kill: ${managerOptions.secondToKill}`);
            ExtensionOutputChannel.info(`  - Reset Min: ${managerOptions.resetMin}`);
            ExtensionOutputChannel.info(`  - Reset Start Counter: ${managerOptions.resetStartCounter}`);
            ExtensionOutputChannel.info(`  - Start Options: ${managerOptions.startOptions}`);
            
            // Step 4: Add manager at end of list
            const insertPosition = managers.length;
            
            ExtensionOutputChannel.info(`Inserting manager at position ${insertPosition} (end of list)`);
            ExtensionOutputChannel.info(`Calling PMON.insertManagerAt()...`);
            
            const exitCode = await pmon.insertManagerAt(
                managerOptions,
                projectId,
                insertPosition
            );
            
            ExtensionOutputChannel.info(`PMON.insertManagerAt() returned exit code: ${exitCode}`);
            
            if (exitCode === 0) {
                ExtensionOutputChannel.info('✅ Manager added successfully via PMON');
                
                // Show success message
                vscode.window.showInformationMessage(
                    '✅ MCP Server manager added successfully!\n\n' +
                    'The manager will start automatically with the project (start mode: always).',
                    'OK'
                );
                
                return true;
            } else {
                throw new Error(`PMON insertManagerAt failed with exit code: ${exitCode}`);
            }
            
        } catch (error: any) {
            ExtensionOutputChannel.error(`❌ Failed to add manager via PMON: ${error.message}`);
            ExtensionOutputChannel.error(error.stack || error);
            
            // Fallback to config file method
            ExtensionOutputChannel.info('Attempting fallback to config/progs file method...');
            return await this.addManagerViaConfigFile(projectPath, mcpServerPath);
        }
    }
    
    /**
     * Fallback: Add manager via config/progs file (legacy method)
     */
    private static async addManagerViaConfigFile(
        projectPath: string,
        mcpServerPath: string
    ): Promise<boolean> {
        ExtensionOutputChannel.info('=== Fallback: Adding manager via config/progs file ===');
        
        try {
            const scriptPath = 'mcpServer\\\\index_http.js';
            
            // Check if manager already exists
            ExtensionOutputChannel.info('Checking if manager already exists in config file...');
            const exists = await ManagerConfigWriter.managerExists(
                projectPath,
                'node',
                scriptPath
            );
            
            if (exists) {
                ExtensionOutputChannel.info('Manager already exists in config/progs');
                vscode.window.showWarningMessage(
                    'MCP Server manager already exists in project configuration.'
                );
                return true;
            }
            
            // Create manager entry
            const manager: ManagerEntry = {
                component: 'node',
                startMode: 'always',
                secKill: 30,
                restartCount: 3,
                resetMin: 1,
                options: scriptPath
            };
            
            ExtensionOutputChannel.info('Writing manager to config/progs file...');
            ExtensionOutputChannel.info(`Manager config: ${JSON.stringify(manager)}`);
            
            // Add to progs file
            await ManagerConfigWriter.addManager(projectPath, manager);
            
            ExtensionOutputChannel.info('✅ Manager added successfully to config/progs file');
            
            // Show success message with restart reminder
            vscode.window.showInformationMessage(
                '✅ MCP Server manager added successfully!\n\n' +
                '⚠️ IMPORTANT: You must restart the WinCC OA project for the manager to appear.\n\n' +
                'After restart, the manager will start automatically (start mode: always).',
                'OK'
            );
            
            return true;
            
        } catch (error: any) {
            ExtensionOutputChannel.error(`❌ Failed to add manager via config file: ${error.message}`);
            ExtensionOutputChannel.error(error.stack || error);
            vscode.window.showErrorMessage(
                `Failed to add MCP Server manager: ${error.message}`
            );
            return false;
        }
    }
    
    /**
     * Show manual installation instructions
     */
    static async showManualInstructions(
        projectPath: string,
        mcpServerPath: string
    ): Promise<void> {
        const scriptPath = path.join(mcpServerPath, 'index_http.js');
        const nextNum = await ManagerConfigWriter.getNextFreeManagerNumber(projectPath);
        
        const instructions = [
            '# Manual MCP Server Manager Setup',
            '',
            '## Option 1: Via PMON Console (Recommended)',
            '1. Open your WinCC OA project',
            '2. Open PMON Console',
            '3. Click "Add Manager" (or similar button)',
            '4. Configure the new JavaScript manager:',
            '',
            '**Manager Settings:**',
            `- Component: \`node\``,
            `- Start Mode: \`always\``,
            `- Seconds to Kill: \`30\``,
            `- Restart Count: \`3\``,
            `- Reset Min: \`1\``,
            `- Options: \`-num ${nextNum} mcpServer ${scriptPath}\``,
            '',
            '5. Save the manager configuration',
            '6. Start the manager manually',
            '',
            '## Option 2: Edit config/progs File',
            '1. Open the file: `<project>/config/progs`',
            '2. Add this line at the end (before comments):',
            '',
            '```',
            `node             | always |      30 |        3 |        1 |-num ${nextNum} mcpServer ${scriptPath}`,
            '```',
            '',
            '3. Save the file',
            '4. Restart your WinCC OA project',
            '5. Start the manager in PMON Console',
            '',
            '---',
            '',
            '**Copy the options line for easy use:**',
            `\`-num ${nextNum} mcpServer ${scriptPath}\``
        ].join('\n');
        
        // Create webview panel for instructions
        const panel = vscode.window.createWebviewPanel(
            'mcpManagerInstructions',
            'MCP Server Manager - Manual Setup',
            vscode.ViewColumn.One,
            {
                enableScripts: false
            }
        );
        
        panel.webview.html = this.getInstructionsHtml(instructions, scriptPath, nextNum);
        
        // Also log to output channel
        ExtensionOutputChannel.info('='.repeat(60));
        ExtensionOutputChannel.info('MCP Server Manager - Manual Setup Instructions');
        ExtensionOutputChannel.info('='.repeat(60));
        ExtensionOutputChannel.info(instructions);
        ExtensionOutputChannel.info('='.repeat(60));
    }
    
    /**
     * Show manager configuration details
     */
    private static showManagerDetails(manager: ManagerEntry): void {
        const details = [
            'Manager Configuration:',
            `- Component: ${manager.component}`,
            `- Start Mode: ${manager.startMode}`,
            `- Seconds to Kill: ${manager.secKill}`,
            `- Restart Count: ${manager.restartCount}`,
            `- Reset Min: ${manager.resetMin}`,
            `- Options: ${manager.options}`
        ].join('\n');
        
        vscode.window.showInformationMessage(details);
        ExtensionOutputChannel.info(details);
    }
    
    /**
     * Generate HTML for instructions webview
     */
    private static getInstructionsHtml(instructions: string, scriptPath: string, managerNum: number): string {
        // Convert markdown to simple HTML
        const htmlContent = instructions
            .replace(/^# (.*)/gm, '<h1>$1</h1>')
            .replace(/^## (.*)/gm, '<h2>$1</h2>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/^---$/gm, '<hr>')
            .replace(/^```$/gm, '')
            .replace(/^\d+\. (.*)/gm, '<li>$1</li>')
            .replace(/^- (.*)/gm, '<li>$1</li>')
            .replace(/\n/g, '<br>');
        
        const optionsLine = `-num ${managerNum} mcpServer ${scriptPath}`;
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP Server Manager Setup</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        h1 {
            color: var(--vscode-textPreformat-foreground);
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 10px;
        }
        h2 {
            color: var(--vscode-textLink-foreground);
            margin-top: 30px;
        }
        code {
            background-color: var(--vscode-textBlockQuote-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
        }
        .copy-box {
            background-color: var(--vscode-textBlockQuote-background);
            border: 1px solid var(--vscode-panel-border);
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
            font-family: var(--vscode-editor-font-family);
        }
        .copy-box pre {
            margin: 0;
            overflow-x: auto;
        }
        strong {
            color: var(--vscode-textPreformat-foreground);
        }
        hr {
            border: none;
            border-top: 1px solid var(--vscode-panel-border);
            margin: 30px 0;
        }
        ul {
            padding-left: 20px;
        }
        li {
            margin: 5px 0;
        }
    </style>
</head>
<body>
    <h1>🚀 MCP Server Manager - Manual Setup Instructions</h1>
    
    <h2>Option 1: Via PMON Console (Recommended)</h2>
    <ol>
        <li>Open your WinCC OA project</li>
        <li>Open PMON Console</li>
        <li>Click "Add Manager" or similar button</li>
        <li>Configure the new JavaScript manager with these settings:</li>
    </ol>
    
    <div class="copy-box">
        <strong>Manager Settings:</strong><br><br>
        <strong>Component:</strong> <code>node</code><br>
        <strong>Start Mode:</strong> <code>always</code><br>
        <strong>Seconds to Kill:</strong> <code>30</code><br>
        <strong>Restart Count:</strong> <code>3</code><br>
        <strong>Reset Min:</strong> <code>1</code><br>
        <strong>Options:</strong><br>
        <pre><code>${optionsLine}</code></pre>
    </div>
    
    <ol start="5">
        <li>Save the manager configuration</li>
        <li>Start the manager manually in PMON</li>
    </ol>
    
    <hr>
    
    <h2>Option 2: Edit config/progs File</h2>
    <ol>
        <li>Open the file: <code>&lt;project&gt;/config/progs</code></li>
        <li>Add this line at the end (before any comments):</li>
    </ol>
    
    <div class="copy-box">
        <pre>node             | always |      30 |        3 |        1 |${optionsLine}</pre>
    </div>
    
    <ol start="3">
        <li>Save the file</li>
        <li><strong>Restart your WinCC OA project</strong></li>
        <li>Start the manager in PMON Console</li>
    </ol>
    
    <hr>
    
    <h2>📋 Quick Copy - Options Line</h2>
    <div class="copy-box">
        <pre>${optionsLine}</pre>
    </div>
    
    <p><em>This is the exact options string to paste into the PMON Console manager configuration.</em></p>
</body>
</html>`;
    }
}
