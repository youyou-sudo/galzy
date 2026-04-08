/**
 * 断言响应状态为 200 (OK)。如果不是，则抛出包含详细信息的错误。
 * 此函数通常用于在访问数据之前验证 API 响应。
 *
 * @param res - 包含状态和数据的响应对象。
 * @param name - 请求的描述性名称，用于错误消息。
 * @returns 如果状态为 200，则返回响应中的数据。
 * @throws 如果响应状态不是 200，则抛出错误，消息包含状态和数据。
 *
 * @example
 * ```typescript
 * const response = { status: 200, data: { message: 'Success' } };
 * const data = assertOk(response, 'API Call');
 * console.log(data); // { message: 'Success' }
 * ```
 */
export function assertOk<T>(res: { status: number; data: T }, name: string): T {
	if (res.status !== 200) {
		throw new Error(
			`${name} 请求失败 (status: ${res.status},error: ${JSON.stringify(res.data, null, 2)})`,
		);
	}
	return res.data;
}
