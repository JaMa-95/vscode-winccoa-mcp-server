/**
 * Test Script: Add MCP Server Manager to WinCC OA Project
 * 
 * This script tests adding a Node.js manager to a WinCC OA project using npm-winccoa-core.
 * 
 * Usage:
 *   ts-node scripts/test-add-manager.ts <project-path> <project-name>
 * 
 * Example:
 *   ts-node scripts/test-add-manager.ts /path/to/DevEnv DevEnv
 */

import { PmonComponent } from '@winccoa-tools-pack/npm-winccoa-core';
import { ProjEnvManagerStartMode } from '@winccoa-tools-pack/npm-winccoa-core';
import * as path from 'path';
import * as fs from 'fs';

// Simple inline version of ManagerConfigWriter for testing
class ManagerConfigWriter {
    static async addManager(projectPath: string, manager: {component: string; startMode: string; secKill: number; restartCount: number; resetMin: number; options: string}): Promise<boolean> {
        const progsPath = path.join(projectPath, 'config', 'progs');
        
        const content = fs.readFileSync(progsPath, 'utf8');
        const lines = content.split('\n');
        
        let insertIndex = lines.length;
        for (let i = lines.length - 1; i >= 0; i--) {
            const trimmed = lines[i].trim();
            if (trimmed && !trimmed.startsWith('#')) {
                insertIndex = i + 1;
                break;
            }
        }
        
        const startMode = manager.startMode.padEnd(6);
        const secKill = manager.secKill.toString().padStart(8);
        const restartCount = manager.restartCount.toString().padStart(8);
        const resetMin = manager.resetMin.toString().padStart(8);
        
        const managerLine = 
            `${manager.component.padEnd(16)} | ${startMode} |${secKill} |${restartCount} |${resetMin} |${manager.options}`;
        
        lines.splice(insertIndex, 0, managerLine);
        fs.writeFileSync(progsPath, lines.join('\n'), 'utf8');
        
        return true;
    }
    
    static async managerExists(projectPath: string, component: string, options: string): Promise<boolean> {
        const progsPath = path.join(projectPath, 'config', 'progs');
        const content = fs.readFileSync(progsPath, 'utf8');
        const lines = content.split('\n');
        
        for (const line of lines) {
            if (line.trim().startsWith('#') || line.trim().startsWith('version') || line.trim().startsWith('auth')) {
                continue;
            }
            if (line.includes(component) && line.includes(options)) {
                return true;
            }
        }
        return false;
    }
}

async function testAddManager() {
    console.log('='.repeat(60));
    console.log('Testing: Add MCP Server Manager to WinCC OA Project');
    console.log('='.repeat(60));

    // Get args from command line
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error('Usage: ts-node test-add-manager.ts <project-path> <project-name>');
        console.error('Example: ts-node test-add-manager.ts /opt/WinCC_OA/projects/DevEnv DevEnv');
        process.exit(1);
    }

    const projectPath = args[0];
    const projectName = args[1];
    
    console.log(`\nProject Path: ${projectPath}`);
    console.log(`Project Name: ${projectName}\n`);

    try {
        // Step 1: Detect WinCC OA version
        console.log('[1/5] Detecting WinCC OA version...');
        // TODO: Read from config file or auto-detect
        // For now, hardcode or pass as parameter
        const winccOAVersion = '3.20'; // Adjust as needed
        console.log(`   → Version: ${winccOAVersion}\n`);

        // Step 2: Create PmonComponent instance
        console.log('[2/5] Creating PmonComponent...');
        const pmon = new PmonComponent();
        pmon.setVersion(winccOAVersion);
        console.log(`   → PmonComponent created\n`);

        // Step 3: Get current manager list to find next available index
        console.log('[3/5] Getting current manager list...');
        const managerList = await pmon.getManagerOptionsList(projectName);
        console.log(`   → Found ${managerList.length} managers\n`);
        
        // Display current managers
        console.log('Current Managers:');
        managerList.forEach((mgr: any, idx: number) => {
            if (idx > 0) { // Skip pmon itself
                console.log(`   [${idx}] ${mgr.component} - ${mgr.startMode === ProjEnvManagerStartMode.Always ? 'always' : mgr.startMode === ProjEnvManagerStartMode.Once ? 'once' : 'manual'}`);
            }
        });
        console.log();

        // Find first empty slot or use next index
        let targetIndex = managerList.length;
        for (let i = 1; i < managerList.length; i++) {
            if (!managerList[i] || managerList[i].component === '') {
                targetIndex = i;
                break;
            }
        }

        console.log(`   → Target index for new manager: ${targetIndex}\n`);

        // Step 4: Check if manager already exists
        console.log('[4/6] Checking if manager already exists...');
        
        // Path to MCP Server script
        const mcpServerScript = path.join(projectPath, 'javascript', 'mcpServer', 'mcpWinCCOA', 'build', 'index_http.js');
        const mcpManagerOptions = `mcpServer ${mcpServerScript}`;
        
        const exists = await ManagerConfigWriter.managerExists(projectPath, 'node', mcpManagerOptions);
        
        if (exists) {
            console.log('   ⚠️  Manager already exists in config!\n');
            console.log('='.repeat(60));
            console.log('Test completed - Manager already configured');
            console.log('='.repeat(60));
            return;
        }
        
        console.log('   ✅ Manager not found - safe to add\n');

        // Step 5: Prepare manager entry
        console.log('[5/6] Preparing MCP Server manager entry...');
        
        // Step 5: Prepare manager entry
        console.log('[5/6] Preparing MCP Server manager entry...');
        
        const managerEntry = {
            component: 'node',
            startMode: 'manual' as const,
            secKill: 30,
            restartCount: 3,
            resetMin: 1,
            options: mcpManagerOptions
        };

        console.log('   Manager Configuration:');
        console.log(`   - Component: ${managerEntry.component}`);
        console.log(`   - Start Mode: ${managerEntry.startMode}`);
        console.log(`   - Seconds to Kill: ${managerEntry.secKill}`);
        console.log(`   - Restart Count: ${managerEntry.restartCount}`);
        console.log(`   - Options: ${managerEntry.options}\n`);

        // Step 6: Write to progs file
        console.log('[6/6] Writing manager to config/progs file...');
        const writeSuccess = await ManagerConfigWriter.addManager(projectPath, managerEntry);
        
        if (writeSuccess) {
            console.log(`   ✅ SUCCESS: Manager added to config/progs\n`);
            
            // Verify by reading progs file
            console.log('Verification: Reading config/progs...');
            const fs = await import('fs');
            const progsContent = fs.readFileSync(path.join(projectPath, 'config', 'progs'), 'utf8');
            const lines = progsContent.split('\n');
            const lastLines = lines.slice(-5);
            console.log('   Last 5 lines of progs file:');
            lastLines.forEach((line, idx) => {
                if (line.trim()) {
                    console.log(`   ${lines.length - 5 + idx}: ${line}`);
                }
            });
        } else {
            console.error(`   ❌ ERROR: Failed to write manager to config\n`);
            process.exit(1);
        }

        console.log('='.repeat(60));
        console.log('Test completed successfully!');
        console.log('='.repeat(60));
        console.log('\nNext Steps:');
        console.log('1. Check the project config (progs file) to verify entry');
        console.log('2. Start the manager using PMON or WinCC OA UI');
        console.log('3. Check logs for MCP Server startup\n');

    } catch (error: any) {
        console.error('\n❌ ERROR:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run test
testAddManager();
