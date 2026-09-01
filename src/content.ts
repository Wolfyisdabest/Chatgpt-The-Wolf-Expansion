import "./features/quickAccess/quick-access.css";
import "./features/settings/in-chat-settings.css";
import { WolfExpansionApp } from "./core/app";

const app = new WolfExpansionApp();

void app.start().catch((error: unknown) => {
  console.error("[Wolf Expansion] The extension could not start.", error);
});
