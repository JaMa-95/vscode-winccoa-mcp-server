/**
 * WinCC OA MCP Server Extension
 * 
 * VS Code extension for managing WinCC OA MCP Server.
 * Provides auto-detection, setup wizard, and GitHub Copilot integration.
 */

import * as vscode from 'vscode';
import { McpClient } from './mcpClient';
import { ExtensionOutputChannel } from './extensionOutput';
import { StatusBarManager } from './statusBar';
import { WinCCOAChatParticipant } from './chatParticipant';
import { LanguageModelTools } from './languageModelTools';
import { ProjectConfigDetector, McpConfig } from './projectConfigDetector';
import { SetupWizard } from './setupWizard';
import { ConnectionMonitor } from './connectionMonitor';

// Global persistent client
let mcpClient: McpClient | null = null;
let currentConfig: McpConfig | null = null;

// Connection Monitor
let connectionMonitor: ConnectionMonitor | null = null;

let statusBar: StatusBarManager;
let chatParticipant: WinCCOAChatParticipant;
let languageModelTools: LanguageModelTools;
let configDetector: ProjectConfigDetector;

/**
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    ExtensionOutputChannel.info('WinCC OA MCP Server Extension activating...');

    // Initialize Config Detector
    configDetector = new ProjectConfigDetector();

    // Initialize Status Bar
    statusBar = new StatusBarManager();
    context.subscriptions.push(statusBar);

    // Initialize Language Model Tools (always register, even without client)
    languageModelTools = new LanguageModelTools(null);
    languageModelTools.register(context);

    // Auto-connect to MCP server on startup
    try {
        ExtensionOutputChannel.info('Auto-detecting MCP configuration...');
        const { config, error } = await configDetector.detectConfig();
        
        if (!config) {
            // Check if auto-setup should run
            await handleDetectionError(error);
            statusBar.setStatus('error');
        } else {
            ExtensionOutputChannel.info(`Connecting to MCP Server: ${config.url}`);
            await createClient(config);
            statusBar.setStatus('connected');
            ExtensionOutputChannel.info(`✅ Connected to ${config.projectName || 'WinCC OA'} MCP Server`);
        }
    } catch (error: any) {
        ExtensionOutputChannel.error(`Auto-connect failed: ${error.message}`);
        statusBar.setStatus('error');
        vscode.window.showWarningMessage(
            'WinCC OA MCP Server not reachable. Click status bar to retry.',
            'Show Logs'
        ).then(selection => {
            if (selection === 'Show Logs') {
                ExtensionOutputChannel.show();
            }
        });
    }

    // Subscribe to Project Admin project changes
    await subscribeToProjectChanges(context);

    // Initialize Chat Participant
    chatParticipant = new WinCCOAChatParticipant(getMcpConfig);
    chatParticipant.register(context);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('winccoa.mcp.showMenu', showMenu),
        vscode.commands.registerCommand('winccoa.mcp.testConnection', testConnection),
        vscode.commands.registerCommand('winccoa.mcp.showInfo', showServerInfo),
        vscode.commands.registerCommand('winccoa.mcp.reconnect', reconnect),
        vscode.commands.registerCommand('winccoa.mcp.showOutput', () => ExtensionOutputChannel.show()),
        vscode.commands.registerCommand('winccoa.mcp.executeScript', executeScript),
        vscode.commands.registerCommand('winccoa.mcp.runSetup', runSetup)
    );

    ExtensionOutputChannel.info('WinCC OA MCP Server Extension activated ✅');
}

/**
 * Extension deactivation
 */
export async function deactivate(): Promise<void> {
    ExtensionOutputChannel.info('WinCC OA MCP Server Extension deactivating...');
    
    // Stop connection monitor
    if (connectionMonitor) {
        connectionMonitor.stop();
    }
    
    await disposeClient();
    ExtensionOutputChannel.info('WinCC OA MCP Server Extension deactivated');
}

/**
 * Create and initialize MCP Client (persistent)
 */
