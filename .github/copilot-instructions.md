# README für GitHub Copilot: WinCC OA MCP Server Extension

## Projektübersicht

Die **WinCC OA MCP Server Extension** ist eine VS Code Extension, die automatisch einen Model Context Protocol (MCP) Server für WinCC OA Projekte einrichtet und verwaltet. Sie integriert den MCP Server nahtlos mit GitHub Copilot, um AI-gestützte WinCC OA Entwicklung zu ermöglichen.

## Kernziele

### 🎯 Hauptfunktionen

1. **Automatische Projekt-Erkennung**
   - Integration mit WinCC OA Project Admin Extension
   - Erkennung des aktuell ausgewählten WinCC OA Projekts
   - Überwachung von Projekt-Wechseln

2. **MCP Server Auto-Setup**
   - Prüfung ob MCP Server bereits im Projekt läuft
   - Wenn nicht vorhanden:
     - Automatisches Clonen/Download des `winccoa-ae-js-mcpserver` Repository
     - Installation im Projekt-Verzeichnis: `<project>/javascript/mcpServer/`
     - Automatische NPM Dependencies Installation
     - Token-Generierung (secure random token)
     - Konfiguration der `.env` Datei
     - Build-Prozess ausführen
     - WinCC OA Manager-Eintrag erstellen
     - Server automatisch starten

3. **GitHub Copilot Integration**
   - Automatische Konfiguration der Claude Desktop / GitHub Copilot Settings
   - Token-Übergabe an Copilot
   - MCP Server URL konfigurieren (http://localhost:3001)
   - Auth-Type und Token in Copilot-Config schreiben

4. **Extension Detection & Integration**
   - Erkennung installierter WinCC OA Extensions:
     - `vscode-winccoa-scriptactions` → Als MCP Tool verfügbar machen
     - `vscode-winccoa-tests` → Test Explorer via MCP
     - `vscode-winccoa-logviewer` → Log-Abfragen via MCP
     - `vscode-winccoa-ctrllang` → CTL Language Features via MCP
   - Dynamisches Registrieren der Extensions als MCP Tools
   - Bidirektionale Kommunikation: Extension ↔ MCP ↔ Copilot

5. **Status-Management**
   - Status Bar Item: MCP Server Status (Running/Stopped/Error)
   - Commands:
     - `winccoa.mcp.start` - Server starten
     - `winccoa.mcp.stop` - Server stoppen
     - `winccoa.mcp.restart` - Server neu starten
     - `winccoa.mcp.setup` - Setup-Wizard starten
     - `winccoa.mcp.configure` - Konfiguration öffnen
   - Notifications bei Problemen

## Projektstruktur

```
vscode-winccoa-mcp-server/
├── src/
│   ├── extension.ts              # Entry Point, Activation
│   ├── mcpServerManager.ts       # MCP Server Lifecycle Management
│   ├── projectDetector.ts        # WinCC OA Projekt-Erkennung
│   ├── setupWizard.ts            # Auto-Setup Wizard
│   ├── tokenManager.ts           # Token Generation & Storage
│   ├── copilotIntegration.ts    # GitHub Copilot Config
│   ├── extensionDetector.ts     # Andere Extensions erkennen
│   └── statusBar.ts              # Status Bar UI
├── package.json                  # Extension Manifest
├── .github/
│   └── copilot-instructions.md   # DIESE DATEI
└── README.md
```

## Technische Details

### 1. Projekt-Erkennung via Project Admin

```typescript
// Integration mit vscode-winccoa-control (Project Admin)
import { ProjectManager } from 'vscode-winccoa-control';

async function getCurrentProject(): Promise<Project | null> {
    // Get currently selected project from Project Admin Extension
    const projectAdmin = vscode.extensions.getExtension('etm-control.vscode-winccoa-control');
    if (!projectAdmin) {
        throw new Error('WinCC OA Project Admin Extension not installed');
    }
    
    const api = await projectAdmin.activate();
    return api.getCurrentProject();
}
```

### 2. MCP Server Status Detection

```typescript
async function isMcpServerRunning(project: Project): Promise<boolean> {
    // Check 1: Manager läuft?
    const managers = await project.getManagers();
    const mcpManager = managers.find(m => m.commandlineOptions.includes('mcpServer'));
    
    if (!mcpManager || mcpManager.state !== 'running') {
        return false;
    }
    
    // Check 2: HTTP Endpoint erreichbar?
    try {
        const response = await fetch('http://localhost:3001/mcp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/event-stream'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'initialize',
                id: 1
            })
        });
        
        return response.ok;
    } catch {
        return false;
    }
}
```

### 3. Auto-Setup Workflow

```typescript
async function setupMcpServer(project: Project): Promise<void> {
    const setupSteps = [
        { name: 'Clone Repository', fn: cloneRepository },
        { name: 'Install Dependencies', fn: installDependencies },
        { name: 'Generate Token', fn: generateToken },
        { name: 'Configure .env', fn: configureEnv },
        { name: 'Build Server', fn: buildServer },
        { name: 'Add Manager to Pmon', fn: addManagerToPmon },
        { name: 'Start Server', fn: startServer },
        { name: 'Configure Copilot', fn: configureCopilot }
    ];
    
    for (const step of setupSteps) {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Setting up MCP Server: ${step.name}`,
            cancellable: false
        }, async () => {
            await step.fn(project);
        });
    }
}

