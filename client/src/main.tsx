import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { PublicEventsApp } from "@/features/events/PublicEventsApp";

const path = window.location.pathname;
const isPublicEventRoute = path.startsWith("/events/");

createRoot(document.getElementById("root")!).render(
  isPublicEventRoute ? <PublicEventsApp /> : <App />,
);


