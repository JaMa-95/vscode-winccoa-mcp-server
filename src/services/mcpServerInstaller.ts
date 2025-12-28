/**
 * MCP Server Installer
 * Handles git clone and npm install for WinCC OA MCP Server
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import simpleGit from 'simple-git';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const MCP_REPO_URL = 'https://github.com/winccoa/winccoa-ae-js-mcpserver.git';
const MCP_INSTALL_DIR = 'javascript/mcpServer';

export class MCPServerInstaller {
    private outputChannel: vscode.OutputChannel;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }

    /**
     * Install MCP Server into WinCC OA project
     * @param projectPath - Absolute path to WinCC OA project
     */
    async install(projectPath: string): Promise<{ success: boolean; installPath?: string; error?: string }> {
        this.outputChannel.appendLine('🔄 Starting MCP Server installation...');

        try {
            const installPath = path.join(projectPath, MCP_INSTALL_DIR);

            // Check if already installed
            const exists = await this.checkInstallation(installPath);
            if (exists) {
                this.outputChannel.appendLine('⚠️ MCP Server already installed');
                const overwrite = await vscode.window.showWarningMessage(
                    'MCP Server already exists in this project. Overwrite?',
                    'Yes', 'No'
                );
                if (overwrite !== 'Yes') {
                    return { success: false, error: 'Installation cancelled by user' };
                }
                // Remove existing installation
                await fs.rm(installPath, { recursive: true, force: true });
            }

            // Ensure javascript directory exists
            const javascriptDir = path.join(projectPath, 'javascript');
            await fs.mkdir(javascriptDir, { recursive: true });

            // Clone repository
            this.outputChannel.appendLine(`📥 Cloning MCP Server from ${MCP_REPO_URL}...`);
            await this.cloneRepository(javascriptDir);

            // Install NPM dependencies
            this.outputChannel.appendLine('📦 Installing dependencies...');
            await this.installDependencies(installPath);

            this.outputChannel.appendLine('✅ MCP Server installed successfully!');
            return { success: true, installPath };

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Installation failed: ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
    }

    /**
     * Check if MCP Server is already installed
     */
    private async checkInstallation(installPath: string): Promise<boolean> {
        try {
            await fs.access(path.join(installPath, 'mcpWinCCOA', 'package.json'));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Clone MCP Server repository
     */
    private async cloneRepository(targetDir: string): Promise<void> {
        const git = simpleGit();
        await git.clone(MCP_REPO_URL, path.join(targetDir, 'mcpServer'));
    }

    /**
     * Install NPM dependencies for MCP Server
     */
    private async installDependencies(installPath: string): Promise<void> {
        const mcpServerDir = path.join(installPath, 'mcpWinCCOA');

        this.outputChannel.appendLine(`  Running npm install in ${mcpServerDir}...`);

        // Run npm install
        const { stdout, stderr } = await execAsync('npm install', {
            cwd: mcpServerDir,
            env: { ...process.env, NODE_ENV: 'production' }
        });

        if (stdout) this.outputChannel.appendLine(stdout);
        if (stderr) this.outputChannel.appendLine(stderr);
    }

    /**
     * Uninstall MCP Server from project
     */
    async uninstall(projectPath: string): Promise<void> {
        const installPath = path.join(projectPath, MCP_INSTALL_DIR);
        
        this.outputChannel.appendLine('🗑️ Uninstalling MCP Server...');
        await fs.rm(installPath, { recursive: true, force: true });
        this.outputChannel.appendLine('✅ MCP Server uninstalled');
    }
}
