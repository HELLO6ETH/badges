import { Button } from "@whop/react/components";
import Link from "next/link";

export default function Page() {
	return (
		<div className="py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-2xl mx-auto rounded-3xl bg-gray-a2 p-4 border border-gray-a4">
				<div className="text-center mt-8 mb-12">
					<h1 className="text-8 font-bold text-gray-12 mb-4">
						🏆 Badge System
					</h1>
					<p className="text-4 text-gray-10 mb-2">
						Boost community pride and engagement with custom badges
					</p>
					<p className="text-3 text-gray-9">
						Design badges like "OG," "Top Earner," "Verified," or "100-Day
						Streak" that show up on profiles and leaderboards.
					</p>
				</div>

				<div className="flex flex-col gap-3">
					<Link href="https://docs.whop.com/apps" target="_blank" className="w-full">
						<Button variant="classic" className="w-full" size="4">
							📚 Developer Docs
						</Button>
					</Link>
					<p className="text-xs text-gray-10 text-center">
						Configure your app paths in the Whop developer dashboard to get
						started
					</p>
				</div>
			</div>
		</div>
	);
}