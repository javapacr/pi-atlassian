/**
 * Atlassian extension — ticket markdown renderer
 */

import { fieldToString } from "../../utils/markdown";
import type { Ticket } from "./ticket";

const SUMMARY_FIELDS = [
	"summary",
	"status",
	"issuetype",
	"priority",
	"assignee",
	"reporter",
	"created",
	"updated",
	"description",
];

function getDisplayValue(value: unknown): string {
	if (value === null || value === undefined) return "—";
	if (typeof value === "object") {
		const obj = value as Record<string, unknown>;
		if (typeof obj.displayName === "string") return obj.displayName;
		if (typeof obj.name === "string") return obj.name;
		if (typeof obj.value === "string") return obj.value;
	}
	return fieldToString(value);
}

function formatIsoDate(value: unknown): string {
	if (typeof value !== "string") return String(value ?? "—");
	try {
		return new Date(value).toLocaleString();
	} catch {
		return value;
	}
}

/**
 * Render a Jira ticket as markdown suitable for agent review.
 */
export function renderTicketToMarkdown(ticket: Ticket): string {
	const fields = ticket.fields;
	const summary = getDisplayValue(fields.summary);

	const lines: string[] = [];
	lines.push(`# ${ticket.key}: ${summary}`);
	lines.push("");
	lines.push(`- **ID:** ${ticket.id}`);
	lines.push(`- **Key:** ${ticket.key}`);
	lines.push(`- **Self:** ${ticket.self}`);
	lines.push("");

	// Core fields table
	lines.push("## Fields");
	lines.push("");
	lines.push("| Field | Value |");
	lines.push("|-------|-------|");

	for (const fieldName of SUMMARY_FIELDS) {
		const value = fields[fieldName];
		let display: string;
		if (fieldName === "created" || fieldName === "updated") {
			display = formatIsoDate(value);
		} else {
			display = getDisplayValue(value);
		}
		lines.push(`| ${fieldName} | ${display.replace(/\n/g, " ")} |`);
	}

	lines.push("");

	// Full raw fields appendix
	lines.push("## Raw fields");
	lines.push("");
	lines.push("```json");
	lines.push(JSON.stringify(fields, null, 2));
	lines.push("```");
	lines.push("");

	return lines.join("\n");
}
