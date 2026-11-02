import * as React from "react";
import { useInView, type UseInViewOptions } from "motion/react";

/** 永不挂到节点上的哑 ref：inView 关闭时交给 motion，避免它创建 IntersectionObserver */
const NO_ELEMENT_REF = { current: null } as React.RefObject<HTMLElement | null>;

interface UseIsInViewOptions {
	inView?: boolean;
	inViewOnce?: boolean;
	inViewMargin?: UseInViewOptions["margin"];
}

function useIsInView<T extends HTMLElement = HTMLElement>(
	ref: React.Ref<T>,
	options: UseIsInViewOptions = {},
) {
	const { inView, inViewOnce = false, inViewMargin = "0px" } = options;
	const localRef = React.useRef<T>(null);
	React.useImperativeHandle(ref, () => localRef.current as T);
	const inViewResult = useInView(
		inView ? (localRef as React.RefObject<HTMLElement | null>) : NO_ELEMENT_REF,
		{ once: inViewOnce, margin: inViewMargin },
	);
	const isInView = !inView || inViewResult;
	return { ref: localRef, isInView };
}

export { useIsInView, type UseIsInViewOptions };
