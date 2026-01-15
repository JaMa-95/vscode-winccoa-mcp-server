#!/usr/bin/env ts-node

/**
 * Test Script: Manager Number Auto-Assignment
 * 
 * Tests the getNextFreeManagerNumber functionality
 */

import * as fs from 'fs';
import * as path from 'path';

// Inline implementation without vscode dependency
class ManagerConfigWriterTest {
    static async getNextFreeManagerNumber(projectPath: string): Promise<number> {
        const progsPath = path.join(projectPath, 'config', 'progs');
        
        if (!fs.existsSync(progsPath)) {
            return 1;
        }
        
        const content = fs.readFileSync(progsPath, 'utf8');
        const lines = content.split('\n');
        
        const usedNumbers = new Set<number>();
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('version') || trimmed.startsWith('auth')) {
                continue;
            }
            
            const numMatch = line.match(/-num\s+(\d+)/);
            if (numMatch) {
                usedNumbers.add(parseInt(numMatch[1], 10));
            }
        }
        
        let nextNumber = 1;
        while (usedNumbers.has(nextNumber)) {
            nextNumber++;
        }
        
        console.log(`   Used numbers: [${Array.from(usedNumbers).sort((a, b) => a - b).join(', ')}]`);
        return nextNumber;
    }
}

async function main() {
    const projectPath = '/home/testus/wincc_proj/TestProject';
    
    console.log('============================================================');
    console.log('Testing: Manager Number Auto-Assignment');
    console.log('============================================================\n');
    
    console.log(`Project Path: ${projectPath}\n`);
    
    console.log('[1/2] Finding next free manager number...');
    const nextNum = await ManagerConfigWriterTest.getNextFreeManagerNumber(projectPath);
    console.log(`   → Next free number: ${nextNum}\n`);
    
    console.log('[2/2] Testing manual instructions formatting...');
    const scriptPath = path.join(projectPath, 'javascript/mcpServer/mcpWinCCOA/build/index_http.js');
    const optionsLine = `-num ${nextNum} mcpServer ${scriptPath}`;
    
    console.log('\n============================================================');
    console.log('RESULT: Options line for manual setup:');
    console.log('============================================================');
    console.log(optionsLine);
    console.log('\n');
    
    console.log('Full progs line:');
    const progsLine = `node             | manual |      30 |        3 |        1 |${optionsLine}`;
    console.log(progsLine);
    console.log('\n');
    
    console.log('✅ Test completed!');
}

main().catch(err => {
    console.error('ERROR:', err);
    process.exit(1);
});
