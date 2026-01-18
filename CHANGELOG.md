# Changelog

All notable changes to the "WinCC OA MCP Server" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-01-18

### 🎯 Changed
- **Clear Responsibilities**: Removed Execute Script Tool from MCP Extension
  - Script execution now exclusively handled by Script Actions Extension
  - MCP Extension focuses on MCP Server lifecycle management only
  - Tools: 5 MCP Server tools (managers, datapoints, values, types, status)

### 🛠️ Architecture
- **Extension Separation**: Each extension owns its specific Language Model Tools
  - MCP Server Extension: Server management + MCP tools
  - Script Actions Extension: Script execution (`scriptactions_execute_script`)
  - CTL Language Extension: Language features (`ctl_*` tools)
  - LogViewer Extension: Log analysis (`logviewer_*` tools)

## [1.1.1] - 2026-01-18

### Added
- **Reset & Reinstall Command**: Quick reset for debugging MCP Server setup issues
  - Deletes `javascript/mcpServer` folder and reinstalls from scratch
  - Manager entries in `config/progs` are preserved
  - Accessible via "Run Setup Wizard" button when already installed
- **Version Check**: Blocks installation for WinCC OA versions < 3.20
  - Shows clear error message with version requirement
  - Prevents installation attempts on unsupported versions

### Changed
- **🔧 BREAKING: NPM Package Installation**: Migrated from Git Clone to NPM package
  - Now installs `@etm-professional-control/winccoa-mcp-server` package
  - Pre-built JavaScript files, no TypeScript compilation needed
  - No bash build script required (Windows compatible)
  - Faster and more reliable installation
- **Windows Path Support**: Uses Project Admin Extension for WinCC OA paths
  - Automatically detects Windows registry paths (C:\Siemens\Automation\WinCC_OA\)
  - No more hardcoded `/opt/WinCC_OA/` Linux paths
  - Cross-platform compatibility (Windows + Linux)

### Fixed
- **Manager Script Path**: Corrected to `javascript/mcpServer/index_http.js`
  - Was: `javascript/mcpServer/mcpWinCCOA/build/index_http.js`
  - Matches NPM package structure
- **.env Detection Path**: Fixed to `javascript/mcpServer/.env`
  - Was: `javascript/mcpServer/mcpWinCCOA/build/.env`
  - Connection checks now find configuration correctly
- **npm install Error**: Resolved "Cannot read properties of undefined (reading 'extraneous')"
  - Root cause: Incompatible package-lock.json from Git Clone
  - Solution: NPM package has compatible dependencies

### Technical Notes
- **Architecture Change**: WinCC OA installation path now provided by Project Admin Extension
  - Single source of truth for project metadata
  - No duplicate path detection logic
- **Simplified Installation**: Reduced from 5 steps to 4 steps
  - ~~Step 1: Clone Repository~~ → Install NPM Package
  - ~~Step 2: Install Dependencies~~ → (included in NPM package)
  - Step 2: Install WinCC OA Manager (peer dependency)
  - Step 3: Generate Token
  - Step 4: Create .env
  - ~~Step 5: Build TypeScript~~ → (pre-built in NPM package)

## [1.1.0] - 2026-01-15

### Added
- **Automatic Manager Installation**: Post-setup dialog for WinCC OA manager configuration
  - User choice: Automatic installation or manual instructions
  - Automatic mode: Writes manager to `config/progs` file with restart reminder
  - Manual mode: Shows comprehensive setup instructions in webview panel
- **Smart Manager Number Assignment**: Automatically finds next free `-num X` number
  - Scans existing managers for used numbers
  - Prevents conflicts with existing manager numbers
- **Manager Configuration Writer**: File-based manager entry creation
  - Writes directly to `config/progs` file for persistence
  - Proper formatting matching WinCC OA expectations
  - Duplicate detection to prevent multiple entries
- **Comprehensive Manual Instructions**: Two setup methods provided
  - **Option 1 (Recommended)**: Via PMON Console with exact configuration values
  - **Option 2**: Direct `config/progs` file editing with formatted entry
  - Copy-ready manager options string for easy setup

### Changed
- **Setup Wizard**: Replaced TODO with integrated manager installation workflow
  - Post-installation manager setup dialog
  - Clear restart requirements communicated to user
- **Manager Options Format**: Uses `-num X mcpServer <path>` format
  - Follows WinCC OA JavaScript manager conventions
  - Auto-assigns next free manager number

