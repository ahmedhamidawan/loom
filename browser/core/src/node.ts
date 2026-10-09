/** The agent run from Node, for an evaluation harness: never imported by a browser bundle. */
export { agentSources, describe, type DescribeLayout } from "./agent/describe";
export { Headless, type HeadlessConfig } from "./agent/headless";
export { runNodeSession } from "./agent/node-session";
