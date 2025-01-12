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
	// ... other binding types
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		try {
			// await env.MATCH_STATES.put("1", JSON.stringify({"hi": "gm"}));
			await env.MATCH_STATES.put("1", "not a json lol");
			const value = await env.MATCH_STATES.get("1");
			if (value === null) {
				return Response.json({"error": "value not found"}, { status: 404 });
			}
			return Response.json(JSON.parse(value));
		} catch (err) {
			// In a production application, you could instead choose to retry your KV
			// read or fall back to a default code path.
			console.error(`KV returned error: ${err}`);
			return Response.json({"error": err.toString()}, { status: 500 });
		}
	},
} satisfies ExportedHandler<Env>;
