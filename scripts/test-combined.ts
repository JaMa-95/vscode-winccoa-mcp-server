#!/usr/bin/env ts-node

/**
 * Test Script: Combined Approach
 * 
 * Tests if combining file writing + PMON command works:
 * 1. Write manager to config/progs file
 * 2. Execute PMON SINGLE_MGR:INS command
 * 3. Check if manager appears immediately in runtime
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
    PmonComponent, 
    ProjEnvManagerStartMode
} from '@winccoa-tools-pack/npm-winccoa-core';

// =====================================================
// INLINE ManagerConfigWriter (from our implementation)
// =====================================================
class ManagerConfigWriter {
    static addManager(projectPath: string, manager: any): void {
        const progsPath = path.join(projectPath, 'config', 'progs');
        
        if (!fs.existsSync(progsPath)) {
            throw new Error(`config/progs not found at ${progsPath}`);
        }
        
        // Read existing file
        const content = fs.readFileSync(progsPath, 'utf8');
        const lines = content.split('\n');
        
        // Find insertion point (before comments/empty lines at end)
        let insertIndex = lines.length;
        for (let i = lines.length - 1; i >= 0; i--) {
            const trimmed = lines[i].trim();
            if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('//')) {
                insertIndex = i + 1;
                break;
            }
        }
        
        // Format entry (matching WinCC OA format with proper padding)
        const component = manager.component.padEnd(16);
        const startMode = manager.startMode.padEnd(6);
        const secondToKill = manager.secondToKill.toString().padStart(8);
        const restart = manager.restart.toString().padStart(8);
        const resetMin = manager.resetMin.toString().padStart(8);
        const options = manager.options || '';
        
        const entry = `${component} | ${startMode} | ${secondToKill} | ${restart} | ${resetMin} |${options}`;
        
        // Insert entry
        lines.splice(insertIndex, 0, entry);
        
        // Write back
        fs.writeFileSync(progsPath, lines.join('\n'));
        
        console.log(`   ✅ Manager added to config/progs at line ${insertIndex + 1}`);
    }
    
    static managerExists(projectPath: string, component: string, options: string): boolean {
        const progsPath = path.join(projectPath, 'config', 'progs');
        const content = fs.readFileSync(progsPath, 'utf8');
        
        const searchPattern = new RegExp(`${component}.*${options.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
        return searchPattern.test(content);
    }
}

// =====================================================
// MAIN TEST SCRIPT
// =====================================================
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.error('Usage: npx ts-node test-combined.ts <project-path> <project-name>');
        console.error('Example: npx ts-node test-combined.ts /home/testus/wincc_proj/TestProject TestProject');
        process.exit(1);
    }
    
    const projectPath = args[0];
    const projectName = args[1];
    
    console.log('============================================================');
    console.log('Testing: COMBINED Approach (File + PMON)');
    console.log('============================================================\n');
    
    console.log(`Project Path: ${projectPath}`);
    console.log(`Project Name: ${projectName}\n`);
    
    // Step 1: Detect WinCC OA version
    console.log('[1/8] Detecting WinCC OA version...');
    const version = '3.20'; // Hardcoded for testing
    console.log(`   → Version: ${version}\n`);
    
    // Step 2: Create PmonComponent
    console.log('[2/8] Creating PmonComponent...');
    const pmon = new PmonComponent();
    pmon.setVersion(version);
    console.log('   → PmonComponent created\n');
    
    // Step 3: Get BEFORE state
    console.log('[3/8] Getting manager list BEFORE...');
    const managersBefore = await pmon.getManagerOptionsList(projectName);
    console.log(`   → Found ${managersBefore.length} managers\n`);
    
    console.log('Managers BEFORE:');
    managersBefore.forEach((mgr: any, idx: number) => {
        const comp = mgr.component || 'unknown';
        const mode = mgr.startMode || 'unknown';
        console.log(`   [${idx + 1}] ${comp} - ${mode}`);
    });
    console.log('');
    
    // Step 4: Prepare manager config
    console.log('[4/8] Preparing MCP Server manager entry...');
    const mcpScriptPath = path.join(projectPath, 'javascript/mcpServer/mcpWinCCOA/build/index_http.js');
    const managerOptions = `mcpServer ${mcpScriptPath}`;
    
    const manager = {
        component: 'node',
        startMode: 'manual',
        secondToKill: 30,
        restart: 3,
        resetMin: 1,
        options: managerOptions
    };
    
    console.log('   Manager Configuration:');
    console.log(`   - Component: ${manager.component}`);
    console.log(`   - Start Mode: ${manager.startMode}`);
    console.log(`   - Options: ${manager.options}\n`);
    
    // Step 5: Check if already exists
    console.log('[5/8] Checking if manager already exists in file...');
    if (ManagerConfigWriter.managerExists(projectPath, manager.component, managerOptions)) {
        console.log('   ⚠️  Manager already exists - aborting test');
        console.log('   (Remove the last line from config/progs to retest)\n');
        process.exit(0);
    }
    console.log('   ✅ Manager not found - safe to add\n');
    
    // Step 6: WRITE TO FILE FIRST
    console.log('[6/8] Writing manager to config/progs file...');
    ManagerConfigWriter.addManager(projectPath, manager);
    console.log('');
    
    // Step 7: THEN TELL PMON ABOUT IT
    console.log('[7/8] Executing PMON command to reload config...');
    const targetIndex = managersBefore.length; // Index for new manager
    
    const exitCode = await pmon.insertManagerAt(
        {
            component: manager.component,
            startMode: ProjEnvManagerStartMode.Manual,
            secondToKill: manager.secondToKill,
            resetStartCounter: manager.resetMin,
            restart: manager.restart,
            startOptions: manager.options
        },
        projectName,
        targetIndex
    );
    
    console.log(`   → PMON command executed (exit code: ${exitCode})\n`);
    
    // Step 8: Get AFTER state
    console.log('[8/8] Getting manager list AFTER...');
    const managersAfter = await pmon.getManagerOptionsList(projectName);
    console.log(`   → Found ${managersAfter.length} managers\n`);
    
    // Compare
    console.log('============================================================');
    console.log('RESULTS:');
    console.log('============================================================');
    console.log(`Managers BEFORE: ${managersBefore.length}`);
    console.log(`Managers AFTER:  ${managersAfter.length}`);
    console.log(`Difference:      ${managersAfter.length - managersBefore.length}\n`);
    
    if (managersAfter.length > managersBefore.length) {
        console.log('✅ SUCCESS! Manager appears in runtime immediately!');
        console.log('   → Combined approach works!\n');
        
        console.log('New manager details:');
        const newManager: any = managersAfter[managersAfter.length - 1];
        console.log(`   Component: ${newManager.component}`);
        console.log(`   Start Mode: ${newManager.startMode}`);
        console.log(`   Options: ${newManager.startOptions || ''}\n`);
    } else {
        console.log('❌ FAILED: Manager NOT visible in runtime');
        console.log('   → Still requires PMON restart\n');
    }
    
    console.log('Verification: Reading config/progs...');
    const progsPath = path.join(projectPath, 'config', 'progs');
    const progsContent = fs.readFileSync(progsPath, 'utf8');
    const progsLines = progsContent.split('\n').filter(l => l.trim());
    
    console.log(`   Last 3 lines of progs file:`);
    progsLines.slice(-3).forEach((line, idx) => {
        console.log(`   ${progsLines.length - 3 + idx + 1}: ${line}`);
    });
    
    console.log('\n============================================================');
    console.log('Test completed!');
    console.log('============================================================\n');
}

main().catch(err => {
    console.error('ERROR:', err);
    process.exit(1);
});
