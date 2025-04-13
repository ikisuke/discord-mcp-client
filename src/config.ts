import { config } from 'dotenv';

config();

export type MCPServersConfig = {
  mcpServers: Record<string, { 
      command: string; 
      args: string[]; 
      env?: Record<string, string> 
  }>;
};

export const defaultConfig: MCPServersConfig = {
  mcpServers: {
    "github": {
      command: '/usr/local/bin/docker',
      args: [
          'run',
          '-i',
          '--rm',
          '-e',
          'GITHUB_PERSONAL_ACCESS_TOKEN',
          'mcp/github'
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": process.env.GITHUB_TOKEN || ""
      }
    },
  },
};