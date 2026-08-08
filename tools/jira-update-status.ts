/**
 * jira_update_status — transition a Jira issue to a new status
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { loadConfig } from "../utils/config";
import { updateTicketStatus } from "../domain/ticket/ticket-service";

export interface UpdateStatusDetails {
	ticket: string;
	status: string;
	transitionName?: string;
	error?: string;
}

export function registerJiraUpdateStatusTool(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "jira_update_status",
		label: "Jira Update Status",
		description:
			"Transition a Jira issue to a new status. " +
			"The tool lists available transitions and picks the one matching the requested status name.",
		promptSnippet: "Update the status of a Jira ticket",
		promptGuidelines: [
			"Use jira_update_status to move a ticket through its workflow",
			"Provide the exact ticket key (e.g. PROJ-123) and target status name",
			"Status matching is case-insensitive",
		],
		parameters: Type.Object({
			ticket: Type.String({
				description: "Jira ticket key, e.g. PROJ-123",
			}),
			status: Type.String({
				description: "Target status name, e.g. 'In Progress' or 'Done'",
			}),
		}),

		async execute(_toolCallId, params) {
			const ticketKey = (params.ticket as string).trim().toUpperCase();
			const statusName = params.status as string;
			const details: UpdateStatusDetails = {
				ticket: ticketKey,
				status: statusName,
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

			const result = await updateTicketStatus(
				configResult.config,
				ticketKey,
				statusName,
			);
			if (!result.ok) {
				details.error = result.error;
				return {
					content: [{ type: "text", text: details.error }],
					isError: true,
					details,
				};
			}

			details.transitionName = result.data.transitionName;

			return {
				content: [
					{
						type: "text",
						text: `Transitioned ${ticketKey} to "${result.data.transitionName}"`,
					},
				],
				details,
			};
		},

		renderCall(args, theme) {
			return new Text(
				theme.fg("toolTitle", theme.bold("jira_update_status ")) +
					theme.fg("dim", `${args.ticket} → ${args.status}`),
				0,
				0,
			);
		},

		renderResult(result, _state, theme) {
			const details = result.details as UpdateStatusDetails | undefined;
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
						`${details?.ticket ?? ""} → ${details?.transitionName ?? ""}`,
					),
				0,
				0,
			);
		},
	});
}
