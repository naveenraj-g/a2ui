"use client";

import { useState, useMemo } from "react";
import { useDynamicComponent } from "../hooks/use-dynamic-component";
import type { DateTimeInputNode } from "../types";
import type { IMessageProcessor } from "../rendering/processor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DateTimeInputProps {
  processor: IMessageProcessor;
  surfaceId: string;
  component: DateTimeInputNode;
  weight?: string | number;
}

export function DateTimeInput({
  processor,
  surfaceId,
  component,
  weight = "initial",
}: DateTimeInputProps) {
  const { resolvePrimitive } = useDynamicComponent(
    processor,
    surfaceId,
    component,
    weight,
  );

  const initialValue = useMemo(
    () => resolvePrimitive(component.properties.value) || "",
    [resolvePrimitive, component.properties.value],
  );
  const [value, setValue] = useState(initialValue);
  const label = useMemo(
    () => resolvePrimitive(component.properties.label),
    [resolvePrimitive, component.properties.label],
  );
  const enableDate = component.properties.enableDate !== false;
  const enableTime = component.properties.enableTime !== false;

  const type = enableDate && enableTime
    ? "datetime-local"
    : enableDate
      ? "date"
      : "time";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  return (
    <div className="space-y-2" style={{ flex: weight }}>
      {label && <Label htmlFor={component.id}>{label}</Label>}
      <Input
        id={component.id}
        type={type}
        value={value}
        onChange={handleChange}
      />
    </div>
  );
}
