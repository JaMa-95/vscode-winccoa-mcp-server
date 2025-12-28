/**
 * Simple Unit Tests for MCPConfigManager (Pure Node.js, no VS Code)
 */

import * as assert from 'assert';
import { MCPConfigManager } from '../../src/services/mcpConfigManager';

// Mock output channel
const mockOutput = {
    appendLine: () => {}
};

suite('MCPConfigManager Pure Unit Tests', () => {
    let configManager: MCPConfigManager;

    setup(() => {
        configManager = new MCPConfigManager(mockOutput as any);
    });

    suite('Token Generation', () => {
        test('should generate 64-character hex token', () => {
            const token = configManager.generateToken();
            assert.strictEqual(token.length, 64);
            assert.match(token, /^[a-f0-9]{64}$/);
        });

        test('should generate unique tokens', () => {
            const tokens = new Set();
            for (let i = 0; i < 10; i++) {
                tokens.add(configManager.generateToken());
            }
            assert.strictEqual(tokens.size, 10);
        });
    });

    suite('Default Tool Configurations', () => {
        test('should provide predefined tool sets', () => {
            const toolSets = configManager.getDefaultTools();

            assert.ok(Array.isArray(toolSets));
            assert.ok(toolSets.length >= 3);

            toolSets.forEach(set => {
                assert.ok(set.name);
                assert.ok(Array.isArray(set.tools));
                assert.ok(set.tools.length > 0);
            });
        });

        test('should include Read-Only Monitoring preset', () => {
            const toolSets = configManager.getDefaultTools();
            const readOnly = toolSets.find(s => s.name === 'Read-Only Monitoring');
            
            assert.ok(readOnly);
            assert.ok(readOnly.tools.includes('datapoints/dp_basic'));
            assert.ok(readOnly.tools.includes('manager/manager_list'));
        });

        test('should include Full Features preset', () => {
            const toolSets = configManager.getDefaultTools();
            const full = toolSets.find(s => s.name === 'Full Features');
            
            assert.ok(full);
            assert.ok(full.tools.length > 3);
        });
    });
});
