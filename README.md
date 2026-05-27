# 🤖 ServiceNow Agent — Powered by Claude AI

> A POC | Built with Claude AI + GitHub Actions + ServiceNow REST API

This agent lets you manage ServiceNow tasks using plain English commands. No UI needed — just type what you want and the AI does it.

---

## 💡 What problem does it solve?

Normally to create or update a ServiceNow task you have to:
1. Log into ServiceNow
2. Navigate to the right module
3. Fill in multiple fields manually
4. Save and copy the ticket number

With this agent you just type:
```
create a high priority task for production bug fix in payment service
```
And the agent creates the ticket, fills all fields intelligently, and gives you the ticket number and link — in seconds.

---

## 🎯 What it can do

| You type | Agent does |
|---|---|
| `create a task for deployment review` | Creates SCTASK with Moderate priority |
| `create a high priority task for prod outage` | Creates SCTASK with High priority |
| `create a critical task for server is down` | Creates SCTASK with Critical priority |
| `update SCTASK0010001 to in progress` | Updates ticket state |
| `close SCTASK0010001 work is done` | Closes the ticket |
| `get details of SCTASK0010001` | Fetches ticket info |

---

## 🏗️ Architecture

```
You type a command in GitHub Actions
            ↓
    GitHub Actions starts a Linux runner
            ↓
    Node.js runs the agent (index.js)
            ↓
    Claude AI reads your command
    and decides which tool to call
            ↓
    ┌─────────────────────────────┐
    │  create_task  update_task   │
    │  close_task   get_task      │
    └─────────────────────────────┘
            ↓
    servicenow.js calls the
    ServiceNow REST API
            ↓
    Ticket created/updated in ServiceNow
            ↓
    Claude summarizes: "Done! SCTASK0010001 created"
            ↓
    You see the result in GitHub Actions logs
```

---

## 📁 Project structure

```
servicenow-agent/
├── .github/
│   └── workflows/
│       └── servicenow-agent.yml   ← GitHub Actions trigger + pipeline
├── agent/
│   ├── index.js                   ← Claude agent brain + agentic loop
│   ├── servicenow.js              ← ServiceNow REST API client
│   └── package.json               ← Node.js dependencies
├── .gitignore
└── README.md
```

### File responsibilities

**`servicenow-agent.yml`** — the trigger. Defines when and how the workflow runs. Uses `workflow_dispatch` so you manually trigger it with a text input. Passes your secrets securely as environment variables.

**`agent/index.js`** — the brain. Sends your command to Claude, runs the agentic loop (Claude → tool call → ServiceNow result → Claude summarizes), and prints the final result.

**`agent/servicenow.js`** — the hands. Makes authenticated HTTP calls to the ServiceNow REST API to create, update, close, or fetch tasks.

---

## 🔑 Key concepts

### Agentic loop
The core of the POC. Instead of a simple one-shot API call, Claude runs in a loop:
1. Read your command
2. Decide which tool to call (`create_task`, `update_task` etc.)
3. Call ServiceNow API
4. Read the result
5. Summarize and respond
6. Stop when done

This is what makes it an **agent** — not just a script.

### Tool use (function calling)
Claude doesn't directly call APIs. Instead we define **tools** (like a menu of actions) and Claude decides which one to use based on your natural language input. Claude fills in all the required fields intelligently — priority, description, state — from context.

### Secrets management
API keys and passwords are stored as **GitHub Secrets** — never in code. The workflow injects them as environment variables at runtime. Even repo admins can't read them after saving.

---

## ⚙️ Setup for your team

### Prerequisites
- GitHub account with a repo
- ServiceNow developer instance (free at developer.servicenow.com)
- Anthropic API key (from console.anthropic.com — $5 free credits on signup)
- Node.js 20+

### Step 1 — Clone the repo
```bash
git clone https://github.com/mohinimishra/servicenow-agent.git
cd servicenow-agent
```

### Step 2 — Add GitHub Secrets
Go to **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your key from console.anthropic.com |
| `SNOW_INSTANCE` | e.g. `dev12345.service-now.com` |
| `SNOW_USERNAME` | `admin` |
| `SNOW_PASSWORD` | Your ServiceNow admin password |

