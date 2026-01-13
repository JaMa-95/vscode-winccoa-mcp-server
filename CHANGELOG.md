# Changelog

All notable changes to the "WinCC OA MCP Server" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Setup Wizard for MCP Server installation
- PMON integration with Core Extension

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
