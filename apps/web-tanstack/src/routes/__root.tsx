import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	ScriptOnce,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Toaster } from "sonner";
import Errors from "#/components/error";
import { RouterProgress } from "#/components/ProgressProvider";
import Footer from "../components/Footer";
import Header from "../components/Header";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import TanStackQueryProvider from "../integrations/tanstack-query/root-provider";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;
export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				name: "description",
				content: "Galgame 资源站, 这里收录了大部分电脑端与手机端的汉化 Galgame",
			},
			{
				title: "GalZY - Galgame 资源站",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
		scripts: [
			{
				src: process.env.UMAMI_SCRIPT_URL,
				defer: true,
				"data-website-id": process.env.UMAMI_DATA_WEBSITE_ID,
			},
			{
				type: "application/ld+json",
				children: JSON.stringify({
					"@context": "https://schema.org",
					"@type": "WebPage",
					relatedLink: {
						"@type": "WebPageElement",
						name: "广告",
						cssSelector: "#sidebar-ad",
						webPageElementType: "Advertisement",
					},
				}),
			},
		],
	}),
	shellComponent: RootDocument,
	notFoundComponent: () => {
		return <Errors code="404" errormessage={"页面不存在"} />;
	},
	errorComponent: ({ error }) => {
		return <Errors code="500" errormessage={error.message} />;
	},
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<ScriptOnce children={THEME_INIT_SCRIPT} />
				<HeadContent />
			</head>
			<body className="font-sans antialiased flex flex-col min-h-screen">
				<TanStackQueryProvider>
					<RouterProgress />
					<Header />
					<main className="mx-auto w-full max-w-7xl px-4 py-4 space-y-4">
						{children}
					</main>
					<Footer />
					<Toaster position="top-center" />
					<TanStackDevtools
						config={{
							position: "bottom-right",
						}}
						plugins={[
							{
								name: "Tanstack Router",
								render: <TanStackRouterDevtoolsPanel />,
							},
							TanStackQueryDevtools,
						]}
					/>
				</TanStackQueryProvider>
				<Scripts />
			</body>
		</html>
	);
}
