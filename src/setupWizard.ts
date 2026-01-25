/**
 * MCP Server Setup Wizard
 * 
 * Automatically installs MCP Server if not present in project
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import simpleGit from 'simple-git';
import { ExtensionOutputChannel } from './extensionOutput';
import { ManagerInstallationHelper } from './managerInstallationHelper';

export class SetupWizard {
    private static readonly MCP_NPM_PACKAGE = '@etm-professional-control/winccoa-mcp-server';
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
    static async resetAndReinstall(projectDir: string, projectName: string, oaInstallPath: string): Promise<boolean> {
        ExtensionOutputChannel.info(`Resetting MCP Server for project: ${projectName}`);
        ExtensionOutputChannel.info(`Using WinCC OA installation: ${oaInstallPath}`);

        const mcpPath = path.join(projectDir, this.MCP_SUBPATH);

        try {
            // Step 1: Check if MCP Server exists
            const isInstalled = await this.isMcpServerInstalled(projectDir);
            if (!isInstalled) {
                ExtensionOutputChannel.info('MCP Server not installed - running setup instead');
                return await this.runSetup(projectDir, projectName, oaInstallPath);
            }

            // Step 2: Delete MCP Server folder and reinstall
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

                // Get install method from settings
                const config = vscode.workspace.getConfiguration('winccoa.mcp');
                const installMethod = config.get<string>('installMethod', 'git');

                progress.report({ increment: 20, message: `Installing via ${installMethod}...` });
                
                if (installMethod === 'git') {
                    await this.installFromGit(projectDir, oaInstallPath);
                } else {
                    await this.installFromNpm(projectDir, oaInstallPath);
                }

                progress.report({ increment: 85, message: 'Generating security token...' });
                const token = this.generateToken();

                progress.report({ increment: 95, message: 'Creating configuration...' });
                await this.createEnvFile(projectDir, token);

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
    static async runSetup(projectDir: string, projectName: string, oaInstallPath: string): Promise<boolean> {
        ExtensionOutputChannel.info(`Starting MCP Server setup for project: ${projectName}`);
        ExtensionOutputChannel.info(`Using WinCC OA installation: ${oaInstallPath}`);

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
            // Get install method from settings
            const config = vscode.workspace.getConfiguration('winccoa.mcp');
            const installMethod = config.get<string>('installMethod', 'git');

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Installing MCP Server for ${projectName}`,
                cancellable: false
            }, async (progress) => {
                // Step 1: Install MCP Server (NPM or Git)
                progress.report({ increment: 0, message: `Installing via ${installMethod}...` });
                
                if (installMethod === 'git') {
                    await this.installFromGit(projectDir, oaInstallPath);
                } else {
                    await this.installFromNpm(projectDir, oaInstallPath);
                }

                // Step 2: Generate Token
                progress.report({ increment: 80, message: 'Generating security token...' });
                const token = this.generateToken();

                // Step 3: Create .env File
                progress.report({ increment: 90, message: 'Creating configuration...' });
                await this.createEnvFile(projectDir, token);

                progress.report({ increment: 100, message: 'Installation complete!' });
            });

            // Ask user for manager installation
            const mcpServerPath = path.join(projectDir, this.MCP_SUBPATH);
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
     * Install MCP Server from NPM package
     */
    private static async installFromNpm(projectDir: string, oaInstallPath: string): Promise<void> {
        const mcpServerDir = path.join(projectDir, this.MCP_SUBPATH);
        
        // Create directory structure
        await fs.mkdir(mcpServerDir, { recursive: true });

        ExtensionOutputChannel.info(`Installing NPM package to: ${mcpServerDir}`);

        // Install NPM package (postinstall.cjs will copy files automatically)
        const result = await this.executeCommand(
            'npm',
            ['install', this.MCP_NPM_PACKAGE],
            mcpServerDir
        );

        if (result.exitCode !== 0) {
            throw new Error(`npm install failed: ${result.stderr}`);
        }

        ExtensionOutputChannel.info('✅ MCP Server package installed successfully');
        ExtensionOutputChannel.info('✅ postinstall copied files to installation directory');

        // Install winccoa-manager
        await this.installWinCCOAManager(projectDir, oaInstallPath);
    }

    /**
     * Install MCP Server from Git repository
     */
    private static async installFromGit(projectDir: string, oaInstallPath: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('winccoa.mcp');
        const gitUrl = config.get<string>('gitRepositoryUrl', 'https://github.com/RichardJanisch/winccoa-ae-js-mcpserver.git');
        const gitBranch = config.get<string>('gitBranch', 'main');

        const mcpServerDir = path.join(projectDir, this.MCP_SUBPATH);
        const tempBuildDir = path.join(projectDir, 'javascript', '.mcp-build-temp');

        ExtensionOutputChannel.info(`Installing from Git: ${gitUrl} (branch: ${gitBranch})`);

        try {
            // Step 1: Clean up temp and target directories
            await fs.rm(tempBuildDir, { recursive: true, force: true });
            await fs.rm(mcpServerDir, { recursive: true, force: true });

            // Step 2: Clone repository
            ExtensionOutputChannel.info(`Cloning repository to: ${tempBuildDir}`);
            const git = simpleGit();
            await git.clone(gitUrl, tempBuildDir, ['--branch', gitBranch, '--depth', '1']);
            ExtensionOutputChannel.info('✅ Git clone successful');

            // Step 3: Detect source directory (mcpWinCCOA subdirectory or root)
            const mcpWinCCOAPath = path.join(tempBuildDir, 'mcpWinCCOA');
            let buildSourceDir: string;
            
            try {
                await fs.access(mcpWinCCOAPath);
                buildSourceDir = mcpWinCCOAPath;
                ExtensionOutputChannel.info('Using mcpWinCCOA subdirectory');
            } catch {
                buildSourceDir = tempBuildDir;
                ExtensionOutputChannel.info('Using repository root');
            }

            // Step 4: Clean old package-lock.json
            try {
                await fs.rm(path.join(buildSourceDir, 'package-lock.json'), { force: true });
            } catch {}

            // Step 5: Install ALL dependencies (including devDependencies for TypeScript)
            ExtensionOutputChannel.info('Installing dependencies (including TypeScript)...');
            const installResult = await this.executeCommand('npm', ['install'], buildSourceDir);
            if (installResult.exitCode !== 0) {
                throw new Error(`npm install failed: ${installResult.stderr}`);
            }

            // Step 6: Build TypeScript
            ExtensionOutputChannel.info('Building TypeScript sources...');
            const buildResult = await this.executeCommand('npx', ['tsc'], buildSourceDir);
            if (buildResult.exitCode !== 0) {
                throw new Error(`TypeScript build failed: ${buildResult.stderr}`);
            }

            // Step 7: Create final installation directory
            await fs.mkdir(mcpServerDir, { recursive: true });

            // Step 8: Copy build/* contents to ROOT (mimicking NPM postinstall)
            ExtensionOutputChannel.info('Copying build files to installation directory...');
            const buildDir = path.join(buildSourceDir, 'build');
            await this.copyDirectoryContents(buildDir, mcpServerDir);

            // Step 9: Copy additional files
            await this.copyFileIfExists(path.join(buildSourceDir, '.env.example'), path.join(mcpServerDir, '.env.example'));
            await this.copyFileIfExists(path.join(buildSourceDir, 'src', 'systemprompt.md'), path.join(mcpServerDir, 'systemprompt.md'));
            await this.copyFileIfExists(path.join(buildSourceDir, 'package.json'), path.join(mcpServerDir, 'package.json'));
            await this.copyFileIfExists(path.join(buildSourceDir, 'postinstall.cjs'), path.join(mcpServerDir, 'postinstall.cjs'));
            await this.copyFileIfExists(path.join(buildSourceDir, 'config', 'demo-project-instructions.md'), path.join(mcpServerDir, 'demo-project-instructions.md'));
            await this.copyDirectoryIfExists(path.join(buildSourceDir, 'src', 'fields'), path.join(mcpServerDir, 'fields'));

            // Step 10: Install production dependencies
            ExtensionOutputChannel.info('Installing production dependencies...');
            const prodInstallResult = await this.executeCommand('npm', ['install', '--omit=dev'], mcpServerDir);
            if (prodInstallResult.exitCode !== 0) {
                throw new Error(`Production install failed: ${prodInstallResult.stderr}`);
            }

            // Step 11: Install winccoa-manager
            await this.installWinCCOAManager(projectDir, oaInstallPath);

            // Step 12: Cleanup temp directory
            await fs.rm(tempBuildDir, { recursive: true, force: true });

            ExtensionOutputChannel.info('✅ Git installation completed successfully');

        } catch (error: any) {
            // Cleanup on error
            try {
                await fs.rm(tempBuildDir, { recursive: true, force: true });
            } catch {}
            throw error;
        }
    }

    /**
     * Copy directory contents recursively
     */
    private static async copyDirectoryContents(source: string, dest: string): Promise<void> {
        const entries = await fs.readdir(source, { withFileTypes: true });
        
        for (const entry of entries) {
            const sourcePath = path.join(source, entry.name);
            const destPath = path.join(dest, entry.name);
            
            if (entry.isDirectory()) {
                await fs.cp(sourcePath, destPath, { recursive: true });
            } else {
                await fs.copyFile(sourcePath, destPath);
            }
        }
    }

    /**
     * Copy file if it exists
     */
    private static async copyFileIfExists(source: string, dest: string): Promise<void> {
        try {
            await fs.copyFile(source, dest);
            ExtensionOutputChannel.debug(`Copied: ${path.basename(source)}`);
        } catch {
            ExtensionOutputChannel.debug(`Skipped (not found): ${path.basename(source)}`);
        }
    }

    /**
     * Copy directory if it exists
     */
    private static async copyDirectoryIfExists(source: string, dest: string): Promise<void> {
        try {
            await fs.access(source);
            await fs.cp(source, dest, { recursive: true });
            ExtensionOutputChannel.debug(`Copied directory: ${path.basename(source)}`);
        } catch {
            ExtensionOutputChannel.debug(`Skipped directory (not found): ${path.basename(source)}`);
        }
    }



    /**
     * Install winccoa-manager package from WinCC OA installation
     */
    private static async installWinCCOAManager(projectDir: string, oaInstallPath: string): Promise<void> {
        const mcpServerDir = path.join(projectDir, this.MCP_SUBPATH);

        if (!oaInstallPath) {
            throw new Error('WinCC OA installation path not provided by Project Admin Extension');
        }

        // Build path to winccoa-manager package
        const winCCOAManagerPath = path.join(oaInstallPath, 'javascript', 'winccoa-manager');
        
        ExtensionOutputChannel.info(`Looking for winccoa-manager at: ${winCCOAManagerPath}`);
        
        // Verify package exists
        try {
            await fs.access(winCCOAManagerPath);
            ExtensionOutputChannel.info(`✅ Found winccoa-manager package`);
        } catch {
            throw new Error(`WinCC OA Manager package not found at: ${winCCOAManagerPath}`);
        }

        // Install winccoa-manager via npm
        ExtensionOutputChannel.info(`Installing winccoa-manager from: ${winCCOAManagerPath}`);
        const installResult = await this.executeCommand(
            'npm',
            ['install', `"file:${winCCOAManagerPath}"`],
            mcpServerDir
        );

        if (installResult.exitCode !== 0) {
            throw new Error(`Failed to install winccoa-manager: ${installResult.stderr}`);
        }

        ExtensionOutputChannel.info('✅ winccoa-manager installed successfully');
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
        const envPath = path.join(projectDir, this.MCP_SUBPATH, '.env');

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
TOOLS=datapoints/dp_basic,datapoints/dp_create,datapoints/dp_set,datapoints/dp_types,datapoints/dp_type_create,manager/manager_list,manager/manager_add,manager/manager_control,manager/manager_properties,manager/manager_remove,archive/archive_query,archive/archive_set,archive/archive_delete,alarms/alarm_set,alarms/alarm_delete,common/common_query,common/common_set,common/common_delete,pv_range/pv_range_query,pv_range/pv_range_set,pv_range/pv_range_delete,modbus/modbus_address,opcua/opcua_address,opcua/opcua_connection,dashboards/dashboard,dashboards/widget,icons/icon
`;

        // Ensure build directory exists
        await fs.mkdir(path.dirname(envPath), { recursive: true });

        await fs.writeFile(envPath, envContent, 'utf8');
        ExtensionOutputChannel.info(`Configuration file created: ${envPath}`);
    }



    /**
     * Show PMON integration instructions
     */
    private static async showPmonInstructions(projectDir: string): Promise<void> {
        const instructions = `# Manual Step Required: Add MCP Server Manager to PMON

1. Open your WinCC OA project config: ${projectDir}/config/progs

2. Add the following line to start the MCP Server manager:

node -num 3 manual 1 1 2 2 javascript/mcpServer/index_http.js

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
