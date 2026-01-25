# Git Clone Installation - Development Log

**Feature Branch**: `feature/git-clone-support-1.6.0`  
**Date**: 2026-01-25  
**Status**: ⚠️ DEBUGGING - Manager startup failure

---

## Ursprüngliches Ziel

User hat eigene Fork des MCP Servers mit zusätzlichen Modbus-Funktionen:
- Repository: https://github.com/RichardJanisch/winccoa-ae-js-mcpserver.git
- Ziel: Extension soll Git Repository clonen und installieren können (nicht nur NPM Package)
- Use Case: Custom MCP Server Versionen mit eigenen Tools entwickeln

### Implementierte Features

1. **Neue Settings** in `package.json`:
   ```json
   "winccoa.mcp.installMethod": {
     "type": "string",
     "enum": ["npm", "git"],
     "default": "npm"
   },
   "winccoa.mcp.gitRepositoryUrl": {
     "type": "string",
     "default": "https://github.com/siemens/winccoa-ae-js-mcpserver.git"
   },
   "winccoa.mcp.gitBranch": {
     "type": "string", 
     "default": "main"
   }
   ```

2. **Installation Methods**:
   - **NPM**: `npm install @etm-professional-control/winccoa-mcp-server` (existing)
   - **Git**: Clone → Build → Copy → Configure (NEW)

---

## Aufgetretene Probleme (chronologisch)

### Problem 1: Windows Paths mit Leerzeichen

**Symptom**: NPM install schlägt fehl bei Pfaden wie `C:\Program Files\...`

```
Error: Command failed: npm install --prefix "C:\Program Files\Siemens\..."
npm error enoent ENOENT: no such file or directory
```

**Root Cause**: `child_process.spawn()` splittet Argumente an Leerzeichen wenn `shell: false`

**Lösung**:
```typescript
// ❌ FALSCH
spawn('npm', ['install', '--prefix', path]);

// ✅ RICHTIG  
spawn('npm', [`install --prefix "${path}"`], { shell: true });
// ODER (besser):
spawn('npm', [`install --prefix "file:${path}"`], { shell: true });
```

**Wichtig**: Quotes **INNERHALB** des Argument-Strings, nicht außen!

---

### Problem 2: TypeScript Source vs. Pre-built Package

**Symptom**: Git Repository enthält `.ts` Dateien, NPM Package hat `.js`

**Unterschiede**:
- **NPM Package**: Pre-compiled, ready-to-run JavaScript
- **Git Repository**: TypeScript source in `mcpWinCCOA/src/`, muss gebaut werden

**Lösung**: Full TypeScript Build Workflow
```bash
1. git clone
2. cd mcpWinCCOA
3. npm install                    # Alle deps inkl. devDependencies
4. npm install winccoa-manager    # Vor TypeScript build (für imports)
5. npx tsc                        # TypeScript → JavaScript in build/
6. npm prune --omit=dev           # devDependencies entfernen
7. # Copy to target location
8. npm install --omit=dev         # Fresh install im Ziel
9. npm install winccoa-manager    # Nochmal im Ziel installieren
```

**Wichtig**: `winccoa-manager` MUSS vor `npx tsc` installiert sein (TypeScript imports)!

---

### Problem 3: Struktur-Unterschied NPM vs. Git

**Symptom**: Git Build hat `build/` Subdirectory, NPM Package ist flach

**Git Repository Build**:
```
mcpWinCCOA/
  src/
    index_http.ts
    server.ts
  build/              ← npx tsc output
    index_http.js
    server.js
```

**NPM Package Struktur**:
```
node_modules/@etm-professional-control/winccoa-mcp-server/
  index_http.js       ← DIREKT im Root!
  server.js
  tools/
  package.json
```

**Root Cause**: NPM Package nutzt `postinstall.cjs` Script:
```javascript
// postinstall.cjs lines 28-47
const buildDir = path.join(__dirname, 'build');
const files = fs.readdirSync(buildDir);
files.forEach(file => {
    const source = path.join(buildDir, file);
    const dest = path.join(__dirname, file);
    fs.renameSync(source, dest);  // Flatten build/* to root
});
fs.rmdirSync(buildDir);  // Remove empty build/
```

