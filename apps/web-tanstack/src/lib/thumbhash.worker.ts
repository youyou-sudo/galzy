import { thumbHashToDataURL } from "thumbhash";

/** 主线程 → Worker 的解码请求：value 是原始 thumbhash 字符串（去重 key），
 * candidates 是主线程 base64/hex 解出的候选字节序列（按优先级排序）。 */
interface ThumbHashDecodeRequest {
	value: string;
	candidates: Uint8Array[];
}

/** Worker → 主线程的解码结果。 */
interface ThumbHashDecodeResponse {
	value: string;
	dataUrl: string | null;
}

interface WorkerScope {
	onmessage: ((event: MessageEvent<ThumbHashDecodeRequest>) => void) | null;
	postMessage(message: ThumbHashDecodeResponse): void;
}

const scope = self as unknown as WorkerScope;

/** Worker 内缓存：同一 thumbhash 不重复做 IDCT + PNG 编码。 */
const cache = new Map<string, string | null>();

scope.onmessage = (event: MessageEvent<ThumbHashDecodeRequest>) => {
	const { value, candidates } = event.data;
	const cached = cache.get(value);
	if (cached !== undefined) {
		scope.postMessage({ value, dataUrl: cached });
		return;
	}

	let dataUrl: string | null = null;
	for (const bytes of candidates) {
		try {
			dataUrl = thumbHashToDataURL(bytes);
			break;
		} catch {
			// Try the next supported encoding before falling back to null.
		}
	}
	cache.set(value, dataUrl);
	scope.postMessage({ value, dataUrl });
};
