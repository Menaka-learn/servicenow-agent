// index.js — Gemini-powered ServiceNow Agent
import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';
import { createTask, updateTask, closeTask, getTask } from './servicenow.js';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const userCommand = process.env.USER_COMMAND;

if (!userCommand) {
  console.error('❌ No command provided. Set USER_COMMAND env variable.');
  process.exit(1);
}

// ── Tool definitions (Gemini decides which to call) ──────────────────────────
const functionDeclarations = [
  {
    name: 'create_task',
    description: 'Create a new task in ServiceNow. Use when user wants to create, add, or open a new task/ticket.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        short_description: {
          type: Type.STRING,
          description: 'A concise title for the task (max 80 chars)',
        },
        description: {
          type: Type.STRING,
          description: 'Detailed description of the task',
        },
        priority: {
          type: Type.STRING,
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
    parameters: {
      type: Type.OBJECT,
      properties: {
        number: {
          type: Type.STRING,
          description: 'The ServiceNow task number e.g. SCTASK0010001',
        },
        state: {
          type: Type.STRING,
          description: 'New state: open, in progress, closed, complete, incomplete',
        },
        short_description: {
          type: Type.STRING,
          description: 'Optional updated title',
        },
      },
      required: ['number', 'state'],
    },
  },
  {
    name: 'close_task',
    description: 'Close a ServiceNow task. Use when user says close, done, complete, or resolve a task.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        number: {
          type: Type.STRING,
          description: 'The ServiceNow task number e.g. SCTASK0010001',
        },
        resolution_notes: {
          type: Type.STRING,
          description: 'Brief notes on how/why the task was closed',
        },
      },
      required: ['number'],
    },
  },
  {
    name: 'get_task',
    description: 'Get details of an existing ServiceNow task by number.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        number: {
          type: Type.STRING,
          description: 'The ServiceNow task number e.g. SCTASK0010001',
        },
      },
      required: ['number'],
    },
  },
];

const tools = [{ functionDeclarations }];

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
  console.log('  🤖  ServiceNow Agent — Powered by Gemini  ');
  console.log('═══════════════════════════════════════════');
  console.log(`\n📥 Command received: "${userCommand}"\n`);

  const systemInstruction = `You are a ServiceNow agent. Your job is to help users manage ServiceNow tasks via simple natural language commands.

When a user gives you a command:
1. Understand their intent (create / update / close / get a task)
2. Call the appropriate tool with well-formed inputs
3. After the tool responds, summarize the result clearly

Rules:
- Infer priority from context (deployment, production, urgent = High or Critical; regular tasks = Moderate)
- Always write clear, professional short_description and description fields
- If a ticket number is mentioned, extract it exactly (format: SCTASK followed by digits)
- After completing the action, give a short friendly confirmation with the ticket number and link`;

  const contents = [
    {
      role: 'user',
      parts: [{ text: userCommand }],
    },
  ];

  // Agentic loop — keep going until Gemini stops calling tools
  while (true) {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction,
        tools,
      },
    });

    const modelParts = response.candidates?.[0]?.content?.parts ?? [];

    // Add model response to history
    contents.push({ role: 'model', parts: modelParts });

    const functionCalls = response.functionCalls ?? [];

    // If Gemini is done (no more tool calls)
    if (functionCalls.length === 0) {
      const finalText = modelParts
        .filter(p => typeof p.text === 'string')
        .map(p => p.text)
        .join('\n');

      console.log('\n✅ Agent Response:');
      console.log('─────────────────────────────────────────');
      console.log(finalText);
      console.log('─────────────────────────────────────────');
      break;
    }

    // Execute each tool call and collect responses
    const functionResponseParts = [];

    for (const call of functionCalls) {
      try {
        const result = await executeTool(call.name, call.args);
        console.log(`   Result: ${JSON.stringify(result, null, 2)}`);

        functionResponseParts.push({
          functionResponse: {
            name: call.name,
            response: { result },
          },
        });
      } catch (err) {
        console.error(`   ❌ Tool error: ${err.message}`);
        functionResponseParts.push({
          functionResponse: {
            name: call.name,
            response: { error: err.message },
          },
        });
      }
    }

    // Feed tool results back to Gemini
    contents.push({ role: 'user', parts: functionResponseParts });
  }
}

runAgent().catch(err => {
  console.error('❌ Agent failed:', err.message);
  process.exit(1);
});
