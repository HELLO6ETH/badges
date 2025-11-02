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
			// Method 0: Try authorizedUsers.list (recommended method with permissions)
			if (typeof (whopsdk as any).authorizedUsers?.list === 'function') {
				try {
					console.log("Trying authorizedUsers.list (recommended method)...");
					const authorizedUsersResult = (whopsdk as any).authorizedUsers.list({
						company_id: companyId,
					});
					
					// Handle async iterator if it's an async generator
					if (authorizedUsersResult && typeof authorizedUsersResult[Symbol.asyncIterator] === 'function') {
						console.log("authorizedUsers.list returns async iterator");
						let itemCount = 0;
						for await (const item of authorizedUsersResult) {
							itemCount++;
							console.log(`Processing authorizedUsers item ${itemCount}, item type:`, typeof item);
							console.log(`Item keys:`, Object.keys(item || {}));
							
							// Handle different response formats
							let authorizedUsers: any[] = [];
							
							// If item is an array, it's a batch of authorized users
							if (Array.isArray(item)) {
								authorizedUsers = item;
							}
							// If item has a data array, use that
							else if (item?.data && Array.isArray(item.data)) {
								authorizedUsers = item.data;
							}
							// If item has authorizedUsers array, use that
							else if (item?.authorizedUsers && Array.isArray(item.authorizedUsers)) {
								authorizedUsers = item.authorizedUsers;
							}
							// If item is a single authorized user object with { id, role, user }
							else if (item && typeof item === 'object' && item.user) {
								authorizedUsers = [item];
							}
							// If item has users array
							else if (item?.users && Array.isArray(item.users)) {
								authorizedUsers = item.users;
							}
							
							console.log(`Found ${authorizedUsers.length} authorized user entries in item ${itemCount}`);
							
							// Extract user IDs from authorized user objects
							authorizedUsers.forEach((authorizedUser: any) => {
								// Each authorized user object has structure: { id, role, user }
								// The actual user ID is in authorizedUser.user.id
								const userId = authorizedUser?.user?.id || 
											   authorizedUser?.user?.user_id || 
											   authorizedUser?.user_id || 
											   authorizedUser?.user?.userId ||
											   authorizedUser?.id || 
											   authorizedUser?.userId;
								
								if (userId && typeof userId === 'string' && userId.trim() !== '') {
									allCompanyUserIds.add(userId.trim());
									allMembers.push(authorizedUser); // Store the full authorized user object too
									console.log(`Added user ID: ${userId} from authorized user entry`);
								} else {
									console.warn("Authorized user object without valid user ID:", authorizedUser);
									console.warn("Available keys:", Object.keys(authorizedUser || {}));
									if (authorizedUser?.user) {
										console.warn("User object keys:", Object.keys(authorizedUser.user));
									}
								}
							});
						}
						console.log(`✅ Processed ${itemCount} items from authorizedUsers.list`);
					} else {
						// Handle if it returns a promise
						console.log("authorizedUsers.list returns promise, awaiting...");
						const usersResult = await authorizedUsersResult;
						console.log("authorizedUsers.list result type:", typeof usersResult);
						console.log("authorizedUsers.list result keys:", Object.keys(usersResult || {}));
						
						let authorizedUsers: any[] = [];
						if (Array.isArray(usersResult)) {
							authorizedUsers = usersResult;
						} else if (usersResult?.data && Array.isArray(usersResult.data)) {
							authorizedUsers = usersResult.data;
						} else if (usersResult?.authorizedUsers && Array.isArray(usersResult.authorizedUsers)) {
							authorizedUsers = usersResult.authorizedUsers;
						} else if (usersResult?.users && Array.isArray(usersResult.users)) {
							authorizedUsers = usersResult.users;
						} else if (usersResult?.items && Array.isArray(usersResult.items)) {
							authorizedUsers = usersResult.items;
						}
						
						console.log(`Found ${authorizedUsers.length} authorized users from promise result`);
						if (authorizedUsers.length > 0) {
							allMembers.push(...authorizedUsers);
							// Extract user IDs from authorized user objects
							authorizedUsers.forEach((authorizedUser: any) => {
								// Each authorized user object has structure: { id, role, user }
								// The actual user ID is in authorizedUser.user.id
								const userId = authorizedUser?.user?.id || 
											   authorizedUser?.user?.user_id || 
											   authorizedUser?.user_id || 
											   authorizedUser?.user?.userId ||
											   authorizedUser?.id || 
											   authorizedUser?.userId;
								
								if (userId && typeof userId === 'string' && userId.trim() !== '') {
									allCompanyUserIds.add(userId.trim());
									console.log(`Added user ID: ${userId} from authorized user entry`);
								} else {
									console.warn("Authorized user object without valid user ID:", authorizedUser);
									console.warn("Available keys:", Object.keys(authorizedUser || {}));
									if (authorizedUser?.user) {
										console.warn("User object keys:", Object.keys(authorizedUser.user));
									}
								}
							});
						}
					}
					console.log(`✅ Found ${allCompanyUserIds.size} unique user IDs via authorizedUsers.list`);
				} catch (err: any) {
					console.error("authorizedUsers.list failed:", err?.message || err);
					console.error("Error stack:", err?.stack);
				}
			} else {
				console.log("⚠️ authorizedUsers.list is not a function");
				console.log("authorizedUsers exists:", typeof (whopsdk as any).authorizedUsers);
				if ((whopsdk as any).authorizedUsers) {
					console.log("authorizedUsers keys:", Object.keys((whopsdk as any).authorizedUsers));
				}
			}
			
			// Method 0.5: Try users.list as fallback
			if (typeof (whopsdk as any).users?.list === 'function') {
				try {
					console.log("Trying users.list as fallback...");
					const usersResult = await (whopsdk as any).users.list({ company_id: companyId });
					console.log("users.list result type:", typeof usersResult);
					
					let users = [];
					if (Array.isArray(usersResult)) {
						users = usersResult;
					} else if (usersResult?.data && Array.isArray(usersResult.data)) {
						users = usersResult.data;
					} else if (usersResult?.users && Array.isArray(usersResult.users)) {
						users = usersResult.users;
					}
					
					console.log(`Found ${users.length} users via users.list`);
					if (users.length > 0) {
						allMembers.push(...users);
						users.forEach((user: any) => {
							const userId = user?.id || user?.user_id || user?.userId;
							if (userId && typeof userId === 'string' && userId.trim() !== '') {
								allCompanyUserIds.add(userId.trim());
								console.log(`Added user ID from users.list: ${userId}`);
							}
						});
					}
				} catch (err: any) {
					console.warn("users.list failed:", err?.message || err);
				}
			}
			
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
		console.log(`Users breakdown before fetching: ${usersWithBadges.length} with badges, ${allCompanyUserIds.size - usersWithBadges.length} without badges`);

		// Fetch user details from Whop and sort by badge value
		// Include ALL users - those with badges AND those without badges
		const leaderboard = await Promise.all(
			Array.from(allCompanyUserIds).map(async (userId) => {
				const badgeEntry = usersWithBadgesMap.get(userId);
				const badges = badgeEntry?.badges || [];
				const totalBadges = badgeEntry?.totalBadges || 0;
				const highestBadgeOrder = badgeEntry?.highestBadgeOrder ?? Infinity;

				// Log if user has no badges to confirm they're being included
				if (totalBadges === 0) {
					console.log(`Including user ${userId} without badges in leaderboard`);
				}

				try {
					const user = await whopsdk.users.retrieve(userId);
					
					// Try multiple possible property names for profile picture
					const userObj = user as any;
					const avatarValue = 
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
					
					// Extract URL from avatar - it might be an object with a url property, or a string
					let avatarUrl: string | null = null;
					if (avatarValue) {
						if (typeof avatarValue === 'string') {
							avatarUrl = avatarValue;
						} else if (typeof avatarValue === 'object' && avatarValue !== null) {
							// Try to get URL from object properties
							avatarUrl = avatarValue.url || 
							           avatarValue.URL || 
							           avatarValue.src ||
							           avatarValue.href ||
							           (typeof avatarValue.toString === 'function' ? avatarValue.toString() : null);
						}
					}
					
					// Extract display name - try multiple property names
					const displayName = 
						userObj.name || 
						userObj.display_name || 
						userObj.displayName || 
						userObj.full_name || 
						userObj.fullName ||
						(userObj.username ? `@${userObj.username}` : null) ||
						`User ${userId.substring(0, 8)}`;
					
					// Extract username
					const username = userObj.username || null;
					
					// Log for debugging if name extraction fails
					if (displayName.startsWith('User ')) {
						console.log(`⚠️ Could not extract name for user ${userId}. Available keys:`, Object.keys(userObj));
						console.log(`User object sample:`, JSON.stringify({ name: userObj.name, username: userObj.username, display_name: userObj.display_name }, null, 2));
					}
					
					return {
						userId: userId,
						displayName: displayName,
						username: username,
						avatar: avatarUrl,
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
		const usersWithoutBadges = leaderboard.filter(u => u.totalBadges === 0);
		const usersWithBadgesCount = leaderboard.filter(u => u.totalBadges > 0);
		console.log(`📊 Final breakdown: ${usersWithBadgesCount.length} users with badges, ${usersWithoutBadges.length} users without badges`);

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
