import { bffFn } from "@web/lib/bff/fn";
import type * as impl from "./../impl/game/index";

export const getGameDetail = bffFn<typeof impl.getGameDetail>("game.getGameDetail");
export const getGameTags = bffFn<typeof impl.getGameTags>("game.getGameTags");
export const getGameRelations = bffFn<typeof impl.getGameRelations>("game.getGameRelations");
export const getFileList = bffFn<typeof impl.getFileList>("game.getFileList");
export const refreshFileList = bffFn<typeof impl.refreshFileList>("game.refreshFileList");
export const translateData = bffFn<typeof impl.translateData>("game.translateData");
export const dwAcConst = bffFn<typeof impl.dwAcConst>("game.dwAcConst");
export const getGameList = bffFn<typeof impl.getGameList>("game.getGameList");
export const getTotalCount = bffFn<typeof impl.getTotalCount>("game.getTotalCount");
export const getCritical = bffFn<typeof impl.getCritical>("game.getCritical");

export type * from "./../impl/game/index";

// Values used by client code. Kept identical to the impl module (types are re-exported above).
export const GAME_SORT_KEYS = ["released", "downloads", "views"] as const;
export const GAME_ORDER_KEYS = ["desc", "asc"] as const;
