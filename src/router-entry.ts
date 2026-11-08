/**
 * Platform-independent entry point for the existing routing contracts.
 * No provider adapter, local runtime, receipt writer, CLI, or hosted handler.
 */
export { route, routeV2 } from "./router.js";
export { CONTRACT_VERSION, CONTRACT_VERSION_V2 } from "./contracts.js";
export type {
  ModelProfile,
  RouteConstraints,
  RouteNormalizationV2,
  RouteObjective,
  RoutePlan,
  RoutePlanV2,
  RouteRequest,
  RouteRequestV2,
  RouteRequirements,
} from "./contracts.js";
