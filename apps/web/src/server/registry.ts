import "@teyik0/furin/server-only";
import * as admin_adverts from "@web/server/impl/admin/adverts";
import * as admin_collections from "@web/server/impl/admin/collections";
import * as admin_comments from "@web/server/impl/admin/comments";
import * as admin_friend_links from "@web/server/impl/admin/friend-links";
import * as admin_meilisearch from "@web/server/impl/admin/meilisearch";
import * as admin_tasks from "@web/server/impl/admin/tasks";
import * as admin_topics from "@web/server/impl/admin/topics";
import * as admin_vndb_sync from "@web/server/impl/admin/vndb-sync";
import * as adverts_index from "@web/server/impl/adverts/index";
import * as auth_auth_functions from "@web/server/impl/auth/auth.functions";
import * as collections from "@web/server/impl/collections";
import * as comments_index from "@web/server/impl/comments/index";
import * as friend_links_index from "@web/server/impl/friend-links/index";
import * as game_index from "@web/server/impl/game/index";
import * as producer_index from "@web/server/impl/producer/index";
import * as search_index from "@web/server/impl/search/index";
import * as tags_index from "@web/server/impl/tags/index";
import * as topics_index from "@web/server/impl/topics/index";
import * as upload_avatar from "@web/server/impl/upload/avatar";
import * as views_index from "@web/server/impl/views/index";
import type { BffImplLike } from "@web/lib/bff/protocol";

/**
 * Server-side registry of every BFF handler (generated).
 * Regenerate with: bun scripts/furin/gen-registry.mjs
 */
