import { A } from "@solidjs/router";
import { createSignal } from "solid-js";
import ThemeSwitcher from "./themeSwitcher";

export default function Nav() {
  const [isDrawerOpen, setDrawerOpen] = createSignal(false);
  const toggle = () => setDrawerOpen(!isDrawerOpen());
  return (
    <div class="drawer">
      <input
        id="my-drawer-3"
        type="checkbox"
        class="drawer-toggle"
        checked={isDrawerOpen()}
        onChange={(e) => setDrawerOpen(e.currentTarget.checked)}
      ></input>
      <div class="drawer-content flex flex-col">
        <div class="navbar min-h-12 h-14 shadow-sm mx-auto mt-3 w-full max-w-7xl bg-base-100/50 dark:bg-success-content/50 rounded-full">
          <div class="lg:hidden">
            <label for="my-drawer-3" aria-label="open sidebar" class="btn btn-square btn-ghost">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                class="inline-block h-6 w-6 stroke-current"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 6h16M4 12h16M4 18h16"
                ></path>
              </svg>
            </label>
          </div>
          <div class="navbar-start flex flex-1 px-2 items-center space-x-2">
            <A href="/" class="inline-flex btn-sm">
              <img class="h-7 w-7" src="/favicon.ico" alt="Galzy Logo" />
            </A>
            <A href="/" class="btn btn-sm btn-ghost hidden lg:inline-flex" >
              Home
            </A>
            <A href="/about" class="btn btn-sm btn-ghost hidden lg:inline-flex">
              About
            </A>
          </div>

          <div>
            <ThemeSwitcher />
          </div>
        </div>
      </div>
      <div class="drawer-side">
        <label for="my-drawer-3" aria-label="close sidebar" class="drawer-overlay"></label>
        <ul class="w-1/2 bg-base-200 min-h-full p-4 text-center justify-center items-center space-y-2">
          <li>
            <A href="/" onClick={toggle} class="inline-flex">
              <img class="h-7 w-7" src="/favicon.ico" alt="Galzy Logo" />
            </A>
          </li>
          <li>
            <A href="/" onClick={toggle} class="btn btn-ghost btn-wide">
              home
            </A>
          </li>
          <li>
            <A href="/about" onClick={toggle} class="btn btn-ghost btn-wide">
              About
            </A>
          </li>
        </ul>
      </div>
    </div>
  );
}