async function createClient(config: McpConfig): Promise<McpClient> {
    ExtensionOutputChannel.info(`Creating MCP client for: ${config.url}`);
    
    // Dispose old client first
    await disposeClient();
    
    // Create new client
    const client = new McpClient(config);
    await client.initialize();
    
    // Store globally
    mcpClient = client;
    currentConfig = config;
    
    // Update all components
    languageModelTools.updateClient(client);
    updateChatParticipant(client);
    
    // Start connection monitoring
    startConnectionMonitor();
    
    ExtensionOutputChannel.info('✅ MCP Client created and initialized');
    return client;
}

/**
 * Dispose current MCP Client
 */
async function disposeClient(): Promise<void> {
    if (!mcpClient) {
        return;
    }
    
    ExtensionOutputChannel.info('Disposing MCP client...');
    
    // Stop connection monitor
    if (connectionMonitor) {
        connectionMonitor.stop();
        connectionMonitor = null;
    }
    
    try {
        // Client might have dispose/close method in future
        mcpClient = null;
        currentConfig = null;
        
        // Update components
        languageModelTools.updateClient(null);
        
        ExtensionOutputChannel.info('MCP client disposed');
    } catch (error: any) {
        ExtensionOutputChannel.error(`Error disposing client: ${error.message}`);
    }
}

/**
 * Get current MCP Client (if connected)
 */
function getClient(): McpClient | null {
    return mcpClient;
}

/**
 * Update Chat Participant with new client
 */
function updateChatParticipant(client: McpClient | null): void {
    if (!chatParticipant) {
        return;
    }
    
    // Chat participant will get client via getMcpConfig when needed
    // This just invalidates any cached state
    ExtensionOutputChannel.debug('Chat Participant updated with new client');
}

/**
 * Start Connection Monitor for current client
 */
function startConnectionMonitor(): void {
    if (!mcpClient) {
        ExtensionOutputChannel.warn('Connection Monitor: Cannot start - no client');
        return;
    }

    // Stop existing monitor
    if (connectionMonitor) {
        connectionMonitor.stop();
    }

    // Create new monitor with default config (will be configurable in 0.9.0)
    connectionMonitor = new ConnectionMonitor(
        {
            heartbeatInterval: 30000,  // 30 seconds
            reconnectRetries: 3,
            autoReconnect: true
        },
        getClient,
        handleConnectionLost,
        handleReconnectSuccess,
        handleReconnectFailed
    );

    connectionMonitor.start();
}

/**
 * Handle connection lost event
 */
async function handleConnectionLost(): Promise<void> {
    ExtensionOutputChannel.warn('⚠️ Connection lost to MCP Server');
    statusBar.setStatus('error', 'Connection lost');
    
    // Don't show notification here - wait for auto-reconnect result
}

/**
 * Handle successful reconnect
 */
function handleReconnectSuccess(): void {
    ExtensionOutputChannel.info('✅ Auto-reconnect successful');
    statusBar.setStatus('connected');
    
    vscode.window.showInformationMessage(
        'MCP Server connection restored automatically'
    );
}

/**
 * Handle failed reconnect
 */
function handleReconnectFailed(): void {
    ExtensionOutputChannel.error('❌ Auto-reconnect failed after maximum retries');
    statusBar.setStatus('error', 'Reconnect failed');
    
    vscode.window.showErrorMessage(
        'MCP Server connection lost. Click to reconnect.',
        'Reconnect',
        'Show Logs'
    ).then(selection => {
        if (selection === 'Reconnect') {
            vscode.commands.executeCommand('winccoa.mcp.reconnect');
        } else if (selection === 'Show Logs') {
            ExtensionOutputChannel.show();
        }
    });
}

/**
 * Show Status Bar Quick Pick Menu
 */
async function showMenu(): Promise<void> {
    const items: vscode.QuickPickItem[] = [
        {
            label: '$(testing-run-icon) Test Connection',
            description: 'Test connection to MCP Server',
            detail: 'Check if MCP Server is reachable'
        },
        {
            label: '$(info) Show Server Info',
            description: 'Display server details',
            detail: 'Shows server version and available tools'
        }
    ];

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'MCP Server Actions',
        title: 'WinCC OA MCP Server'
    });

    if (!selected) {
        return;
    }

    // Execute command based on selection
    if (selected.label.includes('Test Connection')) {
        await vscode.commands.executeCommand('winccoa.mcp.testConnection');
    } else if (selected.label.includes('Server Info')) {
        await vscode.commands.executeCommand('winccoa.mcp.showInfo');
    }
}

