import "./styles.css";
import { createLobsterSplitDemo } from "./prototype.js";

const app = document.querySelector("#app");

createLobsterSplitDemo(app, {
  imageSrc: "/assets/agent-bill.png",
});
