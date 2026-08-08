/**
 * Atlassian extension — user domain service
 *
 * Operations for resolving Jira users.
 */

import type { JiraConfig } from "../../utils/config";
import { jiraRequest, type JiraResult } from "../../utils/jira-client";
import type { JiraUser } from "./user";

interface JiraUserResponse {
	accountId: string;
	emailAddress?: string;
	displayName: string;
	active: boolean;
}

/**
 * Get the currently authenticated Jira user.
 */
export async function getMyself(
	config: JiraConfig,
): Promise<JiraResult<JiraUser>> {
	const result = await jiraRequest<JiraUserResponse>(
		config,
		"/rest/api/3/myself",
	);
	if (!result.ok) return result;
	return {
		ok: true,
		data: {
			accountId: result.data.accountId,
			emailAddress: result.data.emailAddress,
			displayName: result.data.displayName,
			active: result.data.active,
		},
	};
}

/**
 * Search for a Jira user by email or name and return the first match.
 */
export async function searchUser(
	config: JiraConfig,
	query: string,
): Promise<JiraResult<JiraUser>> {
	const result = await jiraRequest<JiraUserResponse[]>(
		config,
		"/rest/api/3/user/search",
		{
			query: { query },
		},
	);
	if (!result.ok) return result;

	const users = result.data;
	const match = users.find(
		(u) =>
			u.emailAddress?.toLowerCase() === query.toLowerCase() ||
			u.displayName.toLowerCase().includes(query.toLowerCase()),
	);
	const selected = match ?? users[0];

	if (!selected) {
		return {
			ok: false,
			error: `No Jira user found matching "${query}"`,
		};
	}

	return {
		ok: true,
		data: {
			accountId: selected.accountId,
			emailAddress: selected.emailAddress,
			displayName: selected.displayName,
			active: selected.active,
		},
	};
}
