import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@shadcn/ui/components/card'
import { TagTable } from '@web/components/dashboard/tag/tabCard'
import { UpComp } from './UpComp'

export default async function page() {
  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <p>标签编辑</p>
            <UpComp />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TagTable />
        </CardContent>
      </Card>
    </div>
  )
}
