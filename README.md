# ServiceNow and Jira Agents

This repository contains two Node.js command-line agents:

- The ServiceNow agent uses Claude to create, update, close, or retrieve ServiceNow Catalog Tasks from a natural-language command.
- The Jira agent uses Gemini to draft and create a Jira Story or Bug from email text and an existing ServiceNow Catalog Task.

The Jira flow currently takes email text from configuration or the command line. It does not connect to an email inbox, and vector-database classification is not integrated yet.

## Requirements

- Node.js 22 or later
- A ServiceNow instance with API access to the `sc_task` table
- For ServiceNow commands: an Anthropic API key
- For Jira creation: a Gemini API key and a Jira Cloud API token

## Install

```bash
cd agent
npm install
```

The local `agent/.env` file is ignored by Git. Put credentials there for local testing and do not commit it.

## ServiceNow Agent

Set these variables in `agent/.env`:

```dotenv
ANTHROPIC_API_KEY=your-anthropic-api-key
SNOW_INSTANCE=your-instance.service-now.com
SNOW_USERNAME=admin
SNOW_PASSWORD=your-instance-password
```

Run a command from the `agent` directory:

```bash
USER_COMMAND="create a task for deployment review" node --env-file=.env index.js
```

The agent supports creating, updating, closing, and retrieving ServiceNow Catalog Tasks. Ticket numbers currently use the `SCTASK...` format.

The GitHub Actions workflow at `.github/workflows/servicenow-agent.yml` runs this ServiceNow command agent through a manual `workflow_dispatch` input. Configure `ANTHROPIC_API_KEY`, `SNOW_INSTANCE`, `SNOW_USERNAME`, and `SNOW_PASSWORD` as repository Actions secrets before running it.

## Jira Agent

Configure the Jira flow in `agent/.env`:

```dotenv
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3.8-flash
SNOW_INSTANCE=your-instance.service-now.com
SNOW_USERNAME=admin
SNOW_PASSWORD=your-instance-password
JIRA_BASE_URL=https://your-site.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=your-jira-api-token
JIRA_PROJECT_KEY=YOURPROJECT
JIRA_ISSUE_TYPE=Bug
SNOW_TICKET_NUMBER=SCTASK0012345
EMAIL_TEXT="Customer reports that checkout fails after payment."
```

Use the Jira project key assigned to your project, not the example value above. `JIRA_ISSUE_TYPE` accepts `Story` or `Bug` and defaults to `Story`. `GEMINI_MODEL` is optional; the current default is `gemini-3.8-flash`.

Run the Jira agent from the repository root:

```bash
npm --prefix agent run start:jira
```

It retrieves the ServiceNow task, sends the email and task details to Gemini to draft the Jira summary and description, and creates the selected Jira issue type. If `SNOW_TICKET_NUMBER` is omitted, it tries to find an `SCTASK` number in `EMAIL_TEXT`. The current ServiceNow client only searches the `sc_task` table. Every successful run creates a new Jira issue; there is no duplicate-email detection yet.

Jira Cloud authentication uses your Atlassian account email and an API token. Create a token in your Atlassian account security settings. Keep it private.

## Email and Knowledge-Base Integration

Email intake and vector search are future integration work. The email component should provide the message body and the related ServiceNow Catalog Task number. A knowledge-base classifier can then select `Story` or `Bug` and call the exported function:

```js
import { createJiraFromEmail } from "./jira-agent.js";

const issue = await createJiraFromEmail({
  emailText: email.textBody,
  serviceNowTicketNumber: email.serviceNowTaskNumber,
  issueType: classification.issueType,
});
```

The classifier must return exactly `Story` or `Bug`. At present, retrieved vector-search content is not passed to Gemini; only the classification result, email, and ServiceNow task are used. Add a context parameter if knowledge-base results should also inform the Jira description. The eventual email trigger should also prevent duplicate processing, for example by tracking the email provider's message ID.

## Troubleshooting

- **ServiceNow task not found:** Confirm the ticket exists in the same instance and is a Catalog Task (`SCTASK...`); Incidents (`INC...`) are not supported by the current lookup.
- **ServiceNow authentication or access error:** Verify the instance hostname, username, password, and API access to `sc_task`.
- **Jira project or issue-type error:** Check the project key and confirm that the project supports the selected issue type.
- **Gemini API error:** Verify the API key and model. A `503` may be temporary; retry after a short wait.
- **Credentials:** Never commit `.env` or paste API tokens and passwords into chat or issue trackers.

## Project Files

```text
.github/workflows/servicenow-agent.yml  Manual GitHub Actions workflow for ServiceNow
agent/index.js                          Claude-based ServiceNow command agent
agent/servicenow.js                     ServiceNow REST API client
agent/jira-agent.js                     Gemini-based email and ServiceNow to Jira flow
agent/jira.js                           Jira Cloud REST API client
agent/package.json                      Node.js scripts and dependencies
agent/.env                              Local, Git-ignored configuration
```
