import express from 'express';
import { config } from 'dotenv';
import { Octokit } from '@octokit/rest';
import crypto from 'crypto';
import cors from 'cors';

// 環境変数の読み込み
config();

// サーバー初期化
const app = express();
app.use(express.json());
app.use(cors());

// GitHub APIクライアント初期化
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

// MCP Protocol用の定数
const MCP_VERSION = '0.2.0';
const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

// IDジェネレーター
function generateId(length = 10) {
  let result = '';
  const charLength = ID_CHARS.length;
  for (let i = 0; i < length; i++) {
    result += ID_CHARS.charAt(Math.floor(Math.random() * charLength));
  }
  return result;
}

// MCPサーバー初期化エンドポイント
app.post('/initialize', async (req, res) => {
  try {
    const { protocolVersion, capabilities, clientInfo } = req.body.params;
    
    console.log(`Received initialize request from ${clientInfo.name} ${clientInfo.version}`);
    console.log(`Protocol version: ${protocolVersion}`);
    console.log('Capabilities:', capabilities);
    
    if (protocolVersion !== MCP_VERSION) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: `Unsupported protocol version: ${protocolVersion}`
        },
        id: req.body.id
      });
    }
    
    // サーバー機能を返す
    res.json({
      jsonrpc: '2.0',
      result: {
        protocolVersion: MCP_VERSION,
        serverInfo: {
          name: 'GitHub MCP Server',
          version: '1.0.0'
        },
        capabilities: {
          completions: true,
          tools: true,
          prompts: true,
          logging: true
        },
        instructions: 'GitHub MCPサーバーへようこそ。GitHub APIを介してリポジトリ操作が可能です。'
      },
      id: req.body.id
    });
  } catch (error) {
    console.error('Error in initialize endpoint:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error'
      },
      id: req.body.id || null
    });
  }
});

// 初期化完了通知エンドポイント
app.post('/notifications/initialized', (req, res) => {
  console.log('Client initialized');
  res.json({
    jsonrpc: '2.0',
    result: null,
    id: req.body.id || null
  });
});

// Pingエンドポイント
app.post('/ping', (req, res) => {
  res.json({
    jsonrpc: '2.0',
    result: {},
    id: req.body.id
  });
});

// ツール一覧取得エンドポイント
app.post('/tools/list', (req, res) => {
  const tools = [
    {
      name: 'search-repos',
      description: 'Search for GitHub repositories',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          },
          language: {
            type: 'string',
            description: 'Filter by programming language'
          },
          sort: {
            type: 'string',
            enum: ['stars', 'forks', 'updated'],
            description: 'Sort criteria'
          }
        },
        required: ['query']
      }
    },
    {
      name: 'get-repo-info',
      description: 'Get information about a specific repository',
      parameters: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner'
          },
          repo: {
            type: 'string',
            description: 'Repository name'
          }
        },
        required: ['owner', 'repo']
      }
    },
    {
      name: 'list-issues',
      description: 'List issues in a repository',
      parameters: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner'
          },
          repo: {
            type: 'string',
            description: 'Repository name'
          },
          state: {
            type: 'string',
            enum: ['open', 'closed', 'all'],
            description: 'Filter by issue state'
          }
        },
        required: ['owner', 'repo']
      }
    },
    {
      name: 'create-issue',
      description: 'Create a new issue in a repository',
      parameters: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner'
          },
          repo: {
            type: 'string',
            description: 'Repository name'
          },
          title: {
            type: 'string',
            description: 'Issue title'
          },
          body: {
            type: 'string',
            description: 'Issue body'
          }
        },
        required: ['owner', 'repo', 'title']
      }
    },
    {
      name: 'get-file-content',
      description: 'Get content of a file in a repository',
      parameters: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner'
          },
          repo: {
            type: 'string',
            description: 'Repository name'
          },
          path: {
            type: 'string',
            description: 'File path'
          },
          ref: {
            type: 'string',
            description: 'The name of the commit/branch/tag'
          }
        },
        required: ['owner', 'repo', 'path']
      }
    }
  ];

  res.json({
    jsonrpc: '2.0',
    result: {
      tools
    },
    id: req.body.id
  });
});

