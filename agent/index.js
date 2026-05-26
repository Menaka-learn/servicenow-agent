// index.js — Claude-powered ServiceNow Agent
import Anthropic from '@anthropic-ai/sdk';
import { createTask, updateTask, closeTask, getTask } from './servicenow.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const userCommand = process.env.USER_COMMAND;

if (!userCommand) {
  console.error('❌ No command provided. Set USER_COMMAND env variable.');
  process.exit(1);
}

// ── Tool definitions (Claude decides which to call) ──────────────────────────
const tools = [
  {
    name: 'create_task',
    description: 'Create a new task in ServiceNow. Use when user wants to create, add, or open a new task/ticket.',
    input_schema: {
      type: 'object',
      properties: {
        short_description: {
          type: 'string',
          description: 'A concise title for the task (max 80 chars)',
        },
        description: {
          type: 'string',
          description: 'Detailed description of the task',
        },
        priority: {
          type: 'string',
          enum: ['1', '2', '3', '4'],
          description: '1=Critical, 2=High, 3=Moderate, 4=Low. Infer from context.',
        },
      },
      required: ['short_description', 'description'],
    },
  },
  {
    name: 'update_task',
    description: 'Update an existing ServiceNow task status or description. Use when user mentions a ticket number and wants to change its state.',
    input_schema: {
      type: 'object',
      properties: {
        number: {
          type: 'string',
          description: 'The ServiceNow task number e.g. SCTASK0010001',
        },
        state: {
          type: 'string',
          description: 'New state: open, in progress, closed, complete, incomplete',
        },
        short_description: {
          type: 'string',
          description: 'Optional updated title',
        },
      },
      required: ['number', 'state'],
    },
  },
  {
    name: 'close_task',
    description: 'Close a ServiceNow task. Use when user says close, done, complete, or resolve a task.',
    input_schema: {
      type: 'object',
      properties: {
        number: {
          type: 'string',
          description: 'The ServiceNow task number e.g. SCTASK0010001',
        },
        resolution_notes: {
          type: 'string',
          description: 'Brief notes on how/why the task was closed',
        },
      },
      required: ['number'],
    },
  },
  {
    name: 'get_task',
    description: 'Get details of an existing ServiceNow task by number.',
    input_schema: {
      type: 'object',
      properties: {
        number: {
          type: 'string',
          description: 'The ServiceNow task number e.g. SCTASK0010001',
        },
      },
      required: ['number'],
    },
  },
];

// ── Tool executor ─────────────────────────────────────────────────────────────
async function executeTool(name, input) {
  console.log(`\n🔧 Executing tool: ${name}`);
  console.log(`   Input: ${JSON.stringify(input, null, 2)}`);

  switch (name) {
    case 'create_task': return await createTask(input);
    case 'update_task': return await updateTask(input);
    case 'close_task': return await closeTask(input);
    case 'get_task': return await getTask(input);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

// ── Agentic loop ──────────────────────────────────────────────────────────────
async function runAgent() {
  console.log('═══════════════════════════════════════════');
  console.log('  🤖  ServiceNow Agent — Powered by Claude  ');
  console.log('═══════════════════════════════════════════');
  console.log(`\n📥 Command received: "${userCommand}"\n`);

  const messages = [
    {
      role: 'user',
      content: userCommand,
    },
  ];

  const systemPrompt = `You are a ServiceNow agent. Your job is to help users manage ServiceNow tasks via simple natural language commands.

When a user gives you a command:
1. Understand their intent (create / update / close / get a task)
2. Call the appropriate tool with well-formed inputs
3. After the tool responds, summarize the result clearly

Rules:
- Infer priority from context (deployment, production, urgent = High or Critical; regular tasks = Moderate)
- Always write clear, professional short_description and description fields
- If a ticket number is mentioned, extract it exactly (format: SCTASK followed by digits)
- After completing the action, give a short friendly confirmation with the ticket number and link`;

  // Agentic loop — keep going until Claude stops calling tools
  while (true) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages,
    });

    // Add Claude's response to message history
    messages.push({ role: 'assistant', content: response.content });

    // If Claude is done (no more tool calls)
    if (response.stop_reason === 'end_turn') {
      const finalText = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n');

      console.log('\n✅ Agent Response:');
      console.log('─────────────────────────────────────────');
      console.log(finalText);
      console.log('─────────────────────────────────────────');
      break;
    }

    // If Claude wants to use tools
    if (response.stop_reason === 'tool_use') {
      const toolResults = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        try {
          const result = await executeTool(block.name, block.input);
          console.log(`   Result: ${JSON.stringify(result, null, 2)}`);

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        } catch (err) {
          console.error(`   ❌ Tool error: ${err.message}`);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: `Error: ${err.message}`,
            is_error: true,
          });
        }
      }

      // Feed tool results back to Claude
      messages.push({ role: 'user', content: toolResults });
    }
  }
}

runAgent().catch(err => {
  console.error('❌ Agent failed:', err.message);
  process.exit(1);
});
