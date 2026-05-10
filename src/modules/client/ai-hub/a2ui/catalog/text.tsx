import { useMemo } from "react";
import MarkdownIt from "markdown-it";
import { useDynamicComponent } from "../hooks/use-dynamic-component";
import type { TextNode } from "../types";
import type { IMessageProcessor } from "../rendering/processor";

// Tag to class map for markdown rendering
const tagClassMap: Record<string, string[]> = {
  p: ["text-sm leading-7"],
  h1: ["text-4xl font-bold"],
  h2: ["text-3xl font-bold"],
  h3: ["text-2xl font-semibold"],
  h4: ["text-xl font-semibold"],
  h5: ["text-lg font-medium"],
  h6: ["text-base font-medium"],
  ul: ["list-disc ml-8"],
  ol: ["list-decimal ml-8"],
  li: ["my-4 text-sm leading-7"],
  a: ["text-blue-600 hover:underline"],
  strong: ["font-semibold"],
  em: ["italic"],
  code: [
    "px-2 py-0.5 text-xs rounded-md text-purple-800 dark:text-purple-300 bg-purple-600/30",
  ],
  blockquote: ["border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic"],
  table: [
    "w-full overflow-hidden text-sm text-left rtl:text-right text-gray-800 dark:text-gray-200",
  ],
  thead: [
    "text-xs w-full font-medium text-zinc-800 uppercase bg-zinc-100/70 dark:bg-white/10 dark:text-white/70",
  ],
  tbody: [""],
  tr: ["hover:bg-zinc-50/70 dark:hover:bg-white/5"],
  th: ["p-3 text-sm"],
  td: ["p-3 text-xs"],
};

interface TextProps {
  processor: IMessageProcessor;
  surfaceId: string;
  component: TextNode;
  weight?: string | number;
}

export function Text({
  processor,
  surfaceId,
  component,
  weight = "initial",
}: TextProps) {
  const { resolvePrimitive } = useDynamicComponent(
    processor,
    surfaceId,
    component,
    weight,
  );

  const text = useMemo(
    () => resolvePrimitive(component.properties.text),
    [resolvePrimitive, component.properties.text],
  );
  const usageHint = component.properties.usageHint || "body";

  const resolvedText = useMemo(() => {
    if (text == null) {
      return "(empty)";
    }

    const value = String(text);

    // Create a new markdown-it instance for each render to avoid state issues
    const md = new MarkdownIt({
      html: false,
      linkify: true,
      typographer: true,
      breaks: true,
    });

    // Apply custom tag classes
    applyTagClassMap(md, tagClassMap);

    // Check if text already contains markdown
    const hasMarkdown = /[#*_`[\]]/.test(value);

    if (hasMarkdown) {
      return md.render(value);
    }

    // Only wrap with markdown tags if it doesn't already contain markdown
    let formattedValue = value;
    switch (usageHint) {
      case "h1":
        formattedValue = `# ${value}`;
        break;
      case "h2":
        formattedValue = `## ${value}`;
        break;
      case "h3":
        formattedValue = `### ${value}`;
        break;
      case "h4":
        formattedValue = `#### ${value}`;
        break;
      case "h5":
        formattedValue = `##### ${value}`;
        break;
      case "caption":
        formattedValue = `*${value}*`;
        break;
      default:
        formattedValue = value;
        break;
    }

    return md.render(formattedValue);
  }, [text, usageHint]);

  const className = useMemo(() => {
    switch (usageHint) {
      case "h1":
        return "text-4xl font-bold";
      case "h2":
        return "text-3xl font-bold";
      case "h3":
        return "text-2xl font-semibold";
      case "h4":
        return "text-xl font-semibold";
      case "h5":
        return "text-lg font-medium";
      case "caption":
        return "text-sm text-gray-500";
      case "monospaced":
        return "font-mono";
      default:
        return "text-base";
    }
  }, [usageHint]);

  // Render markdown with proper classes
  return (
    <div
      dangerouslySetInnerHTML={{ __html: resolvedText }}
      className={`${className} markdown-body`}
    />
  );
}

function applyTagClassMap(
  md: MarkdownIt,
  tagClassMap: Record<string, string[]>,
) {
  Object.entries(tagClassMap).forEach(([tag, classes]) => {
    let tokenName;
    switch (tag) {
      case "p":
        tokenName = "paragraph";
        break;
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        tokenName = "heading";
        break;
      case "ul":
        tokenName = "bullet_list";
        break;
      case "ol":
        tokenName = "ordered_list";
        break;
      case "li":
        tokenName = "list_item";
        break;
      case "a":
        tokenName = "link";
        break;
      case "strong":
        tokenName = "strong";
        break;
      case "em":
        tokenName = "em";
        break;
      case "code":
        tokenName = "inline_code";
        break;
      case "blockquote":
        tokenName = "blockquote";
        break;
      case "table":
        tokenName = "table";
        break;
      case "thead":
        tokenName = "thead_open";
        break;
      case "tbody":
        tokenName = "tbody_open";
        break;
      case "tr":
        tokenName = "tr_open";
        break;
      case "th":
        tokenName = "th_open";
        break;
      case "td":
        tokenName = "td_open";
        break;
      default:
        return;
    }

    const key = `${tokenName}_open`;
    const original = md.renderer.rules[key];

    md.renderer.rules[key] = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      for (const clazz of classes) {
        token.attrJoin("class", clazz);
      }

      if (original) {
        return original.call(md.renderer, tokens, idx, options, env, self);
      } else {
        return self.renderToken(tokens, idx, options);
      }
    };
  });
}