### Technical Notes
- **PMON Runtime Limitation**: PMON `SINGLE_MGR:INS` command is runtime-only, does NOT persist to config
- **File-Based Approach**: Direct `config/progs` writing is the only way to persistently add managers
- **Restart Requirement**: WinCC OA project must be restarted for new managers to appear in PMON

## [1.0.0] - 2026-01-15

### Added
- **connect command**: Manual connection to MCP Server with already-connected detection
- **disconnect command**: Manual disconnection from MCP Server
- **Context-Sensitive Menu**: showMenu() displays different options based on connection status
  - Connected: Show Server Info, Disconnect, Reconnect, Show Logs
  - Disconnected: Connect, Run Setup, Show Logs

### Changed
- **Command Structure**: Simplified and more semantic command naming
  - `testConnection` → `connect` (more intuitive)
  - Added explicit `disconnect` command
  - All commands properly documented
- **showMenu()**: Now context-aware, shows relevant actions only
- **Status Bar**: getCurrentStatus() method for context detection

### Removed
- **testConnection command**: Replaced by more semantic `connect` command

### Fixed
- **Command Naming**: "Test Connection" was confusing (it actually connected, not just tested)

## [0.9.0] - 2026-01-15

### Added
- **User Settings**: Configuration options in VS Code Settings UI
  - `winccoa.mcp.logLevel`: Filter log output (debug, info, warn, error)
  - `winccoa.mcp.autoReconnect`: Enable/disable automatic reconnection (default: true)
  - `winccoa.mcp.reconnectRetries`: Configure retry attempts 0-10 (default: 3)
  - `winccoa.mcp.heartbeatInterval`: Configure heartbeat check frequency 5s-5min (default: 30s)
  - `winccoa.mcp.showNotifications`: Toggle reconnect notifications (default: true)
- **Log Level Filtering**: ExtensionOutputChannel respects log level setting
- **Settings Integration**: Connection monitor reads settings on startup

### Changed
- **startConnectionMonitor()**: Reads user settings instead of hardcoded values
- **handleReconnectSuccess/Failed()**: Respect showNotifications setting
- **ExtensionOutputChannel**: Added log level filtering logic

### Fixed
- **Log Spam**: Users can now reduce verbosity by setting logLevel to 'warn' or 'error'

## [0.8.0] - 2026-01-15

### Added
- **Connection Monitor**: Heartbeat-based connection monitoring with 30s interval (hardcoded, configurable in 0.9.0)
- **Auto-Reconnect**: Automatic reconnection on connection loss with exponential backoff (2s, 4s, 8s)
- **Reconnect Retries**: Up to 3 automatic reconnect attempts before giving up
- **Connection Status**: New status states: connected, disconnected, reconnecting, error
- **User Notifications**: Auto-reconnect success/failure messages

### Changed
- **createClient()**: Now starts connection monitoring automatically
- **disposeClient()**: Stops connection monitor when disposing client
- **reconnect()**: Resets monitor reconnect attempts on manual reconnect
- **Extension Deactivate**: Stops connection monitor on extension shutdown

### Fixed
- **Silent Connection Loss**: Extension now detects when MCP Server becomes unavailable
- **Connection Failures**: Automatic recovery attempts with user notification

## [0.7.0] - 2026-01-15

### Added
- **Persistent Client**: Global MCP client instance reused across commands
- **Lifecycle Management**: `createClient()`, `disposeClient()`, `getClient()` functions
- **Automatic Disposal**: Old client disposed when creating new one (prevents memory leaks)
- **Extension Deactivation**: Client properly disposed when extension deactivates

### Changed
- **Project Change Handling**: Disposes old client and creates new one when switching projects
- **Chat Participant Update**: Chat participant updated when client changes
- **getMcpConfig()**: Returns cached config if client is connected
- **showServerInfo()**: Uses existing client instead of creating new one
- **testConnection()**: Reuses existing client if available
- **reconnect()**: Uses createClient() for consistent behavior

### Fixed
- **Memory Leak**: Old clients no longer stay in memory on project change
- **Chat Participant Stale Client**: Chat commands now work with current project after switching
- **Language Model Tools Update**: Tools properly updated when client changes

## [0.6.1] - 2026-01-15

### Fixed
- **Chat Participant async/sync mismatch**: `getMcpConfig()` is now properly awaited in `handleRequest()` to prevent "Cannot use 'in' operator" error
- **Reconnect command**: Now creates new `McpClient` instance instead of reusing non-existent client after setup
- **Client initialization**: Chat Participant properly initializes MCP client with awaited config

