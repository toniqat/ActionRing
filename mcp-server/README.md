# ActionRing MCP Server

Standalone MCP (Model Context Protocol) server that allows AI assistants (Claude, etc.) to control ActionRing.

## How It Works

1. ActionRing's main process runs a local HTTP API on `127.0.0.1:<random-port>` (see `src/main/McpApiServer.ts`)
2. The port is written to `<userData>/.mcp-port`
3. This MCP server reads the port file and bridges MCP stdio protocol to the HTTP API

## Build

```bash
npm install
npm run build
```

## Setup

### Claude Desktop / Claude Code

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "actionring": {
      "command": "node",
      "args": ["F:/Project/ActionRing/mcp-server/dist/index.js"]
    }
  }
}
```

### Other MCP Clients

Any MCP client supporting stdio transport can use this server. The command is:
```
node <path-to>/mcp-server/dist/index.js
```

## Available Tools

### System
- `get_status` — Get ActionRing status (enabled, trigger, theme, language)
- `toggle_enabled` — Toggle ActionRing on/off

### Config
- `get_config` — Get the full configuration
- `save_config` — Replace the entire configuration
- `reset_config` — Reset to factory defaults

### Shortcuts Library
- `list_shortcuts` — List all shortcuts
- `get_shortcut` — Get a shortcut by ID
- `create_shortcut` — Create a new shortcut with an action sequence
- `update_shortcut` — Update a shortcut's actions/name/icon
- `delete_shortcut` — Delete a shortcut
- `execute_shortcut` — Run a shortcut immediately

### Shortcut Groups
- `list_shortcut_groups` — List groups
- `create_shortcut_group` — Create a group
- `delete_shortcut_group` — Delete a group

### Apps
- `list_apps` — List all app entries
- `add_app` — Add an app entry
- `remove_app` — Remove an app entry

### Profiles
- `list_profiles` — List profiles for an app
- `add_profile` — Add a profile
- `remove_profile` — Remove a profile
- `rename_profile` — Rename a profile
- `set_active_profile` — Set the active profile

### Slots
- `get_slots` — Get ring button slots for a profile
- `update_slots` — Replace all slots for a profile

### Actions
- `execute_actions` — Execute actions directly (without saving as shortcut)
- `get_action_types` — Get documentation for all action types and their fields

## Files

| File | Description |
|---|---|
| `index.ts` | MCP server entry point — tool definitions, HTTP bridge, port discovery |
| `dist/index.js` | Compiled output (run with `node`) |
| `package.json` | Dependencies: `@modelcontextprotocol/sdk`, `zod` |
| `tsconfig.json` | TypeScript config (ESM, Node16) |