/**
 * Show Server Info (Version, Tools, etc.)
 */
async function showServerInfo(): Promise<void> {
    try {
        statusBar.setStatus('connecting', 'Fetching server info...');

        const client = getClient();
        if (!client || !currentConfig) {
            vscode.window.showWarningMessage('Not connected to MCP Server');
            statusBar.setStatus('error', 'No connection');
            return;
        }

        const config = currentConfig;
        
        const initResult = await client.initialize();
        const tools = await client.listTools();
        const resources = await client.listResources();

        statusBar.setStatus('connected');
        statusBar.setConnectionInfo(initResult.serverInfo.name, tools.length);

        // Build info message
        const toolsList = tools.map((t, i) => `${i + 1}. ${t.name}`).join('\n');
        const resourcesList = resources.map((r, i) => `${i + 1}. ${r.uri}`).join('\n');

        const infoMessage = 
            `📡 MCP Server Information\n\n` +
            `Project: ${config.projectName || 'Unknown'}\n` +
            `Server: ${initResult.serverInfo.name} ${initResult.serverInfo.version}\n` +
            `Protocol: ${initResult.protocolVersion}\n` +
            `URL: ${config.url}\n\n` +
            `Available Tools (${tools.length}):\n${toolsList}\n\n` +
            `Available Resources (${resources.length}):\n${resourcesList}`;

        // Show in new document
        const doc = await vscode.workspace.openTextDocument({
            content: infoMessage,
            language: 'plaintext'
        });
        await vscode.window.showTextDocument(doc, { preview: false });

        ExtensionOutputChannel.info('Server info retrieved successfully');

    } catch (error: any) {
        statusBar.setStatus('error', 'Connection failed');
        ExtensionOutputChannel.error(`showServerInfo error: ${error.message}`);
        vscode.window.showErrorMessage(`Failed to get server info: ${error.message}`);
    }
}

/**
 * Subscribe to Project Admin project changes
 */
async function subscribeToProjectChanges(context: vscode.ExtensionContext): Promise<void> {
    const projectAdmin = vscode.extensions.getExtension('RichardJanisch.winccoa-project-admin');
    
    if (!projectAdmin) {
        ExtensionOutputChannel.debug('Project Admin not found - skipping project change subscription');
        return;
    }

    if (!projectAdmin.isActive) {
        await projectAdmin.activate();
    }

    const api = projectAdmin.exports;
    if (!api || !api.onDidChangeProject) {
        ExtensionOutputChannel.warn('Project Admin API not available for project change events');
        return;
    }

    // Subscribe to project changes
    api.onDidChangeProject(async (project: any) => {
        ExtensionOutputChannel.info('Project changed - reconnecting MCP Server...');
        
        // Invalidate config cache
        configDetector.invalidateCache();
        
        if (!project) {
            ExtensionOutputChannel.debug('No project selected');
            statusBar.setStatus('disconnected');
            handleDetectionError('no-project-selected');
            return;
        }

        ExtensionOutputChannel.info(`New project: ${project.name}`);

        // Reconnect to MCP Server with new project config
        try {
            const { config, error } = await configDetector.detectConfig();
            
            if (!config) {
                // Dispose old client when switching to project without MCP
                await disposeClient();
                handleDetectionError(error);
                statusBar.setStatus('error');
                return;
            }

            // Create new client (disposes old one automatically)
            await createClient(config);

            statusBar.setStatus('connected');
            ExtensionOutputChannel.info(`✅ Connected to ${config.projectName} MCP Server`);

            vscode.window.showInformationMessage(
                `Switched to ${config.projectName} - MCP Server reconnected`
            );

        } catch (error: any) {
            ExtensionOutputChannel.error(`Failed to reconnect: ${error.message}`);
            statusBar.setStatus('error');
            vscode.window.showErrorMessage(`MCP Server reconnection failed: ${error.message}`);
        }
    });

    ExtensionOutputChannel.info('Subscribed to Project Admin project changes');
}

