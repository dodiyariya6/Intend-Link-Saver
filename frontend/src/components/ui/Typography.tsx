/**
 * Typography primitives — the only place font-size/weight/line-height
 * combinations are defined. Feature code should never reach for a raw
 * <h1>/<p> with ad-hoc classes; every piece of text in the app renders
 * through <Heading> or <Text> so the type scale stays consistent.
 */
import type { ElementType, ReactNode } from "react";

import { cn } from "../../lib/cn";

type HeadingLevel = "display" | "h1" | "h2" | "h3";

const headingStyles: Record<HeadingLevel, string> = {
  display: "text-display text-text-primary",
  h1: "text-h1 text-text-primary",
  h2: "text-h2 text-text-primary",
  h3: "text-h3 text-text-primary",
};

const headingDefaultTag: Record<HeadingLevel, ElementType> = {
  display: "h1",
  h1: "h1",
  h2: "h2",
  h3: "h3",
};

export interface HeadingProps {
  /** Visual size/weight — independent from which semantic tag is rendered. */
  level: HeadingLevel;
  /** Override the semantic HTML tag (e.g. a "display" that's visually huge
   * but should still be an <h2> for document outline correctness). */
  as?: ElementType;
  className?: string;
  children: ReactNode;
  id?: string;
}

export function Heading({ level, as, className, children, id }: HeadingProps) {
  const Tag = as ?? headingDefaultTag[level];
  return (
    <Tag id={id} className={cn(headingStyles[level], className)}>
      {children}
    </Tag>
  );
}

type TextVariant = "body-lg" | "body" | "label" | "caption" | "overline";

const textStyles: Record<TextVariant, string> = {
  "body-lg": "text-body-lg text-text-secondary",
  body: "text-body text-text-secondary",
  label: "text-label text-text-secondary",
  caption: "text-caption text-text-tertiary",
  overline: "text-overline text-text-tertiary uppercase",
};

const textDefaultTag: Record<TextVariant, ElementType> = {
  "body-lg": "p",
  body: "p",
  label: "span",
  caption: "span",
  overline: "span",
};

export interface TextProps {
  variant?: TextVariant;
  /** Override the default text color (e.g. text-text-primary for emphasis). */
  tone?: "primary" | "secondary" | "tertiary" | "onAccent";
  as?: ElementType;
  className?: string;
  children: ReactNode;
  id?: string;
}

const toneClass: Record<NonNullable<TextProps["tone"]>, string> = {
  primary: "text-text-primary",
  secondary: "text-text-secondary",
  tertiary: "text-text-tertiary",
  onAccent: "text-text-onAccent",
};

export function Text({ variant = "body", tone, as, className, children, id }: TextProps) {
  const Tag = as ?? textDefaultTag[variant];
  return (
    <Tag id={id} className={cn(textStyles[variant], tone && toneClass[tone], className)}>
      {children}
    </Tag>
  );
}
