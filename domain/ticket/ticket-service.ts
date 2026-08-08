/**
 * Atlassian extension — ticket domain service
 *
 * Read, update status, and assign Jira issues.
 */

import type { JiraConfig } from "../../utils/config";
import { jiraRequest, type JiraResult } from "../../utils/jira-client";
import { getMyself, searchUser } from "../user/user-service";
import type { Ticket, TicketTransition } from "./ticket";

interface JiraIssueResponse {
	id: string;
	key: string;
	self: string;
	fields: Record<string, unknown>;
}

interface TransitionsResponse {
	transitions: Array<{
		id: string;
		name: string;
		to: { id: string; name: string };
	}>;
}

/**
 * Fetch a single Jira issue with all fields.
 */
export async function fetchTicket(
	config: JiraConfig,
	ticketKey: string,
): Promise<JiraResult<Ticket>> {
	const result = await jiraRequest<JiraIssueResponse>(
		config,
		`/rest/api/3/issue/${encodeURIComponent(ticketKey)}`,
		{
			query: { fields: "*all" },
		},
	);
	if (!result.ok) return result;

	return {
		ok: true,
		data: {
			id: result.data.id,
			key: result.data.key,
			self: result.data.self,
			fields: result.data.fields,
		},
	};
}

/**
 * List available status transitions for an issue.
 */
export async function fetchTransitions(
	config: JiraConfig,
	ticketKey: string,
): Promise<JiraResult<TicketTransition[]>> {
	const result = await jiraRequest<TransitionsResponse>(
		config,
		`/rest/api/3/issue/${encodeURIComponent(ticketKey)}/transitions`,
	);
	if (!result.ok) return result;

	return {
		ok: true,
		data: result.data.transitions.map((t) => ({
			id: t.id,
			name: t.name,
			to: { id: t.to.id, name: t.to.name },
		})),
	};
}

/**
 * Transition an issue to a status with a matching name.
 */
export async function updateTicketStatus(
	config: JiraConfig,
	ticketKey: string,
	statusName: string,
): Promise<JiraResult<{ transitionId: string; transitionName: string }>> {
	const transitionsResult = await fetchTransitions(config, ticketKey);
	if (!transitionsResult.ok) return transitionsResult;

	const target = transitionsResult.data.find(
		(t) => t.name.toLowerCase() === statusName.toLowerCase(),
	);

	if (!target) {
		const available = transitionsResult.data.map((t) => t.name).join(", ");
		return {
			ok: false,
			error: `No transition matches status "${statusName}". Available transitions: ${available || "none"}`,
		};
	}

	const result = await jiraRequest<unknown>(
		config,
		`/rest/api/3/issue/${encodeURIComponent(ticketKey)}/transitions`,
		{
			method: "POST",
			body: { transition: { id: target.id } },
		},
	);

	if (!result.ok) return result;

	return {
		ok: true,
		data: {
			transitionId: target.id,
			transitionName: target.name,
		},
	};
}

/**
 * Assign an issue to a user.
 *
 * If assignee is omitted, assigns to the authenticated user.
 * If assignee is an email, resolves it to an accountId first.
 */
export async function assignTicket(
	config: JiraConfig,
	ticketKey: string,
	assignee?: string,
): Promise<JiraResult<{ accountId: string; displayName: string }>> {
	let accountId: string;
	let displayName: string;

	if (assignee) {
		// If it looks like an email, search; otherwise treat as accountId.
		if (assignee.includes("@")) {
			const userResult = await searchUser(config, assignee);
			if (!userResult.ok) return userResult;
			accountId = userResult.data.accountId;
			displayName = userResult.data.displayName;
		} else {
			accountId = assignee;
			displayName = assignee;
		}
	} else {
		const myselfResult = await getMyself(config);
		if (!myselfResult.ok) return myselfResult;
		accountId = myselfResult.data.accountId;
		displayName = myselfResult.data.displayName;
	}

	const result = await jiraRequest<unknown>(
		config,
		`/rest/api/3/issue/${encodeURIComponent(ticketKey)}/assignee`,
		{
			method: "PUT",
			body: { accountId },
		},
	);

	if (!result.ok) return result;

	return {
		ok: true,
		data: { accountId, displayName },
	};
}
