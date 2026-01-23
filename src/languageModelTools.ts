/**
 * Language Model Tools for GitHub Copilot
 * 
 * Simple tool implementations that delegate to MCP Server.
 */

import * as vscode from 'vscode';
import { McpClient } from './mcpClient';
import { ExtensionOutputChannel } from './extensionOutput';

export class LanguageModelTools {
    private client: McpClient | null;

    constructor(client: McpClient | null = null) {
        this.client = client;
    }

    /**
     * Update MCP Client (e.g., after project change)
     */
    updateClient(client: McpClient | null): void {
        this.client = client;
        ExtensionOutputChannel.debug('Language Model Tools: Client updated');
    }

    /**
     * Get current client (throws if not available)
     */
    private getClient(): McpClient {
        if (!this.client) {
            throw new Error('MCP Server not connected. Please select a WinCC OA project.');
        }
        return this.client;
    }

    /**
     * Register all Language Model Tools
     */
    register(context: vscode.ExtensionContext): void {
        ExtensionOutputChannel.info('Registering Language Model Tools...');
        
        // === READ-ONLY TOOLS ===
        
        // Tool 1: List Managers
        context.subscriptions.push(
            vscode.lm.registerTool('winccoa_list_managers', new ListManagersTool(() => this.getClient()))
        );

        // Tool 2: Get Datapoints
        context.subscriptions.push(
            vscode.lm.registerTool('winccoa_get_datapoints', new GetDatapointsTool(() => this.getClient()))
        );

        // Tool 3: Get Value
        context.subscriptions.push(
            vscode.lm.registerTool('winccoa_get_value', new GetValueTool(() => this.getClient()))
        );

        // Tool 4: Get DpTypes
        context.subscriptions.push(
            vscode.lm.registerTool('winccoa_get_dptypes', new GetDpTypesTool(() => this.getClient()))
        );

        // Tool 5: Get Manager Status
        context.subscriptions.push(
            vscode.lm.registerTool('winccoa_get_manager_status', new GetManagerStatusTool(() => this.getClient()))
        );

        // === WRITE TOOLS ===

        // Tool 6: Create Datapoint
        context.subscriptions.push(
            vscode.lm.registerTool('winccoa_create_datapoint', new CreateDatapointTool(() => this.getClient()))
        );

        // Tool 7: Set Datapoint Value
        context.subscriptions.push(
            vscode.lm.registerTool('winccoa_dp_set', new DpSetTool(() => this.getClient()))
        );

        // Tool 8: Create Datapoint Type
        context.subscriptions.push(
            vscode.lm.registerTool('winccoa_create_dp_type', new CreateDpTypeTool(() => this.getClient()))
        );

        // Tool 9: Set Alarm Configuration
        context.subscriptions.push(
            vscode.lm.registerTool('winccoa_alarm_set', new AlarmSetTool(() => this.getClient()))
        );

        // Tool 10: Delete Alarm Configuration
        context.subscriptions.push(
            vscode.lm.registerTool('winccoa_alarm_delete', new AlarmDeleteTool(() => this.getClient()))
        );

        // Tool 11: Set Archive Configuration
        context.subscriptions.push(
            vscode.lm.registerTool('winccoa_archive_set', new ArchiveSetTool(() => this.getClient()))
        );

        // Tool 12: Set Common Configuration
        context.subscriptions.push(
            vscode.lm.registerTool('winccoa_common_set', new CommonSetTool(() => this.getClient()))
        );

        // Tool 13: Set PV Range
        context.subscriptions.push(
            vscode.lm.registerTool('winccoa_pv_range_set', new PvRangeSetTool(() => this.getClient()))
        );

        ExtensionOutputChannel.info('✅ All Language Model Tools registered (13 tools: 5 read-only + 8 write)');
    }
}

/**
 * Tool 1: List all WinCC OA managers
 */
class ListManagersTool implements vscode.LanguageModelTool<void> {
    constructor(private getClient: () => McpClient) {}

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
            const client = this.getClient();
            const result = await client.callTool('list-managers', {});
            
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
    constructor(private getClient: () => McpClient) {}

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

