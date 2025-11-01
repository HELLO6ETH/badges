"use client";

import { Button } from "@whop/react/components";
import { useEffect, useState } from "react";
import type { Badge } from "@/lib/badges";
import { BadgeDisplay } from "@/components/BadgeDisplay";

interface DashboardClientProps {
	companyId: string;
}

export default function DashboardClient({ companyId }: DashboardClientProps) {
	const [badges, setBadges] = useState<Badge[]>([]);
	const [loading, setLoading] = useState(true);
	const [showCreateForm, setShowCreateForm] = useState(false);
	const [formData, setFormData] = useState({
		name: "",
		emoji: "🏆",
		color: "#3B82F6",
		description: "",
	});

	useEffect(() => {
		fetchBadges();
	}, []);

	async function fetchBadges() {
		try {
			const response = await fetch(`/api/badges?companyId=${companyId}`);
			const data = await response.json();
			if (data.badges) {
				setBadges(data.badges);
			}
			setLoading(false);
		} catch (error) {
			console.error("Error fetching badges:", error);
			setLoading(false);
		}
	}

	async function createBadge(e: React.FormEvent) {
		e.preventDefault();

		try {
			const response = await fetch("/api/badges", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ...formData, companyId }),
			});

			if (response.ok) {
				const data = await response.json();
				setBadges([...badges, data.badge]);
				setFormData({ name: "", emoji: "🏆", color: "#3B82F6", description: "" });
				setShowCreateForm(false);
			} else {
				const errorData = await response.json();
				alert(`Error: ${errorData.error || "Failed to create badge"}`);
			}
		} catch (error) {
			console.error("Error creating badge:", error);
			alert("Failed to create badge");
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
			} else {
				const errorData = await response.json();
				alert(`Error: ${errorData.error || "Failed to delete badge"}`);
			}
		} catch (error) {
			console.error("Error deleting badge:", error);
			alert("Failed to delete badge");
		}
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<p className="text-gray-10">Loading...</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col p-8 gap-6 max-w-6xl mx-auto">
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-9 font-bold mb-2">Badge Manager</h1>
					<p className="text-3 text-gray-10">
						Design and assign badges to boost community engagement and pride
					</p>
				</div>
				<Button
					variant="classic"
					size="3"
					onClick={() => setShowCreateForm(!showCreateForm)}
				>
					{showCreateForm ? "Cancel" : "+ Create Badge"}
				</Button>
			</div>

			{showCreateForm && (
				<div className="border border-gray-a4 rounded-lg p-6 bg-gray-a2">
					<h2 className="text-6 font-bold mb-4">Create New Badge</h2>
					<form onSubmit={createBadge} className="flex flex-col gap-4">
						<div>
							<label className="block text-sm font-medium mb-2">Badge Name</label>
							<input
								type="text"
								required
								value={formData.name}
								onChange={(e) =>
									setFormData({ ...formData, name: e.target.value })
								}
								placeholder="e.g., OG, Top Earner, Verified, 100-Day Streak"
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
									onChange={(e) =>
										setFormData({ ...formData, emoji: e.target.value })
									}
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
									onChange={(e) =>
										setFormData({ ...formData, color: e.target.value })
									}
									className="w-full h-10 border border-gray-a4 rounded-lg"
								/>
							</div>
						</div>

						<div>
							<label className="block text-sm font-medium mb-2">
								Description (optional)
							</label>
							<input
								type="text"
								value={formData.description}
								onChange={(e) =>
									setFormData({ ...formData, description: e.target.value })
								}
								placeholder="What does this badge represent?"
								className="w-full px-3 py-2 border border-gray-a4 rounded-lg bg-background"
							/>
						</div>

						<div className="flex gap-2">
							<Button type="submit" variant="classic" size="3">
								Create Badge
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="3"
								onClick={() => setShowCreateForm(false)}
							>
								Cancel
							</Button>
						</div>
					</form>
				</div>
			)}

			<div>
				<h2 className="text-7 font-bold mb-4">
					Your Badges ({badges.length})
				</h2>
				{badges.length === 0 ? (
					<div className="border border-gray-a4 rounded-lg p-8 text-center bg-gray-a2">
						<p className="text-gray-10 mb-4">
							No badges created yet. Create your first badge to get started!
						</p>
					</div>
				) : (
					<div className="grid gap-4">
						{badges.map((badge) => (
							<div
								key={badge.id}
								className="border border-gray-a4 rounded-lg p-4 bg-gray-a2 flex items-center justify-between"
							>
								<div className="flex items-center gap-4">
									<BadgeDisplay badge={badge} size="lg" />
									{badge.description && (
										<p className="text-sm text-gray-10">{badge.description}</p>
									)}
								</div>
								<Button
									variant="ghost"
									size="2"
									onClick={() => deleteBadge(badge.id)}
									className="text-red-600 hover:text-red-700"
								>
									Delete
								</Button>
							</div>
						))}
					</div>
				)}
			</div>

			<div>
				<h2 className="text-7 font-bold mb-4">Assign Badges</h2>
				<p className="text-sm text-gray-10 mb-4">
					To assign badges, use the Whop user ID of the member you want to assign
					to. You can find user IDs in your Whop dashboard.
				</p>
				<BadgeAssignmentForm
					badges={badges}
					companyId={companyId}
					onAssign={fetchBadges}
				/>
			</div>
		</div>
	);
}

