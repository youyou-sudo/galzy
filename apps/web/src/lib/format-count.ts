/**
 * 计数（浏览量等）的紧凑显示：四位以上折算成 K。
 *
 * 88_126 → 88.1K，1_200 → 1.2K，20_000 → 20K，999 → 999。
 * 只保留一位小数，整数不补 ".0"；千位以下原样输出 —— 小数字变成
 * 「0.9K」比直接写 946 难读。
 */
export function formatCount(value: number): string {
	if (!Number.isFinite(value) || Math.abs(value) < 1000) return String(value);
	// 先按 100 取整再除回 10，等价于「保留一位小数」，省掉 toFixed 的补零
	const k = Math.round(value / 100) / 10;
	return `${Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)}K`;
}
