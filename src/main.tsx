import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { queryClient } from "./lib/query-client";
import { DbProvider } from "./lib/db-context";
import { db } from "./lib/db";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DbProvider client={db}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </DbProvider>
    </QueryClientProvider>
  </StrictMode>,
);
