// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UserPage } from '@web/pages/user'

/**
 * 回归测试：/user 的页签必须能在**不触发页面导航**的前提下切换。
 *
 * 线上现象：点「安全 / 喜欢 / 收藏」没反应。旧实现把页签交给
 * `navigate({ to: '/user', search })`，一次点击等于重新请求 `?_furin=data`、
 * 重跑整条 loader（会话 + 账号 + 收藏/喜欢），页面在结果回来前没有任何反馈。
 * 现在页签 / 分页是页内状态（`useShallowSearch`：React state + replaceState），
 * 面板立即切换、地址栏同步更新。
 *
 * 这个用例在没有 RouterProvider 的 jsdom 里渲染真实 UserPage：旧实现下
 * `navigate` 会走到 furin 的 fallback（`window.location.href = ...`），面板不会
 * 切换，用例失败；新实现下是纯状态更新，立即生效。
 */

vi.mock('@web/server/topics', () => ({
	getUserFavorites: vi.fn(async () => ({
		topics: [],
		total: 0,
		totalPages: 0,
	})),
	getUserLikes: vi.fn(async () => ({ topics: [], total: 0, totalPages: 0 })),
}))

vi.mock('@web/server/auth/auth-client', () => ({
	authClient: { useSession: () => ({ data: undefined, refetch: () => {} }) },
}))

vi.mock('@web/server/auth/auth.functions', () => ({
	getSession: vi.fn(async () => null),
	listAccounts: vi.fn(async () => ({ data: [], error: null })),
}))

vi.mock('@web/lib/nav', () => ({
	Link: ({ children, ...rest }: { children?: React.ReactNode }) => (
		<a {...rest}>{children}</a>
	),
	redirect: () => {
		throw new Error('redirect in render')
	},
}))

vi.mock('@web/components/user/ProfileMenu/AvatarEditor', () => ({
	default: () => <div data-testid="avatar-editor" />,
}))

vi.mock('@web/components/user/ProfileMenu/ProfileTab', () => ({
	default: () => <div>panel-profile</div>,
}))

vi.mock('@web/components/user/ProfileMenu/SecurityTab', () => ({
	default: () => <div>panel-security</div>,
}))

const EMPTY_LIST = { topics: [], total: 0, totalPages: 0 }

function renderPage(
	search: { tab: string; page: number } = { tab: 'profile', page: 1 },
) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	})
	return render(
		<QueryClientProvider client={client}>
			<UserPage
				session={
					{
						user: {
							id: 'u1',
							name: '小忧忧',
							email: 'u1@example.com',
							image: null,
						},
					} as never
				}
				accounts={[] as never}
				favorites={EMPTY_LIST as never}
				likes={EMPTY_LIST as never}
				search={search as never}
			/>
		</QueryClientProvider>,
	)
}

describe('/user 页签', () => {
	beforeEach(() => {
		window.history.replaceState(null, '', '/user?tab=profile')
	})

	afterEach(() => {
		cleanup()
	})

	it('点「安全」立即切到安全设置面板，并把 tab 写进地址栏', () => {
		renderPage()
		expect(screen.getByText('panel-profile')).toBeTruthy()

		fireEvent.click(screen.getByRole('tab', { name: '安全' }))

		expect(screen.getByText('panel-security')).toBeTruthy()
		expect(screen.queryByText('panel-profile')).toBeNull()
		expect(new URLSearchParams(window.location.search).get('tab')).toBe(
			'security',
		)
	})

	it('切回「个人资料」时把默认 tab 从地址栏剥掉', () => {
		window.history.replaceState(null, '', '/user?tab=security')
		renderPage({ tab: 'security', page: 1 })

		fireEvent.click(screen.getByRole('tab', { name: '个人资料' }))

		expect(screen.getByText('panel-profile')).toBeTruthy()
		expect(new URLSearchParams(window.location.search).has('tab')).toBe(false)
	})
})
