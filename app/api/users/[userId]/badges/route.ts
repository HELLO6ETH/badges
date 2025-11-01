import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { whopsdk } from "@/lib/whop-sdk";
import { badgeService } from "@/lib/badges";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ userId: string }> },
) {
	try {
		const { userId: currentUserId } = await whopsdk.verifyUserToken(await headers());
		const { userId } = await params;
		const { searchParams } = new URL(request.url);
		const companyId = searchParams.get("companyId");

		if (!companyId) {
			return NextResponse.json(
				{ error: "companyId is required" },
				{ status: 400 },
			);
		}

		// Verify user has access to this company
		await whopsdk.users.checkAccess(companyId, { id: currentUserId });

		// Track both users' access
		badgeService.trackUserAccess(companyId, currentUserId);
		badgeService.trackUserAccess(companyId, userId);

		const badges = badgeService.getUserBadges(userId, companyId);
		return NextResponse.json({ badges });
	} catch (error) {
		console.error("Error fetching user badges:", error);
		return NextResponse.json(
			{ error: "Failed to fetch user badges" },
			{ status: 500 },
		);
	}
}
