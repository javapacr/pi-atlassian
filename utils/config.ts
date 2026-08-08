/**
 * Atlassian extension — configuration loader
 *
 * Configuration resolution order (highest precedence first):
 *   1. Environment variables (JIRA_EMAIL, JIRA_API_TOKEN, JIRA_BASE_URL)
 *   2. settings.json key `atlassian.jira`
 *   3. Sensible defaults / error if required values are missing
 *
 * Searches settings.json in ~/.pi/agent, ~/.pi/personal, and ~/.pi/work.
 */

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface JiraConfig {
	email: string;
	apiToken: string;
	baseUrl: string;
}

export interface ConfigError {
	ok: false;
	error: string;
}

export interface ConfigSuccess {
	ok: true;
	config: JiraConfig;
}

export type ConfigResult = ConfigSuccess | ConfigError;

function expandHomeDirectory(
	configuredDir: string,
	homeDirectory: string,
): string {
	if (configuredDir === "~") return homeDirectory;
	if (configuredDir.startsWith("~/") || configuredDir.startsWith("~\\")) {
		return join(homeDirectory, configuredDir.slice(2));
	}
	return configuredDir;
}

/**
 * Resolve the pi agent data directory.
 *
 * Uses PI_CODING_AGENT_DIR env var if set, otherwise falls back to ~/.pi/agent.
 */
export function resolvePiAgentDir(): string {
	const configuredDir = process.env.PI_CODING_AGENT_DIR;
	if (!configuredDir) {
		return join(homedir(), ".pi", "agent");
	}
	return expandHomeDirectory(configuredDir, homedir());
}

interface SettingsJira {
	email?: string;
	apiToken?: string;
	baseUrl?: string;
}

interface SettingsRoot {
	atlassian?: {
		jira?: SettingsJira;
	};
}

async function readSettingsFile(
	filePath: string,
): Promise<SettingsRoot | null> {
	try {
		const raw = await readFile(filePath, "utf8");
		return JSON.parse(raw) as SettingsRoot;
	} catch {
		return null;
	}
}

async function loadSettingsJira(): Promise<SettingsJira> {
	const home = homedir();
	const candidates = [
		join(home, ".pi", "agent", "settings.json"),
		join(home, ".pi", "personal", "settings.json"),
		join(home, ".pi", "work", "settings.json"),
	];

	let merged: SettingsJira = {};
	for (const path of candidates) {
		const settings = await readSettingsFile(path);
		const jira = settings?.atlassian?.jira;
		if (jira) {
			merged = { ...merged, ...jira };
		}
	}
	return merged;
}

/**
 * Load Jira configuration from environment variables and settings.json.
 */
export async function loadConfig(): Promise<ConfigResult> {
	const settings = await loadSettingsJira();

	const email = process.env.JIRA_EMAIL ?? settings.email ?? "";
	const apiToken = process.env.JIRA_API_TOKEN ?? settings.apiToken ?? "";
	const baseUrl = process.env.JIRA_BASE_URL ?? settings.baseUrl ?? "";

	if (!email) {
		return {
			ok: false,
			error:
				"Missing Jira email. Set JIRA_EMAIL or atlassian.jira.email in settings.json.",
		};
	}
	if (!apiToken) {
		return {
			ok: false,
			error:
				"Missing Jira API token. Set JIRA_API_TOKEN or atlassian.jira.apiToken in settings.json.",
		};
	}
	if (!baseUrl) {
		return {
			ok: false,
			error:
				"Missing Jira base URL. Set JIRA_BASE_URL or atlassian.jira.baseUrl in settings.json.",
		};
	}

	// Normalize base URL: strip trailing slash.
	const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

	return {
		ok: true,
		config: {
			email,
			apiToken,
			baseUrl: normalizedBaseUrl,
		},
	};
}
