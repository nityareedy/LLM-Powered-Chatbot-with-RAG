export { WorkersAIDurableObject } from "~/durable";
import { handler } from "~/connect";

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const { pathname } = new URL(request.url);
		if (request.method === "GET" && pathname === "/websocket") {
			const upgradeHeader = request.headers.get("Upgrade");
			if (upgradeHeader !== "websocket") {
				return new Response("Expected Upgrade: websocket", {
					status: 400,
				});
			}
			const id: DurableObjectId =
				env.WORKERS_AI_DURABLE_OBJECT.idFromName("foo");
			const stub = env.WORKERS_AI_DURABLE_OBJECT.get(id);
			return stub.fetch(request);
		}
		const origin = request.headers.get("Origin");
		if (request.method === "OPTIONS" && origin) {
			return new Response(null, {
				headers: {
					"Access-Control-Allow-Origin": origin ?? "*",
					"Access-Control-Allow-Methods": "GET, POST",
					"Access-Control-Allow-Headers": "*",
					"Access-Control-Max-Age": "86400",
				},
			});
		}
		const response = await handler.fetch(request, env, ctx);
		const corsHeaders = new Headers(response.headers);
		corsHeaders.set("Access-Control-Allow-Origin", origin ?? "*");
		return new Response(response.body, {
			headers: corsHeaders,
			status: response.status,
			statusText: response.statusText,
		});
	},
} satisfies ExportedHandler<Env>;