// ツール呼び出しエンドポイント
app.post('/tools/call', async (req, res) => {
  try {
    const { name, args } = req.body.params;
    
    let result;
    let success = true;
    let error;
    
    switch (name) {
      case 'search-repos':
        try {
          const { query, language, sort } = args;
          const searchResult = await octokit.search.repos({
            q: language ? `${query} language:${language}` : query,
            sort: sort || 'stars',
            order: 'desc',
            per_page: 10
          });
          
          result = {
            total_count: searchResult.data.total_count,
            items: searchResult.data.items.map(repo => ({
              name: repo.name,
              full_name: repo.full_name,
              description: repo.description,
              html_url: repo.html_url,
              stars: repo.stargazers_count,
              forks: repo.forks_count,
              language: repo.language
            }))
          };
        } catch (err) {
          success = false;
          error = `Failed to search repositories: ${err.message}`;
        }
        break;
        
      case 'get-repo-info':
        try {
          const { owner, repo } = args;
          const repoResult = await octokit.repos.get({
            owner,
            repo
          });
          
          result = {
            name: repoResult.data.name,
            full_name: repoResult.data.full_name,
            description: repoResult.data.description,
            html_url: repoResult.data.html_url,
            stars: repoResult.data.stargazers_count,
            forks: repoResult.data.forks_count,
            language: repoResult.data.language,
            open_issues: repoResult.data.open_issues_count,
            created_at: repoResult.data.created_at,
            updated_at: repoResult.data.updated_at,
            topics: repoResult.data.topics
          };
        } catch (err) {
          success = false;
          error = `Failed to get repository info: ${err.message}`;
        }
        break;
        
      case 'list-issues':
        try {
          const { owner, repo, state } = args;
          const issuesResult = await octokit.issues.listForRepo({
            owner,
            repo,
            state: state || 'open',
            per_page: 10
          });
          
          result = {
            total_count: issuesResult.data.length,
            items: issuesResult.data.map(issue => ({
              number: issue.number,
              title: issue.title,
              state: issue.state,
              html_url: issue.html_url,
              created_at: issue.created_at,
              updated_at: issue.updated_at,
              body: issue.body
            }))
          };
        } catch (err) {
          success = false;
          error = `Failed to list issues: ${err.message}`;
        }
        break;
        
      case 'create-issue':
        try {
          const { owner, repo, title, body } = args;
          const createResult = await octokit.issues.create({
            owner,
            repo,
            title,
            body: body || ''
          });
          
          result = {
            number: createResult.data.number,
            title: createResult.data.title,
            html_url: createResult.data.html_url
          };
        } catch (err) {
          success = false;
          error = `Failed to create issue: ${err.message}`;
        }
        break;
        
      case 'get-file-content':
        try {
          const { owner, repo, path, ref } = args;
          const contentResult = await octokit.repos.getContent({
            owner,
            repo,
            path,
            ref: ref || undefined
          });
          
          // ファイル内容をデコード
          if ('content' in contentResult.data && 'encoding' in contentResult.data) {
            const content = Buffer.from(contentResult.data.content, contentResult.data.encoding as BufferEncoding).toString();
            result = {
              name: contentResult.data.name,
              path: contentResult.data.path,
              sha: contentResult.data.sha,
              size: contentResult.data.size,
              content,
              html_url: contentResult.data.html_url
            };
          } else {
            // ディレクトリの場合
            success = false;
            error = 'Path points to a directory, not a file';
          }
        } catch (err) {
          success = false;
          error = `Failed to get file content: ${err.message}`;
        }
        break;
        
      default:
        success = false;
        error = `Unknown tool: ${name}`;
    }
    
    res.json({
      jsonrpc: '2.0',
      result: {
        success,
        result: success ? result : undefined,
        error: success ? undefined : error
      },
      id: req.body.id
    });
  } catch (error) {
    console.error('Error in tools/call endpoint:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error'
      },
      id: req.body.id || null
    });
  }
});

// プロンプト一覧取得エンドポイント
app.post('/prompts/list', (req, res) => {
  const prompts = [
    {
      name: 'github-repo-summary',
      description: 'Summarize a GitHub repository'
    },
    {
      name: 'github-issue-analysis',
      description: 'Analyze GitHub issues'
    },
    {
      name: 'github-pr-review',
      description: 'Review a GitHub pull request'
    }
  ];

  res.json({
    jsonrpc: '2.0',
    result: {
      prompts
    },
    id: req.body.id
  });
});

