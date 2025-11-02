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
					console.log("⚠️ Note: authorizedUsers.list might only return admins/authorized users, not all members");
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
							totalAuthorizedUsersFound += authorizedUsers.length;
							
							// Extract user IDs from authorized user objects
							authorizedUsers.forEach((authorizedUser: any, idx: number) => {
								// Each authorized user object has structure: { id, role, user }
								// The actual user ID is in authorizedUser.user.id
								// IMPORTANT: authorizedUser.id is the authorized user record ID (ausr_xxx), NOT the user ID
								let userId = authorizedUser?.user?.id || 
											   authorizedUser?.user?.user_id || 
											   authorizedUser?.user_id || 
											   authorizedUser?.user?.userId;
								
								// Only use authorizedUser.id if it looks like a user ID (starts with 'user_'), not 'ausr_'
								if (!userId && authorizedUser?.id && typeof authorizedUser.id === 'string' && authorizedUser.id.startsWith('user_')) {
									userId = authorizedUser.id;
								}
								// Same for authorizedUser.userId
								if (!userId && authorizedUser?.userId && typeof authorizedUser.userId === 'string' && authorizedUser.userId.startsWith('user_')) {
									userId = authorizedUser.userId;
								}
								
								// Debug: Log full structure for first few entries
								if (idx < 5 || !userId) {
									console.log(`🔍 Authorized user ${idx} structure:`, {
										authorizedUserId: authorizedUser?.id,
										hasUser: !!authorizedUser?.user,
										userObject: authorizedUser?.user ? {
											id: authorizedUser.user.id,
											keys: Object.keys(authorizedUser.user)
										} : null,
										allKeys: Object.keys(authorizedUser || {}),
										extractedUserId: userId
									});
								}
								
								if (userId && typeof userId === 'string' && userId.trim() !== '' && userId.startsWith('user_')) {
									allCompanyUserIds.add(userId.trim());
									allMembers.push(authorizedUser); // Store the full authorized user object too
									console.log(`✅ Added user ID: ${userId} from authorized user entry`);
								} else {
									console.warn(`⚠️ Authorized user object ${idx} without valid user ID:`, {
										authorizedUserId: authorizedUser?.id,
										hasUser: !!authorizedUser?.user,
										userKeys: authorizedUser?.user ? Object.keys(authorizedUser.user) : [],
										allKeys: Object.keys(authorizedUser || {}),
										fullObject: JSON.stringify(authorizedUser, null, 2).substring(0, 500)
									});
								}
							});
						}
						console.log(`✅ Processed ${itemCount} items from authorizedUsers.list`);
						console.log(`📊 Total authorized users found: ${totalAuthorizedUsersFound}`);
						console.log(`⚠️ If you have 8 members but only found ${totalAuthorizedUsersFound}, the missing member(s) might not be admins/authorized users. They'll appear after they visit the page.`);
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
								// IMPORTANT: authorizedUser.id is the authorized user record ID (ausr_xxx), NOT the user ID
								let userId = authorizedUser?.user?.id || 
											   authorizedUser?.user?.user_id || 
											   authorizedUser?.user_id || 
											   authorizedUser?.user?.userId;
								
								// Only use authorizedUser.id if it looks like a user ID (starts with 'user_'), not 'ausr_'
								if (!userId && authorizedUser?.id && typeof authorizedUser.id === 'string' && authorizedUser.id.startsWith('user_')) {
									userId = authorizedUser.id;
								}
								// Same for authorizedUser.userId
								if (!userId && authorizedUser?.userId && typeof authorizedUser.userId === 'string' && authorizedUser.userId.startsWith('user_')) {
									userId = authorizedUser.userId;
								}
								
								if (userId && typeof userId === 'string' && userId.trim() !== '' && userId.startsWith('user_')) {
									allCompanyUserIds.add(userId.trim());
									console.log(`Added user ID: ${userId} from authorized user entry`);
								} else {
									console.warn("Authorized user object without valid user ID:", {
										authorizedUserId: authorizedUser?.id,
										hasUser: !!authorizedUser?.user,
										userKeys: authorizedUser?.user ? Object.keys(authorizedUser.user) : [],
										allKeys: Object.keys(authorizedUser || {})
									});
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
			
			// Method 0.5: Try users.list as fallback - this might get ALL users, not just admins
			if (typeof (whopsdk as any).users?.list === 'function') {
				try {
					console.log("🔄 Trying users.list to get ALL users (not just admins)...");
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
					
					console.log(`✅ Found ${users.length} users via users.list`);
					let addedCount = 0;
					if (users.length > 0) {
						allMembers.push(...users);
						users.forEach((user: any) => {
							const userId = user?.id || user?.user_id || user?.userId;
							if (userId && typeof userId === 'string' && userId.trim() !== '' && userId.startsWith('user_')) {
								const wasNew = !allCompanyUserIds.has(userId.trim());
								allCompanyUserIds.add(userId.trim());
								if (wasNew) {
									addedCount++;
									console.log(`  ✅ Added user ID from users.list: ${userId}`);
								}
							}
						});
						console.log(`📊 Added ${addedCount} new members from users.list. Total now: ${allCompanyUserIds.size}`);
					}
				} catch (err: any) {
					console.warn("users.list failed:", err?.message || err);
				}
			} else {
				console.log("⚠️ users.list is not available");
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
					
					// Add owner_user if it exists and is a user ID
					if (company?.owner_user) {
						const ownerId = company.owner_user?.id || company.owner_user?.user_id || company.owner_user;
						if (ownerId && typeof ownerId === 'string' && ownerId.startsWith('user_')) {
							console.log(`📌 Adding owner_user: ${ownerId}`);
							allCompanyUserIds.add(ownerId);
						} else {
							console.log(`⚠️ Owner user found but not a valid user ID:`, company.owner_user);
						}
					}
					
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
					
					// Always try subscriptions to get ALL members (not just admins)
					// Note: authorizedUsers.list might only return admins, so we need subscriptions for regular members
					console.log(`📊 Current member count: ${allCompanyUserIds.size}, Company member_count: ${company?.member_count || 0}`);
					
					// Try fetching members via subscriptions API - this should get ALL active members
					try {
						// Try subscriptions.list if available - this should get ALL active members
						if (typeof (whopsdk as any).subscriptions?.list === 'function') {
							console.log("🔄 Trying subscriptions.list to get ALL members (including regular members)...");
							const subscriptions = await (whopsdk as any).subscriptions.list({
								company_id: companyId,
								status: 'active'
							});
								
								if (Array.isArray(subscriptions)) {
									console.log(`✅ Found ${subscriptions.length} active subscriptions`);
									let addedCount = 0;
									subscriptions.forEach((sub: any, idx: number) => {
										const userId = sub.user_id || sub.userId || sub.user?.id;
										if (userId && typeof userId === 'string' && userId.startsWith('user_')) {
											const wasNew = !allCompanyUserIds.has(userId);
											allCompanyUserIds.add(userId);
											if (wasNew) {
												addedCount++;
												console.log(`  ✅ Sub ${idx}: Added new userId=${userId}`);
											} else if (idx < 5) {
												console.log(`  ℹ️ Sub ${idx}: userId=${userId} (already existed)`);
											}
										} else if (idx < 10) {
											console.log(`  ⚠️ Sub ${idx}: No valid userId found:`, { 
												user_id: sub.user_id, 
												userId: sub.userId, 
												user: sub.user,
												keys: Object.keys(sub || {})
											});
										}
									});
									console.log(`📊 Added ${addedCount} new members from subscriptions. Total now: ${allCompanyUserIds.size}`);
								} else if (subscriptions?.data && Array.isArray(subscriptions.data)) {
									console.log(`✅ Found ${subscriptions.data.length} active subscriptions in data array`);
									let addedCount = 0;
									subscriptions.data.forEach((sub: any, idx: number) => {
										const userId = sub.user_id || sub.userId || sub.user?.id;
										if (userId && typeof userId === 'string' && userId.startsWith('user_')) {
											const wasNew = !allCompanyUserIds.has(userId);
											allCompanyUserIds.add(userId);
											if (wasNew) {
												addedCount++;
												console.log(`  ✅ Sub data ${idx}: Added new userId=${userId}`);
											} else if (idx < 5) {
												console.log(`  ℹ️ Sub data ${idx}: userId=${userId} (already existed)`);
											}
										} else if (idx < 10) {
											console.log(`  ⚠️ Sub data ${idx}: No valid userId found:`, { 
												user_id: sub.user_id, 
												userId: sub.userId, 
												user: sub.user,
												keys: Object.keys(sub || {})
											});
										}
									});
									console.log(`📊 Added ${addedCount} new members from subscriptions.data. Total now: ${allCompanyUserIds.size}`);
								} else {
									console.log("⚠️ subscriptions.list returned unexpected format:", {
										type: typeof subscriptions,
										isArray: Array.isArray(subscriptions),
										hasData: !!subscriptions?.data,
										keys: subscriptions ? Object.keys(subscriptions) : []
									});
								}
								
								console.log(`📊 Final count after subscriptions: ${allCompanyUserIds.size} members`);
							} else {
								console.log("⚠️ subscriptions.list is not available - cannot fetch regular members");
							}
							
							// Try products.listMembers if available - this might get all members who have access to products
							if (typeof (whopsdk as any).products?.listMembers === 'function' && company.products) {
								console.log("🔄 Trying to get members from products...");
								let productMemberCount = 0;
								for (const product of (company.products as any[]) || []) {
									try {
										const productId = product.id || product.product_id;
										if (productId) {
											const productMembers = await (whopsdk as any).products.listMembers(productId);
											console.log(`  Product ${productId} members:`, productMembers?.length || 0);
											if (Array.isArray(productMembers)) {
												productMembers.forEach((member: any, idx: number) => {
													const userId = member.id || member.user_id || member.userId || member.user?.id;
													if (userId && typeof userId === 'string' && userId.startsWith('user_')) {
														const wasNew = !allCompanyUserIds.has(userId);
														allCompanyUserIds.add(userId);
														if (wasNew) {
															productMemberCount++;
															console.log(`    ✅ Product member ${idx}: Added new userId=${userId}`);
														} else if (idx < 3) {
															console.log(`    ℹ️ Product member ${idx}: userId=${userId} (already existed)`);
														}
													} else if (idx < 5) {
														console.log(`    ⚠️ Product member ${idx}: No valid userId:`, { 
															id: member.id, 
															user_id: member.user_id, 
															userId: member.userId,
															user: member.user,
															keys: Object.keys(member || {})
														});
													}
												});
											}
										}
									} catch (err) {
										console.warn(`Failed to get members for product ${product.id}:`, err);
									}
								}
								console.log(`📊 Added ${productMemberCount} new members from products. Total now: ${allCompanyUserIds.size}`);
							} else {
								console.log("⚠️ products.listMembers is not available");
							}
					} catch (err) {
						console.warn("Failed to fetch members via products/subscriptions:", err);
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
		// IMPORTANT: Filter out 'ausr_' IDs (authorized user record IDs) - only keep 'user_' IDs
		allMembers.forEach((member: any) => {
			// Prioritize user.id over member.id (member.id might be ausr_xxx)
			let memberId = member?.user?.id || 
			              member?.user?.user_id || 
			              member?.user?.userId ||
			              member?.user_id;
			
			// Only use member.id or member.userId if it's a user ID (starts with 'user_'), not 'ausr_'
			if (!memberId && member?.id && typeof member.id === 'string' && member.id.startsWith('user_')) {
				memberId = member.id;
			}
			if (!memberId && member?.userId && typeof member.userId === 'string' && member.userId.startsWith('user_')) {
				memberId = member.userId;
			}
			
			// Handle if member is just a string
			if (!memberId && typeof member === 'string' && member.startsWith('user_')) {
				memberId = member;
			}
			
			// Only add if it's a valid user ID (starts with 'user_')
			if (memberId && typeof memberId === 'string' && memberId.trim() !== '' && memberId.startsWith('user_')) {
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
		console.log(`📋 All user IDs to fetch (${allCompanyUserIds.size} total):`, Array.from(allCompanyUserIds).sort());
		console.log(`🔢 Expected: 8 members (including you)`);
		
		// Important note about missing members
		if (allCompanyUserIds.size < 8) {
			const missingCount = 8 - allCompanyUserIds.size;
			console.log(`⚠️ ⚠️ ⚠️ MISSING ${missingCount} MEMBER(S) ⚠️ ⚠️ ⚠️`);
			console.log(`📝 Explanation:`);
			console.log(`   - authorizedUsers.list only returns admins/authorized users`);
			console.log(`   - Regular members (non-admins) won't appear until they visit the page`);
			console.log(`   - Once they visit, they'll be tracked and appear automatically`);
			console.log(`   - To see them immediately, they need to visit the badge page once`);
		}
		console.log(`📋 All user IDs to fetch:`, Array.from(allCompanyUserIds).slice(0, 10));

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
					
					// Log user object structure for debugging (first few users only)
					if (allCompanyUserIds.size <= 5 || Array.from(allCompanyUserIds).indexOf(userId) < 3) {
						console.log(`=== User object for ${userId} ===`);
						console.log(`Available keys:`, Object.keys(userObj));
						console.log(`Name properties:`, {
							name: userObj.name,
							display_name: userObj.display_name,
							displayName: userObj.displayName,
							full_name: userObj.full_name,
							fullName: userObj.fullName,
							username: userObj.username,
						});
					}
					
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
					
					// Extract display name - the user object has 'name' property (verified in logs)
					// Try direct access first, then fallback to other properties
					let displayName: string = 
						(userObj.name && String(userObj.name).trim()) || 
						(userObj.display_name && String(userObj.display_name).trim()) || 
						(userObj.displayName && String(userObj.displayName).trim()) || 
						(userObj.full_name && String(userObj.full_name).trim()) || 
						(userObj.fullName && String(userObj.fullName).trim()) ||
						null;
					
					// If no name found, try username
					if (!displayName && userObj.username) {
						displayName = String(userObj.username).trim(); // Just username, no @ prefix
					}
					
					// Last resort fallback
					if (!displayName || displayName === '') {
						displayName = `User ${userId.substring(0, 8)}`;
						console.log(`⚠️ No name found for user ${userId}. Full user object keys:`, Object.keys(userObj));
						console.log(`⚠️ userObj.name value:`, userObj.name, `type:`, typeof userObj.name);
					} else {
						console.log(`✅ Extracted name for ${userId}: "${displayName}"`);
					}
					
					// Extract username
					const username = userObj.username || null;
					
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
			const aName = a.displayName || a.username || a.userId;
			const bName = b.displayName || b.username || b.userId;
			return aName.localeCompare(bName);
		});

		// Debug: Log what we're sending
		console.log("📤 Sending leaderboard with displayNames:");
		sortedLeaderboard.slice(0, 5).forEach((u, i) => {
			console.log(`  User ${i + 1}: userId=${u.userId}, displayName="${u.displayName}", type=${typeof u.displayName}, length=${u.displayName?.length}`);
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
