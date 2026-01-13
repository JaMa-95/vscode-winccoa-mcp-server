/**
 * Chat Participant for @winccoa commands
 * 
 * Enables manual commands via @winccoa /managers etc.
 */

import * as vscode from 'vscode';
import { McpClient } from './mcpClient';
import { ExtensionOutputChannel } from './extensionOutput';

export class WinCCOAChatParticipant {
    private client: McpClient | null = null;

    constructor(private getMcpConfig: () => any) {}

    /**
     * Register Chat Participant
     */
    register(context: vscode.ExtensionContext): void {
        const participant = vscode.chat.createChatParticipant('winccoa', async (request, chatContext, stream, token) => {
            return this.handleRequest(request, chatContext, stream, token);
        });

        participant.iconPath = vscode.Uri.file('images/icon.png');

        context.subscriptions.push(participant);
        ExtensionOutputChannel.info('Chat Participant @winccoa registered');
    }

    /**
     * Handle Chat Request
     */
    private async handleRequest(
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<vscode.ChatResult> {
        
        try {
            // Initialize client if needed
            if (!this.client) {
                this.client = new McpClient(this.getMcpConfig());
                await this.client.initialize();
            }

            const command = request.command || 'help';
            const prompt = request.prompt.trim();

            ExtensionOutputChannel.info(`Chat request: /${command} ${prompt}`);

            // Route to handler
            switch (command) {
                case 'managers':
                    return await this.handleManagers(stream, prompt);
                case 'datapoints':
                    return await this.handleDatapoints(stream, prompt);
                case 'get':
                case 'get-value':
                    return await this.handleGetValue(stream, prompt);
                case 'dptypes':
                    return await this.handleDpTypes(stream, prompt);
                case 'tools':
                    return await this.handleTools(stream);
                case 'help':
                default:
                    return await this.handleHelp(stream);
            }

        } catch (error: any) {
            stream.markdown(`❌ **Error:** ${error.message}\n\n`);
            stream.markdown('Make sure the MCP Server is running on `http://localhost:3001/mcp`\n');
            ExtensionOutputChannel.error(`Chat request error: ${error.message}`);
            return { errorDetails: { message: error.message } };
        }
    }

    /**
     * Handler: /managers - List all WinCC OA managers
     */
    private async handleManagers(stream: vscode.ChatResponseStream, prompt: string): Promise<vscode.ChatResult> {
        stream.progress('Fetching managers from MCP Server...');

        const result = await this.client!.callTool('list-managers', {});
        const response = JSON.parse(result.content![0].text!);
        const managers = response.data?.managers || [];

        stream.markdown(`## 📋 WinCC OA Managers (${managers.length})\n\n`);

        for (const mgr of managers) {
            const status = mgr.isRunning ? '✅ Running' : '⏹️  Stopped';
            stream.markdown(`- **${mgr.name}** - ${status} (PID: ${mgr.pid || 'N/A'})\n`);
        }

        return { metadata: { command: 'managers', count: managers.length } };
    }

    /**
     * Handler: /datapoints - Search for datapoints
     */
    private async handleDatapoints(stream: vscode.ChatResponseStream, prompt: string): Promise<vscode.ChatResult> {
        const pattern = prompt || '*';
        stream.progress(`Searching datapoints with pattern: ${pattern}...`);

        const result = await this.client!.callTool('get-datapoints', {
            pattern,
            includeDetails: false
        });

        const response = JSON.parse(result.content![0].text!);
        const datapoint = response.data || response;

        if (Array.isArray(datapoint)) {
            stream.markdown(`## 🔍 Found ${datapoint.length} datapoint(s)\n\n`);
            for (const dp of datapoint.slice(0, 20)) {
                stream.markdown(`- \`${dp.name}\` (${dp.type})\n`);
            }
            if (datapoint.length > 20) {
                stream.markdown(`\n*... and ${datapoint.length - 20} more*\n`);
            }
        } else {
            stream.markdown(`## 🔍 Datapoint: \`${datapoint.name}\`\n\n`);
            stream.markdown(`- **Type:** ${datapoint.type}\n`);
            stream.markdown(`- **Elements:** ${datapoint.elements?.join(', ') || 'N/A'}\n`);
        }

        return { metadata: { command: 'datapoints', count: Array.isArray(datapoint) ? datapoint.length : 1 } };
    }

    /**
     * Handler: /get - Get datapoint value
     */
    private async handleGetValue(stream: vscode.ChatResponseStream, prompt: string): Promise<vscode.ChatResult> {
        if (!prompt) {
            stream.markdown('❌ Please provide a datapoint element name (e.g., `System1:Pump.state`)\n');
            return { errorDetails: { message: 'Missing datapoint element' } };
        }

        stream.progress(`Reading value from ${prompt}...`);

        const result = await this.client!.callTool('get-value', {
            dpe: prompt
        });

        const response = JSON.parse(result.content![0].text!);
        const data = response.data || response;

        stream.markdown(`## 📈 Value for \`${prompt}\`\n\n`);

        if (Array.isArray(data)) {
            for (const item of data) {
                stream.markdown(`- **Element:** \`${item.element}\`\n`);
                stream.markdown(`  - Value: \`${item.value}\`\n`);
                stream.markdown(`  - Timestamp: ${item.timestamp}\n\n`);
            }
        } else {
            stream.markdown(`- **Value:** \`${data.value}\`\n`);
            stream.markdown(`- **Timestamp:** ${data.timestamp}\n`);
            if (data.unit) {
                stream.markdown(`- **Unit:** ${data.unit}\n`);
            }
        }

        return { metadata: { command: 'get-value', dpe: prompt } };
    }

    /**
     * Handler: /dptypes - List datapoint types
     */
    private async handleDpTypes(stream: vscode.ChatResponseStream, prompt: string): Promise<vscode.ChatResult> {
        const pattern = prompt || '*';
        stream.progress(`Fetching datapoint types with pattern: ${pattern}...`);

        const result = await this.client!.callTool('get-dpTypes', {
            pattern,
            includeDetails: false
        });

        const response = JSON.parse(result.content![0].text!);
        const types = response.data?.dpTypes || response.dpTypes || [];

        stream.markdown(`## 🏗️ Datapoint Types (${types.length})\n\n`);

        for (const type of types.slice(0, 20)) {
            stream.markdown(`- **${type.name}**\n`);
            if (type.elements) {
                stream.markdown(`  - Elements: ${type.elements.join(', ')}\n`);
            }
        }

        return { metadata: { command: 'dptypes', count: types.length } };
    }

    /**
     * Handler: /tools - List available MCP tools
     */
    private async handleTools(stream: vscode.ChatResponseStream): Promise<vscode.ChatResult> {
        stream.progress('Fetching available tools...');

        const tools = await this.client!.listTools();

        stream.markdown(`## 🔧 Available MCP Tools (${tools.length})\n\n`);

        for (const tool of tools) {
            stream.markdown(`### ${tool.name}\n`);
            stream.markdown(`${tool.description}\n\n`);
        }

        return { metadata: { command: 'tools', count: tools.length } };
    }

    /**
     * Handler: /help - Show help
     */
    private async handleHelp(stream: vscode.ChatResponseStream): Promise<vscode.ChatResult> {
        stream.markdown(`# 🤖 WinCC OA Chat Participant\n\n`);
        stream.markdown(`I can help you interact with your WinCC OA project via MCP Server.\n\n`);
        stream.markdown(`## Available Commands:\n\n`);
        stream.markdown(`- \`@winccoa /managers\` - List all WinCC OA managers\n`);
        stream.markdown(`- \`@winccoa /datapoints <pattern>\` - Search datapoints (e.g., \`*Pump*\`)\n`);
        stream.markdown(`- \`@winccoa /get <dpe>\` - Get current value of a datapoint element\n`);
        stream.markdown(`- \`@winccoa /dptypes <pattern>\` - List datapoint types\n`);
        stream.markdown(`- \`@winccoa /tools\` - List all available MCP tools\n`);
        stream.markdown(`- \`@winccoa /help\` - Show this help\n\n`);
        stream.markdown(`## Examples:\n\n`);
        stream.markdown(`\`\`\`\n`);
        stream.markdown(`@winccoa /managers\n`);
        stream.markdown(`@winccoa /datapoints System1:*\n`);
        stream.markdown(`@winccoa /get System1:Pump.state\n`);
        stream.markdown(`\`\`\`\n`);

        return { metadata: { command: 'help' } };
    }
}
