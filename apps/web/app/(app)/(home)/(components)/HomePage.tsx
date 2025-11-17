import { HomeGamelist } from "@web/components/home"
import { GameItem } from "@web/components/home/GameItem"
import { homeData } from "../(action)/homeData"

export const HomePage = async () => {
  const data = await homeData(24, 0)
  return (
    <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
      {data?.items?.map((item) => (
        <GameItem key={item.id} item={item} />
      ))}
      <HomeGamelist />
    </div>
  )
}
