/**
 * Extension Output Channel
 * Centralized logging for MCP Server Extension
 */

import * as vscode from 'vscode';

export class ExtensionOutputChannel {
    private static instance: vscode.OutputChannel;

    static getInstance(): vscode.OutputChannel {
        if (!this.instance) {
            this.instance = vscode.window.createOutputChannel('WinCC OA MCP Server');
        }
        return this.instance;
    }

    static show(): void {
        this.getInstance().show();
    }

    static appendLine(message: string): void {
        const timestamp = new Date().toISOString();
        this.getInstance().appendLine(`[${timestamp}] ${message}`);
    }

    static debug(message: string): void {
        this.appendLine(`🔍 DEBUG: ${message}`);
    }

    static info(message: string): void {
        this.appendLine(`ℹ️  INFO: ${message}`);
    }

    static warn(message: string): void {
        this.appendLine(`⚠️  WARN: ${message}`);
    }

    static error(message: string): void {
        this.appendLine(`❌ ERROR: ${message}`);
    }
}
