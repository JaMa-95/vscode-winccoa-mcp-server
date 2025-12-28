import * as vscode from 'vscode';
import { MCPServerAPI, MCPSetupOptions, MCPSetupResult, MCPStatus, MCPConfig } from './api/mcpCommands';
import { MCPServerInstaller } from './services/mcpServerInstaller';
import { MCPConfigManager } from './services/mcpConfigManager';
import { MCPManagerControl } from './services/mcpManagerControl';
import { ExtensionOutputChannel } from './extensionOutput';

let installer: MCPServerInstaller;
let configManager: MCPConfigManager;
let managerControl: MCPManagerControl;

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext): MCPServerAPI {
    ExtensionOutputChannel.info('WinCC OA MCP Server Extension activating...');

    const outputChannel = ExtensionOutputChannel.getInstance();

    // Initialize services
    installer = new MCPServerInstaller(outputChannel);
    configManager = new MCPConfigManager(outputChannel);
    managerControl = new MCPManagerControl(outputChannel);

    // Register commands
    registerCommands(context);

    ExtensionOutputChannel.info('✅ WinCC OA MCP Server Extension activated');

    // Return API for Core Extension
    return createAPI();
}

/**
 * Extension deactivation
 */
export function deactivate() {
    ExtensionOutputChannel.info('WinCC OA MCP Server Extension deactivating...');
}

/**
 * Register VS Code commands
 */
function registerCommands(context: vscode.ExtensionContext) {
    // Setup Wizard
    context.subscriptions.push(
        vscode.commands.registerCommand('winccoa.mcp.setup', async () => {
            ExtensionOutputChannel.show();
            vscode.window.showInformationMessage('MCP Setup Wizard - Coming soon!');
            // TODO: Open Setup Wizard Webview
        })
    );

    // Start Server
    context.subscriptions.push(
        vscode.commands.registerCommand('winccoa.mcp.start', async () => {
            ExtensionOutputChannel.show();
            try {
                // TODO: Get project from Core Extension
                const projectName = 'DevEnv'; // Placeholder
                await managerControl.startManager(projectName);
                vscode.window.showInformationMessage('MCP Server started');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to start MCP Server: ${error}`);
            }
        })
    );

    // Stop Server
    context.subscriptions.push(
        vscode.commands.registerCommand('winccoa.mcp.stop', async () => {
            ExtensionOutputChannel.show();
            try {
                const projectName = 'DevEnv'; // Placeholder
                await managerControl.stopManager(projectName);
                vscode.window.showInformationMessage('MCP Server stopped');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to stop MCP Server: ${error}`);
            }
        })
    );

    // Restart Server
    context.subscriptions.push(
        vscode.commands.registerCommand('winccoa.mcp.restart', async () => {
            ExtensionOutputChannel.show();
            try {
                const projectName = 'DevEnv'; // Placeholder
                await managerControl.restartManager(projectName);
                vscode.window.showInformationMessage('MCP Server restarted');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to restart MCP Server: ${error}`);
            }
        })
    );

    // Show Logs
    context.subscriptions.push(
        vscode.commands.registerCommand('winccoa.mcp.showLogs', () => {
            ExtensionOutputChannel.show();
        })
    );

    // Diagnostics
    context.subscriptions.push(
        vscode.commands.registerCommand('winccoa.mcp.diagnostics', async () => {
            ExtensionOutputChannel.show();
            vscode.window.showInformationMessage('MCP Diagnostics - Coming soon!');
            // TODO: Open Diagnostics Webview
        })
    );

    // Update Configuration
    context.subscriptions.push(
        vscode.commands.registerCommand('winccoa.mcp.updateConfig', async () => {
            ExtensionOutputChannel.show();
            vscode.window.showInformationMessage('MCP Configuration - Coming soon!');
            // TODO: Open Config Editor
        })
    );

    // Generate Token
    context.subscriptions.push(
        vscode.commands.registerCommand('winccoa.mcp.generateToken', async () => {
            const token = configManager.generateToken();
            await vscode.env.clipboard.writeText(token);
            vscode.window.showInformationMessage('Token generated and copied to clipboard');
        })
    );
}

/**
 * Create API for Core Extension integration
 */
function createAPI(): MCPServerAPI {
    return {
        async setupMCPServer(projectPath: string, options?: MCPSetupOptions): Promise<MCPSetupResult> {
            ExtensionOutputChannel.info(`Setting up MCP Server for project: ${projectPath}`);

            try {
                // Install MCP Server
                const installResult = await installer.install(projectPath);
                if (!installResult.success) {
                    return installResult;
                }

                // Generate token if not provided
                const token = options?.token || configManager.generateToken();

                // Write configuration
                const config = {
                    token,
                    port: options?.port || 3000,
                    mode: 'http' as const,
                    tools: options?.enabledTools || ['datapoints/dp_basic', 'manager/manager_list'],
                    field: options?.fieldConfig || 'default'
                };

                await configManager.writeEnvFile(projectPath, config);
                await configManager.addManagerToProgs(projectPath);

                ExtensionOutputChannel.info('✅ MCP Server setup complete');

                return {
                    success: true,
                    token,
                    installPath: installResult.installPath
                };
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                ExtensionOutputChannel.error(`Setup failed: ${errorMsg}`);
                return { success: false, error: errorMsg };
            }
        },

        async startMCPServer(projectName: string): Promise<void> {
            await managerControl.startManager(projectName);
        },

        async stopMCPServer(projectName: string): Promise<void> {
            await managerControl.stopManager(projectName);
        },

        async restartMCPServer(projectName: string): Promise<void> {
            await managerControl.restartManager(projectName);
        },

        async getMCPStatus(projectName: string): Promise<MCPStatus> {
            const managerStatus = await managerControl.getManagerStatus(projectName);
            
            return {
                managerRunning: managerStatus.running,
                httpReachable: false, // TODO: Implement HTTP check
                lastCheck: new Date(),
                error: managerStatus.error
            };
        },

        async updateMCPConfig(projectPath: string, config: MCPConfig): Promise<void> {
            await configManager.writeEnvFile(projectPath, {
                token: config.token,
                port: config.port,
                mode: 'http',
                tools: config.tools,
                field: config.field
            });
        },

        generateToken(): string {
            return configManager.generateToken();
        }
    };
}