// プロンプト取得エンドポイント
app.post('/prompts/get', (req, res) => {
  const { name } = req.body.params;
  
  let prompt;
  
  switch (name) {
    case 'github-repo-summary':
      prompt = 'Analyze the following GitHub repository information and provide a concise summary:\n\nRepository: {{owner}}/{{repo}}\n\nFocus on:\n1. Main purpose of the repository\n2. Key features\n3. Technology stack\n4. Activity level\n5. Community engagement';
      break;
      
    case 'github-issue-analysis':
      prompt = 'Review the following GitHub issues and provide analysis:\n\nRepository: {{owner}}/{{repo}}\n\nFor each issue, consider:\n1. Issue type (bug, feature request, etc.)\n2. Priority level\n3. Complexity\n4. Potential solutions\n\nProvide a summary of common themes and recommendations.';
      break;
      
    case 'github-pr-review':
      prompt = 'Review the following GitHub pull request information:\n\nRepository: {{owner}}/{{repo}}\nPR #{{number}}\n\nProvide feedback on:\n1. Code quality\n2. Implementation approach\n3. Potential issues\n4. Suggested improvements\n\nUse a constructive and helpful tone.';
      break;
      
    default:
      return res.status(404).json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: `Prompt not found: ${name}`
        },
        id: req.body.id
      });
  }

  res.json({
    jsonrpc: '2.0',
    result: {
      name,
      prompt
    },
    id: req.body.id
  });
});

// 補完エンドポイント
app.post('/completion/complete', async (req, res) => {
  try {
    const { prompt, maxTokens } = req.body.params;
    
    // この実装では、実際のAIモデルは使用せず、GitHub関連の情報に基づく応答を返す
    // 実際の実装では、LLMやOpenAI APIなどを使用することになる
    
    let response = 'This is a simulated response from the GitHub MCP server. ';
    
    if (prompt.toLowerCase().includes('github')) {
      response += 'GitHub is a platform and cloud-based service for software development and version control using Git, allowing developers to store and manage their code. It provides the distributed version control of Git plus access control, bug tracking, software feature requests, task management, continuous integration, and wikis for every project.';
    } else if (prompt.toLowerCase().includes('repository') || prompt.toLowerCase().includes('repo')) {
      response += 'A repository contains all of your project\'s files and each file\'s revision history. You can discuss and manage your project\'s work within the repository.';
    } else if (prompt.toLowerCase().includes('issue')) {
      response += 'Issues are suggested improvements, tasks or questions related to the repository. They can be created by anyone (for public repositories), and are moderated by repository collaborators.';
    } else if (prompt.toLowerCase().includes('pull request') || prompt.toLowerCase().includes('pr')) {
      response += 'Pull requests let you tell others about changes you\'ve pushed to a branch in a repository on GitHub. Once a pull request is opened, you can discuss and review the potential changes with collaborators and add follow-up commits before your changes are merged into the base branch.';
    } else {
      response += 'I can provide information about GitHub repositories, issues, pull requests, and other GitHub-related topics. You can also use specific tools to interact with GitHub directly.';
    }
    
    // 応答IDを生成
    const responseId = generateId();
    
    res.json({
      jsonrpc: '2.0',
      result: {
        id: responseId,
        text: response,
        usage: {
          prompt_tokens: Math.ceil(prompt.length / 4),
          completion_tokens: Math.ceil(response.length / 4),
          total_tokens: Math.ceil((prompt.length + response.length) / 4)
        }
      },
      id: req.body.id
    });
  } catch (error) {
    console.error('Error in completion endpoint:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error'
      },
      id: req.body.id || null
    });
  }
});

// ログレベル設定エンドポイント
app.post('/logging/setLevel', (req, res) => {
  const { level } = req.body.params;
  console.log(`Setting log level to: ${level}`);
  
  res.json({
    jsonrpc: '2.0',
    result: {},
    id: req.body.id
  });
});

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// サーバー起動
const PORT = process.env.GITHUB_MCP_PORT || 3005;
app.listen(PORT, () => {
  console.log(`GitHub MCP Server running on port ${PORT}`);
});

// エラーハンドリング
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});
