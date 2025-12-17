import { Search } from "lucide-solid";

export default function SearchInput() {

  return (
    <label class="input w-2xl">
      <input type="text" placeholder="标题、标签……回车 GO 喵！" />
      <span class="label"><Search class="w-4 h-4" /></span>
    </label>
  )
}
