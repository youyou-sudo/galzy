import { lazy, useEffect, useLayoutEffect, useRef, useState } from "react";
import { visit } from "unist-util-visit";
import { MarkdownComponents } from "./markdown-components";

const Markdown = lazy(() => import("react-markdown"));

let rehypeRawCache: any;
let remarkGfmCache: any;

export const MarkdownAsync = ({
	readmedata,
	onReady,
}: {
	readmedata: string;
	onReady?: () => void;
}) => {
	const [plugins, setPlugins] = useState<{
		rehypeRaw?: any;
		remarkGfm?: any;
		components?: any;
	}>({});

	const notifiedRef = useRef(false);
	const onReadyRef = useRef(onReady);
	onReadyRef.current = onReady;

	useEffect(() => {
		if (rehypeRawCache && remarkGfmCache && MarkdownComponents) {
			setPlugins({
				rehypeRaw: rehypeRawCache,
				remarkGfm: remarkGfmCache,
				components: MarkdownComponents,
			});
			return;
		}

		Promise.all([import("rehype-raw"), import("remark-gfm")]).then(
			([rehypeRawMod, remarkGfmMod]) => {
				rehypeRawCache = rehypeRawMod.default;
				remarkGfmCache = remarkGfmMod.default;

				setPlugins({
					rehypeRaw: rehypeRawCache,
					remarkGfm: remarkGfmCache,
					components: MarkdownComponents,
				});
			},
		);
	}, []);

	useLayoutEffect(() => {
		if (
			plugins.rehypeRaw &&
			plugins.remarkGfm &&
			plugins.components &&
			!notifiedRef.current
		) {
			notifiedRef.current = true;
			onReadyRef.current?.();
		}
	}, [plugins]);

	if (!plugins.rehypeRaw || !plugins.remarkGfm || !plugins.components) {
		return null;
	}

	return (
		<Markdown
			remarkPlugins={[plugins.remarkGfm]}
			rehypePlugins={[plugins.rehypeRaw]}
			components={plugins.components}
		>
			{readmedata}
		</Markdown>
	);
};

export function rehypeRemoveBlackWhiteStyles() {
	return (tree: any) => {
		visit(tree, "element", (node) => {
			if (node.properties?.style) {
				const style = node.properties.style as string;

				const newStyle = style
					.split(";")
					.filter((s) => {
						const lower = s.toLowerCase();
						return !(
							lower.includes("color:#000") ||
							lower.includes("color:#000000") ||
							lower.includes("color:#fff") ||
							lower.includes("color:#ffffff") ||
							lower.includes("color:black") ||
							lower.includes("color:white")
						);
					})
					.join(";");

				if (newStyle.trim()) {
					node.properties.style = newStyle;
				} else {
					delete node.properties.style;
				}
			}
		});
	};
}
