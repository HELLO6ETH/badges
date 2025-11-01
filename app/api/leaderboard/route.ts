import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { whopsdk } from "@/lib/whop-sdk";
import { badgeService } from "@/lib/badges";

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

		// Track this user's access to the company
		badgeService.trackUserAccess(companyId, userId);

		const usersWithBadges = badgeService.getAllUsersWithBadges(companyId);
		console.log(`Found ${usersWithBadges.length} users with badges for company ${companyId}`);
		
		const usersWithBadgesMap = new Map<string, typeof usersWithBadges[0]>();
		usersWithBadges.forEach((entry) => {
			usersWithBadgesMap.set(entry.userId, entry);
		});

		// Get all tracked users (users who have accessed this company)
		const trackedUsers = badgeService.getTrackedUsers(companyId);
		console.log(`Found ${trackedUsers.length} tracked users for company ${companyId}`);

		// Start with users who have badges, then add all tracked users
		// Always include the current user even if not tracked yet
		let allCompanyUserIds = new Set<string>([userId]);
		usersWithBadges.forEach((u) => allCompanyUserIds.add(u.userId));
		trackedUsers.forEach((trackedUserId) => {
			allCompanyUserIds.add(trackedUserId);
		});
		
		// Try ALL available methods to get company members with pagination
		const allMembers: any[] = [];
		
		try {
			// First, log what methods are available on the SDK
			console.log("=== SDK STRUCTURE DEBUG ===");
			console.log("whopsdk.companies exists:", typeof (whopsdk as any).companies);
			console.log("whopsdk.companies.members exists:", typeof (whopsdk as any).companies?.members);
			if ((whopsdk as any).companies) {
				console.log("companies object keys:", Object.keys((whopsdk as any).companies));
			}
			if ((whopsdk as any).companies?.members) {
				console.log("companies.members object keys:", Object.keys((whopsdk as any).companies.members));
			}
			console.log("========================");
			
			// Method 1: Try companies.members.list with pagination
			if (typeof (whopsdk as any).companies?.members?.list === 'function') {
				try {
					console.log("Trying companies.members.list...");
					const membersResult = await (whopsdk as any).companies.members.list(companyId);
					console.log("members.list response type:", typeof membersResult);
					console.log("members.list response:", JSON.stringify(membersResult).substring(0, 500));
					
					// Handle different response formats
					let members = [];
					if (Array.isArray(membersResult)) {
						members = membersResult;
					} else if (membersResult?.data && Array.isArray(membersResult.data)) {
						members = membersResult.data;
					} else if (membersResult?.members && Array.isArray(membersResult.members)) {
						members = membersResult.members;
					} else if (membersResult?.items && Array.isArray(membersResult.items)) {
						members = membersResult.items;
					}
					
					console.log(`Found ${members.length} members via members.list`);
					allMembers.push(...members);
					
					// Try pagination if available
					if ((membersResult?.hasMore || membersResult?.has_more) && members.length > 0) {
						let page = 2;
						let hasMore = true;
						while (hasMore && page < 20) { // Limit to 20 pages for 82 members
							try {
								const nextPage = await (whopsdk as any).companies.members.list(companyId, { page });
								let nextMembers = [];
								if (Array.isArray(nextPage)) {
									nextMembers = nextPage;
								} else if (nextPage?.data) {
									nextMembers = nextPage.data;
								} else if (nextPage?.items) {
									nextMembers = nextPage.items;
								}
								if (nextMembers.length > 0) {
									allMembers.push(...nextMembers);
									page++;
									hasMore = nextPage?.hasMore || nextPage?.has_more || false;
								} else {
									hasMore = false;
								}
							} catch (err) {
								console.warn(`Failed to fetch page ${page}:`, err);
								hasMore = false;
							}
						}
					}
				} catch (err: any) {
					console.warn("companies.members.list failed:", err?.message || err);
				}
			} else {
				console.log("⚠️ companies.members.list is not a function");
			}
			
			// Method 2: Try companies.listMembers
			if (typeof (whopsdk as any).companies?.listMembers === 'function') {
				try {
					console.log("Trying companies.listMembers...");
					const members = await (whopsdk as any).companies.listMembers(companyId);
					console.log("listMembers response:", JSON.stringify(members).substring(0, 500));
					if (Array.isArray(members)) {
						console.log(`Found ${members.length} members via listMembers`);
						allMembers.push(...members);
					} else if (members?.data && Array.isArray(members.data)) {
						console.log(`Found ${members.data.length} members via listMembers.data`);
						allMembers.push(...members.data);
					}
				} catch (err: any) {
					console.warn("companies.listMembers failed:", err?.message || err);
				}
			} else {
				console.log("⚠️ companies.listMembers is not a function");
			}
			
			// Method 3: Try companies.retrieve and then get members
			if (typeof (whopsdk as any).companies?.retrieve === 'function') {
				try {
					console.log("Trying companies.retrieve...");
					const company = await (whopsdk as any).companies.retrieve(companyId);
					console.log("Company member_count:", company?.member_count);
					console.log("Company object keys:", Object.keys(company || {}));
					
					if (company?.members && Array.isArray(company.members)) {
						console.log(`Found ${company.members.length} members via retrieve`);
						allMembers.push(...company.members);
					}
					
					// Also try other possible properties
					const possibleMemberArrays = [
						company.userIds,
						company.users,
						company.memberIds,
						company.user_ids,
						(company as any).member_ids,
					].filter(Boolean);
					
					possibleMemberArrays.forEach((memberArray: any, idx) => {
						if (Array.isArray(memberArray)) {
							console.log(`Found ${memberArray.length} members in property ${idx}`);
							allMembers.push(...memberArray.map((m: any) => ({ id: m })));
						}
					});
					
					// If we have member_count but no members array, try to fetch via products/subscriptions
					if (company?.member_count > 0 && allMembers.length === 0) {
						console.log(`⚠️ Company has ${company.member_count} members but no member list available. Trying alternative methods...`);
						
						// Try fetching members via subscriptions API
						try {
							// Try subscriptions.list if available
							if (typeof (whopsdk as any).subscriptions?.list === 'function') {
								console.log("Trying subscriptions.list to get members...");
								const subscriptions = await (whopsdk as any).subscriptions.list({
									company_id: companyId,
									status: 'active'
								});
								
								if (Array.isArray(subscriptions)) {
									console.log(`Found ${subscriptions.length} active subscriptions`);
									subscriptions.forEach((sub: any) => {
										const userId = sub.user_id || sub.userId || sub.user?.id;
										if (userId) {
											allCompanyUserIds.add(userId);
										}
									});
								} else if (subscriptions?.data && Array.isArray(subscriptions.data)) {
									console.log(`Found ${subscriptions.data.length} active subscriptions in data array`);
									subscriptions.data.forEach((sub: any) => {
										const userId = sub.user_id || sub.userId || sub.user?.id;
										if (userId) {
											allCompanyUserIds.add(userId);
										}
									});
								}
							}
							
							// Try products.listMembers if available
							if (typeof (whopsdk as any).products?.listMembers === 'function' && company.products) {
								console.log("Trying to get members from products...");
								for (const product of (company.products as any[]) || []) {
									try {
										const productId = product.id || product.product_id;
										if (productId) {
											const productMembers = await (whopsdk as any).products.listMembers(productId);
											if (Array.isArray(productMembers)) {
												productMembers.forEach((member: any) => {
													const userId = member.id || member.user_id || member.userId || member.user?.id;
													if (userId) {
														allCompanyUserIds.add(userId);
													}
												});
											}
										}
									} catch (err) {
										console.warn(`Failed to get members for product ${product.id}:`, err);
									}
								}
							}
						} catch (err) {
							console.warn("Failed to fetch members via products/subscriptions:", err);
						}
					}
				} catch (err: any) {
					console.warn("companies.retrieve failed:", err?.message || err);
				}
			} else {
				console.log("⚠️ companies.retrieve is not a function");
			}
			
			// Method 4: Try direct API calls if SDK methods don't work
			// This is a fallback - we'll try to use the SDK's internal fetch if possible
			if (allMembers.length === 0) {
				console.log("⚠️ No members found via SDK methods. All members array is empty.");
			}
			
			// Extract user IDs from all collected members
			allMembers.forEach((member: any) => {
				const memberId = member?.id || member?.userId || member?.user?.id || member?.user_id || 
				               (typeof member === 'string' ? member : null);
				if (memberId && typeof memberId === 'string' && memberId.trim() !== '') {
					allCompanyUserIds.add(memberId.trim());
				}
			});
			
			console.log(`✅ Collected ${allCompanyUserIds.size} total unique user IDs from all methods`);
			console.log(`📊 Breakdown: ${usersWithBadges.length} with badges, ${trackedUsers.length} tracked, ${allMembers.length} from company APIs`);
			
		} catch (error) {
			console.warn("Error fetching company members:", error);
			// Continue with users we already have
		}

		console.log(`Total user IDs to fetch: ${allCompanyUserIds.size}`);

		// Fetch user details from Whop and sort by badge value
		const leaderboard = await Promise.all(
			Array.from(allCompanyUserIds).map(async (userId) => {
				const badgeEntry = usersWithBadgesMap.get(userId);
				const badges = badgeEntry?.badges || [];
				const totalBadges = badgeEntry?.totalBadges || 0;
				const highestBadgeOrder = badgeEntry?.highestBadgeOrder ?? Infinity;

				try {
					const user = await whopsdk.users.retrieve(userId);
					
					// Try multiple possible property names for profile picture
					// Log the actual user object to see what's available
					const userObj = user as any;
					const avatar = 
						userObj.profilePicture || 
						userObj.profile_picture || 
						userObj.avatar || 
						userObj.avatar_url || 
						userObj.image || 
						userObj.image_url ||
						userObj.picture || 
						userObj.photo ||
						userObj.profile_image ||
						null;
					
					// Log for debugging
					if (!avatar) {
						console.log(`⚠️ No avatar found for user ${userId}. Available keys:`, Object.keys(userObj));
						console.log(`User object:`, JSON.stringify(userObj, null, 2));
					} else {
						console.log(`✅ Avatar found for user ${userId}:`, avatar);
					}
					return {
						userId: userId,
						displayName: user.name || `@${user.username}`,
						username: user.username,
						avatar: avatar,
						badges: badges,
						totalBadges: totalBadges,
						highestBadge: badges.length > 0 ? badges[0] : null,
						highestBadgeOrder: highestBadgeOrder,
					};
				} catch (error) {
					console.error(`Error fetching user ${userId}:`, error);
					return {
						userId: userId,
						displayName: `User ${userId.substring(0, 8)}`,
						username: null,
						avatar: null,
						badges: badges,
						totalBadges: totalBadges,
						highestBadge: badges.length > 0 ? badges[0] : null,
						highestBadgeOrder: highestBadgeOrder,
					};
				}
			}),
		);

		console.log(`Successfully fetched ${leaderboard.length} users`);

		// Sort: users with badges first (by badge value), then users without badges (alphabetically)
		const sortedLeaderboard = leaderboard.sort((a, b) => {
			// Users with badges come before users without badges
			const aHasBadges = a.totalBadges > 0;
			const bHasBadges = b.totalBadges > 0;

			if (aHasBadges && !bHasBadges) return -1;
			if (!aHasBadges && bHasBadges) return 1;

			if (aHasBadges && bHasBadges) {
				// Both have badges: sort by badge value (lower order = higher value)
				if (a.highestBadgeOrder !== b.highestBadgeOrder) {
					return a.highestBadgeOrder - b.highestBadgeOrder;
				}
				// Same badge value, sort by total badges
				return b.totalBadges - a.totalBadges;
			}

			// Both don't have badges: sort alphabetically by name
			return a.displayName.localeCompare(b.displayName);
		});

		return NextResponse.json({ leaderboard: sortedLeaderboard });
	} catch (error) {
		console.error("Error fetching leaderboard:", error);
		return NextResponse.json(
			{ error: "Failed to fetch leaderboard" },
			{ status: 500 },
		);
	}
}