**Lösung**: Manuell build/ flattening nach TypeScript Compilation
```javascript
// Copy build/* contents to root (not build/ as directory)
const buildDir = path.join(sourceDir, 'build');
const buildEntries = await fs.readdir(buildDir, { withFileTypes: true });
for (const entry of buildEntries) {
    const sourcePath = path.join(buildDir, entry.name);
    const destPath = path.join(mcpServerDir, entry.name); // ROOT!
    // Copy/move to root
}
```

---

### Problem 4: package-lock.json Konflikte

**Symptom**: Extraneous package warnings nach Copy

```
npm warn extraneous: winccoa-manager@X.Y.Z
npm warn extraneous: @modelcontextprotocol/sdk@X.Y.Z
```

**Root Cause**: `package-lock.json` aus Build-Temp passt nicht zu finaler Location

**Lösung**: Skip `package-lock.json` beim Copy, regenerieren im Ziel
```javascript
if (entry.name === 'package-lock.json') {
    continue; // Skip - wird bei npm install neu generiert
}
```

---

### Problem 5: node_modules Copy Conflicts

**Symptom**: npm install findet bereits vorhandene aber inkorrekte Module

**Lösung**: Skip `node_modules/` beim Copy, fresh install im Ziel
```javascript
if (entry.name === 'node_modules') {
    continue; // Skip - komplett fresh install
}
```

---

### Problem 6: winccoa-manager wird von npm prune entfernt

**Symptom**: `npm prune --omit=dev` entfernt winccoa-manager

**Root Cause**: winccoa-manager ist NICHT in `package.json` dependencies
- MCP Server Package nutzt `peerDependencies` für winccoa-manager
- npm prune sieht es als "extraneous" und entfernt es

**Lösung**: winccoa-manager separat installieren (NACH prune)
```bash
npm install winccoa-manager  # Im temp build dir
# ... after copy ...
npm install winccoa-manager  # Nochmal im final location
```

---

### Problem 7: Manager Startup - "Not enough arguments in command line"

**Symptom**: Manager startet aber crasht sofort
```
✓ Connected to Data Manager
✓ Connected to Event Manager
✓ .env file found and loaded
✗ TypeError: Not enough arguments in command line (1/7)
   at WinccoaManagerConnection (winccoa-manager/lib/connection-binding.js:36)
```

**Root Cause Analysis**:

1. **WinccoaManager Initialization** (server.ts line 109):
   ```typescript
   winccoa = new WinccoaManager(); // NO parameters!
   ```

2. **Connection Binding** (winccoa-manager/lib/connection-binding.js:36):
   ```javascript
   function WinccoaManagerConnection(argv) {
       // Expects process.argv with WinCC OA arguments
   }
   // Called as: new WinccoaManagerConnection(process.argv)
   ```

3. **Expected Arguments** (WinCC OA Manager Mode):
   ```
   node.exe bootstrap.js -PROJ ProjectName -pmonIndex 11 path/to/manager.js
   ```
   = 7 arguments total

4. **Actual Arguments** (standalone `node index_http.js`):
   ```
   ['C:\\Program Files\\nodejs\\node.exe', 'C:\\tmp\\...\\index_http.js']
   ```
   = 2 arguments total → ERROR

**Versuchte Lösung**: PMON TCP Connection Settings in .env
```env
WINCCOA_PMON_HOST=localhost
WINCCOA_PMON_PORT=4999
```

**Ergebnis**: Error verbessert sich von (1/7) zu (2/7), aber immer noch Crash

**Aktuelle Hypothese**:
- MCP Server MUSS als WinCC OA Manager gestartet werden (durch PMON)
- Standalone `node index_http.js` funktioniert NICHT
- PMON liefert automatisch alle 7 benötigten WinCC OA Argumente

---

## Implementierte Lösungen

### Test Script: `scripts/test-install.js`

Schneller Iterations-Zyklus ohne Extension Reload:

