/**
 * MCP Server Panel View - Copilot-style embedded panel
 *
 * WebviewView that appears in panel area when clicking status bar
 */

import * as vscode from 'vscode';
import { McpServerStatus } from './statusBar';

export class McpPanelView implements vscode.WebviewViewProvider {
    private view?: vscode.WebviewView;
    private extensionUri: vscode.Uri;
    private currentStatus: McpServerStatus = 'disconnected';
    private projectName: string = '';
    private serverUrl: string = '';
    private toolCount: number = 0;

    constructor(extensionUri: vscode.Uri) {
        this.extensionUri = extensionUri;
    }

    /**
     * Called when view is first opened
     */
    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken,
    ): void | Thenable<void> {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };

        webviewView.webview.html = this.getHtmlContent();

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            await this.handleMessage(message);
        });

        // Send initial status
        this.sendStatusUpdate();
    }

    /**
     * Show/focus the view
     */
    show(): void {
        vscode.commands.executeCommand('workbench.view.extension.winccoa-copilot');
    }

    /**
     * Update panel with current connection info
     */
    updateStatus(
        status: McpServerStatus,
        projectName?: string,
        serverUrl?: string,
        toolCount?: number,
    ): void {
        this.currentStatus = status;
        if (projectName) this.projectName = projectName;
        if (serverUrl) this.serverUrl = serverUrl;
        if (toolCount !== undefined) this.toolCount = toolCount;

        this.sendStatusUpdate();
    }

    private sendStatusUpdate(): void {
        if (this.view) {
            this.view.webview.postMessage({
                command: 'updateStatus',
                status: this.currentStatus,
                projectName: this.projectName,
                serverUrl: this.serverUrl,
                toolCount: this.toolCount,
            });
        }
    }

    private async handleMessage(message: any): Promise<void> {
        switch (message.command) {
            case 'testConnection':
                await vscode.commands.executeCommand('winccoa.mcp.testConnection');
                break;
            case 'reconnect':
                await vscode.commands.executeCommand('winccoa.mcp.reconnect');
                break;
            case 'openSettings':
                await vscode.commands.executeCommand(
                    'workbench.action.openSettings',
                    '@ext:RichardJanisch.winccoa-mcp-server',
                );
                break;
            case 'showLogs':
                await vscode.commands.executeCommand('winccoa.mcp.showOutput');
                break;
        }
    }

    private getHtmlContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WinCC OA Copilot</title>
    <style>
        body {
            padding: 12px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: var(--vscode-sideBar-background);
        }

        .header {
            font-weight: 600;
            font-size: 14px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .status-card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 12px;
        }

        .status-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 8px;
        }

        .status-connected {
            background: var(--vscode-testing-iconPassed);
            color: var(--vscode-editor-background);
        }

        .status-disconnected {
            background: var(--vscode-editorWarning-foreground);
            color: var(--vscode-editor-background);
        }

        .status-connecting {
            background: var(--vscode-editorInfo-foreground);
            color: var(--vscode-editor-background);
        }

        .status-error {
            background: var(--vscode-editorError-foreground);
            color: var(--vscode-editor-background);
        }

        .info-row {
            display: flex;
            justify-content: space-between;
            margin: 4px 0;
            font-size: 12px;
        }

        .info-label {
            color: var(--vscode-descriptionForeground);
        }

        .info-value {
            font-weight: 500;
        }

        .actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 12px;
        }

        .action-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            padding: 8px;
            font-size: 12px;
            cursor: pointer;
            text-align: center;
        }

        .action-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .action-btn:active {
            opacity: 0.8;
        }

        .info-section {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid var(--vscode-panel-border);
        }

        .info-section h3 {
            font-size: 12px;
            font-weight: 600;
            margin: 0 0 8px 0;
            color: var(--vscode-descriptionForeground);
        }

        .info-section p {
            font-size: 12px;
            margin: 4px 0;
            line-height: 1.5;
        }

        .features {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .features li {
            margin: 4px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        🪄 WinCC OA Copilot
    </div>

    <div class="status-card">
        <div class="status-badge status-disconnected" id="statusBadge">Disconnected</div>
        <div class="info-row">
            <span class="info-label">Project:</span>
            <span class="info-value" id="projectName">-</span>
        </div>
        <div class="info-row">
            <span class="info-label">Server:</span>
            <span class="info-value" id="serverUrl">-</span>
        </div>
        <div class="info-row">
            <span class="info-label">Tools:</span>
            <span class="info-value" id="toolCount">0</span>
        </div>
    </div>

    <div class="actions">
        <button class="action-btn" id="testBtn">🔌 Test Connection</button>
        <button class="action-btn" id="reconnectBtn">🔄 Reconnect</button>
        <button class="action-btn" id="settingsBtn">⚙️ Settings</button>
        <button class="action-btn" id="logsBtn">📋 Logs</button>
    </div>

    <div class="info-section">
        <h3>About</h3>
        <p>Use natural language with GitHub Copilot to interact with your WinCC OA project.</p>
    </div>

    <div class="info-section">
        <h3>Features</h3>
        <ul class="features">
            <li>Query datapoints and values</li>
            <li>Manage WinCC OA managers</li>
            <li>Query archive data</li>
            <li>Create and modify datapoints</li>
        </ul>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // Button handlers
        document.getElementById('testBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'testConnection' });
        });

        document.getElementById('reconnectBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'reconnect' });
        });

        document.getElementById('settingsBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'openSettings' });
        });

        document.getElementById('logsBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'showLogs' });
        });

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'updateStatus') {
                updateStatus(message.status, message.projectName, message.serverUrl, message.toolCount);
            }
        });

        function updateStatus(status, projectName, serverUrl, toolCount) {
            const badge = document.getElementById('statusBadge');
            badge.className = 'status-badge status-' + status;
            
            const statusText = {
                'connected': 'Connected',
                'disconnected': 'Disconnected',
                'connecting': 'Connecting...',
                'error': 'Error'
            };
            badge.textContent = statusText[status] || status;

            document.getElementById('projectName').textContent = projectName || '-';
            document.getElementById('serverUrl').textContent = serverUrl || '-';
            document.getElementById('toolCount').textContent = toolCount || '0';
        }
    </script>
</body>
</html>`;
    }
}