/**
 * Get MCP Configuration (with auto-detection)
 * Returns current config if client is connected, otherwise detects
 */
async function getMcpConfig(): Promise<McpConfig | null> {
    // Return current config if client is connected
    if (mcpClient && currentConfig) {
        return currentConfig;
    }
    
    // Otherwise detect config
    const { config, error } = await configDetector.detectConfig();
    
    if (!config) {
        handleDetectionError(error);
        return null;
    }
    
    return config;
}

/**
 * Handle config detection errors
 */
async function handleDetectionError(error?: string): Promise<void> {
    switch (error) {
        case 'project-admin-missing':
            vscode.window.showWarningMessage(
                'WinCC OA Project Admin Extension required for auto-configuration',
                'Learn More'
            ).then(selection => {
                if (selection === 'Learn More') {
                    vscode.env.openExternal(vscode.Uri.parse(
                        'https://marketplace.visualstudio.com/items?itemName=RichardJanisch.winccoa-project-admin'
                    ));
                }
            });
            break;

        case 'no-project-selected':
            // Don't show notification - red icon is enough indicator
            ExtensionOutputChannel.debug('No WinCC OA project selected');
            break;

        case 'mcp-not-installed':
        case 'env-file-missing':
            // Offer auto-setup wizard
            vscode.window.showWarningMessage(
                'MCP Server not found in current project',
                'Run Setup Wizard',
                'Manual Config'
            ).then(async selection => {
                if (selection === 'Run Setup Wizard') {
                    await vscode.commands.executeCommand('winccoa.mcp.runSetup');
                } else if (selection === 'Manual Config') {
                    ExtensionOutputChannel.show();
                }
            });
            break;

        case 'token-missing':
            vscode.window.showErrorMessage(
                'MCP_API_TOKEN not found in .env file. Please check your MCP Server installation.'
            );
            break;

        default:
            ExtensionOutputChannel.warn(`Unknown detection error: ${error}`);
    }
}

/**
 * Test MCP Server Connection
 */
async function testConnection(): Promise<void> {
    try {
        statusBar.setStatus('connecting', 'Testing connection...');

        // Use existing client or create new one
        let client = getClient();
        let config = currentConfig;
        
        if (!client) {
            // No client, detect config and create
            const detected = await configDetector.detectConfig();
            if (!detected.config) {
                statusBar.setStatus('error', 'No config available');
                return;
            }
            config = detected.config;
            client = await createClient(config);
        }
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Testing MCP Server Connection',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Connecting...' });
            
            const isConnected = await client.testConnection();
            
            if (isConnected && config) {
                progress.report({ message: 'Initializing...' });
                const initResult = await client.initialize();
                
                progress.report({ message: 'Listing tools...' });
                const tools = await client.listTools();
                
                statusBar.setStatus('connected');
                statusBar.setConnectionInfo(initResult.serverInfo.name, tools.length);

                vscode.window.showInformationMessage(
                    `✅ MCP Server Connected!\n` +
                    `Project: ${config.projectName || 'Unknown'}\n` +
                    `Server: ${initResult.serverInfo.name} ${initResult.serverInfo.version}\n` +
                    `Tools: ${tools.length}`
                );
            } else {
                statusBar.setStatus('error', 'Connection failed');
                vscode.window.showErrorMessage('❌ MCP Server connection failed');
            }
        });
        
    } catch (error: any) {
        statusBar.setStatus('error', 'Connection failed');
        ExtensionOutputChannel.error(`testConnection error: ${error.message}`);
        vscode.window.showErrorMessage(`MCP Connection Error: ${error.message}`);
    }
}

/**
 * Reconnect to MCP Server (called from Panel)
 */
