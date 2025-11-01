// Simple in-memory storage for badges
// In production, you'd use a database like PostgreSQL, MongoDB, or Supabase

export interface Badge {
	id: string;
	companyId: string;
	name: string;
	emoji: string;
	color: string;
	description: string;
	createdAt: string;
	createdBy: string;
	order: number; // Lower number = higher value/priority
}

export interface BadgeAssignment {
	id: string;
	badgeId: string;
	userId: string;
	companyId: string;
	assignedAt: string;
	assignedBy: string;
}

// In-memory storage - use global to persist across Next.js module reloads
// In Next.js, modules can be re-evaluated during hot reloading, which would reset these Maps
// By using globalThis, we ensure the data persists across module reloads
declare global {
	var __badgesStore: Map<string, Badge> | undefined;
	var __assignmentsStore: Map<string, BadgeAssignment> | undefined;
	var __companyUsersStore: Map<string, Set<string>> | undefined;
}

const badgesStore = globalThis.__badgesStore ?? (globalThis.__badgesStore = new Map<string, Badge>());
const assignmentsStore = globalThis.__assignmentsStore ?? (globalThis.__assignmentsStore = new Map<string, BadgeAssignment>());
// Track users who have accessed each company (for showing users without badges)
const companyUsersStore = globalThis.__companyUsersStore ?? (globalThis.__companyUsersStore = new Map<string, Set<string>>());

// Generate IDs
function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Badge operations
export const badgeService = {
	create(badge: Omit<Badge, "id" | "createdAt" | "order">): Badge {
		// Get the highest order number and add 1
		const existingBadges = this.getByCompany(badge.companyId);
		const maxOrder = existingBadges.length > 0 
			? Math.max(...existingBadges.map(b => b.order))
			: -1;
		
		const newBadge: Badge = {
			...badge,
			id: generateId(),
			createdAt: new Date().toISOString(),
			order: maxOrder + 1,
		};
		badgesStore.set(newBadge.id, newBadge);
		return newBadge;
	},

	getById(id: string): Badge | undefined {
		const trimmedId = id?.trim();
		if (!trimmedId) return undefined;
		return badgesStore.get(trimmedId);
	},
	
	// Debug method to get all badges (for debugging)
	getAllBadges(): Badge[] {
		return Array.from(badgesStore.values());
	},

	getByCompany(companyId: string): Badge[] {
		return Array.from(badgesStore.values())
			.filter((badge) => badge.companyId === companyId)
			.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
	},

	update(id: string, updates: Partial<Omit<Badge, "id" | "createdAt">>): Badge | null {
		const trimmedId = id?.trim();
		if (!trimmedId) return null;
		
		const badge = badgesStore.get(trimmedId);
		if (!badge) {
			console.error(`Badge not found for update. ID: "${trimmedId}"`);
			console.error("Available badge IDs:", Array.from(badgesStore.keys()));
			return null;
		}
		
		console.log("Updating badge:", {
			id: trimmedId,
			current: { name: badge.name, emoji: badge.emoji, color: badge.color },
			updates
		});
		
		const updated = { 
			...badge, 
			...updates,
			// Ensure order is preserved if not being updated
			order: updates.order !== undefined ? updates.order : badge.order
		};
		badgesStore.set(trimmedId, updated);
		
		// Verify it was saved
		const verify = badgesStore.get(trimmedId);
		if (!verify) {
			console.error("CRITICAL: Badge was updated but not found in store after save!");
		} else {
			console.log("✅ Badge updated and verified in store:", { id: verify.id, name: verify.name });
		}
		
		return updated;
	},

	delete(id: string): boolean {
		// Also delete all assignments for this badge
		const assignments = Array.from(assignmentsStore.values()).filter(
			(a) => a.badgeId === id,
		);
		assignments.forEach((assignment) => {
			assignmentsStore.delete(assignment.id);
		});
		return badgesStore.delete(id);
	},

	// Assignment operations
	assign(badgeId: string, userId: string, companyId: string, assignedBy: string): BadgeAssignment {
		// Check if already assigned
		const existing = Array.from(assignmentsStore.values()).find(
			(a) => a.userId === userId && a.companyId === companyId && a.badgeId === badgeId,
		);
		if (existing) return existing;

		const assignment: BadgeAssignment = {
			id: generateId(),
			badgeId,
			userId,
			companyId,
			assignedAt: new Date().toISOString(),
			assignedBy,
		};
		assignmentsStore.set(assignment.id, assignment);
		return assignment;
	},

	unassign(badgeId: string, userId: string, companyId: string): boolean {
		const assignment = Array.from(assignmentsStore.values()).find(
			(a) => a.userId === userId && a.companyId === companyId && a.badgeId === badgeId,
		);
		if (!assignment) return false;
		return assignmentsStore.delete(assignment.id);
	},

	getUserAssignments(userId: string, companyId: string): BadgeAssignment[] {
		return Array.from(assignmentsStore.values()).filter(
			(a) => a.userId === userId && a.companyId === companyId,
		);
	},

	getAssignmentsByBadge(badgeId: string): BadgeAssignment[] {
		return Array.from(assignmentsStore.values()).filter((a) => a.badgeId === badgeId);
	},

	getUserBadges(userId: string, companyId: string): Badge[] {
		const assignments = Array.from(assignmentsStore.values()).filter(
			(a) => a.userId === userId && a.companyId === companyId,
		);
		return assignments
			.map((assignment) => badgesStore.get(assignment.badgeId))
			.filter((badge): badge is Badge => badge !== undefined)
			.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
	},

	getAllUsersWithBadges(companyId: string): Array<{
		userId: string;
		badges: Badge[];
		totalBadges: number;
		highestBadgeOrder: number; // For sorting by badge value
	}> {
		const userMap = new Map<string, Badge[]>();

		// Get all assignments for this company
		const assignments = Array.from(assignmentsStore.values()).filter(
			(a) => a.companyId === companyId,
		);

		assignments.forEach((assignment) => {
			const badge = badgesStore.get(assignment.badgeId);
			if (badge) {
				const existing = userMap.get(assignment.userId) || [];
				userMap.set(assignment.userId, [...existing, badge]);
			}
		});

		return Array.from(userMap.entries()).map(([userId, badges]) => {
			// Sort badges by order and get the highest value badge (lowest order number)
			const sortedBadges = badges.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
			const highestBadgeOrder = sortedBadges.length > 0 ? sortedBadges[0].order : Infinity;
			
			return {
				userId,
				badges: sortedBadges,
				totalBadges: badges.length,
				highestBadgeOrder,
			};
		});
	},

	updateOrder(badgeIds: string[]): boolean {
		// Update the order of badges based on the provided array
		badgeIds.forEach((badgeId, index) => {
			const badge = badgesStore.get(badgeId);
			if (badge) {
				badgesStore.set(badgeId, { ...badge, order: index });
			}
		});
		return true;
	},

	// Track a user accessing a company (so we can show users without badges)
	trackUserAccess(companyId: string, userId: string): void {
		if (!companyUsersStore.has(companyId)) {
			companyUsersStore.set(companyId, new Set());
		}
		companyUsersStore.get(companyId)!.add(userId);
	},

	// Get all tracked users for a company
	getTrackedUsers(companyId: string): string[] {
		const users = companyUsersStore.get(companyId);
		return users ? Array.from(users) : [];
	},
};
