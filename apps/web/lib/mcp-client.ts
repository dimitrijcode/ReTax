/**
 * Web orchestrator uses hardcoded fixtures in lib/fixtures.ts.
 * MCP HTTP/stdio is not required for RETAX_MODE=fixture.
 */
export function mcpInfo() {
  return { name: "retax", version: "0.1.0", transport: "in-process" as const };
}
