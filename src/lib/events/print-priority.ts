/**
 * Where an event sits in its printed square.
 *
 * The rules themselves live in `convex/printPriority.ts`, because the server
 * needs them too and a Convex function cannot import out of `src/`. This file
 * is the door into them from the application side, so nothing under `src`
 * has to know where they are kept.
 *
 * Two copies of "TOP means 1" would be two copies that drift, and the one
 * that drifted would be the one deciding what gets printed.
 */
export * from "../../../convex/printPriority";