```javascript
// Complete Git Installation Workflow
async function testGitInstall() {
    const repoUrl = 'https://github.com/RichardJanisch/winccoa-ae-js-mcpserver.git';
    const targetDir = 'C:\\tmp\\ProjectToRegister\\javascript';
    
    // Step 1: Clone
    await git.clone(repoUrl, tempDir, { '--depth': 1, '--branch': 'main' });
    
    // Step 2-4: Prepare & Clean
    const sourceDir = path.join(tempDir, 'mcpWinCCOA');
    // Remove old files from target
    
    // Step 5: Install ALL dependencies (including dev)
    await exec('npm install', { cwd: sourceDir, shell: true });
    
    // Step 5a: Install winccoa-manager BEFORE TypeScript build
    await exec('npm install winccoa-manager', { cwd: sourceDir, shell: true });
    
    // Step 5b: Build TypeScript
    await exec('npx tsc', { cwd: sourceDir, shell: true });
    
    // Step 5c: Prune dev dependencies
    await exec('npm prune --omit=dev', { cwd: sourceDir, shell: true });
    
    // Step 6: Copy files (FLATTEN build/* to root)
    const buildDir = path.join(sourceDir, 'build');
    const buildEntries = await fs.readdir(buildDir, { withFileTypes: true });
    for (const entry of buildEntries) {
        const sourcePath = path.join(buildDir, entry.name);
        const destPath = path.join(mcpServerDir, entry.name); // ROOT!
        if (entry.isDirectory()) {
            await fs.cp(sourcePath, destPath, { recursive: true });
        } else {
            await fs.copyFile(sourcePath, destPath);
        }
    }
    
    // Skip node_modules and package-lock.json during copy
    // Copy package.json, .npmignore, README, etc.
    
    // Step 7: Fresh npm install in final location
    await exec('npm install --omit=dev', { cwd: mcpServerDir, shell: true });
    
    // Step 8: Install winccoa-manager in final location
    await exec('npm install winccoa-manager', { cwd: mcpServerDir, shell: true });
    
    // Step 9: Create .env
    const envContent = `
MCP_API_TOKEN=test-token-123456789
MCP_MODE=http
MCP_HTTP_PORT=3001
MCP_HTTP_HOST=0.0.0.0
MCP_AUTH_TYPE=bearer
RATE_LIMIT_ENABLED=true
MCP_CORS_ENABLED=true
MCP_CORS_ORIGINS=*
WINCCOA_FIELD=default
WINCCOA_PMON_HOST=localhost
WINCCOA_PMON_PORT=4999
TOOLS=datapoints/dp_basic,datapoints/dp_create,datapoints/dp_set,manager/manager_list,archive/archive_query
    `.trim();
    await fs.writeFile(path.join(mcpServerDir, '.env'), envContent);
}
```

**Verifikation**:
- ✅ Alle Dateien korrekt kopiert (index_http.js im Root, NICHT build/)
- ✅ node_modules/winccoa-manager vorhanden
- ✅ 145 packages, 0 vulnerabilities
- ✅ .env korrekt generiert
- ⚠️ Manager startet aber crasht mit Argument Error

---

### Extension Code: `src/setupWizard.ts`

**Angepasste Methoden**:

1. **installFromGit()** - Akzeptiert jetzt oaInstallPath
   ```typescript
   private async installFromGit(
       projectPath: string, 
       oaInstallPath: string  // NEW
   ): Promise<void>
   ```

2. **createEnvFile()** - PMON Settings hinzugefügt
   ```typescript
   const envContent = `
   # ... existing settings ...
   WINCCOA_PMON_HOST=localhost
   WINCCOA_PMON_PORT=4999
   `;
   ```

3. **showPmonInstructions()** - Korrekter Pfad basierend auf installMethod
   ```typescript
   const scriptPath = installMethod === 'git' 
       ? 'javascript/mcpServer/index_http.js'  // Git: Root
       : 'javascript/mcpServer/index_http.js'; // NPM: Auch Root (nach postinstall)
   ```

4. **copyDirectory()** - Excludes node_modules, package-lock.json, .git
   ```typescript
   const excludes = ['.git', '.clone-temp', 'node_modules', 'package-lock.json'];
   ```

---

## Aktueller Status

### ✅ Erfolgreich Implementiert

