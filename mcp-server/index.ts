#!/usr/bin/env node

/**
 * ActionRing MCP Server — stdio transport
 *
 * This is a standalone MCP server that bridges the Model Context Protocol
 * to ActionRing's local HTTP API. ActionRing must be running for this to work.
 *
 * Usage in claude_desktop_config.json:
 * {
 *   "mcpServers": {
 *     "actionring": {
 *       "command": "node",
 *       "args": ["<path-to>/mcp-server/dist/index.js"]
 *     }
 *   }
 * }
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// ── Discover ActionRing API port ──────────────────────────────────────────────

function getAppName(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'))
    return pkg.build?.productName ?? pkg.name ?? 'ActionRing'
  } catch {
    return 'ActionRing'
  }
}

function getPortFilePath(): string {
  const appName = getAppName()
  const platform = process.platform
  if (platform === 'win32') {
    return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), appName, '.mcp-port')
  } else if (platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', appName, '.mcp-port')
  } else {
    return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), appName, '.mcp-port')
  }
}

function discoverPort(): number {
  const portFile = getPortFilePath()
  if (!existsSync(portFile)) {
    throw new Error(
      `ActionRing MCP port file not found at ${portFile}. ` +
      `Make sure ActionRing is running.`
    )
  }
  const port = parseInt(readFileSync(portFile, 'utf-8').trim(), 10)
  if (isNaN(port)) throw new Error('Invalid port in .mcp-port file')
  return port
}

// ── HTTP client helper ──────────────────────────────────────────────────────

async function apiCall(port: number, method: string, path: string, body?: unknown): Promise<any> {
  const url = `http://127.0.0.1:${port}${path}`
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) {
    options.body = JSON.stringify(body)
  }
  const res = await fetch(url, options)
  const text = await res.text()
  let json: any
  try { json = JSON.parse(text) } catch { json = text }
  if (!res.ok) {
    throw new Error(`API ${method} ${path} failed (${res.status}): ${JSON.stringify(json)}`)
  }
  return json
}

// ── Helper ────────────────────────────────────────────────────────────────────

function jsonResult(data: unknown): { content: { type: 'text'; text: string }[] } {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function textResult(msg: string): { content: { type: 'text'; text: string }[] } {
  return { content: [{ type: 'text' as const, text: msg }] }
}

// ── MCP Server ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const port = discoverPort()

  // Verify ActionRing is reachable
  try {
    await apiCall(port, 'GET', '/status')
  } catch (err: any) {
    console.error(`Cannot connect to ActionRing on port ${port}: ${err.message}`)
    process.exit(1)
  }

  const server = new McpServer({
    name: 'actionring',
    version: '1.0.0',
  })

  // ── Status / System tools ────────────────────────────────────────────────

  server.tool(
    'get_status',
    'Get ActionRing status (enabled state, trigger config, theme, language)',
    {},
    async () => jsonResult(await apiCall(port, 'GET', '/status')),
  )

  server.tool(
    'toggle_enabled',
    'Toggle ActionRing on or off',
    {},
    async () => {
      const data = await apiCall(port, 'POST', '/toggle-enabled')
      return textResult(`ActionRing is now ${data.enabled ? 'enabled' : 'disabled'}`)
    },
  )

  // ── Config tools ─────────────────────────────────────────────────────────

  server.tool(
    'get_config',
    'Get the full ActionRing configuration (apps, profiles, slots, shortcuts library, appearance, trigger)',
    {},
    async () => jsonResult(await apiCall(port, 'GET', '/config')),
  )

  server.tool(
    'save_config',
    'Save the full ActionRing configuration. WARNING: replaces entire config.',
    {
      config: z.object({
        apps: z.array(z.record(z.string(), z.any())).optional(),
        shortcutsLibrary: z.array(z.record(z.string(), z.any())).optional(),
        shortcutGroups: z.array(z.record(z.string(), z.any())).optional(),
        appearance: z.record(z.string(), z.any()).optional(),
        trigger: z.record(z.string(), z.any()).optional(),
      }).passthrough().describe('Full AppConfig object to save'),
    },
    async (args) => {
      await apiCall(port, 'PUT', '/config', args.config)
      return textResult('Config saved successfully')
    },
  )

  server.tool(
    'reset_config',
    'Reset ActionRing configuration to factory defaults',
    {},
    async () => {
      const data = await apiCall(port, 'POST', '/config/reset')
      return textResult('Config reset to defaults.\n' + JSON.stringify(data, null, 2))
    },
  )

  // ── Shortcuts Library tools ──────────────────────────────────────────────

  server.tool(
    'list_shortcuts',
    'List all shortcuts in the ActionRing shortcuts library. Each shortcut has an id, name, actions array, and optional metadata.',
    {},
    async () => jsonResult(await apiCall(port, 'GET', '/shortcuts')),
  )

  server.tool(
    'get_shortcut',
    'Get a specific shortcut by ID from the library',
    { id: z.string().describe('Shortcut ID') },
    async (args) => jsonResult(await apiCall(port, 'GET', `/shortcuts/${args.id}`)),
  )

  server.tool(
    'create_shortcut',
    'Create a new shortcut in the library. A shortcut is a named, reusable sequence of actions. Use get_action_types to see available action types.',
    {
      name: z.string().describe('Display name for the shortcut'),
      actions: z.array(z.object({ type: z.string() }).passthrough()).describe('Array of ActionConfig objects defining the action sequence. Each object must have a "type" field (e.g. "launch", "keyboard", "shell", "system", "link", etc.)'),
      icon: z.string().optional().describe('Optional icon name (builtin) or path (custom)'),
      groupId: z.string().optional().describe('Optional group ID to organize the shortcut'),
    },
    async (args) => {
      const data = await apiCall(port, 'POST', '/shortcuts', {
        name: args.name,
        actions: args.actions,
        icon: args.icon,
        groupId: args.groupId,
      })
      return textResult(`Created shortcut "${data.name}" (id: ${data.id})\n` + JSON.stringify(data, null, 2))
    },
  )

  server.tool(
    'update_shortcut',
    'Update an existing shortcut in the library (actions, name, icon, bgColor)',
    {
      id: z.string().describe('Shortcut ID to update'),
      name: z.string().optional().describe('New display name'),
      actions: z.array(z.object({ type: z.string() }).passthrough()).optional().describe('New actions array. Each object must have a "type" field.'),
      icon: z.string().optional().describe('New icon name or path'),
      bgColor: z.string().optional().describe('New background color hex'),
    },
    async (args) => {
      const { id, ...body } = args
      await apiCall(port, 'PUT', `/shortcuts/${id}`, body)
      return textResult(`Shortcut ${id} updated successfully`)
    },
  )

  server.tool(
    'delete_shortcut',
    'Delete a shortcut from the library. Slots referencing it will be orphaned.',
    { id: z.string().describe('Shortcut ID to delete') },
    async (args) => {
      await apiCall(port, 'DELETE', `/shortcuts/${args.id}`)
      return textResult(`Shortcut ${args.id} deleted`)
    },
  )

  server.tool(
    'execute_shortcut',
    "Execute a shortcut by ID — runs its action sequence immediately on the user's machine",
    { id: z.string().describe('Shortcut ID to execute') },
    async (args) => jsonResult(await apiCall(port, 'POST', `/shortcuts/${args.id}/execute`)),
  )

  // ── Shortcut Groups tools ────────────────────────────────────────────────

  server.tool(
    'list_shortcut_groups',
    'List all shortcut groups (folders for organizing shortcuts)',
    {},
    async () => jsonResult(await apiCall(port, 'GET', '/shortcut-groups')),
  )

  server.tool(
    'create_shortcut_group',
    'Create a new shortcut group for organizing shortcuts',
    { name: z.string().describe('Group name') },
    async (args) => {
      const data = await apiCall(port, 'POST', '/shortcut-groups', { name: args.name })
      return textResult(`Created group "${data.name}" (id: ${data.id})`)
    },
  )

  server.tool(
    'delete_shortcut_group',
    'Delete a shortcut group. Shortcuts in the group will be ungrouped, not deleted.',
    { id: z.string().describe('Group ID to delete') },
    async (args) => {
      await apiCall(port, 'DELETE', `/shortcut-groups/${args.id}`)
      return textResult(`Group ${args.id} deleted`)
    },
  )

  // ── App tools ────────────────────────────────────────────────────────────

  server.tool(
    'list_apps',
    'List all app entries in ActionRing. Each app has profiles with their own slots and appearance. The "default" app is the Default System (always present).',
    {},
    async () => jsonResult(await apiCall(port, 'GET', '/apps')),
  )

  server.tool(
    'add_app',
    'Add a new app entry to ActionRing (for app-specific ring configurations)',
    {
      exeName: z.string().describe('Executable name, e.g. "chrome.exe"'),
      displayName: z.string().describe('Friendly display name, e.g. "Google Chrome"'),
    },
    async (args) => {
      const data = await apiCall(port, 'POST', '/apps', args)
      return textResult(`Added app "${data.displayName}" (id: ${data.id})`)
    },
  )

  server.tool(
    'remove_app',
    'Remove an app entry from ActionRing. Cannot remove the "default" app.',
    { id: z.string().describe('App ID to remove') },
    async (args) => {
      await apiCall(port, 'DELETE', `/apps/${args.id}`)
      return textResult(`App ${args.id} removed`)
    },
  )

  // ── Profile tools ────────────────────────────────────────────────────────

  server.tool(
    'list_profiles',
    'List all profiles for a given app entry',
    { appId: z.string().describe('App ID (use "default" for Default System)') },
    async (args) => jsonResult(await apiCall(port, 'GET', `/apps/${args.appId}/profiles`)),
  )

  server.tool(
    'add_profile',
    'Add a new profile to an app entry',
    {
      appId: z.string().describe('App ID'),
      name: z.string().describe('Profile name'),
    },
    async (args) => {
      const data = await apiCall(port, 'POST', `/apps/${args.appId}/profiles`, { name: args.name })
      return textResult(`Added profile "${data.name}" (id: ${data.id})`)
    },
  )

  server.tool(
    'remove_profile',
    'Remove a profile from an app entry. Cannot remove the last profile.',
    {
      appId: z.string().describe('App ID'),
      profileId: z.string().describe('Profile ID to remove'),
    },
    async (args) => {
      await apiCall(port, 'DELETE', `/apps/${args.appId}/profiles/${args.profileId}`)
      return textResult(`Profile ${args.profileId} removed`)
    },
  )

  server.tool(
    'rename_profile',
    'Rename a profile',
    {
      appId: z.string().describe('App ID'),
      profileId: z.string().describe('Profile ID'),
      name: z.string().describe('New name'),
    },
    async (args) => {
      await apiCall(port, 'PUT', `/apps/${args.appId}/profiles/${args.profileId}/rename`, { name: args.name })
      return textResult(`Profile renamed to "${args.name}"`)
    },
  )

  server.tool(
    'set_active_profile',
    'Set the active profile for an app entry',
    {
      appId: z.string().describe('App ID'),
      profileId: z.string().describe('Profile ID to activate'),
    },
    async (args) => {
      await apiCall(port, 'PUT', `/apps/${args.appId}/active-profile`, { profileId: args.profileId })
      return textResult(`Active profile set to ${args.profileId}`)
    },
  )

  // ── Slot tools ───────────────────────────────────────────────────────────

  server.tool(
    'get_slots',
    'Get all ring button slots for a specific app profile. Each slot has an id, label, icon, shortcutIds (referencing library entries), and optional subSlots for folder-type slots.',
    {
      appId: z.string().describe('App ID (use "default" for Default System)'),
      profileId: z.string().describe('Profile ID'),
    },
    async (args) => jsonResult(await apiCall(port, 'GET', `/apps/${args.appId}/profiles/${args.profileId}/slots`)),
  )

  server.tool(
    'update_slots',
    'Replace all ring button slots for a specific app profile. Use this to rearrange buttons, assign shortcuts to slots, or change slot appearance.',
    {
      appId: z.string().describe('App ID'),
      profileId: z.string().describe('Profile ID'),
      slots: z.array(z.object({
        id: z.string(),
        label: z.string(),
        icon: z.string(),
        iconIsCustom: z.boolean().optional(),
        actions: z.array(z.object({ type: z.string() }).passthrough()).optional(),
        shortcutIds: z.array(z.string()).optional(),
        enabled: z.boolean().optional(),
      }).passthrough()).describe('Array of SlotConfig objects for the ring buttons.'),
    },
    async (args) => {
      await apiCall(port, 'PUT', `/apps/${args.appId}/profiles/${args.profileId}/slots`, { slots: args.slots })
      return textResult('Slots updated successfully')
    },
  )

  // ── Action execution tools ───────────────────────────────────────────────

  server.tool(
    'execute_actions',
    "Execute a list of actions directly on the user's machine. Use this to test action sequences without saving them as shortcuts first.",
    {
      actions: z.array(z.object({ type: z.string() }).passthrough()).describe('Array of ActionConfig objects to execute sequentially. Each object must have a "type" field.'),
    },
    async (args) => jsonResult(await apiCall(port, 'POST', '/actions/execute', { actions: args.actions })),
  )

  // ── Action type reference ────────────────────────────────────────────────

  server.tool(
    'get_action_types',
    'Get documentation for all available action types and their fields. Use this to understand how to construct actions for create_shortcut and execute_actions.',
    {},
    async () => jsonResult(await apiCall(port, 'GET', '/action-types')),
  )

  // ── Start server ────────────────────────────────────────────────────────

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
