/**
 * MCP Server Setup Wizard
 * 
 * Automatically installs MCP Server if not present in project
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { ExtensionOutputChannel } from './extensionOutput';
import { ManagerInstallationHelper } from './managerInstallationHelper';

export class SetupWizard {
    private static readonly MCP_REPO_URL = 'https://github.com/winccoa/winccoa-ae-js-mcpserver.git';
    private static readonly MCP_SUBPATH = 'javascript/mcpServer';

    /**
     * Check if MCP Server is installed in project
     */
    static async isMcpServerInstalled(projectDir: string): Promise<boolean> {
        const mcpPath = path.join(projectDir, this.MCP_SUBPATH);
        try {
            await fs.access(mcpPath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Reset MCP Server (delete folder) and reinstall
     */
    static async resetAndReinstall(projectDir: string, projectName: string): Promise<boolean> {
        ExtensionOutputChannel.info(`Resetting MCP Server for project: ${projectName}`);

        const mcpPath = path.join(projectDir, this.MCP_SUBPATH);

        try {
            // Step 1: Check if MCP Server exists
            const isInstalled = await this.isMcpServerInstalled(projectDir);
            if (!isInstalled) {
                ExtensionOutputChannel.info('MCP Server not installed - running setup instead');
                return await this.runSetup(projectDir, projectName);
            }

            // Step 2: Delete MCP Server folder
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Resetting MCP Server for ${projectName}`,
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: 'Deleting MCP Server folder...' });
                
                try {
                    await fs.rm(mcpPath, { recursive: true, force: true });
                    ExtensionOutputChannel.info(`Deleted folder: ${mcpPath}`);
                } catch (error: any) {
                    ExtensionOutputChannel.warn(`Could not delete folder (may not exist): ${error.message}`);
                }

                progress.report({ increment: 20, message: 'Cloning repository...' });
                await this.cloneRepository(projectDir);

                progress.report({ increment: 40, message: 'Installing dependencies...' });
                await this.installDependencies(projectDir);

                progress.report({ increment: 60, message: 'Generating security token...' });
                const token = this.generateToken();

                progress.report({ increment: 70, message: 'Creating configuration...' });
                await this.createEnvFile(projectDir, token);

                progress.report({ increment: 90, message: 'Building MCP Server...' });
                await this.buildMcpServer(projectDir);

                progress.report({ increment: 100, message: 'Reset complete!' });
            });

            ExtensionOutputChannel.info('✅ MCP Server reset and reinstalled successfully');
            ExtensionOutputChannel.info('Note: Manager entry in config/progs was NOT modified');

            return true;

        } catch (error: any) {
            ExtensionOutputChannel.error(`Reset failed: ${error.message}`);
            vscode.window.showErrorMessage(`MCP Server reset failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Run auto-setup wizard
     */
    static async runSetup(projectDir: string, projectName: string): Promise<boolean> {
        ExtensionOutputChannel.info(`Starting MCP Server setup for project: ${projectName}`);

        // Ask user for confirmation
        const answer = await vscode.window.showInformationMessage(
            `MCP Server not found in project "${projectName}". Install now?`,
            { modal: true },
            'Install',
            'Skip'
        );

        if (answer !== 'Install') {
            ExtensionOutputChannel.info('Setup cancelled by user');
            return false;
        }

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Installing MCP Server for ${projectName}`,
                cancellable: false
            }, async (progress) => {
                // Step 1: Clone Repository
                progress.report({ increment: 0, message: 'Cloning repository...' });
                await this.cloneRepository(projectDir);

                // Step 2: Install Dependencies
                progress.report({ increment: 20, message: 'Installing dependencies...' });
                await this.installDependencies(projectDir);

                // Step 3: Generate Token
                progress.report({ increment: 40, message: 'Generating security token...' });
                const token = this.generateToken();

                // Step 4: Create .env File
                progress.report({ increment: 60, message: 'Creating configuration...' });
                await this.createEnvFile(projectDir, token);

                // Step 5: Build MCP Server
                progress.report({ increment: 80, message: 'Building MCP Server...' });
                await this.buildMcpServer(projectDir);

                progress.report({ increment: 100, message: 'Installation complete!' });
            });

            // Ask user for manager installation
            const mcpServerPath = path.join(projectDir, this.MCP_SUBPATH, 'mcpWinCCOA');
            const choice = await ManagerInstallationHelper.askUserForInstallation(mcpServerPath);
            
            if (choice === 'auto') {
                await ManagerInstallationHelper.addManagerAutomatically(projectDir, mcpServerPath);
            } else if (choice === 'manual') {
                await ManagerInstallationHelper.showManualInstructions(projectDir, mcpServerPath);
            }

            ExtensionOutputChannel.info('✅ MCP Server setup completed successfully');
            return true;

        } catch (error: any) {
            ExtensionOutputChannel.error(`Setup failed: ${error.message}`);
            vscode.window.showErrorMessage(`MCP Server installation failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Clone MCP Server repository
     */
    private static async cloneRepository(projectDir: string): Promise<void> {
        const targetPath = path.join(projectDir, this.MCP_SUBPATH);
        
        // Ensure parent directory exists
        await fs.mkdir(path.join(projectDir, 'javascript'), { recursive: true });

        ExtensionOutputChannel.info(`Cloning repository to: ${targetPath}`);

        // Execute git clone
        const result = await this.executeCommand(
            'git',
            ['clone', this.MCP_REPO_URL, targetPath],
            projectDir
        );

        if (result.exitCode !== 0) {
            throw new Error(`Git clone failed: ${result.stderr}`);
        }

        ExtensionOutputChannel.info('Repository cloned successfully');
    }

    /**
     * Install NPM dependencies
     */
    private static async installDependencies(projectDir: string): Promise<void> {
        const mcpPath = path.join(projectDir, this.MCP_SUBPATH, 'mcpWinCCOA');
        ExtensionOutputChannel.info(`Installing dependencies in: ${mcpPath}`);

        // Step 1: Install package dependencies
        const result = await this.executeCommand('npm', ['install'], mcpPath);

        if (result.exitCode !== 0) {
            throw new Error(`npm install failed: ${result.stderr}`);
        }

        ExtensionOutputChannel.info('Dependencies installed successfully');

        // Step 2: Install winccoa-manager from local WinCC OA installation
        await this.installWinCCOAManager(projectDir);
    }

    /**
     * Install winccoa-manager package from WinCC OA installation
     */
    private static async installWinCCOAManager(projectDir: string): Promise<void> {
        const mcpPath = path.join(projectDir, this.MCP_SUBPATH, 'mcpWinCCOA');

        // Find WinCC OA installation (Linux path)
        const winCCOAPaths = [
            '/opt/WinCC_OA/3.21/javascript/winccoa-manager',
            '/opt/WinCC_OA/3.20/javascript/winccoa-manager',
            '/opt/WinCC_OA/3.19/javascript/winccoa-manager'
        ];

        let winCCOAManagerPath: string | null = null;
        for (const testPath of winCCOAPaths) {
            try {
                await fs.access(testPath);
                winCCOAManagerPath = testPath;
                ExtensionOutputChannel.info(`Found winccoa-manager at: ${testPath}`);
                break;
            } catch {
                // Continue searching
            }
        }

        if (!winCCOAManagerPath) {
            throw new Error('WinCC OA installation not found. Please ensure WinCC OA is installed in /opt/WinCC_OA/');
        }

        // Install winccoa-manager via npm
        ExtensionOutputChannel.info(`Installing winccoa-manager from: ${winCCOAManagerPath}`);
        const installResult = await this.executeCommand(
            'npm',
            ['install', `file:${winCCOAManagerPath}`],
            mcpPath
        );

        if (installResult.exitCode !== 0) {
            throw new Error(`Failed to install winccoa-manager: ${installResult.stderr}`);
        }

        ExtensionOutputChannel.info('winccoa-manager installed successfully');
    }

    /**
     * Generate secure random token
     */
    private static generateToken(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Create .env configuration file
     */
    private static async createEnvFile(projectDir: string, token: string): Promise<void> {
        const envPath = path.join(projectDir, this.MCP_SUBPATH, 'mcpWinCCOA', 'build', '.env');

        const envContent = `# WinCC OA MCP Server Configuration
# Auto-generated by WinCC OA MCP Server Extension

# Security Token (keep secret!)
MCP_API_TOKEN=${token}

# Server Mode and Port
MCP_MODE=http
MCP_HTTP_PORT=3001
MCP_HTTP_HOST=0.0.0.0

# Authentication
MCP_AUTH_TYPE=bearer

# Rate Limiting
RATE_LIMIT_ENABLED=true

# CORS Configuration
MCP_CORS_ENABLED=true
MCP_CORS_ORIGINS=*

# WinCC OA Field (usually "default")
WINCCOA_FIELD=default

# Available Tools (comma-separated)
TOOLS=datapoints/dp_basic,datapoints/dp_create,datapoints/dp_set,manager/manager_list,archive/archive_query,dptypes/dptype_basic
`;

        // Ensure build directory exists
        await fs.mkdir(path.dirname(envPath), { recursive: true });

        await fs.writeFile(envPath, envContent, 'utf8');
        ExtensionOutputChannel.info(`Configuration file created: ${envPath}`);
    }

    /**
     * Build MCP Server
     */
    private static async buildMcpServer(projectDir: string): Promise<void> {
        const mcpPath = path.join(projectDir, this.MCP_SUBPATH, 'mcpWinCCOA');
        ExtensionOutputChannel.info(`Building MCP Server in: ${mcpPath}`);

        const result = await this.executeCommand('npm', ['run', 'build'], mcpPath);

        if (result.exitCode !== 0) {
            throw new Error(`npm build failed: ${result.stderr}`);
        }

        ExtensionOutputChannel.info('MCP Server built successfully');
    }

    /**
     * Show PMON integration instructions
     */
    private static async showPmonInstructions(projectDir: string): Promise<void> {
        const instructions = `# Manual Step Required: Add MCP Server Manager to PMON

1. Open your WinCC OA project config: ${projectDir}/config/progs

2. Add the following line to start the MCP Server manager:

node -num 3 manual 1 1 2 2 javascript/mcpServer/mcpWinCCOA/build/index_http.js

3. Save the file and restart PMON

Note: Automatic PMON integration will be added in a future version.`;

        const doc = await vscode.workspace.openTextDocument({
            content: instructions,
            language: 'markdown'
        });

        await vscode.window.showTextDocument(doc);
    }

    /**
     * Execute shell command
     */
    private static async executeCommand(
        command: string,
        args: string[],
        cwd: string
    ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            const proc = spawn(command, args, { cwd, shell: true });

            let stdout = '';
            let stderr = '';

            proc.stdout?.on('data', (data: Buffer) => {
                stdout += data.toString();
                ExtensionOutputChannel.debug(data.toString().trim());
            });

            proc.stderr?.on('data', (data: Buffer) => {
                stderr += data.toString();
                ExtensionOutputChannel.debug(data.toString().trim());
            });

            proc.on('close', (code: number) => {
                resolve({ exitCode: code, stdout, stderr });
            });

            proc.on('error', (error: Error) => {
                reject(error);
            });
        });
    }
}
