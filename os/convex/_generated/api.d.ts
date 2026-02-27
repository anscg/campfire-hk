/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as groups from "../groups.js";
import type * as music from "../music.js";
import type * as otp from "../otp.js";
import type * as quests from "../quests.js";
import type * as shop from "../shop.js";
import type * as shopOrders from "../shopOrders.js";
import type * as stocks from "../stocks.js";
import type * as transactions from "../transactions.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  groups: typeof groups;
  music: typeof music;
  otp: typeof otp;
  quests: typeof quests;
  shop: typeof shop;
  shopOrders: typeof shopOrders;
  stocks: typeof stocks;
  transactions: typeof transactions;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
