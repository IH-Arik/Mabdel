import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import AppErrorBoundary from "./Components/Common/AppErrorBoundary";
import "./index.css";
import { router } from "./router/Routes";

createRoot(document.getElementById("root")).render(
  <AppErrorBoundary>
    <RouterProvider router={router} />
  </AppErrorBoundary>
);
