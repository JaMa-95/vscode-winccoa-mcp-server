/**
 * MCP Client Test - Static Configuration
 * 
 * Tests the core MCP Client with hardcoded parameters.
 * Once this works, we'll build the auto-detection around it.
 */

import { McpClient } from '../src/mcpClient';

// STATIC TEST CONFIGURATION
// TODO: Later these will come from auto-detection
const TEST_CONFIG = {
    url: 'http://localhost:3001/mcp',
    token: 'b31ad5e10c14a1a40d9f95d3650cf21f69d4be69f75dea2f9ee030a3c5981eaa',
    authType: 'bearer' as const,
    timeout: 30000
};

async function runTests() {
    console.log('🧪 Testing MCP Client with static config...\n');
    console.log('Config:', {
        url: TEST_CONFIG.url,
        token: TEST_CONFIG.token.substring(0, 20) + '...',
        authType: TEST_CONFIG.authType
    });
    console.log('─'.repeat(80));

    const client = new McpClient(TEST_CONFIG);

    // Test 1: Connection
    console.log('\n1️⃣  Testing connection...');
    try {
        const isConnected = await client.testConnection();
        if (isConnected) {
            console.log('   ✅ Connection successful');
        } else {
            console.log('   ❌ Connection failed');
            return;
        }
    } catch (error: any) {
        console.error('   ❌ Connection error:', error.message);
        return;
    }

    // Test 2: Initialize
    console.log('\n2️⃣  Testing initialize...');
    try {
        const initResult = await client.initialize();
        console.log('   ✅ Initialize successful');
        console.log('   Protocol:', initResult.protocolVersion);
        console.log('   Server:', initResult.serverInfo.name, initResult.serverInfo.version);
    } catch (error: any) {
        console.error('   ❌ Initialize error:', error.message);
        return;
    }

    // Test 3: List Tools
    console.log('\n3️⃣  Testing list tools...');
    try {
        const tools = await client.listTools();
        console.log(`   ✅ Found ${tools.length} tools:`);
        tools.forEach((tool, idx) => {
            console.log(`   ${idx + 1}. ${tool.name}`);
            if (tool.description) {
                console.log(`      ${tool.description}`);
            }
        });
    } catch (error: any) {
        console.error('   ❌ List tools error:', error.message);
    }

    // Test 4: List Resources
    console.log('\n4️⃣  Testing list resources...');
    try {
        const resources = await client.listResources();
        console.log(`   ✅ Found ${resources.length} resources:`);
        resources.forEach((resource, idx) => {
            console.log(`   ${idx + 1}. ${resource.uri}`);
            if (resource.name) {
                console.log(`      Name: ${resource.name}`);
            }
            if (resource.description) {
                console.log(`      ${resource.description}`);
            }
        });
    } catch (error: any) {
        console.error('   ❌ List resources error:', error.message);
    }

    console.log('\n' + '─'.repeat(80));
    console.log('✅ All tests completed!\n');
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
