import CountComponent from "~/components/home/Count";
import SearchInput from "~/components/home/searchInput";

export default function Home() {
  return (
    <main class="text-center mx-auto">

      <h1 class="text-4xl font-bold text-center mt-10">紫缘社</h1>
      <CountComponent />
      <SearchInput />
    </main>
  );
}
