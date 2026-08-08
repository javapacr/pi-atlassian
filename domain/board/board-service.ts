/**
 * Atlassian extension — board domain service
 *
 * Fetches Jira projects/boards and their team members, and manages the cache.
 */

import type { JiraConfig } from "../../utils/config";
import { jiraRequest, type JiraResult } from "../../utils/jira-client";
import type { Board, CachedBoardData } from "./board";
import { loadBoardCache, saveBoardCache } from "./board-cache";
import type { JiraUser } from "../user/user";

interface JiraProject {
	id: string;
	key: string;
	name: string;
}

interface JiraServerInfo {
	baseUrl: string;
	cloudId?: string;
}

/**
 * Extract the Atlassian cloud ID from the base URL if present, otherwise
 * fetch it from /rest/api/3/serverInfo.
 */
export async function resolveCloudId(
	config: JiraConfig,
): Promise<JiraResult<string>> {
	// Jira Cloud base URLs sometimes include the cloud ID as the host suffix.
	const match = config.baseUrl.match(/https:\/\/([a-z0-9-]+)\.atlassian\.net/i);
	if (match) {
		return { ok: true, data: match[1] };
	}

	const result = await jiraRequest<JiraServerInfo>(
		config,
		"/rest/api/3/serverInfo",
	);
	if (!result.ok) return result;

	const cloudId = result.data.cloudId;
	if (!cloudId) {
		return {
			ok: false,
			error: "Could not determine Jira Cloud ID from base URL or server info",
		};
	}

	return { ok: true, data: cloudId };
}

/**
 * Fetch accessible Jira projects as boards.
 */
export async function fetchBoards(
	config: JiraConfig,
): Promise<JiraResult<Board[]>> {
	const result = await jiraRequest<JiraProject[]>(
		config,
		"/rest/api/3/project",
	);
	if (!result.ok) return result;

	const boards = result.data.map((p) => ({
		id: p.id,
		name: p.name,
		key: p.key,
		projectKey: p.key,
	}));

	return { ok: true, data: boards };
}

interface JiraSearchIssue {
	fields: {
		assignee: {
			accountId: string;
			emailAddress?: string;
			displayName: string;
			active: boolean;
		} | null;
	};
}

interface JiraSearchResponse {
	issues: JiraSearchIssue[];
}

/**
 * Fetch users who have been active assignees on issues in the project within
 * the last `lookbackDays` days. Activity is determined by issue update date,
 * and assignees are ordered by most-recent issue first.
 */
export async function fetchActiveAssignees(
	config: JiraConfig,
	projectKey: string,
	lookbackDays = 30,
): Promise<JiraResult<JiraUser[]>> {
	const jql =
		`project = "${projectKey}" AND updated >= -${lookbackDays}d AND assignee is not EMPTY ` +
		`ORDER BY updated DESC`;

	const seen = new Map<string, JiraUser>();
	const maxResults = 1000;
	const maxPages = 10;

	for (let page = 0; page < maxPages; page++) {
		const result = await jiraRequest<JiraSearchResponse>(
			config,
			"/rest/api/3/search/jql",
			{
				query: {
					jql,
					fields: "assignee",
					maxResults,
					startAt: page * maxResults,
				},
			},
		);
		if (!result.ok) return result;

		const issues = result.data.issues ?? [];
		if (issues.length === 0) break;

		for (const issue of issues) {
			const assignee = issue.fields?.assignee;
			if (!assignee) continue;
			if (!seen.has(assignee.accountId)) {
				seen.set(assignee.accountId, {
					accountId: assignee.accountId,
					emailAddress: assignee.emailAddress,
					displayName: assignee.displayName,
					active: assignee.active,
				});
			}
		}

		if (issues.length < maxResults) break;
	}

	return { ok: true, data: Array.from(seen.values()) };
}

/**
 * Refresh the full board cache.
 */
export async function refreshBoardCache(
	config: JiraConfig,
): Promise<JiraResult<CachedBoardData>> {
	const cloudResult = await resolveCloudId(config);
	if (!cloudResult.ok) return cloudResult;

	const boardsResult = await fetchBoards(config);
	if (!boardsResult.ok) return boardsResult;

	const allowedKeys = new Set(["FECSK", "BAC"]);
	const filteredBoards = boardsResult.data.filter((board) =>
		allowedKeys.has(board.key),
	);

	const teamMembers: Record<string, JiraUser[]> = {};
	for (const board of filteredBoards) {
		const membersResult = await fetchActiveAssignees(config, board.projectKey);
		if (membersResult.ok) {
			teamMembers[board.id] = membersResult.data;
		} else {
			teamMembers[board.id] = [];
		}
	}

	const data: CachedBoardData = {
		cloudId: cloudResult.data,
		baseUrl: config.baseUrl,
		boards: filteredBoards,
		teamMembers,
	};

	await saveBoardCache(data);
	return { ok: true, data };
}

/**
 * Get cached board data; refresh if missing or stale baseUrl.
 */
export async function getBoardCache(
	config: JiraConfig,
	refresh = false,
): Promise<JiraResult<CachedBoardData>> {
	if (!refresh) {
		const cached = await loadBoardCache();
		if (cached && cached.baseUrl === config.baseUrl) {
			return { ok: true, data: cached };
		}
	}

	return refreshBoardCache(config);
}
