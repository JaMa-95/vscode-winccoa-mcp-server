# Refactoring Plan: Replace LM Tool Wrappers with `.vscode/mcp.json`

## Repository

`c:\repos\vscode-winccoa-mcp-server` — branch `develop` (HEAD `e7f0cf4`)

## Context / Why

The current `src/languageModelTools.ts` (1193 lines) wraps every single MCP Server tool
individually inside a VS Code `vscode.lm.registerTool()` call. This is the
**Telephone Anti-Pattern**:

```
Copilot → VS Code LM Tool (Extension) → McpClient (HTTP) → MCP Server → WinCC OA
                   ↑ this layer adds zero value
```

Every tool name, schema and payload has to be maintained twice.
The underlying MCP Server (`winccoa-tools-pack/winccoa-mcp-server`, latest `v0.1.4`) already
**changed all tool names** (e.g. `list-managers` → `manager.manager_list`,
`get-datapoints` → `datapoints.dp_names`) so all 16 `callTool()` calls are currently broken.

**The correct approach** is to write a `.vscode/mcp.json` file into the workspace so that
VS Code/Copilot connects to the MCP Server directly (HTTP transport, supported since VS Code 1.99).
The Extension then only does what it is uniquely positioned to do:
detect the project, install the server, manage the manager lifecycle, and write the config file.

---

## Goal

After this refactor:

1. **`languageModelTools.ts`** is deleted.
2. **`mcpClient.ts`** is deleted (no longer needed for tool bridging; keep only if connection health-check is still wanted — see note below).
3. **`chatParticipant.ts`** is deleted (was only used for tool routing).
4. **`extension.ts`** writes `.vscode/mcp.json` whenever a successful connection is established or the project changes.
5. The `package.json` `contributes.languageModelTools` array and the `contributes.chatParticipants` array are removed.
6. Version bumped to **`1.9.0`**, CHANGELOG updated.

---

## Step-by-step Instructions

### Step 1 — Create feature branch

```powershell
cd c:\repos\vscode-winccoa-mcp-server
git checkout develop
git pull origin develop
git checkout -b feature/replace-lm-tools-with-mcp-json
```

---

### Step 2 — Understand what currently uses `McpClient` and `LanguageModelTools`

Read the following files to understand all their usages before deleting anything:

- `src/extension.ts` — imports and calls `McpClient`, `LanguageModelTools`, `ConnectionMonitor`
- `src/connectionMonitor.ts` — imports `McpClient`
- `src/languageModelTools.ts` — 1193 lines, full delete candidate
- `src/chatParticipant.ts` — check if used from `extension.ts`
- `src/mcpClient.ts` — used for health-check in `connectionMonitor.ts` + tool calls in `languageModelTools.ts`
- `src/mcpPanel.ts` / `src/mcpPanelView.ts` — check whether they use `McpClient`

**Decision on `McpClient`**: Keep a minimal version of `McpClient` that only does
`initialize()` (ping/health-check) so `ConnectionMonitor` can verify the server is reachable.
The `callTool()` method can be removed.

---

### Step 3 — Remove `languageModelTools.ts`

Delete the file:
```powershell
Remove-Item src\languageModelTools.ts
```

In `src/extension.ts`:
- Remove `import { LanguageModelTools } from './languageModelTools';`
- Remove `let languageModelTools: LanguageModelTools;`
- Remove `languageModelTools = new LanguageModelTools(null); languageModelTools.register(context);`
- Remove `languageModelTools.updateClient(client);` (inside `createClient()`)

---

### Step 4 — Remove `chatParticipant.ts`

Check if `chatParticipant.ts` is imported in `extension.ts`. If yes, remove the import and registration call, then delete the file.

```powershell
Remove-Item src\chatParticipant.ts
```

---

### Step 5 — Strip `McpClient.callTool()` (optional cleanup)

In `src/mcpClient.ts`, remove:
- `callTool()` method
- `listTools()` method
- `McpTool`, `McpResource`, `McpToolResult` interfaces (if only used by those methods)

Keep:
- `initialize()` — used by `ConnectionMonitor` as health-check ping
- `McpClientConfig` interface
- Constructor

---

### Step 6 — Implement `writeMcpJson()` in `extension.ts`

Add this function to `src/extension.ts`:

```typescript
/**
 * Write .vscode/mcp.json so that VS Code / GitHub Copilot connects
 * to the MCP Server directly (HTTP transport).
 * Overwrites any previous entry for "winccoa".
 */
async function writeMcpJson(config: McpConfig): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        ExtensionOutputChannel.warn('No workspace folder open — skipping mcp.json write');
        return;
    }

    const vscodePath = vscode.Uri.joinPath(workspaceFolders[0].uri, '.vscode');
    const mcpJsonPath = vscode.Uri.joinPath(vscodePath, 'mcp.json');

    // Read existing file (if any) to preserve other server entries
    let existing: any = { servers: {} };
    try {
        const raw = await vscode.workspace.fs.readFile(mcpJsonPath);
        existing = JSON.parse(Buffer.from(raw).toString('utf8'));
        if (!existing.servers) existing.servers = {};
    } catch {
        // file does not exist yet — start fresh
    }

    existing.servers['winccoa'] = {
        type: 'http',
        url: config.url,
        headers: {
            Authorization: `Bearer ${config.token}`,
        },
    };

    await vscode.workspace.fs.writeFile(
        mcpJsonPath,
        Buffer.from(JSON.stringify(existing, null, 4), 'utf8'),
    );

    ExtensionOutputChannel.info(`✅ .vscode/mcp.json written: ${config.url}`);
}
```

