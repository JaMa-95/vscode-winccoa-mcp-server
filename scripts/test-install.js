/**
 * Test Script for MCP Server Git Installation
 * 
 * Usage: node scripts/test-install.js
 * 
 * This script tests the Git installation workflow to produce IDENTICAL output as NPM install.
 * 
 * CRITICAL: Mimics NPM postinstall.cjs behavior exactly:
 * 1. Clone Git repository
 * 2. Build TypeScript in temp location
 * 3. Copy build/* contents to ROOT (NOT build/ directory!)
 * 4. Copy additional files (.env.example, systemprompt.md, etc.)
 * 5. Install production dependencies with winccoa-manager
 * 6. Result should be IDENTICAL to "npm install @etm-professional-control/winccoa-mcp-server"
 */

const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const simpleGit = require('simple-git');

// Configuration
const PROJECT_DIR = 'C:\\WinCCOA_Proj\\NewMCPTest';  // Use the working test project!
const MCP_SUBPATH = 'javascript\\mcpServer';
const WINCCOA_INSTALL = 'C:\\Program Files\\Siemens\\WinCC_OA\\3.21';
const GIT_URL = 'https://github.com/RichardJanisch/winccoa-ae-js-mcpserver.git';
const GIT_BRANCH = 'main';

// Paths
const mcpServerDir = path.join(PROJECT_DIR, MCP_SUBPATH);
const tempBuildDir = path.join(PROJECT_DIR, 'javascript', '.mcp-build-temp');
const winCCOAManagerPath = path.join(WINCCOA_INSTALL, 'javascript', 'winccoa-manager');

// Helper: Execute command
async function executeCommand(command, args, cwd, useShell = true) {
    console.log(`\n🔧 Running: ${command} ${args.join(' ')}`);
    console.log(`   CWD: ${cwd}`);
    console.log(`   Shell: ${useShell}`);

    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, { cwd, shell: useShell });

        let stdout = '';
        let stderr = '';

        proc.stdout?.on('data', (data) => {
            stdout += data.toString();
            process.stdout.write(data);
        });

        proc.stderr?.on('data', (data) => {
            stderr += data.toString();
            process.stderr.write(data);
        });

        proc.on('close', (code) => {
            resolve({ exitCode: code, stdout, stderr });
        });

        proc.on('error', (error) => {
            reject(error);
        });
    });
}

// Helper: Copy directory
async function copyDirectory(source, destination) {
    const entries = await fs.readdir(source, { withFileTypes: true });
    
    await fs.mkdir(destination, { recursive: true });
    
    for (const entry of entries) {
        // Skip .git, .clone-temp, node_modules, and package-lock.json
        // These will be regenerated in final location
        if (entry.name === '.git' || 
            entry.name === '.clone-temp' || 
            entry.name === 'node_modules' ||
            entry.name === 'package-lock.json') {
            continue;
        }
        
        const sourcePath = path.join(source, entry.name);
        const destPath = path.join(destination, entry.name);
        
        if (entry.isDirectory()) {
            await copyDirectory(sourcePath, destPath);
        } else {
            await fs.copyFile(sourcePath, destPath);
        }
    }
}

