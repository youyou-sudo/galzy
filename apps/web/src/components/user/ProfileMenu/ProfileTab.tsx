import { useQueries, useQuery } from "@tanstack/react-query";
import { Image } from "@unpic/react";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Label } from "@web/components/ui/label";
import { Skeleton } from "@web/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@web/components/ui/tooltip";
import { getAccountInfo, listAccounts } from "@web/server/auth/auth.functions";
import { authClient } from "@web/server/auth/auth-client";
import { Check, Loader2 } from "lucide-react";
import { type ChangeEvent, useState } from "react";
import { FaDiscord, FaGithub, FaTwitter } from "react-icons/fa";
import { toast } from "sonner";

interface OAuthProviderDef {
	id: string;
	name: string;
	iconType: "fa";
	Icon: typeof FaGithub;
}

interface OAuthProviderImageDef {
	id: string;
	name: string;
	iconType: "image";
	iconSrc: string;
}

const OAUTH_PROVIDERS: (OAuthProviderDef | OAuthProviderImageDef)[] = [
	{
		id: "github",
		name: "GitHub",
		iconType: "fa",
		Icon: FaGithub,
	},
	{
		id: "discord",
		name: "Discord",
		iconType: "fa",
		Icon: FaDiscord,
	},
	{
		id: "twitter",
		name: "Twitter",
		iconType: "fa",
		Icon: FaTwitter,
	},
	{
		id: "linuxdo",
		name: "Linux.Do",
		iconType: "image",
		iconSrc: "/linuxdo.webp",
	},
	{
		id: "kungal",
		name: "Kun Galgame",
		iconType: "image",
		iconSrc: "/kungal.webp",
	},
];

interface ProfileTabProps {
	user: NonNullable<ReturnType<typeof authClient.useSession>["data"]>["user"];
	onProfileUpdated: () => void;
}

