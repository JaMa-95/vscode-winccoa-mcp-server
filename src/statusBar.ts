/**
 * Status Bar Manager for MCP Server
 * 
 * Displays MCP Server connection status in VS Code status bar.
 */

import * as vscode from 'vscode';

export type McpServerStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private currentStatus: McpServerStatus = 'disconnected';

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'winccoa.mcp.showMenu';
        this.updateDisplay();
        this.statusBarItem.show();
    }

    /**
     * Update status and refresh display
     */
    setStatus(status: McpServerStatus, message?: string): void {
        this.currentStatus = status;
        this.updateDisplay(message);
    }

    /**
     * Update status bar display
     */
    private updateDisplay(message?: string): void {
        const icons = {
            connected: '$(wand)',           // Magic wand - AI assistant
            disconnected: '$(circle-slash)',
            connecting: '$(sync~spin)',
            error: '$(error)'
        };

        const colors = {
            connected: undefined,
            disconnected: new vscode.ThemeColor('statusBarItem.warningBackground'),
            connecting: undefined,
            error: new vscode.ThemeColor('statusBarItem.errorBackground')
        };

        const statusText = message || this.currentStatus;
        
        this.statusBarItem.text = `${icons[this.currentStatus]} WinCC OA Copilot`;
        this.statusBarItem.tooltip = `WinCC OA Copilot: ${statusText}\nClick for menu`;
        this.statusBarItem.backgroundColor = colors[this.currentStatus];
    }

    /**
     * Show connection info in tooltip
     */
    setConnectionInfo(serverName?: string, toolCount?: number): void {
        if (serverName && toolCount !== undefined) {
            this.statusBarItem.tooltip = 
                `WinCC OA Copilot: ${this.currentStatus}\n` +
                `Server: ${serverName}\n` +
                `Tools: ${toolCount}\n` +
                `Click for menu`;
        }
    }

    /**
     * Dispose status bar item
     */
    dispose(): void {
        this.statusBarItem.dispose();
    }
}
