/** The agent worker: Orbit's browser agent, as Olit. */
import { startAgentWorker } from "@galaxyproject/orbit-browser/worker";
import { olitFlavor } from "./agent/flavor";

startAgentWorker(olitFlavor);
