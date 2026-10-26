import { Mail } from "lucide-react";
import AvatarComp from "./AvatarEditor";
import type { AvatarSize } from "./AvatarEditor";

interface UserHeaderProps {
	name?: string | null;
	email?: string | null;
	image?: string | null;
	profileMenu?: boolean;
	/** 下拉菜单里用 sm，个人页保持默认 lg */
	avatarSize?: AvatarSize;
}

export default function UserHeader({
	name,
	email,
	image,
	profileMenu,
	avatarSize,
}: UserHeaderProps) {
	// 小头像配小字号，否则 w-56 的下拉里名字会把邮箱挤成省略号
	const compact = avatarSize === "sm";
	return (
		<div className="flex gap-3 items-center">
			<AvatarComp
				name={name}
				image={image}
				editor={!profileMenu}
				size={avatarSize}
			/>
			<div className={`${profileMenu ? "max-w-39" : "max-w-80"}`}>
				<h2
					className={`${compact ? "text-sm" : "text-lg"} font-semibold leading-none tracking-tight truncate`}
				>
					{name}
				</h2>
				<p
					className={`${compact ? "text-xs" : "text-sm"} text-muted-foreground flex items-center gap-1 `}
				>
					<Mail className={compact ? "size-3" : "size-4"} />
					<span className={`truncate`}>{email}</span>
				</p>
			</div>
		</div>
	);
}
