import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { whopsdk } from "@/lib/whop-sdk";
import { badgeService } from "@/lib/badges";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ badgeId: string }> },
) {
	try {
		const { userId } = await whopsdk.verifyUserToken(await headers());
		const { badgeId } = await params;

		const badge = badgeService.getById(badgeId);
		if (!badge) {
			return NextResponse.json({ error: "Badge not found" }, { status: 404 });
		}

		// Verify user has access to this company
		await whopsdk.users.checkAccess(badge.companyId, { id: userId });

		return NextResponse.json({ badge });
	} catch (error) {
		console.error("Error fetching badge:", error);
		return NextResponse.json(
			{ error: "Failed to fetch badge" },
			{ status: 500 },
		);
	}
}

export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ badgeId: string }> },
) {
	try {
		const { userId } = await whopsdk.verifyUserToken(await headers());
		const { badgeId } = await params;
		const body = await request.json();

		console.log("=== UPDATE BADGE REQUEST ===");
		console.log("Badge ID:", badgeId);
		console.log("Update data:", body);

		const badge = badgeService.getById(badgeId);
		if (!badge) {
			console.error("Badge not found:", badgeId);
			return NextResponse.json({ error: "Badge not found" }, { status: 404 });
		}

		console.log("Badge found:", { id: badge.id, name: badge.name, companyId: badge.companyId });

		// Verify user has access to this company and is an admin
		const access = await whopsdk.users.checkAccess(badge.companyId, { id: userId });
		if (access.access_level !== "admin") {
			return NextResponse.json(
				{ 
					error: "Admin access required to update badges",
					accessLevel: access.access_level
				},
				{ status: 403 },
			);
		}

		const updated = badgeService.update(badgeId, body);
		if (!updated) {
			console.error("Failed to update badge in store");
			return NextResponse.json(
				{ error: "Failed to update badge" },
				{ status: 500 },
			);
		}

		console.log("Badge updated successfully:", {
			id: updated.id,
			name: updated.name,
			emoji: updated.emoji,
			color: updated.color,
			companyId: updated.companyId
		});

		// Verify the update persisted
		const verifyBadge = badgeService.getById(badgeId);
		if (!verifyBadge) {
			console.error("CRITICAL: Badge was updated but not found after update!");
		} else {
			console.log("Verified badge in store:", verifyBadge);
		}

		return NextResponse.json({ badge: updated });
	} catch (error) {
		console.error("Error updating badge:", error);
		return NextResponse.json(
			{ error: "Failed to update badge" },
			{ status: 500 },
		);
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ badgeId: string }> },
) {
	try {
		const { userId } = await whopsdk.verifyUserToken(await headers());
		const { badgeId } = await params;

		const badge = badgeService.getById(badgeId);
		if (!badge) {
			return NextResponse.json({ error: "Badge not found" }, { status: 404 });
		}

		// Verify user has access to this company and is an admin
		const access = await whopsdk.users.checkAccess(badge.companyId, { id: userId });
		if (access.access_level !== "admin") {
			return NextResponse.json(
				{ 
					error: "Admin access required to delete badges",
					accessLevel: access.access_level
				},
				{ status: 403 },
			);
		}

		const deleted = badgeService.delete(badgeId);
		if (!deleted) {
			return NextResponse.json(
				{ error: "Failed to delete badge" },
				{ status: 500 },
			);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error deleting badge:", error);
		return NextResponse.json(
			{ error: "Failed to delete badge" },
			{ status: 500 },
		);
	}
}
