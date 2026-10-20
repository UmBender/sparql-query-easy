/**
 * QUAL-012: runtime schemas for request and response bodies, built with Zod
 * from the OpenAPI snapshot that `schema.d.ts` is generated from (so both
 * check the same contract). Used to check that the legacy fixtures still have
 * the shapes the API documents.
 */
import { z } from 'zod';
import snapshot from '#lib/api/openapi.json';
import type { LegacyFixture } from './fixtures.js';

type SchemaObject = Record<string, unknown>;
type Operation = {
	requestBody?: { content: Record<string, { schema: SchemaObject }> };
	responses: Record<string, { content?: Record<string, { schema: SchemaObject }> }>;
};
const paths = snapshot.paths as unknown as Record<string, Record<string, Operation>>;
const definitions = snapshot.components.schemas;

/** JSON Schema refs point at `$defs`, which Zod resolves; OpenAPI's point at components. */
function toZod(schema: SchemaObject): z.ZodType {
	const document = JSON.stringify({ ...schema, $defs: definitions });
	return z.fromJSONSchema(JSON.parse(document.replaceAll('#/components/schemas/', '#/$defs/')));
}

/** The documented operation for a concrete path, matching `{param}` templates. */
export function operationFor(method: string, path: string): Operation | undefined {
	const verb = method.toLowerCase();
	if (paths[path]?.[verb]) return paths[path][verb];
	const template = Object.keys(paths).find((candidate) =>
		new RegExp(`^${candidate.replace(/\{[^}]+\}/g, '[^/]+')}$`).test(path)
	);
	return template ? paths[template][verb] : undefined;
}

export function requestSchema(method: string, path: string): z.ZodType | undefined {
	const schema = operationFor(method, path)?.requestBody?.content['application/json']?.schema;
	return schema && toZod(schema);
}

export function responseSchema(
	method: string,
	path: string,
	status: number
): z.ZodType | undefined {
	const schema = operationFor(method, path)?.responses[String(status)]?.content?.[
		'application/json'
	]?.schema;
	return schema && toZod(schema);
}

type Issue = { path: PropertyKey[]; message: string };
type ZodIssue = z.core.$ZodIssue;

/**
 * A union (nullable or enum) failure names its deepest branch: `where.0.filterType`
 * rather than `where`; an enum lists its values.
 */
function leaves(issue: ZodIssue, prefix: PropertyKey[]): Issue[] {
	const path = [...prefix, ...issue.path];
	if (issue.code !== 'invalid_union' || !issue.errors.length)
		return [{ path, message: issue.message }];
	const branches = issue.errors.map((branch) => branch.flatMap((inner) => leaves(inner, path)));
	const depth = (list: Issue[]) => Math.max(...list.map((item) => item.path.length));
	const deepest = branches.reduce((best, branch) =>
		depth(branch) > depth(best) ? branch : best
	);
	if (depth(deepest) > path.length) return deepest;
	const values = issue.errors
		.flat()
		.flatMap((inner) => (inner.code === 'invalid_value' ? inner.values : []));
	return [
		{
			path,
			message: values.length
				? `expected one of ${values.map(String).join(', ')}`
				: issue.message
		}
	];
}

const describeIssues = (where: string, error: z.ZodError) =>
	error.issues
		.flatMap((issue) => leaves(issue as ZodIssue, []))
		.map((issue) => `${where} ${issue.path.join('.') || '(body)'}: ${issue.message}`);

/**
 * Every place where a scenario's requests or responses leave the documented
 * shape, as `<file>[<index>] <field>: <message>`; empty when all match.
 */
export function fixtureShapeIssues(fixture: LegacyFixture): string[] {
	const issues: string[] = [];
	if (fixture.requests.length !== fixture.responses.length)
		issues.push(
			`${fixture.name}: ${fixture.requests.length} requests but ${fixture.responses.length} responses`
		);
	fixture.requests.forEach((request, index) => {
		const where = (file: string) => `${fixture.name}.${file}.json[${index}]`;
		const operation = operationFor(request.method, request.path);
		if (!operation) {
			issues.push(
				`${where('request')} ${request.method} ${request.path}: not in the OpenAPI snapshot`
			);
			return;
		}
		const content = operation.requestBody?.content ?? {};
		const multipart = (request.body as { multipart?: { name: string }[] } | null)?.multipart;
		if (multipart) {
			const declared = content['multipart/form-data']?.schema;
			const resolved =
				typeof declared?.$ref === 'string'
					? (definitions as Record<string, SchemaObject>)[declared.$ref.split('/').pop()!]
					: declared;
			const fields = Object.keys((resolved?.properties as SchemaObject | undefined) ?? {});
			for (const part of multipart)
				if (!fields.includes(part.name))
					issues.push(
						`${where('request')} ${part.name}: not a documented multipart field`
					);
		} else {
			const schema = requestSchema(request.method, request.path);
			const parsed = schema?.safeParse(request.body);
			if (parsed && !parsed.success)
				issues.push(...describeIssues(where('request'), parsed.error));
		}
		const response = fixture.responses[index];
		if (!response) return;
		const schema = responseSchema(request.method, request.path, response.status);
		if (!schema) {
			issues.push(
				`${where('response')} status ${response.status}: no documented JSON response`
			);
			return;
		}
		const parsed = schema.safeParse(response.body);
		if (!parsed.success) issues.push(...describeIssues(where('response'), parsed.error));
	});
	return issues;
}
