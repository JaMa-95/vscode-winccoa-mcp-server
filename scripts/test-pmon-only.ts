import { PmonComponent, ProjEnvManagerStartMode } from '@winccoa-tools-pack/npm-winccoa-core';

const projectPath = '/home/testus/wincc_proj/TestProject';
const projectName = 'TestProject';
const winccOAVersion = '3.20';

async function testPmonInsert() {
    console.log('🔍 Testing PMON insertManagerAt() method...\n');
    
    // Create PMON component instance
    const pmon = new PmonComponent();
    pmon.setVersion(winccOAVersion);
    
    console.log('📋 Getting manager list BEFORE insertion...');
    const managersBefore = await pmon.getManagerOptionsList(projectName);
    console.log(`Total managers BEFORE: ${managersBefore.length}`);
    managersBefore.forEach((m: any, i: number) => {
        console.log(`  [${i}] ${m.component} - ${m.startMode} - ${m.startOptions || m.commandlineOptions || 'N/A'}`);
    });
    
    console.log('\n🚀 Executing insertManagerAt() with index 10...');
    const exitCode = await pmon.insertManagerAt(
        {
            component: 'node',
            startMode: ProjEnvManagerStartMode.Manual,
            secondToKill: 30,
            restart: 3,
            resetStartCounter: 1,
            startOptions: '-num 10 -name mcpServerTest node /home/testus/wincc_proj/TestProject/javascript/mcpServer/mcpWinCCOA/build/index_http.js'
        },
        projectName,
        10
    );
    
    console.log(`\n📊 Result: Exit code ${exitCode}`);
    
    console.log('\n📋 Getting manager list AFTER insertion...');
    const managersAfter = await pmon.getManagerOptionsList(projectName);
    console.log(`Total managers AFTER: ${managersAfter.length}`);
    managersAfter.forEach((m: any, i: number) => {
        console.log(`  [${i}] ${m.component} - ${m.startMode} - ${m.startOptions || m.commandlineOptions || 'N/A'}`);
    });
    
    console.log('\n🔍 Comparing BEFORE vs AFTER:');
    if (managersAfter.length > managersBefore.length) {
        console.log(`✅ New manager added! Count increased from ${managersBefore.length} to ${managersAfter.length}`);
    } else if (managersAfter.length === managersBefore.length) {
        console.log(`⚠️ No new manager added (same count: ${managersAfter.length})`);
        console.log(`   Checking if existing manager was modified...`);
        
        for (let i = 0; i < managersBefore.length; i++) {
            const before: any = managersBefore[i];
            const after: any = managersAfter[i];
            
            const beforeOpts = before.startOptions || before.commandlineOptions || '';
            const afterOpts = after.startOptions || after.commandlineOptions || '';
            
            if (before.component !== after.component || 
                before.startMode !== after.startMode ||
                beforeOpts !== afterOpts) {
                console.log(`   🔴 Manager at index ${i} was MODIFIED!`);
                console.log(`      BEFORE: ${before.component} ${before.startMode} ${beforeOpts}`);
                console.log(`      AFTER:  ${after.component} ${after.startMode} ${afterOpts}`);
            }
        }
    }
}

testPmonInsert().catch(console.error);
