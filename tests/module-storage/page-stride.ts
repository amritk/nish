// tsc refuses this page: `layout` types each stride as its literal, so a page
// written for a 12-byte Body does not compile against a 16-byte one.
import type { Module } from "./main"

export const wrong = (m: Module): 12 => m.layout.bodies.stride
