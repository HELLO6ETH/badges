import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { whopsdk } from "@/lib/whop-sdk";
import { badgeService } from "@/lib/badges";

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
		const { badgeId, targetUserId, companyId } = body;
		
		console.log("=== BADGE ASSIGNMENT REQUEST ===");
		console.log("Badge ID:", badgeId);
		console.log("Target User ID:", targetUserId);
		console.log("Company ID:", companyId);
		console.log("Company ID type:", typeof companyId);
		console.log("Company ID from env:", process.env.COMPANY_ID);
		console.log("Company IDs match:", companyId === process.env.COMPANY_ID);
		console.log("Requesting User ID:", userId);

		if (!badgeId || !targetUserId || !companyId) {
			const missing = [];
			if (!badgeId) missing.push("badgeId");
			if (!targetUserId) missing.push("targetUserId");
			if (!companyId) missing.push("companyId");
			console.error("Missing required fields:", missing);
			return NextResponse.json(
				{ 
					error: `Missing required fields: ${missing.join(", ")}`,
					received: { badgeId, targetUserId, companyId }
				},
				{ status: 400 },
			);
		}

		// Verify user has access to this company and is an admin
		const access = await whopsdk.users.checkAccess(companyId, { id: userId });
		if (access.access_level !== "admin") {
			return NextResponse.json(
				{ 
					error: "Admin access required to assign badges",
					accessLevel: access.access_level
				},
				{ status: 403 },
			);
		}

		// Track both users' access
		badgeService.trackUserAccess(companyId, userId);
		badgeService.trackUserAccess(companyId, targetUserId);

		// Trim and validate badge ID
		const trimmedBadgeId = badgeId?.trim();
		if (!trimmedBadgeId) {
			return NextResponse.json({ 
				error: "Badge ID is required and cannot be empty",
			}, { status: 400 });
		}
		
		// Get ALL badges first (regardless of company) for debugging
		const allBadgesInStore = badgeService.getAllBadges();
		console.log(`=== BADGE LOOKUP DEBUG ===`);
		console.log(`Total badges in entire store: ${allBadgesInStore.length}`);
		console.log("All badges in store:", allBadgesInStore.map(b => ({ 
			id: b.id, 
			companyId: b.companyId, 
			name: b.name 
		})));
		
		// Get all badges for this company first to debug
		const allCompanyBadges = badgeService.getByCompany(companyId);
		console.log(`Total badges for company ${companyId}: ${allCompanyBadges.length}`);
		console.log("Company badge IDs:", allCompanyBadges.map(b => b.id));
		console.log("Requested badge ID:", trimmedBadgeId);
		console.log("Requested company ID:", companyId);
		console.log("Badge ID length:", trimmedBadgeId.length);
		console.log("Badge ID type:", typeof trimmedBadgeId);
		
		// Check if badge exists anywhere in the store
		const badgeInAnyCompany = allBadgesInStore.find(b => b.id === trimmedBadgeId);
		if (badgeInAnyCompany) {
			console.log(`⚠️ Badge found but in different company!`);
			console.log(`Badge company ID: ${badgeInAnyCompany.companyId}`);
			console.log(`Requested company ID: ${companyId}`);
			console.log(`Company IDs match: ${badgeInAnyCompany.companyId === companyId}`);
		}
		
		// Try exact match first
		let badge = badgeService.getById(trimmedBadgeId);
		
		// If not found, try to find by matching any company badge ID
		if (!badge) {
			console.log("Exact match failed, checking company badges...");
			const matchingBadge = allCompanyBadges.find(b => b.id === trimmedBadgeId);
			if (matchingBadge) {
				console.log("Found badge in company list!");
				badge = matchingBadge;
			}
		}
		
		// If still not found, check for similar IDs (in case of whitespace/encoding issues)
		if (!badge) {
			console.log("Checking for similar badge IDs...");
			const similarBadge = allCompanyBadges.find(b => {
				const normalized = (str: string) => str.trim().replace(/\s+/g, '');
				return normalized(b.id) === normalized(trimmedBadgeId);
			});
			if (similarBadge) {
				console.log("Found badge with similar ID!");
				badge = similarBadge;
			}
		}
		
		console.log("Badge found:", !!badge);
		
		if (!badge) {
			console.error(`❌ Badge not found in store!`);
			console.error(`Requested badge ID: "${trimmedBadgeId}"`);
			console.error(`Requested company ID: "${companyId}"`);
			console.error(`Requested badge ID (hex):`, [...trimmedBadgeId].map((c) => c.charCodeAt(0).toString(16)).join(' '));
			console.error(`Total badges in store: ${allBadgesInStore.length}`);
			console.error(`Company badges available: ${allCompanyBadges.length}`);
			console.error(`Available badge IDs for company:`, allCompanyBadges.map(b => `"${b.id}"`));
			console.error(`Available badge IDs (hex):`, allCompanyBadges.map(b => [...b.id].map((c) => c.charCodeAt(0).toString(16)).join(' ')));
			console.error(`Exact match in company:`, allCompanyBadges.some(b => b.id === trimmedBadgeId));
			console.error(`Normalized match in company:`, allCompanyBadges.some(b => b.id.trim() === trimmedBadgeId.trim()));
			console.error(`Exists anywhere in store:`, allBadgesInStore.some(b => b.id === trimmedBadgeId));
			if (badgeInAnyCompany) {
				console.error(`Badge exists but for company: ${badgeInAnyCompany.companyId} (requested: ${companyId})`);
			}
			
			const availableBadgesInfo = allCompanyBadges.map(b => ({
				id: b.id,
				name: b.name,
				emoji: b.emoji
			}));
			
			return NextResponse.json({ 
				error: "Badge not found",
				badgeId: trimmedBadgeId,
				availableBadges: availableBadgesInfo,
				message: `Badge with ID "${trimmedBadgeId.substring(0, 20)}..." was not found. Available badges: ${availableBadgesInfo.length}`
			}, { status: 404 });
		}
		
		console.log(`✅ Badge found: ${badge.name} (ID: ${badge.id})`);

		// Verify badge belongs to the company
		if (badge.companyId !== companyId) {
			console.error(`Badge ${badgeId} does not belong to company ${companyId}`);
			return NextResponse.json({ 
				error: "Badge does not belong to this company",
				badgeCompanyId: badge.companyId,
				requestedCompanyId: companyId
			}, { status: 403 });
		}

		const assignment = badgeService.assign(
			badgeId,
			targetUserId,
			companyId,
			userId,
		);

		console.log(`Successfully assigned badge ${badgeId} to user ${targetUserId}`);
		return NextResponse.json({ assignment }, { status: 201 });
	} catch (error) {
		console.error("Error assigning badge:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to assign badge";
		return NextResponse.json(
			{ 
				error: errorMessage,
				details: String(error)
			},
			{ status: 500 },
		);
	}
}

export async function DELETE(request: NextRequest) {
	try {
		const { userId } = await whopsdk.verifyUserToken(await headers());
		const { searchParams } = new URL(request.url);
		const badgeId = searchParams.get("badgeId");
		const targetUserId = searchParams.get("targetUserId");
		const companyId = searchParams.get("companyId");

		if (!badgeId || !targetUserId || !companyId) {
			return NextResponse.json(
				{ error: "Missing required query params: badgeId, targetUserId, companyId" },
				{ status: 400 },
			);
		}

		// Verify user has access to this company and is an admin
		const access = await whopsdk.users.checkAccess(companyId, { id: userId });
		if (access.access_level !== "admin") {
			return NextResponse.json(
				{ 
					error: "Admin access required to unassign badges",
					accessLevel: access.access_level
				},
				{ status: 403 },
			);
		}

		const unassigned = badgeService.unassign(badgeId, targetUserId, companyId);
		if (!unassigned) {
			return NextResponse.json(
				{ error: "Assignment not found" },
				{ status: 404 },
			);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error unassigning badge:", error);
		return NextResponse.json(
			{ error: "Failed to unassign badge" },
			{ status: 500 },
		);
	}
}