async function reconnect(): Promise<void> {
    ExtensionOutputChannel.info('Manual reconnect triggered...');
    
    try {
        // Get current config
        const { config, error } = await configDetector.detectConfig();
        
        if (!config) {
            await handleDetectionError(error);
            statusBar.setStatus('error');
            return;
        }

        ExtensionOutputChannel.info(`Connecting to MCP Server: ${config.url}`);
        
        // Create new client (disposes old one, starts new monitor)
        await createClient(config);
        
        // Reset monitor reconnect attempts
        if (connectionMonitor) {
            connectionMonitor.reset();
        }
        
        statusBar.setStatus('connected');
        ExtensionOutputChannel.info(`✅ Connected to ${config.projectName || 'WinCC OA'} MCP Server`);
        
        vscode.window.showInformationMessage(
            `Connected to ${config.projectName || 'WinCC OA'} MCP Server`
        );
        
    } catch (error: any) {
        ExtensionOutputChannel.error(`Reconnect failed: ${error.message}`);
        statusBar.setStatus('error');
        vscode.window.showErrorMessage(`Failed to connect: ${error.message}`);
    }
}

/**
 * Execute WinCC OA Script via Script Actions Extension
 */
async function executeScript(scriptPath: string, args: string = ''): Promise<void> {
    try {
        ExtensionOutputChannel.info(`Execute Script requested: ${scriptPath} with args: ${args || '(none)'}`);

        // Find script file in workspace
        const files = await vscode.workspace.findFiles(`**/${scriptPath}`, '**/node_modules/**', 1);
        
        if (files.length === 0) {
            throw new Error(`Script not found: ${scriptPath}`);
        }

        const fileUri = files[0];

        // Check if Script Actions extension is available
        const scriptActionsExt = vscode.extensions.getExtension('richardjanisch.winccoa-script-actions');
        if (!scriptActionsExt) {
            throw new Error('WinCC OA Script Actions extension not installed');
        }

        // Execute script via Script Actions extension
        ExtensionOutputChannel.info(`Calling Script Actions: ${fileUri.fsPath} with args: ${args}`);
        
        await vscode.commands.executeCommand(
            'winccoa.executeScriptWithArgs',
            fileUri,
            args
        );

        ExtensionOutputChannel.info(`✅ Script execution started successfully`);
    } catch (error: any) {
        ExtensionOutputChannel.error(`executeScript error: ${error.message}`);
        throw error;
    }
}

/**
 * Run Setup Wizard to install MCP Server
 */
async function runSetup(): Promise<void> {
    try {
        ExtensionOutputChannel.info('Running MCP Server Setup Wizard...');

        // Get active project from Project Admin Extension
        const projectAdminExt = vscode.extensions.getExtension('RichardJanisch.winccoa-project-admin');
        if (!projectAdminExt) {
            vscode.window.showErrorMessage(
                'WinCC OA Project Admin Extension required for auto-setup',
                'Install Extension'
            ).then(selection => {
                if (selection === 'Install Extension') {
                    vscode.env.openExternal(vscode.Uri.parse(
                        'https://marketplace.visualstudio.com/items?itemName=RichardJanisch.winccoa-project-admin'
                    ));
                }
            });
            return;
        }

        // Activate and get API
        const api = await projectAdminExt.activate();
        if (!api.getCurrentProject) {
            throw new Error('Project Admin Extension API not compatible');
        }

        const project = await api.getCurrentProject();
        if (!project) {
            vscode.window.showWarningMessage('No WinCC OA project selected. Please select a project first.');
            return;
        }

        ExtensionOutputChannel.info(`Running setup for project: ${project.name || project.id}`);

        // Project Admin API uses projectDir, not path
        const projectPath = project.projectDir;
        if (!projectPath) {
            throw new Error('Could not determine project path from Project Admin API (projectDir missing)');
        }

        ExtensionOutputChannel.info(`Project path: ${projectPath}`);

        // Check if already installed
        const isInstalled = await SetupWizard.isMcpServerInstalled(projectPath);
        if (isInstalled) {
            vscode.window.showInformationMessage(
                `MCP Server already installed in project "${project.name}"`
            );
            return;
        }

        // Run setup wizard
        const success = await SetupWizard.runSetup(projectPath, project.name || project.id);
        
        if (success) {
            // Invalidate cache and reconnect
            configDetector.invalidateCache();
            await vscode.commands.executeCommand('winccoa.mcp.reconnect');
        }
    } catch (error: any) {
        ExtensionOutputChannel.error(`Setup wizard error: ${error.message}`);
        vscode.window.showErrorMessage(`Setup failed: ${error.message}`);
    }
}
