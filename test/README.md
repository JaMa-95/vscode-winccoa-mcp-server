# MCP Server Test Documentation

## ⚠️ IMPORTANT: Real Project Testing

**CRITICAL WARNING:** Integration tests use a **real WinCC OA project** located at:
```
/home/testus/vscode_wincc_extenssion/vscode-winccoa-ctrllang/test-workspace
```

**Risks:**
- ❌ Tests **MODIFY** config/progs file
- ❌ Tests **CREATE** javascript/mcpServer directory
- ❌ Tests **WRITE** .env files with tokens
- ❌ May interfere with running WinCC OA processes

**Safety Measures:**
- ✅ Tests automatically **backup** original config files
- ✅ Tests **restore** state in cleanup phase
- ✅ Tests **remove** MCP installation after completion
- ✅ DO NOT run tests while PMON is active on test project

**Before Running Integration Tests:**
1. Ensure PMON is stopped for test project
2. Backup test-workspace if it contains important data
3. Run `git status` to check for uncommitted changes
4. Review test output for errors before committing

**DO NOT:**
- Run integration tests on production projects
- Run tests while WinCC OA managers are active
- Commit test-workspace changes to git
- Use sensitive tokens in test fixtures

## Test Structure

```
test/
├── unit/                       # Unit Tests (isolated, mocked)
│   ├── mcpConfigManager.test.ts
│   └── mcpServerInstaller.test.ts
├── integration/                # Integration Tests (real WinCC OA project)
│   └── setupFlow.test.ts
├── fixtures/                   # Mock data
│   ├── sample.env
│   └── mock-project/
└── suite/                      # Test runner
    └── index.ts
```

## Real WinCC OA Test Project

**Location:** `/home/testus/vscode_wincc_extenssion/vscode-winccoa-ctrllang/test-workspace`

This is a **real WinCC OA 3.20 project** used for integration tests:
- ✅ Full project structure (config, scripts, data, db, log, ...)
- ✅ Real config/progs with managers
- ✅ Real config/config with project settings
- ✅ Can be used for end-to-end testing

### Project Details
- **WinCC OA Version:** 3.20
- **Install Path:** /opt/WinCC_OA/3.20
- **Project Path:** /home/testus/vscode_wincc_extenssion/vscode-winccoa-ctrllang/test-workspace
- **Existing Managers:** PMON, Data, Event, Ctrl, UI, Arch, Sim

## Test Types

### 1. Unit Tests
- **Mocked dependencies** (file system, git, npm)
- **Fast execution** (no external processes)
- **Focus:** Individual service logic

**Run:**
```bash
npm run test:unit
```

### 2. Integration Tests
- **Real WinCC OA project**
- **Real file system operations**
- **No external git/npm** (too slow for CI)
- **Focus:** Service interaction + real config files

**Run:**
```bash
npm run test:integration
```

### 3. E2E Tests (Planned)
- **Full MCP Server installation**
- **Git clone + npm install**
- **Manager startup via PMON**
- **HTTP health check**
- **Focus:** Complete user workflow

## Test Best Practices

### Cleanup Strategy
- Integration tests **backup** config/progs before modification
- **Restore** original state in `suiteTeardown`
- **Remove** MCP installation after tests

### Assertions
- Use `assert.ok()` for boolean checks
- Use `assert.strictEqual()` for exact matches
- Use `assert.deepStrictEqual()` for object comparison
- Use `assert.match()` for regex patterns

### File Operations
- Always use `await fileExists()` before assertions
- Use `{ recursive: true, force: true }` for safe cleanup
- Check both presence and content of generated files

## Running Tests

```bash
# All tests
npm test

# Unit tests only (fast)
npm run test:unit

# Integration tests only (slower, needs test project)
npm run test:integration

# Watch mode
npm run test:watch
```

## CI/CD Considerations

- Unit tests: ✅ Run in CI
- Integration tests: ⚠️ Needs test project (include in repo or mock)
- E2E tests: ❌ Skip in CI (too slow, needs WinCC OA installation)

## Future Test Coverage

- [ ] MCP Server health check (HTTP ping)
- [ ] PMON manager control integration
- [ ] Claude Desktop config writer
- [ ] Token security (SecretStorage)
- [ ] Multi-project scenarios
- [ ] Error recovery and rollback