async function cloneRepository(project: Project): Promise<void> {
    const targetPath = path.join(project.path, 'javascript', 'mcpServer');
    
    // Option 1: Git clone
    await exec(`git clone https://github.com/winccoa/winccoa-ae-js-mcpserver.git ${targetPath}`);
    
    // Option 2: NPM Package (später)
    // await exec(`npm install @etm-professional-control/winccoa-mcp-server`, { cwd: targetPath });
}

async function generateToken(): Promise<string> {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
}

async function configureEnv(project: Project): Promise<void> {
    const token = await generateToken();
    const envPath = path.join(project.path, 'javascript', 'mcpServer', 'mcpWinCCOA', 'build', '.env');
    
    const envContent = `
# Auto-generated by WinCC OA MCP Server Extension
MCP_API_TOKEN=${token}
MCP_MODE=http
MCP_HTTP_PORT=3001
MCP_HTTP_HOST=0.0.0.0
MCP_AUTH_TYPE=bearer
RATE_LIMIT_ENABLED=true
MCP_CORS_ENABLED=true
MCP_CORS_ORIGINS=*
WINCCOA_FIELD=default
TOOLS=datapoints/dp_basic,datapoints/dp_create,datapoints/dp_set,manager/manager_list,archive/archive_query
    `.trim();
    
    await fs.writeFile(envPath, envContent);
    
    // Token sicher speichern für Copilot-Config
    await storeToken(project, token);
}

async function addManagerToPmon(project: Project): Promise<void> {
    // Pmon config editieren
    const pmonConfigPath = path.join(project.path, 'config', 'progs');
    
    const managerEntry = `
node -num 3 manual 1 1 2 2 mcpServer/mcpWinCCOA/build/index_http.js
    `.trim();
    
    // Append to progs file
    await fs.appendFile(pmonConfigPath, '\n' + managerEntry);
}
```

### 4. GitHub Copilot Integration

```typescript
async function configureCopilot(project: Project, token: string): Promise<void> {
    // Claude Desktop Config Path
    const configPaths = {
        linux: path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json'),
        darwin: path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
        win32: path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json')
    };
    
    const configPath = configPaths[process.platform];
    
    let config: any = {};
    if (fs.existsSync(configPath)) {
        config = JSON.parse(await fs.readFile(configPath, 'utf8'));
    }
    
    // MCP Server hinzufügen
    config.mcpServers = config.mcpServers || {};
    config.mcpServers['winccoa'] = {
        command: 'node',
        args: [path.join(project.path, 'javascript', 'mcpServer', 'mcpWinCCOA', 'build', 'index_http.js')],
        env: {
            MCP_API_TOKEN: token,
            MCP_MODE: 'http',
            MCP_HTTP_PORT: '3001'
        }
    };
    
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    
    vscode.window.showInformationMessage(
        'MCP Server configured for GitHub Copilot! Please restart Claude Desktop.',
        'Open Claude Desktop Config'
    ).then(selection => {
        if (selection) {
            vscode.env.openExternal(vscode.Uri.file(configPath));
        }
    });
}
```

### 5. Extension Detection

```typescript
interface WinCCOAExtension {
    id: string;
    name: string;
    mcpTools: string[];  // Welche MCP Tools diese Extension bereitstellt
}

