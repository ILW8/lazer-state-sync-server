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

interface Env {
	MATCH_STATES: KVNamespace;
	MATCH_AUTH_MAPPINGS: KVNamespace;
	// ... other binding types
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

	await env.MATCH_STATES.put(`${tournament_id}/${match_id}`, JSON.stringify(body));

	return new Response(null, { status: 201 });
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

				const value = await env.MATCH_STATES.get(key);
				if (value == null)
					return Response.json({ 'error': `Match \'${key}\' not found` }, { status: 404 });

				return Response.json(JSON.parse(value));
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
