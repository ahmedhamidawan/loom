/** Olit as one Node module, for the evaluation harness: see runNodeSession for the protocol. */
import { olitFlavor } from "./flavor";
import { olitLayout } from "./layout";
import { runNodeSession } from "@galaxyproject/orbit-browser/node";

void runNodeSession(olitFlavor, olitLayout);
