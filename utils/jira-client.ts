/**
 * Atlassian extension — authenticated Jira REST client
 *
 * Wraps fetch with Jira Cloud API token auth, response parsing, and
 * credential sanitization. Never logs or returns the API token.
 */

import type { JiraConfig } from "./config";

export interface JiraError {
	ok: false;
	error: string;
	status?: number;
}

export interface JiraSuccess<T> {
	ok: true;
	data: T;
}

export type JiraResult<T> = JiraSuccess<T> | JiraError;

function buildAuthHeader(config: JiraConfig): string {
	const credentials = `${config.email}:${config.apiToken}`;
	return `Basic ${globalThis.btoa(credentials)}`;
}

function sanitize(text: string, config: JiraConfig): string {
	let out = text;
	if (config.apiToken) {
		out = out.split(config.apiToken).join("[REDACTED]");
	}
	if (config.email) {
		out = out.split(config.email).join("[REDACTED]");
	}
	return out;
}

export interface JiraRequestOptions {
	method?: "GET" | "POST" | "PUT" | "DELETE";
	query?: Record<string, string | number | boolean>;
	body?: unknown;
	timeoutMs?: number;
}

function buildUrl(
	baseUrl: string,
	path: string,
	query?: Record<string, string | number | boolean>,
): string {
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	const url = new URL(`${baseUrl}${normalizedPath}`);
	if (query) {
		for (const [key, value] of Object.entries(query)) {
			url.searchParams.set(key, String(value));
		}
	}
	return url.toString();
}

/**
 * Make an authenticated request to the Jira REST API.
 */
export async function jiraRequest<T>(
	config: JiraConfig,
	path: string,
	options: JiraRequestOptions = {},
): Promise<JiraResult<T>> {
	const { method = "GET", query, body, timeoutMs = 30_000 } = options;

	const url = buildUrl(config.baseUrl, path, query);
	const headers: Record<string, string> = {
		Authorization: buildAuthHeader(config),
		Accept: "application/json",
		"Content-Type": "application/json",
	};

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(url, {
			method,
			headers,
			body: body ? JSON.stringify(body) : undefined,
			signal: controller.signal,
		});

		const text = await response.text();
		let data: unknown;
		try {
			data = text ? JSON.parse(text) : undefined;
		} catch {
			data = text;
		}

		if (!response.ok) {
			const message =
				typeof data === "object" && data !== null && "errorMessages" in data
					? (data as { errorMessages?: string[] }).errorMessages?.join("; ")
					: typeof data === "string"
						? data
						: response.statusText;
			return {
				ok: false,
				error: sanitize(
					`Jira API error ${response.status}${message ? `: ${message}` : ""}`,
					config,
				),
				status: response.status,
			};
		}

		return { ok: true, data: data as T };
	} catch (err: any) {
		if (err.name === "AbortError") {
			return {
				ok: false,
				error: `Jira request timed out after ${timeoutMs}ms`,
			};
		}
		return {
			ok: false,
			error: sanitize(err.message ?? "unknown error", config),
		};
	} finally {
		clearTimeout(timeout);
	}
}
