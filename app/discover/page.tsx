export default function DiscoverPage() {
	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
			<div className="max-w-4xl mx-auto px-4 py-16">
				{/* Title */}
				<h1 className="text-5xl font-bold text-gray-900 mb-6 text-center">
					Badges: Boost Community Pride & Engagement
				</h1>

				{/* Main Description Card */}
				<div className="bg-white rounded-xl p-8 shadow-md text-center mb-16">
					<p className="text-xl text-gray-600 max-w-2xl mx-auto mb-4">
						People love status. Design and assign custom badges like "OG," "Top
						Earner," "Verified," or "100-Day Streak" to reward your community
						members and drive engagement.
					</p>
					<p className="text-base text-gray-500 max-w-2xl mx-auto mb-2">
						Badges show up on member profiles and leaderboards, creating a
						competitive and pride-driven community atmosphere that keeps members
						coming back.
					</p>
					<p className="text-sm text-gray-400 max-w-2xl mx-auto">
						💡 <strong>Simple to build, drives engagement hard.</strong> Boost
						community pride and retention with visual recognition.
					</p>
				</div>

				{/* Features Section */}
				<div className="grid md:grid-cols-3 gap-6 mb-10">
					<div className="bg-white rounded-xl p-6 shadow-md flex flex-col gap-2">
						<div className="text-3xl mb-2">🎨</div>
						<h3 className="font-semibold text-gray-900">Design Custom Badges</h3>
						<p className="text-sm text-gray-600">
							Create unique badges with custom emojis, colors, and descriptions.
							Make them match your community's vibe.
						</p>
					</div>

					<div className="bg-white rounded-xl p-6 shadow-md flex flex-col gap-2">
						<div className="text-3xl mb-2">⭐</div>
						<h3 className="font-semibold text-gray-900">Assign & Recognize</h3>
						<p className="text-sm text-gray-600">
							Easily assign badges to members for achievements, milestones, or
							special recognition. Reward your community.
						</p>
					</div>

					<div className="bg-white rounded-xl p-6 shadow-md flex flex-col gap-2">
						<div className="text-3xl mb-2">🏆</div>
						<h3 className="font-semibold text-gray-900">Leaderboards</h3>
						<p className="text-sm text-gray-600">
							Show off top badge earners with community leaderboards. Creates
							healthy competition and engagement.
						</p>
					</div>
				</div>

				<h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
					Success Stories
				</h2>

				{/* Success Story Cards */}
				<div className="grid md:grid-cols-2 gap-6">
					<div className="bg-white rounded-xl p-6 shadow-md flex flex-col justify-between">
						<div>
							<h3 className="text-lg font-bold text-gray-900 mb-1">
								Elite Traders Community
							</h3>
							<p className="text-xs text-gray-500 mb-2">Trading Community</p>
							<p className="text-gray-700 mb-4 text-sm">
								"Badges like 'Top Earner' and '100-Day Streak' increased member
								retention by{" "}
								<span className="font-bold text-blue-600">35%</span>. Members love
								showing off their achievements!"
							</p>
							<div className="flex flex-wrap gap-2 mb-4">
								<span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
									🏆 OG
								</span>
								<span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
									💎 Top Earner
								</span>
								<span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
									✅ Verified
								</span>
							</div>
						</div>
					</div>

					<div className="bg-white rounded-xl p-6 shadow-md flex flex-col justify-between">
						<div>
							<h3 className="text-lg font-bold text-gray-900 mb-1">
								CryptoMasters
							</h3>
							<p className="text-xs text-gray-500 mb-2">Crypto Education</p>
							<p className="text-gray-700 mb-4 text-sm">
								"Daily engagement jumped{" "}
								<span className="font-bold text-blue-600">42%</span> after
								introducing badges. The leaderboard feature creates friendly
								competition that keeps members active."
							</p>
							<div className="flex flex-wrap gap-2 mb-4">
								<span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">
									🔥 Hot Streak
								</span>
								<span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
									❤️ Community Favorite
								</span>
								<span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs">
									⭐ Star Member
								</span>
							</div>
						</div>
					</div>
				</div>

				{/* CTA Section */}
				<div className="mt-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-8 text-center text-white">
					<h2 className="text-2xl font-bold mb-4">
						Ready to Boost Your Community Engagement?
					</h2>
					<p className="text-blue-100 mb-6">
						Add badges to your Whop community and watch engagement soar. Simple
						setup, powerful results.
					</p>
				</div>
			</div>
		</div>
	);
}