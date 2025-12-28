/**
 * MCP Server API - Exported commands for Core Extension integration
 */

export interface MCPSetupOptions {
    token?: string;
    port?: number;
    enabledTools?: string[];
    fieldConfig?: string;
}

export interface MCPSetupResult {
    success: boolean;
    token?: string;
    error?: string;
    installPath?: string;
}

export interface MCPStatus {
    managerRunning: boolean;
    httpReachable: boolean;
    lastCheck: Date;
    error?: string;
    responseTime?: number;
}

export interface MCPConfig {
    token: string;
    port: number;
    tools: string[];
    field: string;
}

/**
 * Public API for MCP Server Management
 * Can be consumed by Core Extension via:
 * const mcpApi = vscode.extensions.getExtension('RichardJanisch.winccoa-mcp-server')?.exports;
 */
export interface MCPServerAPI {
    /**
     * Setup MCP Server in a WinCC OA project
     * @param projectPath - Absolute path to WinCC OA project
     * @param options - Setup options (token, tools, etc.)
     */
    setupMCPServer(projectPath: string, options?: MCPSetupOptions): Promise<MCPSetupResult>;

    /**
     * Start MCP Server manager via PMON
     * @param projectName - WinCC OA project name
     */
    startMCPServer(projectName: string): Promise<void>;

    /**
     * Stop MCP Server manager via PMON
     * @param projectName - WinCC OA project name
     */
    stopMCPServer(projectName: string): Promise<void>;

    /**
     * Restart MCP Server manager
     * @param projectName - WinCC OA project name
     */
    restartMCPServer(projectName: string): Promise<void>;

    /**
     * Get current MCP Server status
     * @param projectName - WinCC OA project name
     */
    getMCPStatus(projectName: string): Promise<MCPStatus>;

    /**
     * Update MCP Server configuration (.env file)
     * @param projectPath - Absolute path to WinCC OA project
     * @param config - New configuration
     */
    updateMCPConfig(projectPath: string, config: MCPConfig): Promise<void>;

    /**
     * Generate a secure random token
     */
    generateToken(): string;
}