export default function ProfileTab({
	user,
	onProfileUpdated,
}: ProfileTabProps) {
	const [name, setName] = useState(user.name ?? "");
	const [isSaving, setIsSaving] = useState(false);
	const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
	const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(
		null,
	);

	const {
		data: accounts = [],
		refetch: refetchAccounts,
		isPending: isAccountsPending,
	} = useQuery({
		queryKey: ["linked-accounts"],
		queryFn: async () => {
			const { data, error } = await listAccounts();
			if (error) throw error;
			return data ?? [];
		},
	});

	const accountInfoQueries = useQueries({
		queries: accounts.map((account) => ({
			queryKey: ["account-info", account.accountId],
			queryFn: async () => {
				const { data } = await getAccountInfo({
					data: { accountId: account.accountId },
				});
				return data?.user?.name ?? null;
			},
			enabled: accounts.length > 0,
			staleTime: 5 * 60 * 1000,
		})),
	});

	const accountNameMap = new Map(
		accounts.map((account, i) => [account.accountId, accountInfoQueries[i]]),
	);
	const handleSaveProfile = async () => {
		if (!name.trim()) return;
		setIsSaving(true);
		try {
			// better-auth 客户端方法 resolve 出 { data, error }，不 throw：
			// 必须显式检查 error，否则保存失败会被静默吞掉
			const { error } = await authClient.updateUser({ name });
			if (error) {
				toast.error(error.message || "保存失败，请重试");
				return;
			}
			toast.success("资料已更新");
			onProfileUpdated();
		} catch {
			toast.error("保存失败，请重试");
		} finally {
			setIsSaving(false);
		}
	};

	const handleLink = async (providerId: string) => {
		setLinkingProvider(providerId);
		try {
			const callbackURL = `${window.location.origin}/user`;
			const errorCallbackURL = callbackURL;
			const { error } = await authClient.linkSocial({
				provider: providerId,
				callbackURL,
				errorCallbackURL,
			});
			if (error) {
				toast.error(error.message || "绑定失败，请稍后重试");
			}
		} catch {
			toast.error("绑定失败，请稍后重试");
		} finally {
			setLinkingProvider(null);
		}
	};

	const handleUnlink = async (providerId: string, accountId: string) => {
		setUnlinkingProvider(providerId);
		try {
			// better-auth 的 unlinkAccount 仅接受 accountId（providerId 是旧 API）
			const { error } = await authClient.unlinkAccount({ accountId });
			if (error) {
				toast.error(error.message || "解绑失败，请稍后重试");
				return;
			}
			toast.success("已解绑");
			await refetchAccounts();
		} catch {
			toast.error("解绑失败，请稍后重试");
		} finally {
			setUnlinkingProvider(null);
		}
	};

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="profile-name">显示名称</Label>
				<div className="flex gap-2">
					<Input
						id="profile-name"
						value={name}
						onChange={(e: ChangeEvent<HTMLInputElement>) =>
							setName(e.target.value)
						}
						placeholder="请输入您的名称"
					/>
					<Button
						disabled={isSaving || !name.trim() || name === user.name}
						onClick={handleSaveProfile}
					>
						{isSaving ? <Loader2 className="size-4 animate-spin" /> : "保存"}
					</Button>
				</div>
			</div>
			<div className="space-y-2">
				<Label>邮箱</Label>
				<Tooltip>
					<TooltipTrigger
						render={
							<div className="flex items-center px-3 w-full min-w-0 h-9 text-sm break-all text-muted-foreground bg-input/30 rounded-xl border border-input dark:bg-input/80" />
						}
					>
						{user.email ?? "未设置邮箱"}
					</TooltipTrigger>
					<TooltipContent>
						<p>{user.email}</p>
					</TooltipContent>
				</Tooltip>
				<p className="text-xs text-muted-foreground">
					邮箱无法直接修改，如需帮助请联系管理员喵。
				</p>
			</div>

			<div className="space-y-3">
				<div>
					<h4 className="text-sm font-medium">关联账户</h4>
					<p className="mt-1 text-xs text-muted-foreground">
						绑定第三方账户以便快速登录喵。
					</p>
				</div>
				<div className="space-y-2">
					{OAUTH_PROVIDERS.map((provider) => {
						const linkedAccount = accounts?.find(
							(a) => a.providerId === provider.id,
						);
						const isLinked = !!linkedAccount;
						const isProcessing =
							linkingProvider === provider.id ||
							unlinkingProvider === provider.id;

						return (
							<div
								key={provider.id}
								className="flex justify-between items-center p-3 bg-card/60 rounded-xl ring-1 ring-border/60"
							>
								<div className="flex gap-3 items-center">
									{provider.iconType === "fa" ? (
										<provider.Icon className="size-5" />
									) : (
										<Image
											src={provider.iconSrc}
											width={20}
											height={20}
											alt={`${provider.name} 图标`}
											className="rounded-sm"
										/>
									)}
									<div>
										<p className="text-sm font-medium">{provider.name}</p>
										{isAccountsPending ? (
											<Skeleton className="mt-1 w-10 h-3" />
										) : (
											<div className="flex gap-1 items-center text-xs text-muted-foreground">
												{isLinked ? (
													<>
														已绑定
														<Check size={15} className="text-success" />
														{(() => {
															const q = accountNameMap.get(
																linkedAccount!.accountId,
															);
															if (q?.isPending) {
																return <Skeleton className="w-12 h-3" />;
															}
															if (q?.data) {
																return (
																	<span className="text-muted-foreground/70">
																		· {q.data}
																	</span>
																);
															}
															return null;
														})()}
													</>
												) : (
													"未绑定"
												)}
											</div>
										)}
									</div>
								</div>
								{isLinked ? (
									<Button
										variant="outline"
										size="sm"
										disabled={isProcessing}
										onClick={() => handleUnlink(provider.id, linkedAccount!.id)}
									>
										{isProcessing ? (
											<Loader2 className="size-3.5 animate-spin" />
										) : (
											"解绑"
										)}
									</Button>
								) : (
									<Button
										variant="outline"
										size="sm"
										disabled={isProcessing}
										onClick={() => handleLink(provider.id)}
									>
										{isProcessing ? (
											<Loader2 className="size-3.5 animate-spin" />
										) : (
											"绑定"
										)}
									</Button>
								)}
							</div>
						);
					})}

					<p className="mt-1 text-xs text-muted-foreground">
						如果已经通过第三方登陆创建过账户，且邮件不一样，请联系管理员喵～
					</p>
				</div>
			</div>
		</div>
	);
}
