import { Client as MCPClient } from '@modelcontextprotocol/sdk/client/index.js';

/**
 * MCPのツール機能が対応しているか確認
 * @param mcpClient MCPクライアント
 */
export async function checkToolsAvailability(mcpClient: MCPClient): Promise<boolean> {
  try {
    const capabilities = mcpClient.getServerCapabilities();
    return !!capabilities?.tools;
  } catch (error) {
    console.error('Error checking tools capability:', error);
    return false;
  }
}
