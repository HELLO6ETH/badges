import { Whop } from "@whop/sdk";

if (!process.env.WHOP_API_KEY) {
	console.warn(
		"⚠️  WHOP_API_KEY is not set. Make sure to create a .env.local file with your Whop credentials.",
	);
}

if (!process.env.NEXT_PUBLIC_WHOP_APP_ID) {
	console.warn(
		"⚠️  NEXT_PUBLIC_WHOP_APP_ID is not set. Make sure to create a .env.local file with your Whop app ID.",
	);
}

export const whopsdk = new Whop({
	appID: process.env.NEXT_PUBLIC_WHOP_APP_ID,
	apiKey: process.env.WHOP_API_KEY,
	webhookKey: btoa(process.env.WHOP_WEBHOOK_SECRET || ""),
});
