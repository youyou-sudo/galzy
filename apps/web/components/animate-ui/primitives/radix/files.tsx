'use client';

import * as React from 'react';
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react';

import {
  Highlight,
  HighlightItem,
  type HighlightItemProps,
  type HighlightProps,
} from '@web/components/animate-ui/primitives/effects/highlight';
import {
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionTrigger,
  AccordionContent,
  type AccordionProps,
  type AccordionItemProps,
  type AccordionHeaderProps,
  type AccordionTriggerProps,
  type AccordionContentProps,
} from '@web/components/animate-ui/primitives/radix/accordion';
import { getStrictContext } from '@web/lib/get-strict-context';
import { useControlledState } from '@web/hooks/use-controlled-state';

type FilesContextType = {
  open: string[];
};

type FolderContextType = {
  isOpen: boolean;
};

const [FilesProvider, useFiles] =
  getStrictContext<FilesContextType>('FilesContext');

const [FolderProvider, useFolder] =
  getStrictContext<FolderContextType>('FolderContext');

type BaseFilesProps = {
  children: React.ReactNode;
} & Omit<AccordionProps, 'type' | 'defaultValue' | 'value' | 'onValueChange'>;

type ControlledFilesProps = {
  defaultOpen?: never;
  open?: string[];
  onOpenChange?: (open: string[]) => void;
};

type UncontrolledFilesProps = {
  defaultOpen: string[];
  open?: never;
  onOpenChange?: never;
};

type FilesProps = BaseFilesProps &
  (ControlledFilesProps | UncontrolledFilesProps);

function Files({
  children,
  defaultOpen = [],
  open,
  onOpenChange,
  style,
  ...props
}: FilesProps) {
  const [openValue, setOpenValue] = useControlledState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });

  return (
    <FilesProvider value={{ open: openValue ?? [] }}>
      <Accordion
        data-slot="files"
        type="multiple"
        defaultValue={defaultOpen}
        value={open}
        onValueChange={setOpenValue}
        style={{
          position: 'relative',
          overflow: 'auto',
          ...style,
        }}
        {...props}
      >
        {children}
      </Accordion>
    </FilesProvider>
  );
}

type FilesHighlightProps = Omit<HighlightProps, 'controlledItems' | 'mode'>;

function FilesHighlight({ hover = true, ...props }: FilesHighlightProps) {
  return (
    <Highlight
      data-slot="files-highlight"
      controlledItems
      mode="parent"
      hover={hover}
      {...props}
    />
  );
}

type FolderItemProps = AccordionItemProps;

function FolderItem({ value, ...props }: FolderItemProps) {
  const { open } = useFiles();

  return (
    <FolderProvider value={{ isOpen: open.includes(value) }}>
      <AccordionItem data-slot="folder-item" value={value} {...props} />
    </FolderProvider>
  );
}

type FolderHeaderProps = AccordionHeaderProps;

function FolderHeader(props: FolderHeaderProps) {
  return <AccordionHeader data-slot="folder-header" {...props} />;
}

type FolderTriggerProps = AccordionTriggerProps;

function FolderTrigger(props: FolderTriggerProps) {
  return <AccordionTrigger data-slot="folder-trigger" {...props} />;
}

type FolderContentProps = AccordionContentProps;

function FolderContent(props: FolderContentProps) {
  return <AccordionContent data-slot="folder-content" {...props} />;
}

type FolderHighlightProps = HighlightItemProps;

function FolderHighlight(props: FolderHighlightProps) {
  return <HighlightItem data-slot="folder-highlight" {...props} />;
}

type FolderProps = React.ComponentProps<'div'>;

function Folder(props: FolderProps) {
  return <div data-slot="folder" {...props} />;
}

type FolderIconProps = HTMLMotionProps<'span'> & {
  closeIcon: React.ReactNode;
  openIcon: React.ReactNode;
};

function FolderIcon({
  closeIcon,
  openIcon,
  transition = { duration: 0.15 },
  ...props
}: FolderIconProps) {
  const { isOpen } = useFolder();

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={isOpen ? 'open' : 'close'}
        data-slot="folder-icon"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        transition={transition}
        {...props}
      >
        {isOpen ? openIcon : closeIcon}
      </motion.span>
    </AnimatePresence>
  );
}

type FolderLabelProps = React.ComponentProps<'span'>;

function FolderLabel(props: FolderLabelProps) {
  return <span data-slot="folder-label" {...props} />;
}

type FileHighlightProps = HighlightItemProps;

function FileHighlight(props: FileHighlightProps) {
  return <HighlightItem data-slot="file-highlight" {...props} />;
}

type FileProps = React.ComponentProps<'div'>;

function File(props: FileProps) {
  return <div data-slot="file" {...props} />;
}

type FileIconProps = React.ComponentProps<'span'>;

function FileIcon(props: FileIconProps) {
  return <span data-slot="file-icon" {...props} />;
}

type FileLabelProps = React.ComponentProps<'span'>;

function FileLabel(props: FileLabelProps) {
  return <span data-slot="file-label" {...props} />;
}

export {
  Files,
  FilesHighlight,
  FolderItem,
  FolderHeader,
  FolderTrigger,
  FolderContent,
  FileHighlight,
  File,
  FileIcon,
  FileLabel,
  FolderHighlight,
  Folder,
  FolderIcon,
  FolderLabel,
  useFiles,
  useFolder,
  type FilesProps,
  type FilesHighlightProps,
  type FolderItemProps,
  type FolderHeaderProps,
  type FolderTriggerProps,
  type FolderContentProps,
  type FileHighlightProps,
  type FileProps,
  type FileIconProps,
  type FileLabelProps,
  type FolderHighlightProps,
  type FolderProps,
  type FolderIconProps,
  type FolderLabelProps,
  type FilesContextType,
  type FolderContextType,
};
