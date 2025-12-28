/**
 * Unit Tests for MCPConfigManager
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MCPConfigManager } from '../../src/services/mcpConfigManager';
import * as vscode from 'vscode';

suite('MCPConfigManager Unit Tests', () => {
    let configManager: MCPConfigManager;
    let outputChannel: vscode.OutputChannel;
    let fsWriteFileStub: sinon.SinonStub;
    let fsReadFileStub: sinon.SinonStub;

    setup(() => {
        // Mock output channel
        outputChannel = {
            appendLine: sinon.stub()
        } as any;

        configManager = new MCPConfigManager(outputChannel);

        // Stub file system operations
        fsWriteFileStub = sinon.stub(fs, 'writeFile').resolves();
        fsReadFileStub = sinon.stub(fs, 'readFile');
    });

    teardown(() => {
        sinon.restore();
    });

    suite('Token Generation', () => {
        test('should generate a 64-character hex token', () => {
            const token = configManager.generateToken();
            assert.strictEqual(token.length, 64);
            assert.match(token, /^[a-f0-9]{64}$/);
        });

        test('should generate unique tokens', () => {
            const token1 = configManager.generateToken();
            const token2 = configManager.generateToken();
            assert.notStrictEqual(token1, token2);
        });
    });

    suite('ENV File Writing', () => {
        test('should write .env file with correct structure', async () => {
            const projectPath = '/test/project';
            const config = {
                token: 'test-token-123',
                port: 3000,
                mode: 'http' as const,
                tools: ['datapoints/dp_basic', 'manager/manager_list'],
                field: 'default'
            };

            await configManager.writeEnvFile(projectPath, config);

            assert.ok(fsWriteFileStub.calledOnce);
            const [filePath, content] = fsWriteFileStub.firstCall.args;

            assert.strictEqual(
                filePath,
                path.join(projectPath, 'javascript/mcpServer/mcpWinCCOA/.env')
            );

            // Check content includes key settings
            assert.ok(content.includes('MCP_API_TOKEN=test-token-123'));
            assert.ok(content.includes('MCP_HTTP_PORT=3000'));
            assert.ok(content.includes('MCP_MODE=http'));
            assert.ok(content.includes('WINCCOA_FIELD=default'));
            assert.ok(content.includes('TOOLS=datapoints/dp_basic,manager/manager_list'));
        });

        test('should escape special characters in .env', async () => {
            const config = {
                token: 'token-with-special-chars!@#$%',
                port: 3000,
                mode: 'http' as const,
                tools: ['test/tool'],
                field: 'default'
            };

            await configManager.writeEnvFile('/test', config);

            const content = fsWriteFileStub.firstCall.args[1];
            assert.ok(content.includes('token-with-special-chars!@#$%'));
        });
    });

    suite('Manager Configuration', () => {
        test('should add manager to config/progs', async () => {
            fsReadFileStub.resolves('# Existing progs content\nWCCOAui -num 1\n');

            await configManager.addManagerToProgs('/test/project', 'MCP');

            assert.ok(fsWriteFileStub.calledOnce);
            const [filePath, content] = fsWriteFileStub.firstCall.args;

            assert.strictEqual(filePath, '/test/project/config/progs');
            assert.ok(content.includes('# MCP Server'));
            assert.ok(content.includes('WCCOActrl -num 1 -name MCP'));
            assert.ok(content.includes('javascript/mcpServer/mcpWinCCOA/build/index_http.js'));
        });

        test('should not duplicate manager if already exists', async () => {
            const existingContent = `# Existing progs
WCCOActrl -num 1 -name MCP javascript/mcpServer/mcpWinCCOA/build/index_http.js
`;
            fsReadFileStub.resolves(existingContent);

            await configManager.addManagerToProgs('/test/project');

            // Should not write if already exists
            assert.ok(fsWriteFileStub.notCalled);
        });

        test('should create new progs file if not exists', async () => {
            fsReadFileStub.rejects(new Error('ENOENT'));

            await configManager.addManagerToProgs('/test/project');

            assert.ok(fsWriteFileStub.calledOnce);
            const content = fsWriteFileStub.firstCall.args[1];
            assert.ok(content.includes('WCCOActrl'));
        });
    });

    suite('Config Reading', () => {
        test('should read and parse existing .env file', async () => {
            const mockEnv = `MCP_API_TOKEN=test-token
MCP_HTTP_PORT=3001
MCP_MODE=stdio
WINCCOA_FIELD=oil
TOOLS=datapoints/dp_basic,opcua/opcua_connection
`;
            fsReadFileStub.resolves(mockEnv);

            const config = await configManager.readConfig('/test/project');

            assert.ok(config);
            assert.strictEqual(config!.token, 'test-token');
            assert.strictEqual(config!.port, 3001);
            assert.strictEqual(config!.mode, 'stdio');
            assert.strictEqual(config!.field, 'oil');
            assert.deepStrictEqual(config!.tools, ['datapoints/dp_basic', 'opcua/opcua_connection']);
        });

        test('should return null if .env does not exist', async () => {
            fsReadFileStub.rejects(new Error('ENOENT'));

            const config = await configManager.readConfig('/test/project');

            assert.strictEqual(config, null);
        });

        test('should handle malformed .env gracefully', async () => {
            fsReadFileStub.resolves('INVALID_ENV_FILE\nNO_EQUALS_SIGN');

            const config = await configManager.readConfig('/test/project');

            // Should still parse what it can
            assert.ok(config);
            assert.strictEqual(config!.token, '');
        });
    });

    suite('Default Tool Configurations', () => {
        test('should provide predefined tool sets', () => {
            const toolSets = configManager.getDefaultTools();

            assert.ok(Array.isArray(toolSets));
            assert.ok(toolSets.length >= 3);

            // Check structure
            toolSets.forEach(set => {
                assert.ok(set.name);
                assert.ok(Array.isArray(set.tools));
            });

            // Check specific sets exist
            const names = toolSets.map(s => s.name);
            assert.ok(names.includes('Read-Only Monitoring'));
            assert.ok(names.includes('Basic Control'));
            assert.ok(names.includes('Full Features'));
        });
    });
});
