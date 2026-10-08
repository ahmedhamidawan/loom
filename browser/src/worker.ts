/** The agent worker: Orbit's browser agent, as Olit. */
import { startAgentWorker } from "./agent/worker";
import { olitFlavor } from "./agent/flavor";

startAgentWorker(olitFlavor);