### Changed
- Chat Participant constructor receives config getter function, client created on-demand in handleRequest
- Reconnect command now properly instantiates client, initializes connection, and updates Language Model Tools

## [0.6.0] - 2026-01-13

### Added
- **Auto-Setup Wizard**: Automatic MCP Server installation for projects without MCP
  - Repository cloning (`git clone`)
  - NPM dependency installation
  - Secure token generation (crypto.randomBytes)
  - `.env` file creation with configuration
  - MCP Server build process
  - PMON integration instructions (manual step for now)
- **Setup Detection**: Automatically detects missing MCP Server on startup
- **User Prompts**: "Run Setup Wizard" option when MCP Server not found
- **Command**: `winccoa.mcp.runSetup` for manual setup trigger
- **Progress Notifications**: Live progress updates during setup steps

### Changed
- `handleDetectionError` now offers "Run Setup Wizard" instead of "Setup Wizard (TODO)"
- Detection errors trigger async setup flow
- Setup wizard integrates with Project Admin Extension API

### Known Issues
- **Manager Package Resolution**: After setup, WinCC OA Manager may fail with `Cannot find package 'winccoa-manager'` error
  - Cause: Node module resolution in cloned repository
  - Workaround: Manual PMON configuration may be needed
  - Status: Investigating proper NODE_PATH configuration

### TODO
- Automatic PMON manager registration (requires Core Extension integration)

## [0.5.0] - 2026-01-13

### Added
- **Execute Script Tool**: New Language Model Tool `winccoa_execute_script` for executing CTL scripts via Script Actions extension
- Integration with WinCC OA Script Actions extension
- Script file search in workspace
- Support for script arguments

### Changed
- Tool count increased from 5 to 6

## [0.4.0] - 2026-01-13

### Added
- **Auto-Detection:** Read MCP config from project `.env` file (token, port, authType)
- **Project Admin Integration:** Automatic project detection and config loading
- **Project Change Events:** Auto-reconnect when project switches in Project Admin
- **Copilot-style Panel UI:** Click status bar opens panel at bottom (like GitHub Copilot)
  - Connection status with live updates
  - Project name, server URL, and tool count
  - Action buttons: Test Connection, Reconnect, Settings, Logs
- **Language Model Tools:** Always available (lazy client loading pattern)
- **Status Bar:** Renamed to "WinCC OA Copilot" with magic wand icon ($(wand))

### Fixed
- **Security:** Removed hardcoded token from public repository
- **UX:** No more notification spam for "no project selected" (only logs + red icon)
- **Tools Availability:** Tools now registered at startup (always visible to Copilot)

### Changed
- Error handling improved with 5 specific scenarios
- Config detection with caching and invalidation on project change

## [0.3.0] - 2026-01-13

### Fixed
- **Critical:** `get-datapoints` tool used wrong parameter name (`pattern` instead of `dpNamePattern`)
- **Critical:** Multiple datapoint results were ignored (only first result was returned)
- Datapoint search now correctly finds all matching datapoints

### Added
- TEST_PROMPTS.md: Comprehensive test scenarios for manual testing

## [0.2.0] - 2025-12-28

### Added
- **MCP Server Management Foundation**
  - MCPServerInstaller: Git clone + npm install automation
  - MCPConfigManager: .env file generation and config/progs management
  - MCPManagerControl: PMON integration (placeholder)
  - Public API for Core Extension integration
- **Commands**
  - `winccoa.mcp.setup` - Setup wizard (placeholder)
  - `winccoa.mcp.start/stop/restart` - Manager control
  - `winccoa.mcp.showLogs` - Output channel
  - `winccoa.mcp.diagnostics` - Diagnostics view (placeholder)
  - `winccoa.mcp.updateConfig` - Config editor (placeholder)
  - `winccoa.mcp.generateToken` - Secure token generator
- **Test Infrastructure**
  - Unit tests for token generation and tool configurations
  - Integration test structure with real WinCC OA test project
  - Test documentation with safety warnings

### Dependencies
- simple-git for repository cloning
- sinon, chai for testing
- @modelcontextprotocol/sdk ready for future use

### Notes
- Foundation complete, Wizard and Health Check coming in next version
- Integration tests need VS Code Extension Host (will run via make test-local)

## [0.1.0] - 2025-12-28

### Added
- Initial repository setup
- Package structure and configuration
- README with project motivation
- Basic project scaffolding

### Notes
- ⚠️ Pre-release version - no functional features yet
- Repository initialized with Git Flow (main/develop)
- Part of WinCC OA Tools Pack ecosystem
