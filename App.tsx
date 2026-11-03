import React, { useEffect, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { GlobalContextProviders } from "./components/_globalContextProviders";
const Page_0 = () => <Navigate to="/studio" replace />;
import PageLayout_0 from "./pages/login.pageLayout.tsx";
import Page_1 from "./pages/_index.tsx";
import PageLayout_1 from "./pages/_index.pageLayout.tsx";
const Page_2 = lazy(() => import("./pages/studio.tsx"));
import PageLayout_2 from "./pages/studio.pageLayout.tsx";
const Page_3 = lazy(() => import("./pages/unfolder.tsx"));
import PageLayout_3 from "./pages/unfolder.pageLayout.tsx";

if (!window.requestIdleCallback) {
  window.requestIdleCallback = (cb) => {
    return window.setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 1);
  };
  window.cancelIdleCallback = handle => window.clearTimeout(handle);
}

import "./base.css";

const fileNameToRoute = new Map([["./pages/login.tsx","/login"],["./pages/_index.tsx","/"],["./pages/studio.tsx","/studio"],["./pages/unfolder.tsx","/unfolder"]]);
const fileNameToComponent = new Map<string, React.ComponentType>([
    ["./pages/login.tsx", Page_0],
["./pages/_index.tsx", Page_1],
["./pages/studio.tsx", Page_2],
["./pages/unfolder.tsx", Page_3],
  ]);

function makePageRoute(filename: string) {
  const Component = fileNameToComponent.get(filename);
  return Component ? <Component /> : <NotFound />;
}

function toElement({
  trie,
  fileNameToRoute,
  makePageRoute,
}: {
  trie: LayoutTrie;
  fileNameToRoute: Map<string, string>;
  makePageRoute: (filename: string) => React.ReactNode;
}) {
  return [
    ...trie.topLevel.map((filename) => (
      <Route
        key={fileNameToRoute.get(filename)}
        path={fileNameToRoute.get(filename)}
        element={makePageRoute(filename)}
      />
    )),
    ...Array.from(trie.trie.entries()).map(([Component, child], index) => (
      <Route
        key={index}
        element={
          <Component>
            <Outlet />
          </Component>
        }
      >
        {toElement({ trie: child, fileNameToRoute, makePageRoute })}
      </Route>
    )),
  ];
}

type LayoutTrieNode = Map<
  React.ComponentType<{ children: React.ReactNode }>,
  LayoutTrie
>;
type LayoutTrie = { topLevel: string[]; trie: LayoutTrieNode };
function buildLayoutTrie(layouts: {
  [fileName: string]: React.ComponentType<{ children: React.ReactNode }>[];
}): LayoutTrie {
  const result: LayoutTrie = { topLevel: [], trie: new Map() };
  Object.entries(layouts).forEach(([fileName, components]) => {
    let cur: LayoutTrie = result;
    for (const component of components) {
      if (!cur.trie.has(component)) {
        cur.trie.set(component, {
          topLevel: [],
          trie: new Map(),
        });
      }
      cur = cur.trie.get(component)!;
    }
    cur.topLevel.push(fileName);
  });
  return result;
}

function NotFound() {
  return (
    <div>
      <h1>Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <p>Go back to the <a href={import.meta.env.BASE_URL} style={{ color: 'blue' }}>home page</a>.</p>
    </div>
  );
}

import { useLocation, useNavigationType } from "react-router-dom";

export default function ScrollManager() {
  const { pathname, search, hash } = useLocation();
  const navType = useNavigationType(); // "PUSH" | "REPLACE" | "POP"

  useEffect(() => {
    // Back/forward: keep browser-like behavior
    if (navType === "POP") return;

    // Hash links: let the browser scroll to the anchor
    if (hash) return;

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, search, hash, navType]);

  return null;
}

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/+$/, "")}>
      <ScrollManager />
      <GlobalContextProviders>
        <Suspense fallback={<div role="status" style={{ padding: 24 }}>Loading Fold Studio…</div>}>
        <Routes>
          {toElement({ trie: buildLayoutTrie({
"./pages/login.tsx": PageLayout_0,
"./pages/_index.tsx": PageLayout_1,
"./pages/studio.tsx": PageLayout_2,
"./pages/unfolder.tsx": PageLayout_3,
}), fileNameToRoute, makePageRoute })} 
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </GlobalContextProviders>
    </BrowserRouter>
  );
}
