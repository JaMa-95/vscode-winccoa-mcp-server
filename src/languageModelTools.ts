/**
 * Language Model Tools for GitHub Copilot
 * 
 * Simple tool implementations that delegate to MCP Server.
 */

import * as vscode from 'vscode';
import { McpClient } from './mcpClient';
import { ExtensionOutputChannel } from './extensionOutput';

export class LanguageModelTools {
    constructor(private client: McpClient) {}

    /**
     * Register all Language Model Tools
     */
    register(context: vscode.ExtensionContext): void {
        ExtensionOutputChannel.info('Registering Language Model Tools...');
        
        // Tool 1: List Managers
        context.subscriptions.push(
            vscode.lm.registerTool('winccoa_list_managers', new ListManagersTool(this.client))
        );

        // Tool 2: Get Datapoints
        context.subscriptions.push(
            vscode.lm.registerTool('winccoa_get_datapoints', new GetDatapointsTool(this.client))
        );

        // Tool 3: Get Value
        context.subscriptions.push(
            vscode.lm.registerTool('winccoa_get_value', new GetValueTool(this.client))
        );

        // Tool 4: Get DpTypes
        context.subscriptions.push(
            vscode.lm.registerTool('winccoa_get_dptypes', new GetDpTypesTool(this.client))
        );

        // Tool 5: Get Manager Status
        context.subscriptions.push(
            vscode.lm.registerTool('winccoa_get_manager_status', new GetManagerStatusTool(this.client))
        );

        ExtensionOutputChannel.info('✅ All Language Model Tools registered');
    }
}

/**
 * Tool 1: List all WinCC OA managers
 */
class ListManagersTool implements vscode.LanguageModelTool<void> {
    constructor(private client: McpClient) {}

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<void>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: 'Listing WinCC OA managers...'
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<void>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const result = await this.client.callTool('list-managers', {});
            
            if (!result.content || result.content.length === 0) {
                throw new Error('No response from MCP server');
            }

            const response = JSON.parse(result.content[0].text!);
            const managers = response.data?.managers || [];

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify(managers, null, 2))
            ]);
        } catch (error: any) {
            ExtensionOutputChannel.error(`Tool error: ${error.message}`);
            throw new Error(`Failed to list managers: ${error.message}`);
        }
    }
}

/**
 * Tool 2: Get datapoints by pattern
 */
class GetDatapointsTool implements vscode.LanguageModelTool<{ pattern: string }> {
    constructor(private client: McpClient) {}

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<{ pattern: string }>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: `Searching datapoints: ${options.input.pattern}...`
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<{ pattern: string }>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            // Auto-add wildcards if missing (unless pattern has : or already contains *)
            let pattern = options.input.pattern;
            if (!pattern.includes('*') && !pattern.includes(':')) {
                pattern = `*${pattern}*`;
            }

            const result = await this.client.callTool('get-datapoints', {
                dpNamePattern: pattern
            });

            if (!result.content || result.content.length === 0) {
                throw new Error('No response from MCP server');
            }

            // MCP Server returns multiple datapoints as separate content items
            const datapoints = result.content.map(item => JSON.parse(item.text!));

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify(datapoints, null, 2))
            ]);
        } catch (error: any) {
            ExtensionOutputChannel.error(`Tool error: ${error.message}`);
            throw new Error(`Failed to get datapoints: ${error.message}`);
        }
    }
}

/**
 * Tool 3: Get datapoint value
 */
class GetValueTool implements vscode.LanguageModelTool<{ dpe: string }> {
    constructor(private client: McpClient) {}

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<{ dpe: string }>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: `Reading value: ${options.input.dpe}...`
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<{ dpe: string }>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const result = await this.client.callTool('get-value', {
                dpe: options.input.dpe
            });

            if (!result.content || result.content.length === 0) {
                throw new Error('No response from MCP server');
            }

            const response = JSON.parse(result.content[0].text!);
            const value = response.data || response;

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify(value, null, 2))
            ]);
        } catch (error: any) {
            ExtensionOutputChannel.error(`Tool error: ${error.message}`);
            throw new Error(`Failed to get value: ${error.message}`);
        }
    }
}

/**
 * Tool 4: Get datapoint types
 */
class GetDpTypesTool implements vscode.LanguageModelTool<{ pattern?: string }> {
    constructor(private client: McpClient) {}

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<{ pattern?: string }>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: 'Listing datapoint types...'
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<{ pattern?: string }>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const result = await this.client.callTool('get-dpTypes', {
                pattern: options.input.pattern || '*',
                includeDetails: false
            });

            if (!result.content || result.content.length === 0) {
                throw new Error('No response from MCP server');
            }

            const response = JSON.parse(result.content[0].text!);
            const types = response.data?.dpTypes || response.dpTypes || [];

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify(types, null, 2))
            ]);
        } catch (error: any) {
            ExtensionOutputChannel.error(`Tool error: ${error.message}`);
            throw new Error(`Failed to get datapoint types: ${error.message}`);
        }
    }
}

/**
 * Tool 5: Get manager status
 */
class GetManagerStatusTool implements vscode.LanguageModelTool<{ managerName: string }> {
    constructor(private client: McpClient) {}

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<{ managerName: string }>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: `Getting status for manager: ${options.input.managerName}...`
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<{ managerName: string }>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const result = await this.client.callTool('list-managers', {});

            if (!result.content || result.content.length === 0) {
                throw new Error('No response from MCP server');
            }

            const response = JSON.parse(result.content[0].text!);
            const managers = response.data?.managers || [];
            const manager = managers.find((m: any) => m.name === options.input.managerName);

            if (!manager) {
                throw new Error(`Manager '${options.input.managerName}' not found`);
            }

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify(manager, null, 2))
            ]);
        } catch (error: any) {
            ExtensionOutputChannel.error(`Tool error: ${error.message}`);
            throw new Error(`Failed to get manager status: ${error.message}`);
        }
    }
}