const KNOWN_EXTENSIONS: WinCCOAExtension[] = [
    {
        id: 'etm-control.vscode-winccoa-scriptactions',
        name: 'Script Actions',
        mcpTools: ['execute-script', 'execute-script-with-args']
    },
    {
        id: 'etm-control.vscode-winccoa-tests',
        name: 'Test Explorer',
        mcpTools: ['run-test', 'run-test-suite', 'get-test-results']
    },
    {
        id: 'etm-control.vscode-winccoa-logviewer',
        name: 'Log Viewer',
        mcpTools: ['query-logs', 'stream-logs', 'filter-logs']
    },
    {
        id: 'etm-control.vscode-winccoa-ctrllang',
        name: 'CTL Language',
        mcpTools: ['goto-definition', 'find-references', 'hover-info']
    }
];

async function detectInstalledExtensions(): Promise<WinCCOAExtension[]> {
    const installed: WinCCOAExtension[] = [];
    
    for (const ext of KNOWN_EXTENSIONS) {
        const extension = vscode.extensions.getExtension(ext.id);
        if (extension) {
            installed.push(ext);
        }
    }
    
    return installed;
}

async function registerExtensionTools(extensions: WinCCOAExtension[]): Promise<void> {
    // Tools-Liste für MCP Server generieren
    const allTools = extensions.flatMap(ext => ext.mcpTools);
    
    // In .env schreiben
    const envPath = path.join(getCurrentProject().path, 'javascript', 'mcpServer', 'mcpWinCCOA', 'build', '.env');
    const envContent = await fs.readFile(envPath, 'utf8');
    
    // TOOLS= Zeile updaten
    const updatedEnv = envContent.replace(
        /TOOLS=.*/,
        `TOOLS=datapoints/dp_basic,manager/manager_list,${allTools.join(',')}`
    );
    
    await fs.writeFile(envPath, updatedEnv);
    
    // Server neu starten
    await restartMcpServer();
}
```

### 6. Status Bar UI

```typescript
class McpServerStatusBar {
    private statusBarItem: vscode.StatusBarItem;
    
    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'winccoa.mcp.showMenu';
    }
    
    updateStatus(status: 'running' | 'stopped' | 'error' | 'starting') {
        const icons = {
            running: '$(radio-tower)',
            stopped: '$(circle-slash)',
            error: '$(error)',
            starting: '$(sync~spin)'
        };
        
        const colors = {
            running: undefined,
            stopped: new vscode.ThemeColor('statusBarItem.warningBackground'),
            error: new vscode.ThemeColor('statusBarItem.errorBackground'),
            starting: undefined
        };
        
        this.statusBarItem.text = `${icons[status]} MCP Server`;
        this.statusBarItem.backgroundColor = colors[status];
        this.statusBarItem.show();
    }
}
```

## Workflow-Übersicht

### User-Workflow beim ersten Start:

1. **User installiert Extension**
2. **Extension aktiviert sich** bei WinCC OA Projekt-Erkennung
3. **Auto-Detection** prüft:
   - Ist Project Admin Extension installiert? → Ja/Nein
   - Ist ein WinCC OA Projekt ausgewählt? → Ja/Nein
   - Läuft MCP Server bereits? → Ja/Nein
4. **Falls MCP Server nicht läuft:**
   - Zeige Notification: "MCP Server not running. Setup now?"
   - User klickt "Yes"
   - Setup-Wizard startet (Progress Bar)
   - Nach Abschluss: "MCP Server ready! Configure GitHub Copilot?"
5. **Copilot-Config:**
   - User klickt "Yes"
   - Extension schreibt `claude_desktop_config.json`
   - Zeigt "Restart Claude Desktop to activate"
6. **Laufender Betrieb:**
   - Status Bar zeigt: `$(radio-tower) MCP Server`
   - User kann via Command Palette:
     - Server stoppen/starten
     - Config öffnen
     - Logs anschauen

### Extension Detection Workflow:

1. **Bei Activation:**
   ```
   detectInstalledExtensions() 
     → [Script Actions, Test Explorer, Log Viewer]
   ```
2. **Tools registrieren:**
   ```
   registerExtensionTools()
     → Update .env TOOLS=
     → Restart MCP Server
   ```
3. **In Copilot verfügbar:**
   ```
   User: "Run test for MyClass"
   Copilot → MCP Tool: run-test(testCaseId: "MyClass")
   Extension: Test Explorer → executeScriptWithArgs("MyClass")
   ```

## Commands (package.json)

```json
{
  "contributes": {
    "commands": [
      {
        "command": "winccoa.mcp.start",
        "title": "Start MCP Server",
        "category": "WinCC OA"
      },
      {
        "command": "winccoa.mcp.stop",
        "title": "Stop MCP Server",
        "category": "WinCC OA"
      },
      {
        "command": "winccoa.mcp.restart",
        "title": "Restart MCP Server",
        "category": "WinCC OA"
      },
      {
        "command": "winccoa.mcp.setup",
        "title": "Setup MCP Server",
        "category": "WinCC OA"
      },
      {
        "command": "winccoa.mcp.configure",
        "title": "Configure MCP Server",
        "category": "WinCC OA"
      },
      {
        "command": "winccoa.mcp.showLogs",
        "title": "Show MCP Server Logs",
        "category": "WinCC OA"
      },
      {
        "command": "winccoa.mcp.showMenu",
        "title": "Show MCP Server Menu",
        "category": "WinCC OA"
      }
    ]
  }
}
```

## Konfiguration (package.json)

```json
{
  "contributes": {
    "configuration": {
      "title": "WinCC OA MCP Server",
      "properties": {
        "winccoa.mcp.autoStart": {
          "type": "boolean",
          "default": true,
          "description": "Automatically start MCP Server when WinCC OA project is opened"
        },
        "winccoa.mcp.autoSetup": {
          "type": "boolean",
          "default": true,
          "description": "Automatically setup MCP Server if not present"
        },
        "winccoa.mcp.port": {
          "type": "number",
          "default": 3001,
          "description": "HTTP port for MCP Server (avoid 3000 - used by WinCC OA Manager)"
        },
        "winccoa.mcp.enableExtensionIntegration": {
          "type": "boolean",
          "default": true,
          "description": "Automatically detect and integrate other WinCC OA extensions"
        }
      }
    }
  }
}
```

## Dependencies (package.json)

```json
{
  "extensionDependencies": [
    "etm-control.vscode-winccoa-control"
  ],
  "dependencies": {
    "node-fetch": "^3.3.2"
  }
}
```

## Nächste Schritte

### Phase 1: Grundgerüst (Prio 1)
- [ ] Extension Scaffold erstellen
- [ ] Project Detection implementieren
- [ ] MCP Server Status Detection
- [ ] Basic Commands (start/stop/restart)
- [ ] Status Bar UI

### Phase 2: Auto-Setup (Prio 2)
- [ ] Setup Wizard UI
- [ ] Repository Clone/Download
- [ ] Token Generation
- [ ] .env Configuration
- [ ] Pmon Integration
- [ ] Server Start

### Phase 3: Copilot Integration (Prio 3)
- [ ] Claude Desktop Config Detection
- [ ] Auto-Configuration
- [ ] Token-Übergabe
- [ ] Testing mit Copilot

### Phase 4: Extension Detection (Prio 4)
- [ ] Extension Detection Logic
- [ ] MCP Tools Registration
- [ ] Dynamic Tool Loading
- [ ] API für andere Extensions

## Best Practices

### Error Handling
- **Graceful Degradation**: Wenn Project Admin fehlt → Manueller Pfad-Input
- **Retry Logic**: Bei Network-Errors → 3x Retry mit Backoff
- **User Feedback**: Immer klare Error-Messages mit Lösungsvorschlägen

### Security
- **Token Storage**: VS Code SecretStorage API nutzen, NICHT in Settings
- **HTTPS**: Optional SSL/TLS Support für Production
- **Input Validation**: Alle User-Inputs validieren

### Performance
- **Lazy Loading**: MCP Server nur bei Bedarf starten
- **Caching**: Project Info cachen, nicht bei jedem Request neu laden
- **Background Tasks**: Setup im Background, UI nicht blockieren

## Zusammenarbeit mit GitHub Copilot

### Erwartungen
- **Strukturiert arbeiten**: Klare Workflows, modularer Code
- **Testing**: Jeden Feature-Branch testen bevor Merge
- **Git Flow einhalten**: Feature Branches, semantische Commits
- **Dokumentation pflegen**: README, CHANGELOG, API Docs

### Communication Style
- **Deutsch**: Primäre Sprache für Kommunikation
- **Englisch**: Code, Commits, Dokumentation
- **Knapp & präzise**: Keine unnötigen Erklärungen
- **Technisch korrekt**: Exakte Begriffe, keine Vereinfachungen
