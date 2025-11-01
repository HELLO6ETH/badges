import type { Badge } from "@/lib/badges";

interface BadgeDisplayProps {
	badge: Badge;
	size?: "sm" | "md" | "lg";
	showDescription?: boolean;
}

export function BadgeDisplay({
	badge,
	size = "md",
	showDescription = false,
}: BadgeDisplayProps) {
	const sizeClasses = {
		sm: "text-xs px-2 py-1",
		md: "text-sm px-3 py-1.5",
		lg: "text-base px-4 py-2",
	};

	return (
		<div
			className="inline-flex items-center gap-2 rounded-lg border font-medium transition-all hover:scale-105"
			style={{
				backgroundColor: `${badge.color}15`,
				borderColor: `${badge.color}40`,
				color: badge.color,
			}}
		>
			<span className={sizeClasses[size]} style={{ fontSize: "1.2em" }}>
				{badge.emoji}
			</span>
			<span className={sizeClasses[size]}>{badge.name}</span>
			{showDescription && badge.description && (
				<span className="text-xs opacity-70">({badge.description})</span>
			)}
		</div>
	);
}

interface BadgeGridProps {
	badges: Badge[];
	emptyMessage?: string;
}

export function BadgeGrid({ badges, emptyMessage = "No badges yet" }: BadgeGridProps) {
	if (badges.length === 0) {
		return (
			<div className="text-center py-8 text-gray-10">
				<p className="text-3">{emptyMessage}</p>
			</div>
		);
	}

	return (
		<div className="flex flex-wrap gap-3">
			{badges.map((badge) => (
				<BadgeDisplay key={badge.id} badge={badge} />
			))}
		</div>
	);
}
