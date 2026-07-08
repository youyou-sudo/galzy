"use client";

import * as React from "react";
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { motion, AnimatePresence, type HTMLMotionProps } from "motion/react";

import { useControlledState } from "@web/hooks/use-controlled-state";
import { getStrictContext } from "@web/lib/get-strict-context";

type AccordionContextType = {
	value: string | string[] | undefined;
	setValue: (value: string | string[] | undefined) => void;
};

type AccordionItemContextType = {
	value: string;
	isOpen: boolean;
	setIsOpen: (open: boolean) => void;
};

const [AccordionProvider, useAccordion] =
	getStrictContext<AccordionContextType>("AccordionContext");

const [AccordionItemProvider, useAccordionItem] =
	getStrictContext<AccordionItemContextType>("AccordionItemContext");

type AccordionProps = AccordionPrimitive.Root.Props;

function Accordion(props: AccordionProps) {
	const [value, setValue] = useControlledState<string | string[] | undefined>({
		value: props?.value,
		defaultValue: props?.defaultValue,
		onChange: props?.onValueChange as (
			value: string | string[] | undefined,
		) => void,
	});

	return (
		<AccordionProvider value={{ value, setValue }}>
			<AccordionPrimitive.Root
				data-slot="accordion"
				{...props}
				onValueChange={setValue}
			/>
		</AccordionProvider>
	);
}

type AccordionItemProps = AccordionPrimitive.Item.Props;

function AccordionItem(props: AccordionItemProps) {
	const { value } = useAccordion();
	const [isOpen, setIsOpen] = React.useState(
		value?.includes(props?.value) ?? false,
	);

	React.useEffect(() => {
		setIsOpen(value?.includes(props?.value) ?? false);
	}, [value, props?.value]);

	return (
		<AccordionItemProvider value={{ isOpen, setIsOpen, value: props.value }}>
			<AccordionPrimitive.Item data-slot="accordion-item" {...props} />
		</AccordionItemProvider>
	);
}

type AccordionHeaderProps = AccordionPrimitive.Header.Props;

function AccordionHeader(props: AccordionHeaderProps) {
	return <AccordionPrimitive.Header data-slot="accordion-header" {...props} />;
}

type AccordionTriggerProps = AccordionPrimitive.Trigger.Props;

function AccordionTrigger(props: AccordionTriggerProps) {
	return (
		<AccordionPrimitive.Trigger data-slot="accordion-trigger" {...props} />
	);
}

type AccordionContentProps = Omit<
	AccordionPrimitive.Panel.Props,
	"asChild" | "forceMount"
> &
	HTMLMotionProps<"div"> & {
		keepRendered?: boolean;
	};

function AccordionContent({
	keepRendered = false,
	transition = { duration: 0.35, ease: "easeInOut" },
	children,
	...props
}: AccordionContentProps) {
	const { isOpen } = useAccordionItem();

	return (
		<AnimatePresence>
			{keepRendered ? (
				<AccordionPrimitive.Panel
					render={
						<motion.div
							key="accordion-content"
							data-slot="accordion-content"
							initial={{ height: 0, opacity: 0, "--mask-stop": "0%", y: 20 }}
							animate={
								isOpen
									? { height: "auto", opacity: 1, "--mask-stop": "100%", y: 0 }
									: { height: 0, opacity: 0, "--mask-stop": "0%", y: 20 }
							}
							transition={transition}
							style={{
								maskImage:
									"linear-gradient(black var(--mask-stop), transparent var(--mask-stop))",
								WebkitMaskImage:
									"linear-gradient(black var(--mask-stop), transparent var(--mask-stop))",
								overflow: "hidden",
							}}
							{...props}
						/>
					}
				>
					{children}
				</AccordionPrimitive.Panel>
			) : (
				isOpen && (
					<AccordionPrimitive.Panel
						render={
							<motion.div
								key="accordion-content"
								data-slot="accordion-content"
								initial={{ height: 0, opacity: 0, "--mask-stop": "0%", y: 20 }}
								animate={{
									height: "auto",
									opacity: 1,
									"--mask-stop": "100%",
									y: 0,
								}}
								exit={{ height: 0, opacity: 0, "--mask-stop": "0%", y: 20 }}
								transition={transition}
								style={{
									maskImage:
										"linear-gradient(black var(--mask-stop), transparent var(--mask-stop))",
									WebkitMaskImage:
										"linear-gradient(black var(--mask-stop), transparent var(--mask-stop))",
									overflow: "hidden",
								}}
								{...props}
							/>
						}
					>
						{children}
					</AccordionPrimitive.Panel>
				)
			)}
		</AnimatePresence>
	);
}

export {
	Accordion,
	AccordionItem,
	AccordionHeader,
	AccordionTrigger,
	AccordionContent,
	useAccordion,
	useAccordionItem,
	type AccordionProps,
	type AccordionItemProps,
	type AccordionHeaderProps,
	type AccordionTriggerProps,
	type AccordionContentProps,
	type AccordionContextType,
	type AccordionItemContextType,
};
