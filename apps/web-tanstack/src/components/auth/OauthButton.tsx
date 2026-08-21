import { Image } from "@unpic/react";
import { authClient } from "@web/server/auth/auth-client";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { FaDiscord, FaGithub, FaTwitter } from "react-icons/fa";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";

type Provider = "github" | "linuxdo" | "discord" | "kungal" | "twitter";

export const OauthButton = () => {
	const [loading, setLoading] = useState<Provider | null>(null);
	const params = new URLSearchParams(
		typeof window !== "undefined" ? window.location.search : "",
	);

	const return_toss = params.get("return_to");
	const return_to = `${return_toss ? return_toss : ""}`;

	const handleSocialSignIn = async (provider: Provider) => {
		setLoading(provider);
		// 只在点击（浏览器环境）时读取 origin，SSR 阶段不访问 window。
		const origin = window.location.origin;
		// OAuth 失败后跳到登录页并携带错误信息；不指向 `/api/auth/error`，
		// 否则该代理路径会被再次转发到后端，形成无限重定向。
		const errorURL = `${origin}/auth/login`;
		// 归一化回调地址：return_to 为空时回首页，非空时用 URL 拼合避免双斜杠。
		const callbackURL = new URL(return_to || "/", origin).toString();

		try {
			if (provider === "linuxdo" || provider === "kungal") {
				return await authClient.signIn.social({
					provider,
					callbackURL,
					errorCallbackURL: errorURL,
					requestSignUp: false,
				});
			}
			await authClient.signIn.social({
				provider,
				callbackURL,
				errorCallbackURL: errorURL,
			});
		} finally {
			setLoading(null);
		}
	};

	return (
		<div>
			<Separator />
			<div className="mt-2 grid grid-cols-2 gap-2">
				<Button
					disabled={loading === "kungal"}
					onClick={() => handleSocialSignIn("kungal")}
				>
					{loading === "kungal" && <Loader2 className="animate-spin" />}
					<Image
						src="/kungal.webp"
						width={16}
						height={16}
						alt="这是 KunGalgame 登陆按钮图标"
						data-icon="inline-start"
						className="rounded-4xl"
					/>
					Kun Galgame
				</Button>
				<Button
					disabled={loading === "github"}
					onClick={() => handleSocialSignIn("github")}
				>
					{loading === "github" && <Loader2 className="animate-spin" />}
					<FaGithub data-icon="inline-start" />
					Github
				</Button>

				<Button
					disabled={loading === "twitter"}
					onClick={() => handleSocialSignIn("twitter")}
				>
					{loading === "twitter" && <Loader2 className="animate-spin" />}
					<FaTwitter data-icon="inline-start" />
					twitter
				</Button>

				<Button
					disabled={loading === "linuxdo"}
					onClick={() => handleSocialSignIn("linuxdo")}
				>
					{loading === "linuxdo" && <Loader2 className="animate-spin" />}
					<Image
						src="/linuxdo.webp"
						width={16}
						height={16}
						alt="这是 linux.do 登陆按钮图标"
						data-icon="inline-start"
						className="rounded-4xl"
					/>
					Linux.Do
				</Button>

				<Button
					disabled={loading === "discord"}
					onClick={() => handleSocialSignIn("discord")}
				>
					{loading === "discord" && <Loader2 className="animate-spin" />}
					<FaDiscord data-icon="inline-start" />
					Discord
				</Button>
			</div>
		</div>
	);
};