### Step 3 — Run the agent
1. Go to **Actions** tab in your repo
2. Click **ServiceNow Agent** in the sidebar
3. Click **Run workflow**
4. Type your command e.g. `create a task for testing the agent`
5. Click **Run workflow**
6. Watch the logs — ticket number and link appear in ~30 seconds

### Step 4 — Run locally (optional)
```bash
cd agent
npm install

SNOW_INSTANCE=dev12345.service-now.com \
SNOW_USERNAME=admin \
SNOW_PASSWORD=yourpassword \
ANTHROPIC_API_KEY=sk-ant-xxx \
USER_COMMAND="create a task for deployment review" \
node index.js
```

---

## 🗺️ Priority mapping

| Value | Priority |
|---|---|
| 1 | Critical |
| 2 | High |
| 3 | Moderate (default) |
| 4 | Low |

Claude infers priority automatically from context — "urgent", "prod down", "critical" → High/Critical. Regular tasks → Moderate.

## 📊 State mapping

| Value | State |
|---|---|
| 1 | Open |
| 2 | Work in Progress |
| 3 | Closed Complete |
| 4 | Closed Incomplete |

---

## 🚀 Future enhancements

- [ ] Connect to GitHub Issues — auto-create ServiceNow task when issue is opened
- [ ] Slack integration — type commands in Slack, agent updates ServiceNow
- [ ] Multi-ticket support — handle multiple tickets in one command
- [ ] Priority escalation — auto-escalate tasks based on SLA breach
- [ ] Notification on ticket update — email/Slack alert when task status changes

---

## 🛠️ Tech stack

| Technology | Purpose |
|---|---|
| Claude claude-sonnet-4-5 | AI brain — natural language understanding + tool use |
| GitHub Actions | CI/CD pipeline + manual workflow trigger |
| Node.js 20 | Runtime for the agent |
| ServiceNow REST API | Ticket management (sc_task table) |
| @anthropic-ai/sdk | Claude API client |

---

## 🧭 Detailed Architecture (Mermaid)

### 1. System component diagram

End-to-end view of every actor, secret store, and external system involved when a command is executed.

```mermaid
flowchart TB
    subgraph User["👤 User"]
        U1[Developer / Ops Engineer]
    end

    subgraph GH["🐙 GitHub"]
        direction TB
        WF["workflow_dispatch trigger<br/>(servicenow-agent.yml)"]
        SEC[("🔐 GitHub Secrets<br/>ANTHROPIC_API_KEY<br/>SNOW_INSTANCE<br/>SNOW_USERNAME<br/>SNOW_PASSWORD")]
        RUN["Ubuntu Runner<br/>Node.js 22"]
        LOG["📜 Action Logs<br/>(stdout output)"]
        WF --> RUN
        SEC -. injected as env vars .-> RUN
        RUN --> LOG
    end

    subgraph Agent["🧠 Agent Process (Node.js)"]
        direction TB
        IDX["index.js<br/>• Tool definitions<br/>• Agentic loop<br/>• System prompt"]
        SNOW["servicenow.js<br/>• REST client<br/>• Basic auth<br/>• State mapping"]
        IDX -- invokes tool fn --> SNOW
    end

    subgraph Anthropic["☁️ Anthropic API"]
        CLAUDE["claude-sonnet-4-5<br/>• NL understanding<br/>• Tool selection<br/>• Result summarization"]
    end

    subgraph ServiceNow["🛎️ ServiceNow Instance"]
        REST["REST API<br/>/api/now/table/sc_task"]
        DB[("sc_task table")]
        REST --- DB
    end

    U1 -- "1. types command" --> WF
    RUN -- "2. spawns node process" --> IDX
    IDX -- "3. messages.create<br/>(prompt + tools)" --> CLAUDE
    CLAUDE -- "4. tool_use block" --> IDX
    SNOW -- "5. HTTPS + Basic Auth" --> REST
    REST -- "6. JSON result" --> SNOW
    IDX -- "7. tool_result back to Claude" --> CLAUDE
    CLAUDE -- "8. final summary" --> IDX
    IDX -- "9. prints to stdout" --> LOG
    LOG -- "10. user reads result" --> U1

    classDef user fill:#fef3c7,stroke:#d97706,color:#000
    classDef github fill:#e0e7ff,stroke:#4338ca,color:#000
    classDef agent fill:#d1fae5,stroke:#059669,color:#000
    classDef ai fill:#fce7f3,stroke:#be185d,color:#000
    classDef snow fill:#dbeafe,stroke:#2563eb,color:#000
    classDef secret fill:#fee2e2,stroke:#dc2626,color:#000

    class U1 user
    class WF,RUN,LOG github
    class SEC secret
    class IDX,SNOW agent
    class CLAUDE ai
    class REST,DB snow
```

