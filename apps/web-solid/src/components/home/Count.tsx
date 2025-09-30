import { A, createAsync } from "@solidjs/router"
import { Send } from "lucide-solid"
import { api } from "@libs";


const totalCountGet = async () => {
  "use server"
  const totalCountResult = await api.games.count.get()
  return Number(totalCountResult.data || 0)
}

const envGet = async () => {
  "use server"
  const password = process.env.DB_PASSWORD
  return password
}

console.log(import.meta.env.VITE_PUBLIC_ENDPOINT2)

export default function CountComponent() {
  const coutn = createAsync(() => totalCountGet())

  const password = createAsync(() => envGet())
  return (
    <div class="flex items-center">
      {coutn && (
        <span class="pl-1 flex opacity-50">
          共收录了： {coutn()}
          条目
        </span>
      )}
      {password && (
        <span class="pl-1 flex opacity-50">
          DB密码： {password() }
        </span>
      )}
      <span class="inline-flex items-center gap-1 ml-2">
        <A
          class="underline text-blue-500 hover:text-blue-300"
          target="_blank"
          href="https://t.me/+mKVpQNjxQss1ZDRl"
        >
          频道
        </A>
        <Send size={15} class="text-blue-400" />
      </span>
    </div>
  )
}
