# Changelog

All notable changes to the "WinCC OA MCP Server" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Setup Wizard Webview
- Health Check (HTTP ping)
- Claude Desktop config writer
- PMON integration with Core Extension

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
