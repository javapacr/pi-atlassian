# pi-atlassian

[pi](https://github.com/earendil-works/pi) extension for [Atlassian Jira](https://www.atlassian.com/software/jira) integration.

## Tools

| Tool | Description |
|------|-------------|
| `jira_read_ticket` | Fetch a Jira issue and write it to a markdown file for review |
| `jira_update_status` | Transition a Jira issue to a new status |
| `jira_assign_ticket` | Assign a Jira issue to a user (by accountId or email) |
| `jira_list_boards` | List cached Jira boards and team members (refreshes from server) |
| `jira_list_cached_boards` | List boards/members from local cache (optionally filtered by board key) |

## Installation

```bash
pi extension install npm:pi-atlassian
```

Or add to your `settings.json`:

```json
{
  "extensions": ["npm:pi-atlassian"]
}
```

## Configuration

Jira credentials are resolved in this order (highest precedence first):

1. **Environment variables:** `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_BASE_URL`
2. **settings.json** key `atlassian.jira`:

```json
{
  "atlassian": {
    "jira": {
      "email": "you@example.com",
      "apiToken": "your-api-token",
      "baseUrl": "https://your-domain.atlassian.net"
    }
  }
}
```

settings.json is searched in `~/.pi/agent`, `~/.pi/personal`, and `~/.pi/work` (merged in that order).

### Getting an API token

1. Go to <https://id.atlassian.com/manage-profile/security/api-tokens>
2. Create an API token
3. Use your Atlassian email + the token in the config above

## Architecture

```
pi-atlassian/
├── index.ts                      # Entry point — registers all tools
├── domain/
│   ├── board/                    # Board caching, service, types
│   ├── ticket/                   # Ticket fetching, status transitions, rendering
│   └── user/                     # User lookup
├── tools/                        # Tool registrations (jira-read-ticket, etc.)
└── utils/                        # Config loader, Jira HTTP client, cache, markdown helpers
```

DDD structure: `domain/` contains business logic, `tools/` contains pi tool registrations, `utils/` contains shared infrastructure.

## License

MIT
