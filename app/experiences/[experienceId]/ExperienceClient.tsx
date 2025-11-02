"use client";

import { useEffect, useState } from "react";
import { Button } from "@whop/react/components";
import type { Badge } from "@/lib/badges";
import { BadgeDisplay } from "@/components/BadgeDisplay";

interface ExperienceClientProps {
	experienceId: string;
	companyId: string;
	currentUserId: string;
	currentUserName: string;
}

interface UserEntry {
	userId: string;
	displayName: string;
	username: string | null;
	avatar: string | null;
	badges: Badge[];
	totalBadges: number;
	highestBadge: Badge | null;
}

export default function ExperienceClient({
	experienceId,
	companyId,
	currentUserId,
	currentUserName,
}: ExperienceClientProps) {
	const [users, setUsers] = useState<UserEntry[]>([]);
	const [badges, setBadges] = useState<Badge[]>([]);
	const [loading, setLoading] = useState(true);
	const [isAdmin, setIsAdmin] = useState(false);
	const [showSettings, setShowSettings] = useState(false);
	const [showCreateBadgeModal, setShowCreateBadgeModal] = useState(false);
	const [showAssignBadgeModal, setShowAssignBadgeModal] = useState(false);
	const [showUserDetailModal, setShowUserDetailModal] = useState(false);
	const [selectedUser, setSelectedUser] = useState<UserEntry | null>(null);
	const [assigningToUserId, setAssigningToUserId] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
	const [formData, setFormData] = useState({
		name: "",
		emoji: "🏆",
		color: "#3B82F6",
		description: "",
	});
	const [notification, setNotification] = useState<{ message: string; progress: number } | null>(null);
	const [showNotifications, setShowNotifications] = useState(true);

	useEffect(() => {
		if (!companyId || companyId.trim() === "") {
			console.error("CompanyId is missing! Value:", companyId);
			setLoading(false);
			return;
		}
		Promise.all([fetchUsers(), fetchBadges(), checkAdmin()]).then(() => {
			setLoading(false);
		});
	}, [companyId]);

	async function fetchUsers(): Promise<UserEntry[]> {
		try {
			const response = await fetch(`/api/leaderboard?companyId=${companyId}`);
			const data = await response.json();
			console.log("Fetched users data:", data);
			if (data.leaderboard) {
				console.log(`Setting ${data.leaderboard.length} users`);
				console.log("Users with names:", data.leaderboard.map((u: UserEntry) => ({
					userId: u.userId,
					displayName: u.displayName,
					displayNameType: typeof u.displayName,
					displayNameLength: u.displayName?.length,
					username: u.username,
					avatar: u.avatar,
					hasAvatar: !!u.avatar
				})));
				setUsers(data.leaderboard);
				return data.leaderboard;
			} else {
				console.warn("No leaderboard data in response:", data);
				return [];
			}
		} catch (error) {
			console.error("Error fetching users:", error);
			return [];
		}
	}

	async function fetchBadges() {
		if (!companyId) {
			console.error("Cannot fetch badges: companyId is missing");
			return;
		}
		
		try {
			console.log("=== FETCHING BADGES ===");
			console.log("Company ID:", companyId);
			console.log("Company ID type:", typeof companyId);
			console.log("Company ID length:", companyId?.length);
			const response = await fetch(`/api/badges?companyId=${companyId}`);
			const data = await response.json();
			console.log("Badges fetched from API:", data.badges?.length || 0);
			if (data.badges) {
				console.log("Badge IDs from API:", data.badges.map((b: Badge) => ({ 
					id: b.id, 
					idLength: b.id.length,
					name: b.name 
				})));
				setBadges(data.badges);
				console.log(`✅ Set ${data.badges.length} badges in state`);
			}
		} catch (error) {
			console.error("Error fetching badges:", error);
		}
	}

	async function checkAdmin() {
		try {
			const response = await fetch(`/api/users/${currentUserId}/admin?companyId=${companyId}`);
			if (response.ok) {
				const data = await response.json();
				setIsAdmin(data.isAdmin === true);
				console.log(`Admin status: ${data.isAdmin}, access level: ${data.accessLevel}`);
			} else {
				console.warn("Failed to check admin status:", response.status);
				setIsAdmin(false);
			}
		} catch (error) {
			console.error("Error checking admin status:", error);
			setIsAdmin(false);
		}
	}

	async function createBadge(e: React.FormEvent) {
		e.preventDefault();

		// Validate client-side first
		if (!companyId || companyId.trim() === "") {
			alert("Error: Company ID is missing. Please refresh the page.");
			console.error("CompanyId value:", companyId);
			return;
		}
		
		const trimmedFormData = {
			name: formData.name?.trim() || "",
			emoji: formData.emoji?.trim() || "",
			color: formData.color?.trim() || "",
			description: formData.description?.trim() || "",
		};

		if (!trimmedFormData.name) {
			alert("Error: Badge name is required");
			return;
		}
		if (!trimmedFormData.emoji) {
			alert("Error: Emoji is required");
			return;
		}
		if (!trimmedFormData.color) {
			alert("Error: Color is required");
			return;
		}

		const payload = { ...trimmedFormData, companyId: companyId.trim() };
		
		// Debug: log what we're sending
		console.log("Creating badge with payload:", payload);

		try {
			const response = await fetch("/api/badges", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			if (response.ok) {
				const data = await response.json();
				console.log("=== BADGE CREATION SUCCESS ===");
				console.log("Created badge:", data.badge);
				console.log("Badge ID:", data.badge?.id);
				console.log("Badge name:", data.badge?.name);
				console.log("Current badges in state:", badges.length);
				
				// Refresh badges from server to ensure we have the latest
				await fetchBadges();
				setFormData({ name: "", emoji: "🏆", color: "#3B82F6", description: "" });
				setEditingBadge(null);
				setShowCreateBadgeModal(false);
			} else {
				// Try to parse JSON error response
				let errorData: any = {};
				const contentType = response.headers.get("content-type");
				
				try {
					const text = await response.text();
					console.log("Raw response text:", text);
					
					if (text) {
						if (contentType && contentType.includes("application/json")) {
							errorData = JSON.parse(text);
						} else {
							errorData = { error: text };
						}
					} else {
						errorData = { 
							error: `HTTP ${response.status}: ${response.statusText}`,
							message: "Empty response body"
						};
					}
				} catch (parseError) {
					console.error("Error parsing response:", parseError);
					errorData = { 
						error: `HTTP ${response.status}: ${response.statusText}`,
						message: "Could not parse error response",
						parseError: parseError instanceof Error ? parseError.message : String(parseError)
					};
				}
				
				console.error("Error response:", {
					status: response.status,
					statusText: response.statusText,
					contentType: contentType,
					data: errorData
				});
				
				const errorMsg = errorData.error || errorData.message || `Failed to create badge (HTTP ${response.status})`;
				const details = errorData.details ? `\n\nDetails: ${errorData.details}` : "";
				const suggestion = errorData.suggestion ? `\n\n${errorData.suggestion}` : "";
				const receivedInfo = errorData.received ? `\n\nReceived: ${JSON.stringify(errorData.received, null, 2)}` : "";
				const companyIdInfo = errorData.companyId !== undefined ? `\n\nCompany ID used: ${errorData.companyId || "(empty)"}` : "";
				alert(`Error: ${errorMsg}${details}${suggestion}${companyIdInfo}${receivedInfo}`);
			}
		} catch (error) {
			console.error("Error creating badge:", error);
			const errorMessage = error instanceof Error ? error.message : "Network error or failed to create badge";
			alert(`Failed to create badge: ${errorMessage}`);
		}
	}

	async function updateBadge(e: React.FormEvent) {
		e.preventDefault();
		if (!editingBadge) {
			console.error("No badge being edited");
			return;
		}

		const badgeIdToUpdate = editingBadge.id;
		console.log("=== UPDATING BADGE ===");
		console.log("Editing badge object:", editingBadge);
		console.log("Badge ID to update:", badgeIdToUpdate);
		console.log("Form data:", formData);
		console.log("Current badges in state:", badges.map(b => ({ id: b.id, name: b.name })));
		
		// Verify the badge exists in our current state
		const badgeInState = badges.find(b => b.id === badgeIdToUpdate);
		if (!badgeInState) {
			console.error("Badge not found in current state! ID:", badgeIdToUpdate);
			alert(`Error: Badge not found. Please refresh the page and try again.`);
			return;
		}
		console.log("Found badge in state:", badgeInState);

		try {
			const payload = {
				name: formData.name.trim(),
				emoji: formData.emoji.trim(),
				color: formData.color.trim(),
				description: formData.description.trim(),
			};
			
			console.log("Sending update payload:", payload);
			
			const response = await fetch(`/api/badges/${badgeIdToUpdate}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			console.log("Update response status:", response.status);

			if (response.ok) {
				const data = await response.json();
				console.log("Updated badge data from server:", data.badge);
				
				// Refresh badges from server to ensure we have the latest data
				await fetchBadges();
				
				// Refresh users to show updated badges
				await fetchUsers();
				
				setFormData({ name: "", emoji: "🏆", color: "#3B82F6", description: "" });
				setEditingBadge(null);
				setShowCreateBadgeModal(false);
				
				console.log("✅ Badge update complete");
			} else {
				const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
				console.error("Update error:", errorData);
				alert(`Error: ${errorData.error || "Failed to update badge"}`);
			}
		} catch (error) {
			console.error("Error updating badge:", error);
			alert("Failed to update badge");
		}
	}

	async function deleteBadge(badgeId: string) {
		if (!confirm("Are you sure you want to delete this badge? All assignments will be removed.")) return;

		try {
			const response = await fetch(`/api/badges/${badgeId}`, {
				method: "DELETE",
			});

			if (response.ok) {
				setBadges(badges.filter((b) => b.id !== badgeId));
				// Refresh users to show updated badges
				fetchUsers();
			} else {
				const errorData = await response.json();
				alert(`Error: ${errorData.error || "Failed to delete badge"}`);
			}
		} catch (error) {
			console.error("Error deleting badge:", error);
			alert("Failed to delete badge");
		}
	}

	async function updateBadgeOrder(badgeIds: string[]) {
		try {
			const response = await fetch("/api/badges", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ companyId, badgeIds }),
			});

			if (response.ok) {
				const data = await response.json();
				setBadges(data.badges);
				// Refresh users to show updated sorting
				fetchUsers();
			} else {
				const errorData = await response.json();
				alert(`Error: ${errorData.error || "Failed to update badge order"}`);
			}
		} catch (error) {
			console.error("Error updating badge order:", error);
			alert("Failed to update badge order");
		}
	}

	async function assignBadgeToUser(userId: string, badgeId: string) {
		if (!badgeId || badgeId.trim() === "") {
			alert("Please select a badge");
			return;
		}

		const trimmedBadgeId = badgeId?.trim();
		if (!trimmedBadgeId) {
			alert("Invalid badge ID");
			return;
		}
		
		console.log("=== assignBadgeToUser called ===");
		console.log("Badge ID (raw):", badgeId);
		console.log("Badge ID (trimmed):", trimmedBadgeId);
		console.log("Badge ID type:", typeof trimmedBadgeId);
		console.log("Badge ID length:", trimmedBadgeId.length);
		console.log("User ID:", userId);
		console.log("Company ID:", companyId);
		console.log("Company ID type:", typeof companyId);
		console.log("Company ID length:", companyId?.length);
		console.log("Available badges in state:", badges.map(b => ({ 
			id: b.id, 
			idTrimmed: b.id.trim(),
			name: b.name,
			match: b.id === trimmedBadgeId || b.id.trim() === trimmedBadgeId
		})));
		
		// Verify badge exists in local state
		const badgeInState = badges.find(b => b.id === trimmedBadgeId || b.id.trim() === trimmedBadgeId);
		if (!badgeInState) {
			console.error("❌ Badge not found in local state!");
			console.error("Looking for:", trimmedBadgeId);
			console.error("Available in state:", badges.map(b => b.id));
			alert(`Error: Badge not found in list. The badge might have been deleted. Refreshing...`);
			await fetchBadges();
			return;
		}

		try {
			const payload = {
				badgeId: trimmedBadgeId,
				targetUserId: userId,
				companyId,
			};
			console.log("Sending assignment request:", payload);
			
			const response = await fetch("/api/badges/assign", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const contentType = response.headers.get("content-type");
			const status = response.status;
			const statusText = response.statusText;
			
			if (response.ok) {
				const data = await response.json();
				console.log("Badge assignment successful:", data);
				
				// Get user info for notification
				const targetUser = users.find(u => u.userId === userId);
				const assignedBadge = badges.find(b => b.id === trimmedBadgeId);
				const username = targetUser?.username || targetUser?.displayName || "User";
				const badgeName = assignedBadge?.name || "badge";
				
				// Show notification if enabled
				if (showNotifications) {
					setNotification({ message: `${username} was awarded ${badgeName}`, progress: 100 });
					
					// Animate progress bar - 2 seconds = 2000ms, update every 16ms (~60fps)
					const startTime = Date.now();
					const duration = 2000; // 2 seconds
					const interval = setInterval(() => {
						const elapsed = Date.now() - startTime;
						const remaining = Math.max(0, duration - elapsed);
						const progress = (remaining / duration) * 100;
						
						setNotification(prev => prev ? { ...prev, progress: progress } : null);
						
						if (progress <= 0) {
							clearInterval(interval);
							setTimeout(() => setNotification(null), 50);
						}
					}, 16); // ~60fps for smooth animation
				}
				
				// Refresh users to show the new badge
				await fetchUsers();
				
				// Update selected user in detail modal if it's open
				if (showUserDetailModal && selectedUser && selectedUser.userId === userId) {
					// Wait a moment for state to update, then refresh user
					setTimeout(async () => {
						const refreshedUsers = await fetchUsers();
						const refreshedUser = refreshedUsers.find((u: UserEntry) => u.userId === userId);
						if (refreshedUser) {
							setSelectedUser(refreshedUser);
						}
					}, 100);
				}
				
				setShowAssignBadgeModal(false);
				setAssigningToUserId(null);
			} else {
				// Read the response body
				let errorData: any = {};
				let rawText = "";
				
				try {
					// Clone response to read it safely
					const responseClone = response.clone();
					rawText = await responseClone.text();
					
					if (rawText && rawText.trim().length > 0) {
						try {
							if (contentType && contentType.includes("application/json")) {
								const parsed = JSON.parse(rawText);
								errorData = parsed;
							} else {
								errorData = { error: rawText };
							}
						} catch (jsonParseError) {
							console.error("JSON parse error:", jsonParseError);
							errorData = { error: rawText, rawResponse: true };
						}
					} else {
						errorData = { 
							error: `HTTP ${status}: ${statusText || "Unknown error"}`,
							message: "Empty response body"
						};
					}
				} catch (readError) {
					console.error("Error reading response:", readError);
					errorData = { 
						error: `HTTP ${status}: ${statusText || "Unknown error"}`,
						message: "Could not read error response"
					};
				}
				
				// Extract error information - access properties directly
				const errorText = (errorData as any)?.error || (errorData as any)?.message || `Failed to assign badge (HTTP ${status})`;
				const detailsText = (errorData as any)?.details || "";
				const availableBadgesList = (errorData as any)?.availableBadges;
				const badgeIdUsed = (errorData as any)?.badgeId;
				
				// Build available badges message
				let availableBadgesMsg = "";
				if (availableBadgesList && Array.isArray(availableBadgesList) && availableBadgesList.length > 0) {
					availableBadgesMsg = `\n\nAvailable badges:\n${availableBadgesList.map((b: any) => `- ${b.name || b.id || 'Unknown'}`).join('\n')}`;
				}
				
				// Show a more user-friendly error message
				if (status === 404) {
					let msg = "Badge not found. ";
					if (badgeIdUsed) {
						msg += `The badge ID "${badgeIdUsed.substring(0, 12)}..." was not found. `;
					}
					msg += "The badge may have been deleted or doesn't exist.";
					if (availableBadgesMsg) {
						msg += availableBadgesMsg;
					}
					msg += "\n\nPlease refresh the page to see the current list of badges.";
					alert(`Error: ${msg}`);
					// Refresh badges list
					await fetchBadges();
				} else {
					alert(`Error: ${errorText}${detailsText ? `\n\nDetails: ${detailsText}` : ""}${availableBadgesMsg}`);
				}
			}
		} catch (error) {
			console.error("Error assigning badge:", error);
			const errorMessage = error instanceof Error ? error.message : "Network error or failed to assign badge";
			alert(`Failed to assign badge: ${errorMessage}`);
		}
	}

	async function removeBadgeFromUser(userId: string, badgeId: string) {
		try {
			const response = await fetch(
				`/api/badges/assign?badgeId=${badgeId}&targetUserId=${userId}&companyId=${companyId}`,
				{
					method: "DELETE",
				}
			);

			if (response.ok) {
				// Refresh users to show the updated badges
				const updatedUsers = await fetchUsers();
				
				// Update selected user in detail modal if it's open
				if (showUserDetailModal && selectedUser && selectedUser.userId === userId) {
					const updatedUser = updatedUsers.find((u: UserEntry) => u.userId === userId);
					if (updatedUser) {
						setSelectedUser(updatedUser);
					}
				}
			} else {
				const errorData = await response.json();
				alert(`Error: ${errorData.error || "Failed to remove badge"}`);
			}
		} catch (error) {
			console.error("Error removing badge:", error);
			alert("Failed to remove badge");
		}
	}


	function handleDragStart(e: React.DragEvent, badgeId: string) {
		e.dataTransfer.setData("badgeId", badgeId);
	}

	function handleDragOver(e: React.DragEvent) {
		e.preventDefault();
	}

	function handleDrop(e: React.DragEvent, targetBadgeId: string) {
		e.preventDefault();
		const draggedBadgeId = e.dataTransfer.getData("badgeId");
		
		if (draggedBadgeId === targetBadgeId) return;

		const draggedIndex = badges.findIndex((b) => b.id === draggedBadgeId);
		const targetIndex = badges.findIndex((b) => b.id === targetBadgeId);

		if (draggedIndex === -1 || targetIndex === -1) return;

		const newBadges = [...badges];
		const [removed] = newBadges.splice(draggedIndex, 1);
		newBadges.splice(targetIndex, 0, removed);

		const newOrder = newBadges.map((b) => b.id);
		updateBadgeOrder(newOrder);
	}

	const filteredUsers = users.filter((user) => {
		if (!searchQuery || searchQuery.trim() === "") return true;
		const query = searchQuery.toLowerCase().trim();
		const displayName = (user.displayName || "").toLowerCase();
		const username = (user.username || "").toLowerCase();
		const userId = (user.userId || "").toLowerCase();
		return (
			displayName.includes(query) ||
			username.includes(query) ||
			userId.includes(query)
		);
	});

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<p className="text-gray-10">Loading...</p>
			</div>
		);
	}

	if (!companyId || companyId.trim() === "") {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen p-8 max-w-6xl mx-auto">
				<div className="border border-red-300 rounded-lg p-6 bg-red-50 max-w-2xl">
					<h2 className="text-7 font-bold mb-4 text-red-800">Company ID Missing</h2>
					<p className="text-gray-700 mb-4">
						Unable to retrieve the company ID from the experience. This might be due to:
					</p>
					<ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
						<li>The experience doesn't have an associated company</li>
						<li>The company ID property name might be different</li>
						<li>There might be an issue with the Whop API response</li>
					</ul>
					<p className="text-sm text-gray-600">
						Please check the server console logs for more details about the experience object structure.
					</p>
					<p className="text-sm text-gray-600 mt-4">
						If you're a developer, check the browser console (F12) for the logged experience object to see what properties are available.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col p-8 gap-6 max-w-6xl mx-auto">
			<div className="flex justify-end items-center gap-2">
				{isAdmin && (
					<Button
						variant="classic"
						size="3"
						onClick={() => {
							setShowSettings(true);
						}}
					>
						Badges
					</Button>
				)}
			</div>

			{/* Search Bar */}
			<div className="relative">
				<input
					type="text"
					placeholder="Search users..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="w-full px-4 py-2 border border-gray-a4 rounded-full bg-background"
				/>
			</div>

			{/* Settings Modal for Admin */}
			{showSettings && isAdmin && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowSettings(false)}>
					<div className="bg-background border border-gray-a4 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
						<div className="flex justify-between items-center mb-4">
							<h2 className="text-7 font-bold">Badge Management</h2>
							<Button
								variant="ghost"
								size="2"
								onClick={() => setShowSettings(false)}
								className="text-gray-10"
							>
								✕
							</Button>
						</div>

						{!companyId && (
							<div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
								⚠️ Warning: Company ID is missing. Please refresh the page.
							</div>
						)}

						<div className="mb-4 flex gap-2">
							<Button
								variant="classic"
								size="3"
								onClick={() => {
									setEditingBadge(null);
									setFormData({ name: "", emoji: "🏆", color: "#3B82F6", description: "" });
									setShowSettings(false);
									setShowCreateBadgeModal(true);
								}}
							>
								+ Create Badge
							</Button>
						</div>

						{/* Badge List with Drag & Drop */}
						<div>
							<h3 className="text-6 font-bold mb-3">Badge Order (Drag to reorder)</h3>
							<p className="text-sm text-gray-10 mb-4">
								Drag badges to set their value. Lower position = higher value.
							</p>
							{badges.length === 0 ? (
								<p className="text-sm text-gray-10">No badges created yet. Click "Create Badge" to get started.</p>
							) : (
								<div className="space-y-2">
									{badges.map((badge, index) => (
										<div
											key={badge.id}
											draggable
											onDragStart={(e) => handleDragStart(e, badge.id)}
											onDragOver={handleDragOver}
											onDrop={(e) => handleDrop(e, badge.id)}
											className="flex items-center gap-4 p-3 border border-gray-a4 rounded-lg bg-gray-a2 cursor-move hover:bg-gray-a3"
										>
											<div className="text-gray-10">⋮⋮</div>
											<BadgeDisplay badge={badge} size="md" />
											<div className="flex-1">
												{badge.description && (
													<p className="text-sm text-gray-10">{badge.description}</p>
												)}
											</div>
											<div className="flex gap-2">
												<Button
													variant="ghost"
													size="2"
													onClick={() => {
														console.log("=== EDITING BADGE ===");
														console.log("Badge to edit:", badge);
														console.log("Badge ID:", badge.id);
														// Create a fresh badge reference to avoid stale data
														const badgeToEdit = {
															id: badge.id,
															name: badge.name,
															emoji: badge.emoji,
															color: badge.color,
															description: badge.description,
															companyId: badge.companyId,
															createdAt: badge.createdAt,
															createdBy: badge.createdBy,
															order: badge.order,
														};
														setEditingBadge(badgeToEdit);
														setFormData({
															name: badge.name,
															emoji: badge.emoji,
															color: badge.color,
															description: badge.description,
														});
														setShowSettings(false);
														setShowCreateBadgeModal(true);
													}}
												>
													Edit
												</Button>
												<Button
													variant="ghost"
													size="2"
													onClick={() => deleteBadge(badge.id)}
													className="text-red-600 hover:text-red-700"
												>
													Delete
												</Button>
											</div>
										</div>
									))}
								</div>
							)}
						</div>

						{/* Notification Toggle - Below all badges */}
						<div className="mt-6 p-3 bg-gray-a2 rounded-lg flex items-center justify-between border-t border-gray-a4 pt-4">
							<label className="text-sm font-medium cursor-pointer flex items-center gap-2">
								<input
									type="checkbox"
									checked={showNotifications}
									onChange={(e) => setShowNotifications(e.target.checked)}
									className="w-4 h-4 rounded cursor-pointer"
								/>
								<span>Show notification when badge is awarded</span>
							</label>
						</div>
					</div>
				</div>
			)}

			{/* Create/Edit Badge Modal */}
			{showCreateBadgeModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowCreateBadgeModal(false)}>
					<div className="bg-background border border-gray-a4 rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
						<h2 className="text-7 font-bold mb-4">
							{editingBadge ? "Edit Badge" : "Create Badge"}
						</h2>

						<form onSubmit={editingBadge ? updateBadge : createBadge} className="space-y-4">
						<div>
							<label className="block text-sm font-medium mb-2">Badge Name</label>
							<input
								type="text"
								required
								value={formData.name}
								onChange={(e) => setFormData({ ...formData, name: e.target.value })}
								placeholder="e.g., OG, Top Earner, Verified"
								className="w-full px-3 py-2 border border-gray-a4 rounded-lg bg-background"
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium mb-2">Emoji</label>
								<input
									type="text"
									required
									value={formData.emoji}
									onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
									placeholder="🏆"
									maxLength={2}
									className="w-full px-3 py-2 border border-gray-a4 rounded-lg bg-background text-2xl text-center"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">Color</label>
								<input
									type="color"
									value={formData.color}
									onChange={(e) => setFormData({ ...formData, color: e.target.value })}
									className="w-full h-10 border border-gray-a4 rounded-lg"
								/>
							</div>
						</div>

						<div>
							<label className="block text-sm font-medium mb-2">Description (optional)</label>
							<input
								type="text"
								value={formData.description}
								onChange={(e) => setFormData({ ...formData, description: e.target.value })}
								placeholder="What does this badge represent?"
								className="w-full px-3 py-2 border border-gray-a4 rounded-lg bg-background"
							/>
						</div>

							<div className="flex gap-2">
								<Button type="submit" variant="classic" size="3">
									{editingBadge ? "Update Badge" : "Create Badge"}
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="3"
									onClick={() => {
										setEditingBadge(null);
										setFormData({ name: "", emoji: "🏆", color: "#3B82F6", description: "" });
										setShowCreateBadgeModal(false);
									}}
								>
									Cancel
								</Button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* Assign Badge Modal */}
			{showAssignBadgeModal && assigningToUserId && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => {
					setShowAssignBadgeModal(false);
					setAssigningToUserId(null);
				}}>
					<div className="bg-background border border-gray-a4 rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
						<h2 className="text-7 font-bold mb-4">Assign Badge</h2>
						<p className="text-sm text-gray-10 mb-4">
							Click on a badge to assign it to this user
						</p>
						{badges.length === 0 ? (
							<div className="text-center py-8">
								<p className="text-gray-10 mb-4">No badges available. Create one first.</p>
								<Button
									variant="ghost"
									size="3"
									onClick={() => {
										setShowAssignBadgeModal(false);
										setAssigningToUserId(null);
										setShowCreateBadgeModal(true);
									}}
								>
									Create Badge
								</Button>
							</div>
						) : (
							<div className="space-y-2">
								{badges.map((badge) => {
									// Verify badge exists and has valid ID
									if (!badge || !badge.id) {
										console.warn("Invalid badge in list:", badge);
										return null;
									}
									return (
										<button
											key={badge.id}
											onClick={async () => {
												if (!assigningToUserId) {
													console.error("No user ID set for assignment");
													return;
												}
												console.log("=== CLICKED BADGE TO ASSIGN ===");
												console.log("Badge clicked:", {
													badgeId: badge.id,
													badgeIdTrimmed: badge.id.trim(),
													badgeName: badge.name,
													badgeCompanyId: badge.companyId,
													currentCompanyId: companyId,
													companyIdsMatch: badge.companyId === companyId,
													userId: assigningToUserId,
													badgeIdLength: badge.id.length,
													badgeIdType: typeof badge.id
												});
												
												// Verify badge belongs to this company before assigning
												if (badge.companyId !== companyId) {
													console.error("Company mismatch:", {
														badgeCompanyId: badge.companyId,
														expectedCompanyId: companyId
													});
													alert(`Error: Badge "${badge.name}" does not belong to this company. Please refresh the page.`);
													await fetchBadges();
													return;
												}
												
												// Verify badge ID is valid
												if (!badge.id || badge.id.trim() === "") {
													console.error("Invalid badge ID:", badge);
													alert("Error: Invalid badge ID. Please refresh the page.");
													await fetchBadges();
													return;
												}
												
												console.log("Calling assignBadgeToUser with badgeId:", badge.id);
												await assignBadgeToUser(assigningToUserId, badge.id);
											}}
											className="w-full text-left p-3 border border-gray-a4 rounded-lg bg-background hover:bg-gray-a2 transition-all flex items-center gap-3"
										>
											<BadgeDisplay badge={badge} size="md" />
											{badge.description && (
												<span className="text-sm text-gray-10 ml-auto">{badge.description}</span>
											)}
										</button>
									);
								})}
							</div>
						)}
						<div className="mt-4 flex justify-end">
							<Button
								variant="ghost"
								size="3"
								onClick={() => {
									setShowAssignBadgeModal(false);
									setAssigningToUserId(null);
								}}
							>
								Cancel
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* User List */}
			<div>
				{loading ? (
					<div className="text-center py-8 text-gray-10">
						<p className="text-3">Loading users...</p>
					</div>
				) : filteredUsers.length === 0 ? (
						<div className="text-center py-8 text-gray-10">
						<p className="text-3">
							{searchQuery ? "No users found matching your search" : "No users found"}
						</p>
						<p className="text-sm mt-2 text-gray-9">
							{users.length === 0 && !searchQuery 
								? "No users with badges yet. Assign badges to see them here, or check if company members API is available."
								: ""}
						</p>
						</div>
					) : (
					<div className="space-y-3">
						{filteredUsers.map((user) => (
							<div
								key={user.userId}
								onClick={() => {
									setSelectedUser(user);
									setShowUserDetailModal(true);
								}}
								className={`border border-gray-a4 rounded-2xl p-4 flex items-center gap-4 transition-all cursor-pointer ${
									user.userId === currentUserId
											? "bg-blue-50 border-blue-300 shadow-sm"
											: "bg-background hover:bg-gray-a2"
									}`}
								>
								{/* Profile Picture */}
								<div className="relative w-12 h-12 flex-shrink-0">
									{user.avatar && typeof user.avatar === "string" && user.avatar.trim() !== "" ? (
										<img
											src={user.avatar}
											alt={user.displayName}
											className="w-12 h-12 rounded-full object-cover border border-gray-a4"
											onError={(e) => {
												// Fallback to initial if image fails to load
												console.log("Image failed to load:", user.avatar);
												const target = e.target as HTMLImageElement;
												target.style.display = "none";
												const parent = target.parentElement;
												if (parent) {
													const fallback = parent.querySelector('.avatar-fallback') as HTMLElement;
													if (fallback) {
														fallback.style.display = "flex";
													}
												}
											}}
										/>
									) : null}
									<div
										className={`avatar-fallback w-12 h-12 rounded-full bg-gray-a4 flex items-center justify-center text-lg font-bold text-gray-10 border border-gray-a4 ${
											user.avatar && typeof user.avatar === "string" && user.avatar.trim() !== "" ? "hidden" : ""
										}`}
									>
										{user.displayName && user.displayName.length > 0 ? user.displayName.charAt(0).toUpperCase() : "?"}
									</div>
								</div>

								{/* Name */}
								<div className="flex-1">
									<h3 className="font-semibold text-lg">
										{user.displayName || user.username || `User ${user.userId.substring(0, 8)}`}
										{user.userId === currentUserId && (
											<span className="ml-2 text-sm text-blue-600 font-normal">(You)</span>
										)}
									</h3>
									{user.username && (
										<p className="text-sm text-gray-10">@{user.username}</p>
									)}
								</div>

								{/* Badge and Add Button on Right */}
								<div className="flex items-center gap-3">
									{user.highestBadge ? (
										<BadgeDisplay badge={user.highestBadge} size="md" />
									) : (
										<span className="text-sm text-gray-10 italic">No badge</span>
									)}
									{isAdmin && (
										<Button
											variant="ghost"
											size="2"
											onClick={async (e) => {
												e.stopPropagation(); // Prevent opening user detail modal
												// Refresh badges before showing modal to ensure we have the latest list
												await fetchBadges();
												setAssigningToUserId(user.userId);
												setShowAssignBadgeModal(true);
											}}
											className="text-xs whitespace-nowrap w-8 h-8 p-0 flex items-center justify-center"
										>
											+
										</Button>
											)}
										</div>
							</div>
						))}
					</div>
				)}

			{/* User Detail Modal */}
			{showUserDetailModal && selectedUser && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => {
					setShowUserDetailModal(false);
					setSelectedUser(null);
				}}>
					<div className="bg-background border border-gray-a4 rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
						<h2 className="text-7 font-bold mb-4">User Profile</h2>
						
						{/* User Info Section */}
						<div className="flex items-start gap-4 mb-6">
							{/* Profile Picture */}
							<div className="relative w-20 h-20 flex-shrink-0">
								{selectedUser.avatar && typeof selectedUser.avatar === "string" && selectedUser.avatar.trim() !== "" ? (
									<img
										src={selectedUser.avatar}
										alt={selectedUser.displayName}
										className="w-20 h-20 rounded-full object-cover border border-gray-a4"
										onError={(e) => {
											const target = e.target as HTMLImageElement;
											target.style.display = "none";
											const parent = target.parentElement;
											if (parent) {
												const fallback = parent.querySelector('.avatar-fallback') as HTMLElement;
												if (fallback) {
													fallback.style.display = "flex";
												}
											}
										}}
									/>
								) : null}
								<div
									className={`avatar-fallback w-20 h-20 rounded-full bg-gray-a4 flex items-center justify-center text-3xl font-bold text-gray-10 border border-gray-a4 ${
										selectedUser.avatar && typeof selectedUser.avatar === "string" && selectedUser.avatar.trim() !== "" ? "hidden" : ""
									}`}
								>
									{selectedUser.displayName && selectedUser.displayName.length > 0 ? selectedUser.displayName.charAt(0).toUpperCase() : "?"}
								</div>
							</div>
							
							{/* User Details */}
										<div className="flex-1">
								<h3 className="text-2xl font-bold mb-1">
									{selectedUser.displayName || selectedUser.username || `User ${selectedUser.userId.substring(0, 8)}`}
									{selectedUser.userId === currentUserId && (
										<span className="ml-2 text-sm text-blue-600 font-normal">(You)</span>
									)}
								</h3>
								{selectedUser.username && (
									<p className="text-gray-10 mb-2">@{selectedUser.username}</p>
								)}
								<p className="text-sm text-gray-9">User ID: {selectedUser.userId}</p>
							</div>
						</div>

						{/* Badges Section */}
						<div className="mb-6">
							<div className="flex items-center justify-between mb-3">
								<h3 className="text-lg font-semibold">Badges ({selectedUser.badges.length})</h3>
								{isAdmin && (
									<Button
										variant="ghost"
										size="3"
										onClick={async () => {
											setShowUserDetailModal(false);
											await fetchBadges();
											setAssigningToUserId(selectedUser.userId);
											setShowAssignBadgeModal(true);
										}}
										className="text-xs"
									>
										Add Badge
									</Button>
								)}
							</div>
							
							{selectedUser.badges.length > 0 ? (
								<div className="space-y-2">
									{selectedUser.badges.map((badge) => (
										<div
											key={badge.id}
											className="flex items-center justify-between p-3 border border-gray-a4 rounded-lg bg-background"
										>
											<div className="flex items-center gap-3">
												<BadgeDisplay badge={badge} size="md" />
												<div>
													<p className="font-medium">{badge.name}</p>
													{badge.description && (
														<p className="text-sm text-gray-10">{badge.description}</p>
													)}
											</div>
											</div>
											{isAdmin && (
												<Button
													variant="ghost"
													size="2"
													onClick={async () => {
														await removeBadgeFromUser(selectedUser.userId, badge.id);
														// The removeBadgeFromUser function already handles refreshing and updating the modal
													}}
													className="text-red-600 hover:text-red-700 text-xs"
												>
													Remove
												</Button>
											)}
										</div>
									))}
									</div>
							) : (
								<div className="text-center py-8 border border-gray-a4 rounded-lg bg-gray-a2">
									<p className="text-gray-10 mb-3">No badges assigned</p>
									{isAdmin && (
										<Button
											variant="ghost"
											size="3"
											onClick={async () => {
												setShowUserDetailModal(false);
												await fetchBadges();
												setAssigningToUserId(selectedUser.userId);
												setShowAssignBadgeModal(true);
											}}
										>
											Add Badge
										</Button>
									)}
								</div>
							)}
										</div>

						<div className="flex justify-end">
							<Button
								variant="ghost"
								size="3"
								onClick={() => {
									setShowUserDetailModal(false);
									setSelectedUser(null);
								}}
							>
								Close
							</Button>
									</div>
								</div>
						</div>
					)}

			{/* Notification Toast */}
			{notification && (
				<div 
					className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] rounded-xl px-4 py-3 shadow-2xl min-w-[280px] max-w-[420px] backdrop-blur-md transition-all duration-300 ease-out"
					style={{
						backgroundColor: 'rgba(22, 163, 74, 0.95)',
						border: '1px solid rgba(255, 255, 255, 0.2)',
						boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(255, 255, 255, 0.05)'
					}}
				>
					<div className="flex items-center gap-3">
						<div className="flex-shrink-0 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
							<svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
							</svg>
						</div>
						<p className="text-sm font-semibold text-white flex-1 leading-tight">{notification.message}</p>
					</div>
					<div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
						<div 
							className="h-full bg-white/90 transition-all duration-75 ease-linear rounded-full"
							style={{ width: `${notification.progress}%` }}
						/>
					</div>
				</div>
			)}
			</div>
		</div>
	);
}