1. Git Clone mit custom Repository & Branch
2. Windows Path Handling (shell:true + quotes)
3. TypeScript Build Workflow (install → build → prune)
4. Build Directory Flattening (build/* → root)
5. Korrekte Dependency Installation (winccoa-manager vor & nach Copy)
6. Clean node_modules regeneration
7. .env Generation mit allen Settings

### ⚠️ Offenes Problem

**Manager startet nicht standalone**:
- Error: "Not enough arguments in command line (1/7)" bzw. (2/7)
- Root Cause: WinccoaManager() erwartet WinCC OA Kommandozeilen-Argumente
- Hypothese: Manager MUSS durch PMON gestartet werden

### 🔍 Zu Testen

**PMON Startup statt Standalone**:
```
// WinCC OA PMON Config (config/progs):
node | always | 30 | 3 | 1 | javascript/mcpServer/index_http.js

// PMON startet mit allen Argumenten:
node.exe bootstrap.js -PROJ ProjectToRegister -pmonIndex 11 javascript/mcpServer/index_http.js
```

**Erwartetes Verhalten**:
- PMON liefert alle 7 WinCC OA Argumente
- WinccoaManager() kann korrekt initialisieren
- Manager läuft stabil als WinCC OA Component

---

## Kritische Entdeckung: BEIDE Varianten versagen

**User Report**: "Ich habe auch gerade das alte npm install gemacht es kommt der selbe fehler"

**Was bedeutet das?**:
- NPM Install funktionierte VORHER
- Jetzt versagen NPM UND Git Install mit gleichem Error
- **Gemeinsamer Faktor**: Unsere .env Änderungen (PMON Settings)

**Hypothese**:
```env
# Diese Zeilen könnten das Problem VERURSACHEN:
WINCCOA_PMON_HOST=localhost
WINCCOA_PMON_PORT=4999
```

**Mögliche Root Cause**:
- MCP Server liest WINCCOA_PMON_HOST/PORT aus .env
- Versucht TCP Connection zu PMON zu öffnen
- Fails wenn PMON nicht läuft oder Config falsch
- Original .env OHNE PMON Settings funktioniert wahrscheinlich!

---

## Nächste Schritte (Plan)

### 1. Baseline: Clean NPM Install OHNE Änderungen

**Ziel**: Verifizieren dass original NPM Package funktioniert

```bash
# Remove current installation
rm -rf javascript/mcpServer

# Clean NPM install
mkdir javascript/mcpServer
cd javascript/mcpServer
npm install @etm-professional-control/winccoa-mcp-server

# Create .env WITHOUT PMON settings
cat > .env << EOF
MCP_API_TOKEN=test-token-123
MCP_MODE=http
MCP_HTTP_PORT=3001
MCP_HTTP_HOST=0.0.0.0
MCP_AUTH_TYPE=bearer
RATE_LIMIT_ENABLED=true
MCP_CORS_ENABLED=true
MCP_CORS_ORIGINS=*
WINCCOA_FIELD=default
TOOLS=datapoints/dp_basic,manager/manager_list
EOF

# Start via PMON
# Verify: Manager starts WITHOUT errors
```

**Erwartetes Ergebnis**: Manager läuft stabil

---

### 2. Struktur-Dokumentation

**Zu dokumentieren**:
- Datei-Layout: Welche Files wo?
- node_modules Inhalt: Welche Dependencies?
- .env Format: Welche Variablen WIRKLICH nötig?
- PMON Config: Wie genau startet PMON den Manager?

---

### 3. Git Build Anpassung

**Ziel**: Git Installation produziert EXAKT gleiche Struktur wie NPM

**Zu verifizieren**:
```bash
# NPM Install Snapshot
find npm-install/ -type f | sort > npm-files.txt

# Git Install Snapshot  
find git-install/ -type f | sort > git-files.txt

# Compare
diff npm-files.txt git-files.txt
# → Should be IDENTICAL!
```

**Package.json Comparison**:
- Sind dependencies identisch?
- Sind versions identisch?
- Fehlt etwas in Git Installation?

---

### 4. .env Debugging

**Hypothese**: PMON Settings verursachen Crash

**Tests**:
1. NPM Install mit original .env (ohne PMON) → Sollte funktionieren
2. NPM Install mit PMON .env → Crasht (wie aktuell)
3. Git Install mit original .env → Sollte funktionieren wenn Struktur stimmt
4. Git Install mit PMON .env → Crasht

**Wenn Hypothese stimmt**:
- PMON Settings ENTFERNEN aus .env Template
- Manager funktioniert wenn durch PMON gestartet (bekommt Args via argv)
- Standalone `node index_http.js` wird nie unterstützt (by design)

---

## Wichtige Erkenntnisse

### NPM Package Postinstall Magic

**CRITICAL**: NPM Packages können Installation modifizieren!

```javascript
// postinstall.cjs wird nach npm install ausgeführt
// Kann Files verschieben, löschen, modifizieren
// Git Installation MUSS dies manuell nachbilden!
```

**Lesson**: Immer `postinstall`, `preinstall`, `prepare` Scripts prüfen!

---

### Windows Path Escaping

**Problem**: Leerzeichen in Pfaden
**Lösung**: `shell: true` + Quotes INNERHALB des Arguments

```typescript
// ❌ Fails on paths with spaces
spawn('npm', ['install', '--prefix', 'C:\\Program Files\\...']);

// ✅ Works
spawn('npm', [`install --prefix "C:\\Program Files\\..."`], { shell: true });
```

---

### TypeScript Build Dependencies

**Problem**: TypeScript kann nicht kompilieren wenn imports fehlen

```typescript
// server.ts
import { WinccoaManager } from 'winccoa-manager';  // Import!
```

**Lösung**: Dependencies VOR TypeScript Compilation installieren
```bash
npm install              # Alle deps
npm install winccoa-manager  # Explizit für imports
npx tsc                  # Jetzt kann kompiliert werden
```

---

### npm prune Behavior

**Warnung**: `npm prune --omit=dev` entfernt ALLES nicht in package.json!

**Workaround**: 
1. Separate Installation für Critical Dependencies
2. ODER: package.json anpassen (dependencies statt peerDependencies)

---

### WinCC OA Manager Lifecycle

**Discovery**: WinCC OA Manager != Standalone Node.js App

**Manager wird gestartet mit**:
```
node.exe bootstrap.js -PROJ <name> -pmonIndex <num> <script.js>
```

**Manager erwartet**:
- Projekt-Name in argv
- PMON Index
- Manager-spezifische WinCC OA Argumente

**Standalone start funktioniert NICHT** (by design)

---

## Open Questions

1. **Ist TCP Connection Mode unterstützt?**
   - Kann WinccoaManager() mit host/port initialisiert werden?
   - Oder MUSS es via PMON gestartet werden?

2. **Welche .env Variablen sind WIRKLICH nötig?**
   - Original NPM Package: Welche .env?
   - Minimum viable .env?

3. **Warum funktionierte NPM Install vorher?**
   - Was haben wir geändert?
   - Nur PMON Settings in .env?
   - Oder noch etwas anderes?

4. **Git vs NPM Package Unterschiede**:
   - Sind package.json versions identisch?
   - Sind compiled outputs identisch?
   - Gibt es Laufzeit-Unterschiede?

---

## Debugging Commands

```bash
# Clean Install NPM Package
cd javascript
rm -rf mcpServer
npm install @etm-professional-control/winccoa-mcp-server
mv node_modules/@etm-professional-control/winccoa-mcp-server mcpServer

# Snapshot für Vergleich
cd mcpServer
find . -type f | sort > ~/npm-install-files.txt
cat package.json > ~/npm-package.json

# Git Install Test
node scripts/test-install.js

# Snapshot
cd C:\tmp\ProjectToRegister\javascript\mcpServer
find . -type f | sort > ~/git-install-files.txt
cat package.json > ~/git-package.json

# Compare
diff npm-install-files.txt git-install-files.txt
diff npm-package.json git-package.json

# Test PMON Startup
# Add to WinCC OA config/progs:
# node | always | 30 | 3 | 1 | javascript/mcpServer/index_http.js
# Start PMON and watch logs
```

---

## Files Changed

### New Files
- `scripts/test-install.js` - Standalone test script
- `GIT_INSTALL_DEVELOPMENT_LOG.md` - This file

### Modified Files
- `package.json` - New settings (installMethod, gitRepositoryUrl, gitBranch)
- `src/setupWizard.ts` - installFromGit(), createEnvFile(), copyDirectory()

### Test Files
- NPM Install: `C:\tmp\ProjectToRegister\javascript\mcpServer\` (to be recreated)
- Git Install: Same location (currently broken)

---

## Version Info

- **Branch**: feature/git-clone-support-1.6.0
- **Target Version**: v1.6.0
- **Status**: BLOCKED - Need to fix manager startup before release
- **Blocker**: "Not enough arguments in command line" error

---

## Contact for Next Chat

**Wichtigste Info für neuen Chat**:

1. **Problem**: Git Installation funktioniert FAST - Manager startet aber crasht
2. **Root Cause**: WinccoaManager() braucht WinCC OA argv, bekommt sie nicht standalone
3. **Verdacht**: Unsere PMON Settings in .env verursachen Problem (NPM Install crasht jetzt auch!)
4. **Plan**: Clean NPM Install machen, Struktur vergleichen, Git Build anpassen
5. **Dateien**: Dieser Log + test-install.js + setupWizard.ts

**Erste Aktion im neuen Chat**:
```bash
# Clean NPM install OHNE unsere Änderungen
# Dann schauen wie es WIRKLICH aussehen muss
```