            const client = this.getClient();
            const result = await client.callTool('get-datapoints', {
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
    constructor(private getClient: () => McpClient) {}

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
            const client = this.getClient();
            const result = await client.callTool('get-value', {
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
    constructor(private getClient: () => McpClient) {}

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
            const client = this.getClient();
            const result = await client.callTool('get-dpTypes', {
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
    constructor(private getClient: () => McpClient) {}

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
            const client = this.getClient();
            const result = await client.callTool('list-managers', {});

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

// ============================================================================
// WRITE TOOLS
// ============================================================================

/**
 * Tool 6: Create Datapoint
 */
class CreateDatapointTool implements vscode.LanguageModelTool<{
    dpeName: string;
    dpType: string;
    systemId?: number;
    dpId?: number;
}> {
    constructor(private getClient: () => McpClient) {}

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<{
            dpeName: string;
            dpType: string;
            systemId?: number;
            dpId?: number;
        }>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: `Creating datapoint '${options.input.dpeName}' of type '${options.input.dpType}'...`,
            confirmationMessages: {
                title: 'Create Datapoint',
                message: new vscode.MarkdownString(
                    `Do you want to create datapoint **${options.input.dpeName}** of type **${options.input.dpType}**?\n\n` +
                    `⚠️ This will modify your WinCC OA system configuration.`
                )
            }
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<{
            dpeName: string;
            dpType: string;
            systemId?: number;
            dpId?: number;
        }>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const client = this.getClient();
            const result = await client.callTool('create-datapoint', {
                dpeName: options.input.dpeName,
                dpType: options.input.dpType,
                systemId: options.input.systemId,
                dpId: options.input.dpId
            });

            if (!result.content || result.content.length === 0) {
                throw new Error('No response from MCP server');
            }

            const response = JSON.parse(result.content[0].text!);
            
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify(response, null, 2))
            ]);
        } catch (error: any) {
            ExtensionOutputChannel.error(`Tool error: ${error.message}`);
            throw new Error(`Failed to create datapoint: ${error.message}`);
        }
    }
}

/**
 * Tool 7: Set Datapoint Value
 */
class DpSetTool implements vscode.LanguageModelTool<{
    dpeName: string;
    value: any;
}> {
    constructor(private getClient: () => McpClient) {}

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<{
            dpeName: string;
            value: any;
        }>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: `Setting ${options.input.dpeName} = ${options.input.value}...`,
            confirmationMessages: {
                title: 'Set Datapoint Value',
                message: new vscode.MarkdownString(
                    `Do you want to set **${options.input.dpeName}** to **${options.input.value}**?\n\n` +
                    `⚠️ **WARNING:** This directly controls industrial equipment. Use with caution!`
                )
            }
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<{
            dpeName: string;
            value: any;
        }>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const client = this.getClient();
            const result = await client.callTool('dp-set', {
                datapoints: {
                    dpeName: options.input.dpeName,
                    value: options.input.value
                }
            });

            if (!result.content || result.content.length === 0) {
                throw new Error('No response from MCP server');
            }

            const response = JSON.parse(result.content[0].text!);
            
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify(response, null, 2))
            ]);
        } catch (error: any) {
            ExtensionOutputChannel.error(`Tool error: ${error.message}`);
            throw new Error(`Failed to set datapoint value: ${error.message}`);
        }
    }
}

/**
 * Tool 8: Create Datapoint Type
 */
class CreateDpTypeTool implements vscode.LanguageModelTool<{
    name: string;
    structure: any;
}> {
    constructor(private getClient: () => McpClient) {}

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<{
            name: string;
            structure: any;
        }>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: `Creating datapoint type '${options.input.name}'...`,
            confirmationMessages: {
                title: 'Create Datapoint Type',
                message: new vscode.MarkdownString(
                    `Do you want to create datapoint type **${options.input.name}**?\n\n` +
                    `⚠️ This will modify your WinCC OA system configuration.`
                )
            }
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<{
            name: string;
            structure: any;
        }>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const client = this.getClient();
            const result = await client.callTool('dp-type-create', {
                name: options.input.name,
                structure: options.input.structure
            });

            if (!result.content || result.content.length === 0) {
                throw new Error('No response from MCP server');
            }

            const response = JSON.parse(result.content[0].text!);
            
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify(response, null, 2))
            ]);
        } catch (error: any) {
            ExtensionOutputChannel.error(`Tool error: ${error.message}`);
            throw new Error(`Failed to create datapoint type: ${error.message}`);
        }
    }
}

