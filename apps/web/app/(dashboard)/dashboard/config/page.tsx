import { MeiliSearch } from '@web/components/dashboard/config'

export default function page() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">站点配置</h1>
        <p className="text-muted-foreground">
          管理 MeiliSearch 搜索引擎配置和索引设置
        </p>
      </div>
      <MeiliSearch />
    </div>
  )
}
