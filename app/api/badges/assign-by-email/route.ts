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
		const { badgeId, email, companyId } = body;

		console.log("=== BADGE ASSIGNMENT BY EMAIL REQUEST ===");
		console.log("Badge ID:", badgeId);
		console.log("Email:", email);
		console.log("Company ID:", companyId);

		if (!badgeId || !email || !companyId) {
			const missing = [];
			if (!badgeId) missing.push("badgeId");
			if (!email) missing.push("email");
			if (!companyId) missing.push("companyId");
			return NextResponse.json(
				{ 
					error: `Missing required fields: ${missing.join(", ")}`,
					received: { badgeId, email, companyId }
				},
				{ status: 400 },
			);
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return NextResponse.json(
				{ error: "Invalid email format" },
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

		// Find user by email - try multiple approaches
		let targetUser: any = null;
		let targetUserId: string | null = null;

		console.log("=== STARTING USER SEARCH BY EMAIL ===");
		console.log("Email to search:", email);
		console.log("Company ID:", companyId);
		console.log("Available SDK methods:");
		console.log("- whopsdk.users exists:", typeof (whopsdk as any).users);
		console.log("- whopsdk.users.search exists:", typeof (whopsdk as any).users?.search);
		console.log("- whopsdk.users.list exists:", typeof (whopsdk as any).users?.list);
		console.log("- whopsdk.subscriptions exists:", typeof (whopsdk as any).subscriptions);
		console.log("- whopsdk.subscriptions.list exists:", typeof (whopsdk as any).subscriptions?.list);

		try {
			// Method 0: Try users.search or users.retrieveByEmail if available (with email permission)
			if (typeof (whopsdk as any).users?.search === 'function') {
				console.log("✅ users.search is a function - trying it...");
				console.log("Trying users.search with email:", email);
				try {
					const searchResult = await (whopsdk as any).users.search({ email, company_id: companyId });
					const searchUsers = Array.isArray(searchResult) ? searchResult : (searchResult?.data || searchResult?.users || []);
					console.log(`Found ${searchUsers.length} users via users.search`);
					if (searchUsers.length > 0) {
						targetUser = searchUsers[0];
						targetUserId = targetUser.id || targetUser.user_id || targetUser.userId;
						console.log("Found user via users.search:", targetUserId);
					}
				} catch (searchErr: any) {
					console.log("❌ users.search failed:", searchErr?.message || searchErr);
				}
			} else {
				console.log("⚠️ users.search is not a function");
			}

			// Method 0.5: Try to list all users with email access
			if (!targetUser && typeof (whopsdk as any).users?.list === 'function') {
				console.log("✅ users.list is a function - trying it to find by email...");
				try {
					const usersResult = await (whopsdk as any).users.list({ company_id: companyId });
					const users = Array.isArray(usersResult) ? usersResult : (usersResult?.data || usersResult?.users || []);
					console.log(`Found ${users.length} users via users.list`);
					
					for (const user of users) {
						const userEmail = user.email || user.email_address || user.emailAddress;
						if (userEmail && userEmail.toLowerCase() === email.toLowerCase()) {
							targetUser = user;
							targetUserId = user.id || user.user_id || user.userId;
							console.log("Found user via users.list:", targetUserId);
							break;
						}
					}
				} catch (listErr: any) {
					console.log("❌ users.list search failed:", listErr?.message || listErr);
				}
			} else {
				console.log("⚠️ users.list is not a function or user already found");
			}

			// Method 1: Try subscriptions API to find user by email
			if (!targetUser && typeof (whopsdk as any).subscriptions?.list === 'function') {
				console.log("✅ subscriptions.list is a function - searching subscriptions for email:", email);
				const subscriptions = await (whopsdk as any).subscriptions.list({
					company_id: companyId,
					status: 'active'
				});
				
				const subs = Array.isArray(subscriptions) ? subscriptions : (subscriptions?.data || []);
				console.log(`Found ${subs.length} active subscriptions`);
				
				for (const sub of subs) {
					const subUser = sub.user || sub.user_id || sub.userId;
					if (subUser && typeof subUser === 'object') {
						if (subUser.email?.toLowerCase() === email.toLowerCase() || 
						    subUser.email_address?.toLowerCase() === email.toLowerCase()) {
							targetUser = subUser;
							targetUserId = subUser.id || subUser.user_id || subUser.userId;
							console.log("Found user via subscription:", targetUserId);
							break;
						}
					}
					
					// Also check if subscription has email directly
					if (sub.email?.toLowerCase() === email.toLowerCase()) {
						const userId = sub.user_id || sub.userId || sub.user?.id;
						if (userId) {
							try {
								targetUser = await whopsdk.users.retrieve(userId);
								targetUserId = userId;
								console.log("Found user via subscription email field:", targetUserId);
								break;
							} catch (err) {
								console.warn("Failed to retrieve user from subscription:", err);
							}
						}
					}
				}
			} else {
				console.log("⚠️ subscriptions.list is not a function or user already found");
			}

			// Method 3: Try fetching members from products
			if (!targetUser) {
				console.log("Trying product members search...");
				try {
					const company = await (whopsdk as any).companies.retrieve(companyId);
					if (company?.products && Array.isArray(company.products)) {
						for (const product of company.products) {
							const productId = product.id || product.product_id;
							if (productId && typeof (whopsdk as any).products?.listMembers === 'function') {
								try {
									const members = await (whopsdk as any).products.listMembers(productId);
									const memberList = Array.isArray(members) ? members : (members?.data || []);
									
									for (const member of memberList) {
										const memberUser = member.user || member;
										if (memberUser?.email?.toLowerCase() === email.toLowerCase()) {
											targetUser = memberUser;
											targetUserId = memberUser.id || memberUser.user_id || memberUser.userId;
											console.log("Found user via product members:", targetUserId);
											break;
										}
									}
									if (targetUser) break;
								} catch (err) {
									console.warn(`Failed to get members for product ${productId}:`, err);
								}
							}
						}
					}
				} catch (err) {
					console.warn("Failed to search via products:", err);
				}
			}
		} catch (error) {
			console.error("Error searching for user by email:", error);
		}

		console.log(`User search result: targetUser=${!!targetUser}, targetUserId=${targetUserId}`);

		if (!targetUser || !targetUserId) {
			console.log("User not found after all search methods");
			return NextResponse.json(
				{ 
					error: "User not found with the provided email in this company",
					email: email,
					suggestion: "The user may need to have an active subscription or membership in this company. Make sure the email is associated with a Whop account that is a member of this company. Try using the 'Assign to User' option instead if the user is already visible in the user list."
				},
				{ status: 404 },
			);
		}

		// targetUserId should be set from the search above
		if (!targetUserId || !targetUser) {
			return NextResponse.json(
				{ error: "User found but no valid user ID" },
				{ status: 500 },
			);
		}

		// Verify the badge exists and belongs to the company
		const badge = badgeService.getById(badgeId.trim());
		if (!badge) {
			return NextResponse.json(
				{ 
					error: "Badge not found",
					badgeId: badgeId
				},
				{ status: 404 },
			);
		}

		if (badge.companyId !== companyId) {
			return NextResponse.json(
				{ 
					error: "Badge does not belong to this company",
					badgeCompanyId: badge.companyId,
					requestedCompanyId: companyId
				},
				{ status: 403 },
			);
		}

		// Track the target user's access
		badgeService.trackUserAccess(companyId, targetUserId);
		badgeService.trackUserAccess(companyId, userId);

		// Assign the badge
		const assignment = badgeService.assign(
			badgeId,
			targetUserId,
			companyId,
			userId,
		);

		console.log(`Successfully assigned badge ${badgeId} to user ${targetUserId} (${email})`);
		return NextResponse.json({ 
			assignment,
			user: {
				id: targetUserId,
				email: email,
				name: targetUser.name || targetUser.username
			}
		}, { status: 201 });
	} catch (error) {
		console.error("Error assigning badge by email:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to assign badge by email";
		return NextResponse.json(
			{ 
				error: errorMessage,
				details: String(error)
			},
			{ status: 500 },
		);
	}
}