/**
 * Tool 9: Set Alarm Configuration
 */
class AlarmSetTool implements vscode.LanguageModelTool<{
    dpe: string;
    direction: 'ASC' | 'DESC';
    thresholds?: number[];
    alarmClasses?: string[];
    force?: boolean;
}> {
    constructor(private getClient: () => McpClient) {}

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<{
            dpe: string;
            direction: 'ASC' | 'DESC';
            thresholds?: number[];
            alarmClasses?: string[];
            force?: boolean;
        }>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: `Configuring alarm for ${options.input.dpe}...`,
            confirmationMessages: {
                title: 'Set Alarm Configuration',
                message: new vscode.MarkdownString(
                    `Do you want to configure alarm for **${options.input.dpe}**?\n\n` +
                    `Direction: **${options.input.direction}**\n` +
                    (options.input.thresholds ? `Thresholds: **${options.input.thresholds.join(', ')}**\n` : '') +
                    `\n⚠️ This will modify alarm configuration in your WinCC OA system.`
                )
            }
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<{
            dpe: string;
            direction: 'ASC' | 'DESC';
            thresholds?: number[];
            alarmClasses?: string[];
            force?: boolean;
        }>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const client = this.getClient();
            const result = await client.callTool('alarm-set', {
                config: {
                    dpe: options.input.dpe,
                    direction: options.input.direction,
                    thresholds: options.input.thresholds,
                    alarmClasses: options.input.alarmClasses,
                    force: options.input.force
                }
            });

            if (!result.content || result.content.length === 0) {
                throw new Error('No response from MCP server');
            }

            const response = JSON.parse(result.content[0].text!);
            
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify(response, null, 2))
            ]);
        } catch (error: any) {
            ExtensionOutputChannel.error(`Tool error: ${error.message}`);
            throw new Error(`Failed to set alarm configuration: ${error.message}`);
        }
    }
}

/**
 * Tool 10: Delete Alarm Configuration
 */
class AlarmDeleteTool implements vscode.LanguageModelTool<{
    dpe: string;
}> {
    constructor(private getClient: () => McpClient) {}

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<{
            dpe: string;
        }>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: `Deleting alarm configuration for ${options.input.dpe}...`,
            confirmationMessages: {
                title: 'Delete Alarm Configuration',
                message: new vscode.MarkdownString(
                    `Do you want to **delete** alarm configuration for **${options.input.dpe}**?\n\n` +
                    `⚠️ This action cannot be undone!`
                )
            }
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<{
            dpe: string;
        }>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const client = this.getClient();
            const result = await client.callTool('alarm-delete', {
                dpe: options.input.dpe
            });

            if (!result.content || result.content.length === 0) {
                throw new Error('No response from MCP server');
            }

            const response = JSON.parse(result.content[0].text!);
            
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify(response, null, 2))
            ]);
        } catch (error: any) {
            ExtensionOutputChannel.error(`Tool error: ${error.message}`);
            throw new Error(`Failed to delete alarm configuration: ${error.message}`);
        }
    }
}

/**
 * Tool 11: Set Archive Configuration
 */
