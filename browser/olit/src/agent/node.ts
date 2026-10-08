/** Olit as one Node module, for the evaluation harness: see runNodeSession for the protocol. */
import { olitFlavor, olitLayout } from "./flavor";
import { runNodeSession } from "@galaxyproject/orbit-browser/node";

void runNodeSession(olitFlavor, olitLayout);
