/**
 * MCP Server Panel - Copilot-style panel at bottom
 *
 * Shows connection status, project info, and action buttons
 */

import * as vscode from 'vscode';
import { McpServerStatus } from './statusBar';

export class McpPanel {
    private panel: vscode.WebviewPanel | undefined;
    private extensionUri: vscode.Uri;
    private currentStatus: McpServerStatus = 'disconnected';
    private projectName: string = '';
    private serverUrl: string = '';
    private toolCount: number = 0;

    constructor(extensionUri: vscode.Uri) {
        this.extensionUri = extensionUri;
    }

    /**
     * Show or focus the panel
     */
    show(): void {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Two, true);
        } else {
            this.createPanel();
        }
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

        if (this.panel) {
            this.panel.webview.postMessage({
                command: 'updateStatus',
                status: this.currentStatus,
                projectName: this.projectName,
                serverUrl: this.serverUrl,
                toolCount: this.toolCount,
            });
        }
    }

    /**
     * Create the webview panel
     */
    private createPanel(): void {
        this.panel = vscode.window.createWebviewPanel(
            'winccoa.mcp.panel',
            'WinCC OA Copilot',
            {
                viewColumn: vscode.ViewColumn.Two,
                preserveFocus: true,
            },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            },
        );

        this.panel.iconPath = {
            light: vscode.Uri.joinPath(this.extensionUri, 'resources', 'icon-light.svg'),
            dark: vscode.Uri.joinPath(this.extensionUri, 'resources', 'icon-dark.svg'),
        };

        this.panel.webview.html = this.getHtmlContent();

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            (message) => this.handleMessage(message),
            undefined,
            [],
        );

        // Clean up when panel is closed
        this.panel.onDidDispose(
            () => {
                this.panel = undefined;
            },
            null,
            [],
        );

        // Send initial state
        this.updateStatus(this.currentStatus, this.projectName, this.serverUrl, this.toolCount);
    }

    /**
     * Handle messages from webview
     */
    private handleMessage(message: any): void {
        switch (message.command) {
            case 'testConnection':
                vscode.commands.executeCommand('winccoa.mcp.testConnection');
                break;
            case 'reconnect':
                vscode.commands.executeCommand('winccoa.mcp.reconnect');
                break;
            case 'openSettings':
                vscode.commands.executeCommand('workbench.action.openSettings', 'winccoa.mcp');
                break;
            case 'showLogs':
                vscode.commands.executeCommand('winccoa.mcp.showOutput');
                break;
        }
    }

    /**
     * Get HTML content for webview
     */
    private getHtmlContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WinCC OA Copilot</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
        }

        .header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .header-icon {
            font-size: 32px;
        }

        .header-title {
            font-size: 20px;
            font-weight: 600;
        }

        .status-card {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 16px;
        }

        .status-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
        }

        .status-label {
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
        }

        .status-value {
            font-weight: 500;
        }

        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        }

        .status-connected {
            background-color: var(--vscode-testing-iconPassed);
            color: var(--vscode-editor-background);
        }

        .status-disconnected {
            background-color: var(--vscode-errorForeground);
            color: var(--vscode-editor-background);
        }

        .status-connecting {
            background-color: var(--vscode-statusBarItem-warningBackground);
            color: var(--vscode-editor-background);
        }

        .status-error {
            background-color: var(--vscode-errorForeground);
            color: var(--vscode-editor-background);
        }

        .actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-family: var(--vscode-font-family);
            transition: background-color 0.2s;
        }

        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .info-section {
            margin-top: 24px;
        }

        .info-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 12px;
            color: var(--vscode-foreground);
        }

        .info-text {
            color: var(--vscode-descriptionForeground);
            line-height: 1.6;
            font-size: 13px;
        }

        .divider {
            height: 1px;
            background-color: var(--vscode-panel-border);
            margin: 24px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-icon">🪄</div>
            <div class="header-title">WinCC OA Copilot</div>
        </div>

        <div class="status-card">
            <div class="status-row">
                <span class="status-label">Status</span>
                <span class="status-badge" id="statusBadge">Disconnected</span>
            </div>
            <div class="status-row">
                <span class="status-label">Project</span>
                <span class="status-value" id="projectName">—</span>
            </div>
            <div class="status-row">
                <span class="status-label">Server URL</span>
                <span class="status-value" id="serverUrl">—</span>
            </div>
            <div class="status-row">
                <span class="status-label">Available Tools</span>
                <span class="status-value" id="toolCount">—</span>
            </div>
        </div>

        <div class="actions">
            <button id="testBtn" onclick="testConnection()">🔌 Test Connection</button>
            <button id="reconnectBtn" onclick="reconnect()">🔄 Reconnect</button>
            <button class="secondary" onclick="openSettings()">⚙️ Settings</button>
            <button class="secondary" onclick="showLogs()">📋 Logs</button>
        </div>

        <div class="divider"></div>

        <div class="info-section">
            <div class="info-title">About</div>
            <div class="info-text">
                WinCC OA Copilot connects GitHub Copilot with your WinCC OA project via the Model Context Protocol (MCP).
                This enables AI-powered automation for datapoints, managers, and project configuration.
            </div>
        </div>

        <div class="info-section">
            <div class="info-title">Available Features</div>
            <div class="info-text">
                • Search and query datapoints<br>
                • List and monitor managers<br>
                • Get datapoint values and types<br>
                • Check manager status<br>
                • Auto-detection from project .env file
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'updateStatus') {
                updateUI(message);
            }
        });

        function updateUI(data) {
            const statusBadge = document.getElementById('statusBadge');
            const projectName = document.getElementById('projectName');
            const serverUrl = document.getElementById('serverUrl');
            const toolCount = document.getElementById('toolCount');

            // Update status badge
            statusBadge.className = 'status-badge status-' + data.status;
            statusBadge.textContent = data.status.charAt(0).toUpperCase() + data.status.slice(1);

            // Update project info
            projectName.textContent = data.projectName || '—';
            serverUrl.textContent = data.serverUrl || '—';
            toolCount.textContent = data.toolCount !== undefined ? data.toolCount : '—';
        }

        function testConnection() {
            vscode.postMessage({ command: 'testConnection' });
        }

        function reconnect() {
            vscode.postMessage({ command: 'reconnect' });
        }

        function openSettings() {
            vscode.postMessage({ command: 'openSettings' });
        }

        function showLogs() {
            vscode.postMessage({ command: 'showLogs' });
        }
    </script>
</body>
</html>`;
    }

    /**
     * Dispose panel
     */
    dispose(): void {
        this.panel?.dispose();
    }
}