class ArchiveSetTool implements vscode.LanguageModelTool<{
    dpe: string;
    archiveClass?: string;
    force?: boolean;
}> {
    constructor(private getClient: () => McpClient) {}

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<{
            dpe: string;
            archiveClass?: string;
            force?: boolean;
        }>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: `Configuring archive for ${options.input.dpe}...`,
            confirmationMessages: {
                title: 'Set Archive Configuration',
                message: new vscode.MarkdownString(
                    `Do you want to configure archiving for **${options.input.dpe}**?\n\n` +
                    `Archive Class: **${options.input.archiveClass || '_NGA_G_EVENT'}**\n\n` +
                    `⚠️ This will enable historical data collection.`
                )
            }
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<{
            dpe: string;
            archiveClass?: string;
            force?: boolean;
        }>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const client = this.getClient();
            const result = await client.callTool('archive-set', {
                config: {
                    dpe: options.input.dpe,
                    archiveClass: options.input.archiveClass,
                    force: options.input.force
                }
            });

            if (!result.content || result.content.length === 0) {
                throw new Error('No response from MCP server');
            }

            const response = JSON.parse(result.content[0].text!);
            
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify(response, null, 2))
            ]);
        } catch (error: any) {
            ExtensionOutputChannel.error(`Tool error: ${error.message}`);
            throw new Error(`Failed to set archive configuration: ${error.message}`);
        }
    }
}

/**
 * Tool 12: Set Common Configuration
 */
class CommonSetTool implements vscode.LanguageModelTool<{
    dpe: string;
    description?: string | { [lang: string]: string };
    alias?: string;
    format?: string | { [lang: string]: string };
    unit?: string | { [lang: string]: string };
}> {
    constructor(private getClient: () => McpClient) {}

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<{
            dpe: string;
            description?: string | { [lang: string]: string };
            alias?: string;
            format?: string | { [lang: string]: string };
            unit?: string | { [lang: string]: string };
        }>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: `Configuring common attributes for ${options.input.dpe}...`,
            confirmationMessages: {
                title: 'Set Common Configuration',
                message: new vscode.MarkdownString(
                    `Do you want to configure common attributes for **${options.input.dpe}**?\n\n` +
                    `⚠️ This will modify datapoint metadata.`
                )
            }
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<{
            dpe: string;
            description?: string | { [lang: string]: string };
            alias?: string;
            format?: string | { [lang: string]: string };
            unit?: string | { [lang: string]: string };
        }>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const client = this.getClient();
            const result = await client.callTool('common-set', {
                config: {
                    dpe: options.input.dpe,
                    description: options.input.description,
                    alias: options.input.alias,
                    format: options.input.format,
                    unit: options.input.unit
                }
            });

            if (!result.content || result.content.length === 0) {
                throw new Error('No response from MCP server');
            }

            const response = JSON.parse(result.content[0].text!);
            
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify(response, null, 2))
            ]);
        } catch (error: any) {
            ExtensionOutputChannel.error(`Tool error: ${error.message}`);
            throw new Error(`Failed to set common configuration: ${error.message}`);
        }
    }
}

/**
 * Tool 13: Set PV Range
 */
class PvRangeSetTool implements vscode.LanguageModelTool<{
    dpe: string;
    min: number;
    max: number;
    includeMin?: boolean;
    includeMax?: boolean;
    force?: boolean;
}> {
    constructor(private getClient: () => McpClient) {}

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<{
            dpe: string;
            min: number;
            max: number;
            includeMin?: boolean;
            includeMax?: boolean;
            force?: boolean;
        }>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: `Configuring PV range for ${options.input.dpe}...`,
            confirmationMessages: {
                title: 'Set PV Range',
                message: new vscode.MarkdownString(
                    `Do you want to configure PV range for **${options.input.dpe}**?\n\n` +
                    `Range: **${options.input.min}** to **${options.input.max}**\n\n` +
                    `⚠️ This will set min/max validation for the datapoint.`
                )
            }
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<{
            dpe: string;
            min: number;
            max: number;
            includeMin?: boolean;
            includeMax?: boolean;
            force?: boolean;
        }>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const client = this.getClient();
            const result = await client.callTool('pv-range-set', {
                config: {
                    dpe: options.input.dpe,
                    min: options.input.min,
                    max: options.input.max,
                    includeMin: options.input.includeMin,
                    includeMax: options.input.includeMax,
                    force: options.input.force
                }
            });

            if (!result.content || result.content.length === 0) {
                throw new Error('No response from MCP server');
            }

            const response = JSON.parse(result.content[0].text!);
            
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify(response, null, 2))
            ]);
        } catch (error: any) {
            ExtensionOutputChannel.error(`Tool error: ${error.message}`);
            throw new Error(`Failed to set PV range: ${error.message}`);
        }
    }
}