// Main installation function
async function testInstall() {
    console.log('========================================');
    console.log('MCP Server Git Installation Test');
    console.log('Goal: IDENTICAL result as NPM install');
    console.log('========================================');
    console.log(`Project: ${PROJECT_DIR}`);
    console.log(`MCP Path: ${mcpServerDir}`);
    console.log(`WinCC OA: ${WINCCOA_INSTALL}`);
    console.log('========================================\n');

    try {
        // Step 1: Delete existing MCP folder
        console.log('📁 Step 1: Deleting existing MCP Server installation...');
        try {
            await fs.rm(mcpServerDir, { recursive: true, force: true });
            console.log('✅ Deleted successfully');
        } catch (error) {
            console.log(`⚠️  Could not delete (may not exist): ${error.message}`);
        }
        
        // Also delete temp build directory if it exists
        try {
            await fs.rm(tempBuildDir, { recursive: true, force: true });
        } catch {}

        // Step 2: Create temp build directory and clone
        console.log('\n📦 Step 2: Cloning Git repository to temp location...');
        await fs.mkdir(tempBuildDir, { recursive: true });
        
        const git = simpleGit();
        await git.clone(GIT_URL, tempBuildDir, ['--branch', GIT_BRANCH, '--depth', '1']);
        console.log('✅ Git clone successful');

        // Step 3: Detect mcpWinCCOA subdirectory
        console.log('\n📂 Step 3: Locating source directory...');
        const mcpWinCCOAPath = path.join(tempBuildDir, 'mcpWinCCOA');
        let buildSourceDir;
        
        try {
            await fs.access(mcpWinCCOAPath);
            buildSourceDir = mcpWinCCOAPath;
            console.log('✅ Using mcpWinCCOA subdirectory');
        } catch {
            buildSourceDir = tempBuildDir;
            console.log('✅ Using repository root');
        }

        // Step 4: Clean old package-lock.json (can cause NPM errors)
        console.log('\n🧹 Step 4: Cleaning old package-lock.json...');
        const lockFile = path.join(buildSourceDir, 'package-lock.json');
        try {
            await fs.rm(lockFile, { force: true });
            console.log('✅ Removed old package-lock.json');
        } catch {
            console.log('⚠️  No package-lock.json to remove');
        }
        
        // Step 5: Install ALL dependencies (including devDependencies for TypeScript build)
        console.log('\n📦 Step 5: Installing all dependencies (including TypeScript)...');
        const installResult = await executeCommand('npm', ['install'], buildSourceDir, true);
        
        if (installResult.exitCode !== 0) {
            throw new Error(`npm install failed with exit code ${installResult.exitCode}`);
        }
        console.log('✅ All dependencies installed');

        // Step 6: Build TypeScript
        console.log('\n🔨 Step 6: Building TypeScript sources...');
        const buildResult = await executeCommand('npx', ['tsc'], buildSourceDir, true);
        
        if (buildResult.exitCode !== 0) {
            throw new Error(`TypeScript build failed with exit code ${buildResult.exitCode}`);
        }
        console.log('✅ TypeScript compiled to build/ directory');
        
        // Step 7: Create final mcpServer directory
        console.log('\n📂 Step 7: Creating final installation directory...');
        await fs.mkdir(mcpServerDir, { recursive: true });
        console.log('✅ Directory created');
        
        // Step 8: Copy build/* contents to ROOT (mimicking postinstall.cjs)
        console.log('\n📋 Step 8: Copying build/* contents to ROOT (like NPM postinstall)...');
        const buildDir = path.join(buildSourceDir, 'build');
        const buildEntries = await fs.readdir(buildDir, { withFileTypes: true });
        
        for (const entry of buildEntries) {
            const sourcePath = path.join(buildDir, entry.name);
            const destPath = path.join(mcpServerDir, entry.name);
            
            if (entry.isDirectory()) {
                await fs.cp(sourcePath, destPath, { recursive: true });
                console.log(`   ✓ Copied directory: ${entry.name}/`);
            } else {
                await fs.copyFile(sourcePath, destPath);
                console.log(`   ✓ Copied file: ${entry.name}`);
            }
        }
        console.log('✅ Build files copied to root');
        
        // Step 9: Copy .env.example
        console.log('\n📋 Step 9: Copying .env.example...');
        const envExampleSrc = path.join(buildSourceDir, '.env.example');
        const envExampleDest = path.join(mcpServerDir, '.env.example');
        
        if (await fs.access(envExampleSrc).then(() => true).catch(() => false)) {
            await fs.copyFile(envExampleSrc, envExampleDest);
            console.log('✅ .env.example copied');
        } else {
            console.log('⚠️  .env.example not found in source');
        }
        
        // Step 10: Copy systemprompt.md from src/
        console.log('\n📋 Step 10: Copying systemprompt.md...');
        const systemPromptSrc = path.join(buildSourceDir, 'src', 'systemprompt.md');
        const systemPromptDest = path.join(mcpServerDir, 'systemprompt.md');
        
        if (await fs.access(systemPromptSrc).then(() => true).catch(() => false)) {
            await fs.copyFile(systemPromptSrc, systemPromptDest);
            console.log('✅ systemprompt.md copied');
        } else {
            console.log('⚠️  systemprompt.md not found');
        }
        
        // Step 11: Copy package.json
        console.log('\n📋 Step 11: Copying package.json...');
        const packageJsonSrc = path.join(buildSourceDir, 'package.json');
        const packageJsonDest = path.join(mcpServerDir, 'package.json');
        await fs.copyFile(packageJsonSrc, packageJsonDest);
        console.log('✅ package.json copied');
        
        // Step 11a: Copy postinstall.cjs (referenced in package.json)
        console.log('\n📋 Step 11a: Copying postinstall.cjs...');
        const postinstallSrc = path.join(buildSourceDir, 'postinstall.cjs');
        const postinstallDest = path.join(mcpServerDir, 'postinstall.cjs');
        
        if (await fs.access(postinstallSrc).then(() => true).catch(() => false)) {
            await fs.copyFile(postinstallSrc, postinstallDest);
            console.log('✅ postinstall.cjs copied');
        } else {
            console.log('⚠️  postinstall.cjs not found');
        }
        
        // Step 12: Copy demo-project-instructions.md from config/
        console.log('\n📋 Step 12: Copying demo-project-instructions.md...');
        const demoSrc = path.join(buildSourceDir, 'config', 'demo-project-instructions.md');
        const demoDest = path.join(mcpServerDir, 'demo-project-instructions.md');
        
        if (await fs.access(demoSrc).then(() => true).catch(() => false)) {
            await fs.copyFile(demoSrc, demoDest);
            console.log('✅ demo-project-instructions.md copied');
        } else {
            console.log('⚠️  demo-project-instructions.md not found');
        }
        
        // Step 13: Copy fields/ directory from src/fields/
        console.log('\n📋 Step 13: Copying fields/ directory...');
        const fieldsSrc = path.join(buildSourceDir, 'src', 'fields');
        const fieldsDest = path.join(mcpServerDir, 'fields');
        
        if (await fs.access(fieldsSrc).then(() => true).catch(() => false)) {
            await fs.cp(fieldsSrc, fieldsDest, { recursive: true });
            console.log('✅ fields/ directory copied');
        } else {
            console.log('⚠️  fields/ directory not found');
        }
        
        // Step 14: Install production dependencies
        console.log('\n📦 Step 14: Installing production dependencies...');
        const prodInstallResult = await executeCommand(
            'npm', 
            ['install', '--omit=dev'], 
            mcpServerDir, 
            true
        );
        
        if (prodInstallResult.exitCode !== 0) {
            throw new Error(`Production install failed: ${prodInstallResult.stderr}`);
        }
        console.log('✅ Production dependencies installed');
        
        // Step 15: Install winccoa-manager explicitly
        console.log('\n📦 Step 15: Installing winccoa-manager...');
        const managerInstallResult = await executeCommand(
            'npm',
            ['install', `"file:${winCCOAManagerPath}"`],
            mcpServerDir,
            true
        );
        
        if (managerInstallResult.exitCode !== 0) {
            console.log('⚠️  Warning: winccoa-manager install had issues, but continuing...');
        } else {
            console.log('✅ winccoa-manager installed');
        }
        
        // Step 16: Create .env file (WITHOUT PMON settings!)
        console.log('\n📝 Step 16: Creating .env configuration...');
        const crypto = require('crypto');
        const token = crypto.randomBytes(32).toString('hex');
        
        const envContent = `# WinCC OA MCP Server Configuration
# Auto-generated by WinCC OA MCP Server Extension

# Security Token (keep secret!)
MCP_API_TOKEN=${token}

# Server Mode and Port
MCP_MODE=http
MCP_HTTP_PORT=3001
MCP_HTTP_HOST=0.0.0.0

# Authentication
MCP_AUTH_TYPE=bearer

# Rate Limiting
RATE_LIMIT_ENABLED=true

# CORS Configuration
MCP_CORS_ENABLED=true
MCP_CORS_ORIGINS=*

# WinCC OA Field (usually "default")
WINCCOA_FIELD=default

# Available Tools (comma-separated)
TOOLS=datapoints/dp_basic,datapoints/dp_create,datapoints/dp_set,datapoints/dp_types,datapoints/dp_type_create,manager/manager_list,manager/manager_add,manager/manager_control,manager/manager_properties,manager/manager_remove,archive/archive_query,archive/archive_set,archive/archive_delete,alarms/alarm_set,alarms/alarm_delete,common/common_query,common/common_set,common/common_delete,pv_range/pv_range_query,pv_range/pv_range_set,pv_range/pv_range_delete,modbus/modbus_address,opcua/opcua_address,opcua/opcua_connection,dashboards/dashboard,dashboards/widget,icons/icon
`;
        
        await fs.writeFile(path.join(mcpServerDir, '.env'), envContent, 'utf8');
        console.log('✅ .env created (NO PMON settings - those caused the crash!)');

        // Step 17: Cleanup temp directory
        console.log('\n🧹 Step 17: Cleaning up temp directory...');
        await fs.rm(tempBuildDir, { recursive: true, force: true });
        console.log('✅ Temp directory deleted');
        
        console.log('\n========================================');
        console.log('✅✅✅ INSTALLATION COMPLETE!');
        console.log('========================================');
        console.log(`MCP Server installed at: ${mcpServerDir}`);
        console.log(`Manager script: javascript/mcpServer/index_http.js`);
        console.log('');
        console.log('📊 File structure should now be IDENTICAL to NPM install:');
        console.log('   - All .js files in ROOT (not in build/)');
        console.log('   - .env without PMON settings');
        console.log('   - package.json with winccoa-manager dependency');
        console.log('   - node_modules/ with all dependencies');
        console.log('');
        console.log('Next steps:');
        console.log('1. Verify files match NPM install structure');
        console.log('2. Add to config/progs:');
        console.log('   node -num 3 manual 1 1 2 2 javascript/mcpServer/index_http.js');
        console.log('3. Start PMON manager and test!');
        console.log('========================================');
        
    } catch (error) {
        console.error('\n❌ Installation failed:');
        console.error(error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run test
testInstall().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
