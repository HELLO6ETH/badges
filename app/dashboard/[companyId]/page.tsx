import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage({
	params,
}: {
	params: Promise<{ companyId: string }>;
}) {
	const { companyId } = await params;
	const { userId } = await whopsdk.verifyUserToken(await headers());

	// Verify access
	await whopsdk.users.checkAccess(companyId, { id: userId });

	return <DashboardClient companyId={companyId} />;
}