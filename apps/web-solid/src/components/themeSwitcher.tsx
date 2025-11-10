import { MonitorCog, MoonStar, Sun } from "lucide-solid";
import { onMount, createSignal, Switch, Match } from "solid-js";
import { themeChange } from "theme-change";

export default function ThemeSwitcher() {
  const themes = [
    { label: "Light", value: "cupcake" },
    { label: "Dark", value: "forest" },
    { label: "System", value: "system" },
  ];

  const [currentTheme, setCurrentTheme] = createSignal("system");

  const applyTheme = (theme: string) => {
    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.setAttribute("data-theme", prefersDark ? "forest" : "cupcake");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  };

  const handleThemeClick = (theme: string) => {
    setCurrentTheme(theme);
    localStorage.setItem("user-theme", theme);
    applyTheme(theme);
  };

  onMount(() => {
    themeChange(false);

    // 读取用户选择
    const savedTheme = localStorage.getItem("user-theme");
    if (savedTheme) {
      setCurrentTheme(savedTheme);
      applyTheme(savedTheme);
    } else {
      // 默认 system
      setCurrentTheme("system");
      applyTheme("system");
    }

    // 系统主题变化监听（仅在 system 模式下生效）
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (currentTheme() === "system") {
        const newTheme = e.matches ? "forest" : "cupcake";
        document.documentElement.setAttribute("data-theme", newTheme);
      }
    });
  });

  return (
    <div class="dropdown dropdown-end">
      <div tabindex="0" role="button" class="btn btn-square btn-ghost btn-sm m-1">
        <Switch>
          <Match when={themes.find((t) => t.value === currentTheme())?.label === "Light"}>
            <MoonStar />
          </Match>
          <Match when={themes.find((t) => t.value === currentTheme())?.label === "Dark"}>
            <Sun />
          </Match>
          <Match when={themes.find((t) => t.value === currentTheme())?.label === "System"}>
            <MonitorCog />
          </Match>
        </Switch>
      </div>
      <ul
        tabindex="0"
        class="dropdown-content menu bg-base-100 rounded-box z-10 w-28 p-2 shadow-sm"
      >
        {themes.map((theme) => (
          <li>
            <a
              data-set-theme={theme.value !== "system" ? theme.value : undefined}
              data-act-class="active"
              onClick={() => handleThemeClick(theme.value)}
            >
              <Switch>
                <Match when={theme.label === "Light"}>
                  <Sun />浅色
                </Match>
                <Match when={theme.label === "Dark"}>
                  <MoonStar />深色
                </Match>
                <Match when={theme.label === "System"}>
                  <MonitorCog />系统
                </Match>
              </Switch>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
