/**
 * Extension Output Channel
 * Centralized logging for MCP Server Extension
 */

import * as vscode from 'vscode';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

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

    /**
     * Get current log level from settings
     */
    private static getLogLevel(): LogLevel {
        const config = vscode.workspace.getConfiguration('winccoa.mcp');
        return config.get<LogLevel>('logLevel', 'info');
    }

    /**
     * Check if message should be logged based on current log level
     */
    private static shouldLog(messageLevel: LogLevel): boolean {
        const currentLevel = this.getLogLevel();
        return LOG_LEVEL_VALUES[messageLevel] >= LOG_LEVEL_VALUES[currentLevel];
    }

    static debug(message: string): void {
        if (this.shouldLog('debug')) {
            this.appendLine(`🔍 DEBUG: ${message}`);
        }
    }

    static info(message: string): void {
        if (this.shouldLog('info')) {
            this.appendLine(`ℹ️  INFO: ${message}`);
        }
    }

    static warn(message: string): void {
        if (this.shouldLog('warn')) {
            this.appendLine(`⚠️  WARN: ${message}`);
        }
    }

    static error(message: string): void {
        if (this.shouldLog('error')) {
            this.appendLine(`❌ ERROR: ${message}`);
        }
    }
}
