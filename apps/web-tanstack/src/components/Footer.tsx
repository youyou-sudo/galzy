import { Link } from "@tanstack/react-router";

export default function Footer() {
	const startYear = 2022;
	const currentYear = new Date().getFullYear();
	const years = currentYear - startYear;

	return (
		<footer className="border-t border-border px-6 py-4 text-center text-sm text-muted-foreground">
			<div className="flex flex-col gap-2 items-center">
				<p>
					&copy;
					{years > 0 ? `${startYear}-${currentYear}` : `${startYear}`} Galzy
				</p>
				<div className="flex gap-4 justify-center">
					<Link
						to="/openapi"
						className="hover:text-foreground transition-colors"
					>
						Open Api
					</Link>
					<Link
						to="/friend-links"
						className="hover:text-foreground transition-colors"
					>
						友情链接
					</Link>
					<a
						href="https://icp.gov.moe/?keyword=20222332"
						target="_blank"
						className="hover:text-foreground transition-colors"
						rel="noopener"
					>
						萌ICP备20222332号
					</a>
				</div>
			</div>
		</footer>
	);
}
