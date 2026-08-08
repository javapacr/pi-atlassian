/**
 * jira_assign_ticket — assign a Jira issue to a user
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { loadConfig } from "../utils/config";
import { assignTicket } from "../domain/ticket/ticket-service";

export interface AssignTicketDetails {
	ticket: string;
	assignee?: string;
	assignedTo?: string;
	error?: string;
}

export function registerJiraAssignTicketTool(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "jira_assign_ticket",
		label: "Jira Assign Ticket",
		description:
			"Assign a Jira issue to a user. " +
			"If no assignee is provided, assigns to the authenticated user. " +
			"Accepts a Jira account ID or an email address.",
		promptSnippet: "Assign a Jira ticket to a user or yourself",
		promptGuidelines: [
			"Use jira_assign_ticket to change the assignee of a ticket",
			"Omit assignee to assign to the authenticated Jira user",
			"Provide an email to look up the user's accountId automatically",
			"Provide a Jira accountId directly if you already know it",
		],
		parameters: Type.Object({
			ticket: Type.String({
				description: "Jira ticket key, e.g. PROJ-123",
			}),
			assignee: Type.Optional(
				Type.String({
					description:
						"Jira accountId or email address. If omitted, assigns to the authenticated user.",
				}),
			),
		}),

		async execute(_toolCallId, params) {
			const ticketKey = (params.ticket as string).trim().toUpperCase();
			const assignee = (params.assignee as string | undefined)?.trim();
			const details: AssignTicketDetails = {
				ticket: ticketKey,
				assignee,
			};

			const configResult = await loadConfig();
			if (!configResult.ok) {
				details.error = configResult.error;
				return {
					content: [{ type: "text", text: details.error }],
					isError: true,
					details,
				};
			}

			const result = await assignTicket(
				configResult.config,
				ticketKey,
				assignee,
			);
			if (!result.ok) {
				details.error = result.error;
				return {
					content: [{ type: "text", text: details.error }],
					isError: true,
					details,
				};
			}

			details.assignedTo = result.data.displayName;

			return {
				content: [
					{
						type: "text",
						text: `Assigned ${ticketKey} to ${result.data.displayName}`,
					},
				],
				details,
			};
		},

		renderCall(args, theme) {
			const target = args.assignee ? ` → ${args.assignee}` : " → me";
			return new Text(
				theme.fg("toolTitle", theme.bold("jira_assign_ticket ")) +
					theme.fg("dim", `${args.ticket}${target}`),
				0,
				0,
			);
		},

		renderResult(result, _state, theme) {
			const details = result.details as AssignTicketDetails | undefined;
			if (details?.error) {
				return new Text(
					theme.fg("error", "✗ ") + theme.fg("muted", details.error),
					0,
					0,
				);
			}
			return new Text(
				theme.fg("success", "✓ ") +
					theme.fg(
						"dim",
						`${details?.ticket ?? ""} → ${details?.assignedTo ?? ""}`,
					),
				0,
				0,
			);
		},
	});
}
