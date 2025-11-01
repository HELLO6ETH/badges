import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";
import ExperienceClient from "./ExperienceClient";

export default async function ExperiencePage({
	params,
}: {
	params: Promise<{ experienceId: string }>;
}) {
	const { experienceId } = await params;
	const { userId } = await whopsdk.verifyUserToken(await headers());

	// Fetch the necessary data from Whop
	const [experience, user] = await Promise.all([
		whopsdk.experiences.retrieve(experienceId),
		whopsdk.users.retrieve(userId),
	]);

	const displayName = user.name || `@${user.username}`;
	
	// Try different property names for companyId
	// Log the experience object to debug what properties are available
	console.log("=== EXPERIENCE PAGE DEBUG ===");
	console.log("Experience object keys:", Object.keys(experience));
	console.log("Experience object:", JSON.stringify(experience, null, 2));
	
	const companyId = 
		experience.company_id || 
		experience.companyId || 
		(experience as any).company?.id ||
		(experience as any).company_id ||
		(experience as any).company_id ||
		process.env.COMPANY_ID || // Fallback to env variable
		"";

	console.log("Extracted companyId:", companyId);
	console.log("CompanyId from env:", process.env.COMPANY_ID);
	console.log("CompanyIds match:", companyId === process.env.COMPANY_ID);

	// If still no companyId, log a warning with the full experience object
	if (!companyId) {
		console.error("CompanyId not found in experience object. Available keys:", Object.keys(experience));
		console.error("Full experience object:", experience);
	}

	return (
		<ExperienceClient
			experienceId={experienceId}
			companyId={companyId}
			currentUserId={userId}
			currentUserName={displayName}
		/>
	);
}