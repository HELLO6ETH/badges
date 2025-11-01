import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { whopsdk } from "@/lib/whop-sdk";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ userId: string }> },
) {
	try {
		const { userId } = await params;
		const { searchParams } = new URL(request.url);
		const companyId = searchParams.get("companyId");

		if (!companyId) {
			return NextResponse.json(
				{ error: "companyId is required" },
				{ status: 400 },
			);
		}

		const { userId: currentUserId } = await whopsdk.verifyUserToken(await headers());

		// Verify the user in params matches the authenticated user
		if (userId !== currentUserId) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 403 },
			);
		}

		const access = await whopsdk.users.checkAccess(
			companyId,
			{ id: currentUserId },
		);

		const isAdmin = access.access_level === "admin";

		return NextResponse.json({ isAdmin, accessLevel: access.access_level });
	} catch (error) {
		console.error("Error checking admin status:", error);
		return NextResponse.json(
			{ error: "Failed to check admin status", isAdmin: false },
			{ status: 500 },
		);
	}
}

