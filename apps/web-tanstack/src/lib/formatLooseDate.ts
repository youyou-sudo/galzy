export function formatLooseDate(raw?: string | Date) {
	if (!raw) {
		return { year: "", formatted: "" };
	}

	let dateStr: string;

	// 如果是 Date 对象，转换为 ISO 字符串
	if (raw instanceof Date) {
		if (isNaN(raw.getTime())) {
			return { year: "", formatted: "" };
		}
		dateStr = raw.toISOString(); // 输出: 2013-01-19T00:00:00.000Z
	} else {
		dateStr = raw;
	}

	let y: string, m: string, d: string;

	// 处理包含 '-' 的情况（包括 ISO 格式）
	if (dateStr.includes("-")) {
		// 先尝试按 ISO 格式解析（YYYY-MM-DDTHH:mm:ss.sssZ）
		const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T/);
		if (isoMatch) {
			y = isoMatch[1];
			m = isoMatch[2];
			d = isoMatch[3];
		} else {
			// 回退到普通 '-' 分割
			const parts = dateStr.split("-");
			if (parts.length < 3) return { year: "", formatted: "" };
			y = parts[0];
			m = parts[1];
			d = parts[2].includes("T") ? parts[2].split("T")[0] : parts[2];
		}
	} else if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
		// 处理纯数字格式 YYYYMMDD
		y = dateStr.slice(0, 4);
		m = dateStr.slice(4, 6);
		d = dateStr.slice(6, 8);
	} else {
		return { year: "", formatted: "" };
	}

	// 验证月份和日期是否有效
	const mNum = Number(m);
	const dNum = Number(d);

	// 检查月份是否有效 (1-12)
	if (mNum < 1 || mNum > 12) {
		return { year: y, formatted: "" };
	}

	// 检查日期是否有效 (1-31)
	if (dNum < 1 || dNum > 31) {
		return { year: y, formatted: m };
	}

	// 额外检查：特定月份的天数限制
	const daysInMonth = new Date(Number(y), mNum, 0).getDate();
	if (dNum > daysInMonth) {
		return { year: y, formatted: m };
	}

	return { year: y, formatted: `${m}-${d}` };
}