function BadgeAssignmentForm({
	badges,
	companyId,
	onAssign,
}: {
	badges: Badge[];
	companyId: string;
	onAssign: () => void;
}) {
	const [targetUserId, setTargetUserId] = useState("");
	const [selectedBadgeId, setSelectedBadgeId] = useState("");
	const [isAssigning, setIsAssigning] = useState(false);

	async function handleAssign(e: React.FormEvent) {
		e.preventDefault();
		if (!selectedBadgeId || !targetUserId) return;

		setIsAssigning(true);
		try {
			const response = await fetch("/api/badges/assign", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					badgeId: selectedBadgeId,
					targetUserId,
					companyId,
				}),
			});

			if (response.ok) {
				setTargetUserId("");
				setSelectedBadgeId("");
				onAssign();
				alert("Badge assigned successfully!");
			} else {
				const data = await response.json();
				alert(`Error: ${data.error || "Failed to assign badge"}`);
			}
		} catch (error) {
			console.error("Error assigning badge:", error);
			alert("Failed to assign badge");
		} finally {
			setIsAssigning(false);
		}
	}

	if (badges.length === 0) {
		return (
			<div className="border border-gray-a4 rounded-lg p-4 bg-gray-a2 text-center">
				<p className="text-gray-10">
					Create a badge first before you can assign it
				</p>
			</div>
		);
	}

	return (
		<form onSubmit={handleAssign} className="border border-gray-a4 rounded-lg p-4 bg-gray-a2">
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
				<div>
					<label className="block text-sm font-medium mb-2">
						User ID (Whop user ID)
					</label>
					<input
						type="text"
						required
						value={targetUserId}
						onChange={(e) => setTargetUserId(e.target.value)}
						placeholder="Enter Whop user ID"
						className="w-full px-3 py-2 border border-gray-a4 rounded-lg bg-background"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium mb-2">Select Badge</label>
					<select
						required
						value={selectedBadgeId}
						onChange={(e) => setSelectedBadgeId(e.target.value)}
						className="w-full px-3 py-2 border border-gray-a4 rounded-lg bg-background"
					>
						<option value="">Choose a badge...</option>
						{badges.map((badge) => (
							<option key={badge.id} value={badge.id}>
								{badge.emoji} {badge.name}
							</option>
						))}
					</select>
				</div>
			</div>

			<Button type="submit" variant="classic" size="3" disabled={isAssigning}>
				{isAssigning ? "Assigning..." : "Assign Badge"}
			</Button>
		</form>
	);
}
