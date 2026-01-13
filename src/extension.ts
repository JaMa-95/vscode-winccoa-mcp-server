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

let statusBar: StatusBarManager;
let chatParticipant: WinCCOAChatParticipant;
let languageModelTools: LanguageModelTools;

/**
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    ExtensionOutputChannel.info('WinCC OA MCP Server Extension activating...');

    // Initialize Status Bar
    statusBar = new StatusBarManager();
    context.subscriptions.push(statusBar);

    // Auto-connect to MCP server on startup
    let client: McpClient | null = null;
    try {
        ExtensionOutputChannel.info('Auto-connecting to MCP server...');
        const config = getMcpConfig();
        client = new McpClient(config);
        await client.initialize();
        statusBar.setStatus('connected');
        ExtensionOutputChannel.info('✅ Auto-connect successful - MCP Server ready');
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

    // Initialize Language Model Tools (if client connected)
    if (client) {
        languageModelTools = new LanguageModelTools(client);
        languageModelTools.register(context);
    }

    // Initialize Chat Participant
    chatParticipant = new WinCCOAChatParticipant(getMcpConfig);
    chatParticipant.register(context);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('winccoa.mcp.showMenu', showMenu),
        vscode.commands.registerCommand('winccoa.mcp.testConnection', testConnection),
        vscode.commands.registerCommand('winccoa.mcp.showInfo', showServerInfo)
    );

    ExtensionOutputChannel.info('WinCC OA MCP Server Extension activated ✅');
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
    ExtensionOutputChannel.info('WinCC OA MCP Server Extension deactivated');
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

        const config = getMcpConfig();
        const client = new McpClient(config);
        
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
            `Server: ${initResult.serverInfo.name} ${initResult.serverInfo.version}\n` +
            `Protocol: ${initResult.protocolVersion}\n\n` +
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
 * Get MCP Configuration
 * TODO: Later from settings/auto-detection
 */
function getMcpConfig() {
    return {
        url: 'http://localhost:3001/mcp',
        token: 'b31ad5e10c14a1a40d9f95d3650cf21f69d4be69f75dea2f9ee030a3c5981eaa',
        authType: 'bearer' as const
    };
}

/**
 * Test MCP Server Connection
 */
async function testConnection(): Promise<void> {
    try {
        statusBar.setStatus('connecting', 'Testing connection...');

        const config = getMcpConfig();
        const client = new McpClient(config);
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Testing MCP Server Connection',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Connecting...' });
            
            const isConnected = await client.testConnection();
            
            if (isConnected) {
                progress.report({ message: 'Initializing...' });
                const initResult = await client.initialize();
                
                progress.report({ message: 'Listing tools...' });
                const tools = await client.listTools();
                
                statusBar.setStatus('connected');
                statusBar.setConnectionInfo(initResult.serverInfo.name, tools.length);

                vscode.window.showInformationMessage(
                    `✅ MCP Server Connected!\n` +
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