---

### 2. Agentic loop — sequence diagram

How a single command flows turn-by-turn through Claude's tool-use loop until the model emits `end_turn`.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant GH as GitHub Actions
    participant Idx as index.js<br/>(Agent Loop)
    participant Cla as Claude API<br/>(claude-sonnet-4-5)
    participant Snw as servicenow.js
    participant API as ServiceNow REST

    User->>GH: Run workflow with<br/>command="create high priority<br/>task for prod outage"
    GH->>Idx: spawn node index.js<br/>(USER_COMMAND env)

    Note over Idx: Build initial messages array<br/>+ system prompt + tools

    loop Agentic loop (until end_turn)
        Idx->>Cla: messages.create(<br/>  messages, tools, system)
        Cla-->>Idx: response with<br/>stop_reason

        alt stop_reason == "tool_use"
            Note over Idx: Extract tool_use block(s)
            Idx->>Snw: executeTool(name, input)
            Snw->>API: HTTPS POST/PATCH/GET<br/>+ Basic Auth header
            API-->>Snw: JSON {sys_id, number, ...}
            Snw-->>Idx: normalized result
            Idx->>Idx: append tool_result<br/>to messages
        else stop_reason == "end_turn"
            Cla-->>Idx: final text block
            Note over Idx: Exit loop
        end
    end

    Idx-->>GH: print "✅ Agent Response" + ticket link
    GH-->>User: workflow logs visible<br/>in Actions UI
```

---

### 3. Tool selection decision flow

How Claude picks one of the four tools based on the natural-language command.

```mermaid
flowchart LR
    CMD["📥 User command<br/>(natural language)"] --> NLP{Claude<br/>interprets<br/>intent}

    NLP -->|"create / add / open<br/>+ no ticket #"| CREATE["🆕 create_task<br/>• short_description<br/>• description<br/>• priority (1-4)"]
    NLP -->|"update / change /<br/>set state + SCTASK#"| UPDATE["✏️ update_task<br/>• number<br/>• state<br/>• short_description?"]
    NLP -->|"close / done /<br/>resolve + SCTASK#"| CLOSE["✅ close_task<br/>• number<br/>• resolution_notes"]
    NLP -->|"get / show / fetch<br/>+ SCTASK#"| GET["🔍 get_task<br/>• number"]

    CREATE --> POST["POST /sc_task"]
    UPDATE --> PATCH["PATCH /sc_task/{sys_id}<br/>(after lookup by number)"]
    CLOSE --> PATCH
    GET --> SEARCH["GET /sc_task?number=..."]

    POST --> SN[("ServiceNow<br/>sc_task table")]
    PATCH --> SN
    SEARCH --> SN

    SN --> RESULT["📦 Normalized result<br/>{sys_id, number,<br/>state, priority, link}"]
    RESULT --> SUMMARY["💬 Claude summarizes<br/>and emits end_turn"]

    classDef cmd fill:#fef3c7,stroke:#d97706,color:#000
    classDef decision fill:#fce7f3,stroke:#be185d,color:#000
    classDef tool fill:#d1fae5,stroke:#059669,color:#000
    classDef http fill:#e0e7ff,stroke:#4338ca,color:#000
    classDef snow fill:#dbeafe,stroke:#2563eb,color:#000

    class CMD cmd
    class NLP,SUMMARY decision
    class CREATE,UPDATE,CLOSE,GET tool
    class POST,PATCH,SEARCH http
    class SN,RESULT snow