Call this function in two places inside `extension.ts`:

1. **Inside `createClient()`**, immediately after `mcpClient = client; currentConfig = config;`:
   ```typescript
   await writeMcpJson(config);
   ```

2. **Inside `disposeClient()`** (on explicit disconnect) — optionally remove the `winccoa` entry
   or leave the file as-is (so Copilot shows it as inactive, not broken).

---

### Step 7 — Remove `contributes.languageModelTools` from `package.json`

In `package.json`, delete the entire `"languageModelTools": [...]` array inside `contributes`.
It currently spans roughly lines 80–680 (all tool schemas for Copilot).

Also remove `"contributes.chatParticipants"` if present.

The `contributes` section should only keep:
- `commands`
- `configuration`
- `menus` (if any)

---

### Step 8 — Remove old LM tool icons from `package.json` activation

Check `activationEvents` — remove any event that was only needed for LM tools (e.g. `onLanguageModelTool:winccoa_*`).
Keep `"onStartupFinished"`.

---

### Step 9 — Update `.vscode/mcp.json` note in `README.md`

Add a short section explaining that after connecting, `.vscode/mcp.json` is written automatically
and Copilot will pick up all MCP Server tools natively.

---

### Step 10 — Bump version and update CHANGELOG

In `package.json`:
```json
"version": "1.9.0"
```

In `CHANGELOG.md`, add at the top (under `[Unreleased]`):

```markdown
## [1.9.0] - 2026-03-XX

### ✨ Added
- **Native VS Code MCP integration**: Extension now writes `.vscode/mcp.json` automatically
  on connect, allowing GitHub Copilot to call all MCP Server tools directly without an
  extension wrapper. All current and future server tools are available immediately.

### 🗑️ Removed
- **LM Tool wrappers** (`languageModelTools.ts`, 1193 lines): Deleted — replaced by `.vscode/mcp.json`.
  The 16 wrapped tools were also using outdated tool names (broken since MCP Server v0.1.4).
- **Chat Participant** (`chatParticipant.ts`): Deleted — no longer needed.
- **`contributes.languageModelTools`** in `package.json`: All ~600 lines of tool schema
  declarations removed; VS Code/Copilot reads schemas directly from the server.
- **`McpClient.callTool()` / `listTools()`**: Removed; `McpClient` is now only used for
  health-check pings via `initialize()`.

### 🏗️ Build
- VSIX size reduced significantly (no more large `contributes` blobs in manifest)
```

---

### Step 11 — Compile and verify

```powershell
npm run compile:tsc
npm run lint
npm run format:check
```

Expect zero errors (some warnings for unused vars in remaining files are fine).

---

### Step 12 — Commit

```powershell
git add -A
# exclude DevEnv.code-workspace, bin/, README.md if unchanged
git commit -m "feat: replace LM tool wrappers with .vscode/mcp.json native MCP integration"
git push origin feature/replace-lm-tools-with-mcp-json
```

---

## Files Modified Summary

| File | Action |
|---|---|
| `src/languageModelTools.ts` | **DELETE** |
| `src/chatParticipant.ts` | **DELETE** |
| `src/mcpClient.ts` | Strip `callTool`, `listTools`, related interfaces |
| `src/extension.ts` | Remove LM/chat imports; add `writeMcpJson()`; call it from `createClient()` |
| `src/connectionMonitor.ts` | No change needed (uses `initialize()` only) |
| `package.json` | Remove `contributes.languageModelTools`, bump to `1.9.0` |
| `CHANGELOG.md` | Add `[1.9.0]` entry |

---

## What Copilot Gets After This Change

All tools exposed by `winccoa-tools-pack/winccoa-mcp-server` (currently v0.1.4, 30+ tools),
automatically, without any extension-side maintenance:

- `datapoints.dp_get/set/create/delete/copy/names/exists/query/dp_set_timed/dp_set_period`
- `dp_types.dp_types`
- `manager.manager_list/status/start/stop/restart/properties` + `pmon-project-name` + `system-info`
- `alarms.alarm_config_get/set/delete` + `alarm_log_get`
- `archive.archive_config_get/set/delete`
- `common.common_get/set/delete`
- `pv_range.pv_range_get/set/delete`
- `opcua.opcua_connection_list/add/delete` + `address_set` + `browse`
- `ascii.ascii_export/import`
- `script.script_execute`
- `address.address_config_set/delete`
- `distrib.distrib_config_set/delete`
- `smooth.smooth_config_set/delete`
- `dp_fct.dp_fct_config_set/delete`