export const bffRegistry: Record<string, BffImplLike> = {
	"admin.adverts.adminGetAdSlots": admin_adverts.adminGetAdSlots,
	"admin.adverts.adminCreateAdSlot": admin_adverts.adminCreateAdSlot,
	"admin.adverts.adminUpdateAdSlot": admin_adverts.adminUpdateAdSlot,
	"admin.adverts.adminDeleteAdSlot": admin_adverts.adminDeleteAdSlot,
	"admin.adverts.adminGetAdverts": admin_adverts.adminGetAdverts,
	"admin.adverts.adminCreateAdvert": admin_adverts.adminCreateAdvert,
	"admin.adverts.adminUpdateAdvert": admin_adverts.adminUpdateAdvert,
	"admin.adverts.adminDeleteAdvert": admin_adverts.adminDeleteAdvert,
	"admin.adverts.adminReorderAdverts": admin_adverts.adminReorderAdverts,
	"admin.collections.adminGetCollections": admin_collections.adminGetCollections,
	"admin.collections.adminCreateCollection": admin_collections.adminCreateCollection,
	"admin.collections.adminUpdateCollection": admin_collections.adminUpdateCollection,
	"admin.collections.adminDeleteCollection": admin_collections.adminDeleteCollection,
	"admin.collections.adminUpdateCollectionEntries": admin_collections.adminUpdateCollectionEntries,
	"admin.collections.adminSearchProducers": admin_collections.adminSearchProducers,
	"admin.collections.adminSearchGames": admin_collections.adminSearchGames,
	"admin.comments.adminGetComments": admin_comments.adminGetComments,
	"admin.comments.adminUpdateComment": admin_comments.adminUpdateComment,
	"admin.comments.adminDeleteComment": admin_comments.adminDeleteComment,
	"admin.comments.adminChangeCommentStatus": admin_comments.adminChangeCommentStatus,
	"admin.comments.adminGetAllComments": admin_comments.adminGetAllComments,
	"admin.comments.adminTogglePin": admin_comments.adminTogglePin,
	"admin.friend-links.adminGetFriendLinks": admin_friend_links.adminGetFriendLinks,
	"admin.friend-links.adminCreateFriendLink": admin_friend_links.adminCreateFriendLink,
	"admin.friend-links.adminUpdateFriendLink": admin_friend_links.adminUpdateFriendLink,
	"admin.friend-links.adminDeleteFriendLink": admin_friend_links.adminDeleteFriendLink,
	"admin.friend-links.adminReorderFriendLinks": admin_friend_links.adminReorderFriendLinks,
	"admin.meilisearch.getMeiliSearchProgress": admin_meilisearch.getMeiliSearchProgress,
	"admin.meilisearch.getMeiliStats": admin_meilisearch.getMeiliStats,
	"admin.meilisearch.getEmbedders": admin_meilisearch.getEmbedders,
	"admin.meilisearch.updateEmbedders": admin_meilisearch.updateEmbedders,
	"admin.meilisearch.getPropertyList": admin_meilisearch.getPropertyList,
	"admin.meilisearch.getSearchableAttributes": admin_meilisearch.getSearchableAttributes,
	"admin.meilisearch.updateSearchableAttributes": admin_meilisearch.updateSearchableAttributes,
	"admin.meilisearch.triggerGameIndexRebuild": admin_meilisearch.triggerGameIndexRebuild,
	"admin.meilisearch.triggerTagIndexRebuild": admin_meilisearch.triggerTagIndexRebuild,
	"admin.meilisearch.triggerProducerIndexRebuild": admin_meilisearch.triggerProducerIndexRebuild,
	"admin.tasks.listTasks": admin_tasks.listTasks,
	"admin.tasks.getTaskStats": admin_tasks.getTaskStats,
	"admin.tasks.getQueueStats": admin_tasks.getQueueStats,
	"admin.tasks.getTaskMeta": admin_tasks.getTaskMeta,
	"admin.tasks.getTaskDetail": admin_tasks.getTaskDetail,
	"admin.tasks.getTaskLogs": admin_tasks.getTaskLogs,
	"admin.tasks.listTaskLogs": admin_tasks.listTaskLogs,
	"admin.tasks.retryTask": admin_tasks.retryTask,
	"admin.tasks.deleteTask": admin_tasks.deleteTask,
	"admin.tasks.batchDeleteTasks": admin_tasks.batchDeleteTasks,
	"admin.tasks.batchRetryTasks": admin_tasks.batchRetryTasks,
	"admin.tasks.enqueueTask": admin_tasks.enqueueTask,
	"admin.tasks.listDeadLetters": admin_tasks.listDeadLetters,
	"admin.tasks.listDeadLetterTasks": admin_tasks.listDeadLetterTasks,
	"admin.tasks.republishDeadLetterTask": admin_tasks.republishDeadLetterTask,
	"admin.tasks.removeDeadLetterTask": admin_tasks.removeDeadLetterTask,
	"admin.tasks.batchRepublishDeadLetters": admin_tasks.batchRepublishDeadLetters,
	"admin.tasks.batchRemoveDeadLetters": admin_tasks.batchRemoveDeadLetters,
	"admin.topics.adminGetAllTopics": admin_topics.adminGetAllTopics,
	"admin.topics.adminUpdateTopicStatus": admin_topics.adminUpdateTopicStatus,
	"admin.topics.adminDeleteTopic": admin_topics.adminDeleteTopic,
	"admin.vndb-sync.getSyncProgress": admin_vndb_sync.getSyncProgress,
	"admin.vndb-sync.triggerFullSync": admin_vndb_sync.triggerFullSync,
	"admin.vndb-sync.triggerDeltaSync": admin_vndb_sync.triggerDeltaSync,
	"admin.vndb-sync.triggerProducersSync": admin_vndb_sync.triggerProducersSync,
	"admin.vndb-sync.getCloudreveSyncStatus": admin_vndb_sync.getCloudreveSyncStatus,
	"admin.vndb-sync.triggerCloudreveSync": admin_vndb_sync.triggerCloudreveSync,
	"admin.vndb-sync.checkCloudreveFiles": admin_vndb_sync.checkCloudreveFiles,
	"adverts.getAdSlot": adverts_index.getAdSlot,
	"adverts.trackAdvert": adverts_index.trackAdvert,
	"auth.auth.functions.getSession": auth_auth_functions.getSession,
	"auth.auth.functions.seedVerification": auth_auth_functions.seedVerification,
	"auth.auth.functions.listAccounts": auth_auth_functions.listAccounts,
	"auth.auth.functions.getAccountInfo": auth_auth_functions.getAccountInfo,
	"auth.auth.functions.adminListUsers": auth_auth_functions.adminListUsers,
	"collections.getCollections": collections.getCollections,
	"collections.getCollectionById": collections.getCollectionById,
	"collections.getCollectionPreview": collections.getCollectionPreview,
	"collections.getCollectionsWithPreview": collections.getCollectionsWithPreview,
	"comments.getCmments": comments_index.getCmments,
	"comments.createCmments": comments_index.createCmments,
	"friend-links.getFriendLinks": friend_links_index.getFriendLinks,
	"game.getGameDetail": game_index.getGameDetail,
	"game.getGameTags": game_index.getGameTags,
	"game.getGameRelations": game_index.getGameRelations,
	"game.getGameCharacters": game_index.getGameCharacters,
	"game.getCharacterInfo": game_index.getCharacterInfo,
	"game.getGameWalkthroughs": game_index.getGameWalkthroughs,
	"game.getWalkthroughInfo": game_index.getWalkthroughInfo,
	"game.getFileList": game_index.getFileList,
	"game.refreshFileList": game_index.refreshFileList,
	"game.translateData": game_index.translateData,
	"game.dwAcConst": game_index.dwAcConst,
	"game.getGameList": game_index.getGameList,
	"game.getTotalCount": game_index.getTotalCount,
	"game.getCritical": game_index.getCritical,
	"producer.producerInfo": producer_index.producerInfo,
	"producer.producerGameList": producer_index.producerGameList,
	"producer.getSearchProducers": producer_index.getSearchProducers,
	"search.getSearch": search_index.getSearch,
	"tags.getTagData": tags_index.getTagData,
	"tags.getSearchTags": tags_index.getSearchTags,
	"tags.getVnListByTag": tags_index.getVnListByTag,
	"tags.getTagCategories": tags_index.getTagCategories,
	"tags.getTagHub": tags_index.getTagHub,
	"tags.getTagGroupTags": tags_index.getTagGroupTags,
	"topics.getTopics": topics_index.getTopics,
	"topics.getUserFavorites": topics_index.getUserFavorites,
	"topics.getUserLikes": topics_index.getUserLikes,
	"topics.getTopic": topics_index.getTopic,
	"topics.createTopic": topics_index.createTopic,
	"topics.updateTopic": topics_index.updateTopic,
	"topics.toggleTopicLike": topics_index.toggleTopicLike,
	"topics.toggleTopicFavorite": topics_index.toggleTopicFavorite,
	"topics.deleteTopic": topics_index.deleteTopic,
	"upload.avatar.uploadAvatar": upload_avatar.uploadAvatar,
	"views.recordGameView": views_index.recordGameView,
	"views.recordTagView": views_index.recordTagView,
};
