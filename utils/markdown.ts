/**
 * Atlassian extension — markdown rendering helpers
 */

interface AdfNode {
	type?: string;
	text?: string;
	content?: unknown[];
	attrs?: Record<string, unknown>;
	marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>;
}

function isAdfNode(value: unknown): value is AdfNode {
	return typeof value === "object" && value !== null;
}

function getContent(node: AdfNode): string {
	if (!Array.isArray(node.content)) return "";
	return node.content.map(adfToMarkdown).join("");
}

const MARK_FORMATTERS: Record<
	string,
	(text: string, attrs?: Record<string, unknown>) => string
> = {
	strong: (text) => `**${text}**`,
	em: (text) => `*${text}*`,
	code: (text) => `\`${text}\``,
	strike: (text) => `~~${text}~~`,
	link: (text, attrs) => {
		const href = typeof attrs?.href === "string" ? attrs.href : undefined;
		return href ? `[${text}](${href})` : text;
	},
};

function applyMarks(text: string, marks?: AdfNode["marks"]): string {
	if (!Array.isArray(marks)) return text;
	return marks.reduce((out, mark) => {
		const formatter = mark.type ? MARK_FORMATTERS[mark.type] : undefined;
		return formatter ? formatter(out, mark.attrs) : out;
	}, text);
}

function renderHeading(node: AdfNode): string {
	const level = Number(node.attrs?.level ?? 1);
	return `${"#".repeat(level)} ${getContent(node)}\n\n`;
}

function renderListItem(node: AdfNode): string {
	return `- ${getContent(node).trim()}\n`;
}

const NODE_RENDERERS: Record<string, (node: AdfNode) => string> = {
	paragraph: (node) => `${getContent(node)}\n\n`,
	text: (node) => applyMarks(String(node.text ?? ""), node.marks),
	heading: renderHeading,
	bulletList: getContent,
	orderedList: getContent,
	listItem: renderListItem,
	hardBreak: () => "\n",
};

function renderNode(node: AdfNode): string {
	const renderer = node.type ? NODE_RENDERERS[node.type] : undefined;
	return renderer ? renderer(node) : getContent(node);
}

/**
 * Format a Jira Atlassian Document Format (ADF) node as plain-ish markdown.
 */
export function adfToMarkdown(node: unknown): string {
	if (node === null || node === undefined) return "";
	if (typeof node === "string") return node;
	if (typeof node !== "object") return String(node);
	if (Array.isArray(node)) return node.map(adfToMarkdown).join("");
	if (!isAdfNode(node)) return "";
	return renderNode(node);
}

/**
 * Convert a Jira issue field value to a readable string.
 */
export function fieldToString(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean")
		return String(value);
	if (Array.isArray(value)) {
		return value.map(fieldToString).filter(Boolean).join(", ");
	}
	if (typeof value === "object") {
		const obj = value as Record<string, unknown>;
		if (obj.displayName) return String(obj.displayName);
		if (obj.name) return String(obj.name);
		if (obj.value) return String(obj.value);
		if (typeof obj.content === "object" && obj.content !== null) {
			return adfToMarkdown(obj);
		}
		return JSON.stringify(value);
	}
	return String(value);
}
