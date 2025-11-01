import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { whopsdk } from "@/lib/whop-sdk";
import { badgeService, type Badge } from "@/lib/badges";

export async function GET(request: NextRequest) {
	try {
		const { userId } = await whopsdk.verifyUserToken(await headers());
		const { searchParams } = new URL(request.url);
		const companyId = searchParams.get("companyId");

		if (!companyId) {
			return NextResponse.json(
				{ error: "companyId is required" },
				{ status: 400 },
			);
		}

		// Verify user has access to this company
		await whopsdk.users.checkAccess(companyId, { id: userId });

		// Track this user's access
		badgeService.trackUserAccess(companyId, userId);

		const badges = badgeService.getByCompany(companyId);
		
		// Debug: Log all badges in store
		const allBadges = badgeService.getAllBadges();
		console.log(`=== GET BADGES DEBUG ===`);
		console.log(`Company ID: ${companyId}`);
		console.log(`Total badges in store: ${allBadges.length}`);
		console.log(`Badges for this company: ${badges.length}`);
		console.log(`All badge IDs in store:`, allBadges.map(b => ({ id: b.id, companyId: b.companyId, name: b.name })));
		console.log(`Company badge IDs:`, badges.map(b => b.id));
		
		return NextResponse.json({ badges });
	} catch (error) {
		console.error("Error fetching badges:", error);
		return NextResponse.json(
			{ error: "Failed to fetch badges" },
			{ status: 500 },
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		const { userId } = await whopsdk.verifyUserToken(await headers());
		let body;
		try {
			body = await request.json();
		} catch (parseError) {
			console.error("Failed to parse request body:", parseError);
			return NextResponse.json(
				{ error: "Invalid JSON in request body" },
				{ status: 400 },
			);
		}
		const { companyId, name, emoji, color, description } = body;

		console.log("=== CREATE BADGE DEBUG ===");
		console.log("Received companyId:", companyId);
		console.log("CompanyId type:", typeof companyId);
		console.log("CompanyId length:", companyId?.length);
		console.log("CompanyId from env:", process.env.COMPANY_ID);
		console.log("CompanyIds match:", companyId === process.env.COMPANY_ID);

		// Check for missing or empty fields
		const missingFields: string[] = [];
		if (!companyId || typeof companyId !== "string" || companyId.trim() === "") {
			missingFields.push("companyId");
		}
		if (!name || typeof name !== "string" || name.trim() === "") {
			missingFields.push("name");
		}
		if (!emoji || typeof emoji !== "string" || emoji.trim() === "") {
			missingFields.push("emoji");
		}
		if (!color || typeof color !== "string" || color.trim() === "") {
			missingFields.push("color");
		}

		if (missingFields.length > 0) {
			return NextResponse.json(
				{ 
					error: `Missing required fields: ${missingFields.join(", ")}`,
					received: { companyId, name, emoji, color, description }
				},
				{ status: 400 },
			);
		}

		// Verify user has access to this company and is an admin
		try {
			const access = await whopsdk.users.checkAccess(companyId, { id: userId });
			if (access.access_level !== "admin") {
				return NextResponse.json(
					{ 
						error: "Admin access required to create badges",
						accessLevel: access.access_level
					},
					{ status: 403 },
				);
			}
		} catch (accessError) {
			console.error("Access check failed:", accessError);
			console.error("Attempted to check access for:", { companyId, userId });
			
			// Provide more helpful error message
			const errorMessage = accessError instanceof Error ? accessError.message : String(accessError);
			
			return NextResponse.json(
				{ 
					error: "You don't have access to this company",
					details: errorMessage,
					companyId: companyId,
					suggestion: companyId ? "Make sure you have the correct company ID and that you're authorized to manage badges for this company." : "Company ID appears to be empty. Please refresh the page and try again."
				},
				{ status: 403 },
			);
		}

		let badge;
		try {
			badge = badgeService.create({
				companyId,
				name,
				emoji,
				color,
				description: description || "",
				createdBy: userId,
			});
			console.log("✅ Badge created successfully:", {
				id: badge.id,
				name: badge.name,
				companyId: badge.companyId,
				order: badge.order
			});
			
			// Verify badge was stored
			const storedBadge = badgeService.getById(badge.id);
			if (!storedBadge) {
				console.error("❌ CRITICAL: Badge was created but not found in store!");
			} else {
				console.log("✅ Badge confirmed in store");
			}
			
			// Verify badge appears in company list
			const companyBadges = badgeService.getByCompany(companyId);
			console.log(`Badges for company ${companyId}: ${companyBadges.length} total`);
			console.log("Company badge IDs:", companyBadges.map(b => b.id));
		} catch (createError) {
			console.error("Badge creation failed:", createError);
			return NextResponse.json(
				{ 
					error: "Failed to create badge",
					details: createError instanceof Error ? createError.message : String(createError)
				},
				{ status: 500 },
			);
		}

		return NextResponse.json({ badge }, { status: 201 });
	} catch (error) {
		console.error("Error creating badge:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to create badge";
		return NextResponse.json(
			{ error: errorMessage, details: String(error) },
			{ status: 500 },
		);
	}
}

export async function PATCH(request: NextRequest) {
	try {
		const { userId } = await whopsdk.verifyUserToken(await headers());
		const body = await request.json();
		const { companyId, badgeIds } = body;

		if (!companyId || !badgeIds || !Array.isArray(badgeIds)) {
			return NextResponse.json(
				{ error: "Missing required fields: companyId, badgeIds (array)" },
				{ status: 400 },
			);
		}

		// Verify user has access to this company and is an admin
		const access = await whopsdk.users.checkAccess(companyId, { id: userId });
		if (access.access_level !== "admin") {
			return NextResponse.json(
				{ 
					error: "Admin access required to update badge order",
					accessLevel: access.access_level
				},
				{ status: 403 },
			);
		}

		// Verify all badges belong to this company
		const badges = badgeService.getByCompany(companyId);
		const badgeIdsInCompany = new Set(badges.map(b => b.id));
		const invalidBadgeIds = badgeIds.filter((id: string) => !badgeIdsInCompany.has(id));
		if (invalidBadgeIds.length > 0) {
			return NextResponse.json(
				{ error: `Invalid badge IDs: ${invalidBadgeIds.join(", ")}` },
				{ status: 400 },
			);
		}

		const success = badgeService.updateOrder(badgeIds);
		if (!success) {
			return NextResponse.json(
				{ error: "Failed to update badge order" },
				{ status: 500 },
			);
		}

		// Return updated badges in new order
		const updatedBadges = badgeService.getByCompany(companyId);
		return NextResponse.json({ badges: updatedBadges });
	} catch (error) {
		console.error("Error updating badge order:", error);
		return NextResponse.json(
			{ error: "Failed to update badge order" },
			{ status: 500 },
		);
	}
}
