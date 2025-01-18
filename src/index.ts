/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import {
	S3Client,
	PutObjectCommand,
	S3ClientConfig
} from '@aws-sdk/client-s3';

interface Env {
	MATCH_AUTH_MAPPINGS: KVNamespace;

	S3_ACCESS_KEY: string;
	S3_SECRET_KEY: string;
	S3_ENDPOINT: string;
	BUCKET_NAME: string;
	LINKSHARE_PREFIX: string;
}

async function update_state(request: Request, env: Env) {
	if (request.headers.get('Content-Type') !== 'application/json')
		return new Response('Unsupported Content-Type. ', { status: 415, headers: { 'Allow': 'application/json' } });

	let body: object;
	let match_id: string;
	try {
		body = await request.json();
		match_id = body['match'];
	} catch (err) {
		return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
	}

	const authHeader = request.headers.get('Authorization');
	if (!authHeader)
		return Response.json({ error: 'Missing Authorization header.' }, { status: 401 });

	const tournament_id = await env.MATCH_AUTH_MAPPINGS.get(authHeader);
	if (tournament_id == null)
		return Response.json({ error: 'Invalid Authorization header.' }, { status: 401 });

	// await env.MATCH_STATES.put(`${tournament_id}/${match_id}`, JSON.stringify(body));
	const success = await upload_file_s3(`${tournament_id}/${match_id}`, body, env);

	return new Response(null, { status: success ? 201 : 500 });
}

async function upload_file_s3(key: string, content: object, env:Env) {
// const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3"); // CommonJS import
	const config: S3ClientConfig = {
		credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
		endpoint: env.S3_ENDPOINT,
		region: 'us-east-1'
	};
	// noinspection TypeScriptValidateTypes
	const client = new S3Client(config);
	const command = new PutObjectCommand({
		"Body": JSON.stringify(content),
		"Bucket": env.BUCKET_NAME,
		"Key": key
	});
	try {
		// noinspection TypeScriptValidateTypes
		await client.send(command);
	} catch (err) {
		console.error(`failed uploading object: ${err}`);
		return false;
	}

	return true;
}

export default {
	async fetch(request, env, ..._): Promise<Response> {
		try {
			if (request.method === 'POST')
				return await update_state(request, env);

			if (request.method === 'GET') {
				const url = new URL(request.url);
				const key = url.pathname.slice(1); // Remove leading slash

				if (key == null || key === '')
					return Response.json({ 'error': 'Invalid path.' }, { status: 400 });

				const target = new URL(key, env.LINKSHARE_PREFIX.endsWith('/') ? env.LINKSHARE_PREFIX : env.LINKSHARE_PREFIX + '/');
				target.searchParams.set('download', '1');
				return Response.redirect(target.toString(), 302);
			}

			return Response.json({ 'error': 'Unsupported method.' }, { status: 405 });
		} catch (err) {
			// In a production application, you could instead choose to retry your KV
			// read or fall back to a default code path.
			console.error(`KV returned error: ${err}`);
			return Response.json({ 'error': err.toString() }, { status: 500 });
		}
	}
} satisfies ExportedHandler<Env>;
