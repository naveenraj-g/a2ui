import { useMemo } from "react";
import { useDynamicComponent } from "../hooks/use-dynamic-component";
import type { RowNode } from "../types";
import type { IMessageProcessor } from "../rendering/processor";
import { Renderer } from "../rendering/renderer";

interface RowProps {
  processor: IMessageProcessor;
  surfaceId: string;
  component: RowNode;
  weight?: string | number;
}

export function Row({
  processor,
  surfaceId,
  component,
  weight = "initial",
}: RowProps) {
  const { theme } = useDynamicComponent(
    processor,
    surfaceId,
    component,
    weight,
  );

  const alignment = component.properties?.alignment || "stretch";
  const distribution = component.properties?.distribution || "start";
  const gap = component.properties?.gap || "medium";

  const styles = useMemo(() => {
    const alignMap: Record<string, string> = {
      start: "items-start",
      center: "items-center",
      end: "items-end",
      stretch: "items-stretch",
    };

    const distributeMap: Record<string, string> = {
      start: "justify-start",
      center: "justify-center",
      end: "justify-end",
      spaceBetween: "justify-between",
      spaceAround: "justify-around",
      spaceEvenly: "justify-evenly",
    };

    const gapMap: Record<string, string> = {
      none: "gap-0",
      small: "gap-2",
      medium: "gap-4",
      large: "gap-8",
    };

    return `${alignMap[alignment]} ${distributeMap[distribution]} ${gapMap[gap]}`;
  }, [alignment, distribution, gap]);

  return (
    <div
      className={`flex flex-row w-full min-h-full box-sizing: border-box ${styles}`}
      style={{ flex: weight }}
    >
      {component.properties.children?.map((child) => (
        <Renderer
          key={child.id}
          processor={processor}
          surfaceId={surfaceId}
          component={child}
          weight={child.weight || "initial"}
        />
      ))}
    </div>
  );
}
