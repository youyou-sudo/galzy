import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import Nav from "~/components/Nav";
import "./app.css";

export default function App() {
  return (
    <Router
      root={props => (
        <>
          {/* 背景层 */}
          <div
            class="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat opacity-30 dark:opacity-10"
            style={{ "background-image": 'url("/background.webp")' }}
          />

          <Nav />
          <Suspense>{props.children}</Suspense>
        </>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
