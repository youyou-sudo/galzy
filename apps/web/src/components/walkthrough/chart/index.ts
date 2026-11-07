/**
 * walkthrough chart 的唯一出口。
 *
 * 壳（apps/web/src/components/walkthrough/**）只从这里导入：
 * OrderView / GraphView 两个视图 + chartStats 统计 + 少量纯函数，
 * 内部文件（layout、step 渲染）不对外暴露，方便以后换布局实现。
 */

export type {
	ChartEdgeChunk,
	ChartNodeId,
	ChartSegmentGroup,
} from "./chart-utils";
export {
	chartEdgeChunks,
	chartNodeId,
	chartStats,
	edgeOptionLabel,
	endingTypeBadgeLabel,
	endingTypeLabel,
	nodeLabel,
	nodeStartPhrase,
	resolveText,
	segmentAnchorId,
	segmentGroups,
	segmentOptionCount,
	segmentsForCharacter,
	stepNumbers,
	withAffixes,
	zhText,
} from "./chart-utils";
export { CharacterView, type CharacterViewProps } from "./character-view";
export { GraphView, type GraphViewProps } from "./graph-view";
export { OrderView, type OrderViewProps } from "./order-view";
export type {
	ChartAlternative,
	ChartCharacterStats,
	ChartEnding,
	ChartEndingType,
	ChartEntry,
	ChartLang,
	ChartLegendLine,
	ChartLocalized,
	ChartLocalizedText,
	ChartNode,
	ChartNodeType,
	ChartSave,
	ChartSection,
	ChartSegment,
	ChartStats,
	ChartStep,
	ChartStepType,
	ChartText,
	WalkthroughChart,
} from "./types";