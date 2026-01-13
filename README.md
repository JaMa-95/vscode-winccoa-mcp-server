# WinCC OA MCP Server

![Version](https://img.shields.io/badge/version-0.4.0-blue.svg)

## Motivation

This extension provides a **Model Context Protocol (MCP) Server** for WinCC OA.

The goal is to enable GitHub Copilot and other AI assistants to directly interact with WinCC OA projects. This allows developers to use natural language commands to:

- Search and query datapoints
- List and monitor managers
- Get datapoint values and types
- Check manager status
- Analyze WinCC OA project structure

The MCP server acts as a bridge between AI assistants and the WinCC OA Tools Pack extensions by exposing their functionality through standardized MCP tools.

## Features

✅ **Auto-Detection:** Automatically reads MCP configuration from your WinCC OA project's `.env` file
✅ **Project Integration:** Integrates with WinCC OA Project Admin Extension for seamless project switching
✅ **Language Model Tools:** 5 tools available for GitHub Copilot autonomous access:
  - List WinCC OA Managers
  - Search Datapoints
  - Get Datapoint Values
  - Get Datapoint Types
  - Get Manager Status
✅ **Copilot-style UI:** Click the status bar to open a panel with connection info and action buttons
✅ **Auto-Reconnect:** Automatically reconnects when you switch projects

## Usage

1. **Install Extension:** Install from VS Code Marketplace
2. **Open WinCC OA Project:** Select a project in Project Admin Extension
3. **Auto-Configuration:** Extension reads `.env` from `<project>/javascript/mcpServer/mcpWinCCOA/.env`
4. **Check Status:** Click "🪄 WinCC OA Copilot" in the status bar (bottom right)
5. **Use with Copilot:** Ask GitHub Copilot to interact with your WinCC OA project

### Example Prompts

```
"Show me all datapoints with 'pump' in the name"
"What's the current value of System1:Tank.level?"
"List all running managers"
"Get the type information for ExampleDP_Arg1"
```

## Panel UI

Click the status bar icon to open the WinCC OA Copilot panel:

- **Status Badge:** Live connection status (Connected/Disconnected/Error)
- **Project Info:** Current project name, server URL, and available tools
- **Action Buttons:**
  - 🔌 **Test Connection:** Verify MCP Server is reachable
  - 🔄 **Reconnect:** Manually reconnect to server
  - ⚙️ **Settings:** Open extension settings
  - 📋 **Logs:** Show extension output logs

## Requirements

- **WinCC OA Project Admin Extension** (for automatic project detection)
- **MCP Server** running in your WinCC OA project
- `.env` file configured in `<project>/javascript/mcpServer/mcpWinCCOA/.env`

## Configuration

Extension reads configuration from your project's `.env` file:

```env
MCP_API_TOKEN=your-secure-token
MCP_HTTP_PORT=3001
MCP_AUTH_TYPE=bearer
```

No manual configuration needed - just select your project in Project Admin!

## Status

✅ **Functional** - Core features working:
- Auto-detection from project
- Language Model Tools integration
- Panel UI
- Auto-reconnect on project switch

🚧 **In Development:**
- Setup Wizard for MCP Server installation
- PMON integration

## Planned Features

- PMON Control (Start/Stop/Status)
- Manager Management
- Script Execution
- Log File Access
- Project Information Queries

## Development

This extension is part of the [WinCC OA Tools Pack](https://github.com/winccoa-tools-pack).

## License

MIT © Richard Janisch