```

---

### 4. State & priority mapping (data view)

Reference for the magic numbers ServiceNow uses on the `sc_task` table — these are what `servicenow.js` translates user-friendly words into.

```mermaid
flowchart LR
    subgraph PRI["Priority field (priority)"]
        direction TB
        P1["1 → Critical"] --- P2["2 → High"] --- P3["3 → Moderate (default)"] --- P4["4 → Low"]
    end

    subgraph STA["State field (state)"]
        direction TB
        S1["1 → Open"] --- S2["2 → Work in Progress"] --- S3["3 → Closed Complete"] --- S4["4 → Closed Incomplete"]
    end

    subgraph WORDS["Words Claude/users use"]
        direction TB
        W1["'urgent', 'prod down', 'critical' → 1/2"]
        W2["'in progress', 'wip' → 2"]
        W3["'closed', 'done', 'complete' → 3"]
        W4["'incomplete', 'cancelled' → 4"]
    end

    WORDS -. mapped by .-> STA
    WORDS -. inferred by Claude .-> PRI

    classDef pri fill:#fee2e2,stroke:#dc2626,color:#000
    classDef sta fill:#dbeafe,stroke:#2563eb,color:#000
    classDef words fill:#fef3c7,stroke:#d97706,color:#000

    class P1,P2,P3,P4,PRI pri
    class S1,S2,S3,S4,STA sta
    class W1,W2,W3,W4,WORDS words
```

---

### 5. Secrets & trust boundaries

Where each credential lives, who can read it, and how it crosses trust boundaries at runtime.

```mermaid
flowchart TB
    subgraph Boundary1["🔒 GitHub trust boundary"]
        direction TB
        S1["GitHub Secrets store<br/>(encrypted at rest,<br/>not readable after save)"]
        S1 -- "injected ONLY at job runtime<br/>as masked env vars" --> RUN2["Ephemeral runner<br/>(destroyed after job)"]
    end

    subgraph Boundary2["☁️ Anthropic trust boundary"]
        ANT["Anthropic API endpoint<br/>(receives prompt + tools,<br/>NEVER receives SNOW creds)"]
    end

    subgraph Boundary3["🛎️ ServiceNow trust boundary"]
        SNT["ServiceNow REST API<br/>(receives Basic Auth header,<br/>NEVER receives Anthropic key)"]
    end

    RUN2 -- "Bearer: ANTHROPIC_API_KEY" --> ANT
    RUN2 -- "Basic: USER:PASS<br/>over HTTPS" --> SNT

    Note1["⚠️ No credential is ever<br/>written to disk or logs.<br/>Runner is wiped after each run."]
    RUN2 -.-> Note1

    classDef boundary fill:#fee2e2,stroke:#dc2626,color:#000,stroke-dasharray: 5 5
    classDef secret fill:#fef3c7,stroke:#d97706,color:#000
    classDef ext fill:#e0e7ff,stroke:#4338ca,color:#000
    classDef note fill:#f3f4f6,stroke:#6b7280,color:#000,stroke-dasharray: 2 2

    class Boundary1,Boundary2,Boundary3 boundary
    class S1,RUN2 secret
    class ANT,SNT ext
    class Note1 note
```

---

### How to read these diagrams

- **Diagram 1** answers *"what are all the moving parts?"* — use it to onboard new teammates.
- **Diagram 2** answers *"what happens in time?"* — use it to debug an agent run that misbehaves.
- **Diagram 3** answers *"why did Claude pick this tool?"* — use it when adding a new tool.
- **Diagram 4** answers *"what do these numbers mean in ServiceNow?"* — use it when extending state/priority handling.
- **Diagram 5** answers *"is this secure?"* — use it for any security review or audit conversation.

> 💡 GitHub renders Mermaid natively in Markdown — no extra setup needed. To edit, paste any block into [mermaid.live](https://mermaid.live).

