"use client";

import { useState, useMemo } from "react";
import { useDynamicComponent } from "../hooks/use-dynamic-component";
import type { TextFieldNode } from "../types";
import type { IMessageProcessor } from "../rendering/processor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface TextFieldProps {
  processor: IMessageProcessor;
  surfaceId: string;
  component: TextFieldNode;
  weight?: string | number;
}

export function TextField({
  processor,
  surfaceId,
  component,
  weight = "initial",
}: TextFieldProps) {
  const { resolvePrimitive } = useDynamicComponent(
    processor,
    surfaceId,
    component,
    weight,
  );

  const initialText = useMemo(
    () => resolvePrimitive(component.properties.text) || "",
    [resolvePrimitive, component.properties.text],
  );
  const [text, setText] = useState(initialText);
  const label = useMemo(
    () => resolvePrimitive(component.properties.label),
    [resolvePrimitive, component.properties.label],
  );
  const placeholder = useMemo(
    () => resolvePrimitive(component.properties.placeholder),
    [resolvePrimitive, component.properties.placeholder],
  );
  const textFieldType = component.properties.textFieldType || "shortText";

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setText(e.target.value);
  };

  if (textFieldType === "longText") {
    return (
      <div className="space-y-2" style={{ flex: weight }}>
        {label && <Label htmlFor={component.id}>{label}</Label>}
        <Textarea
          id={component.id}
          value={text}
          onChange={handleChange}
          placeholder={placeholder}
          className="resize-none"
        />
      </div>
    );
  }

  const inputType =
    textFieldType === "obscured"
      ? "password"
      : textFieldType === "number"
        ? "number"
        : "text";

  return (
    <div className="space-y-2" style={{ flex: weight }}>
      {label && <Label htmlFor={component.id}>{label}</Label>}
      <Input
        id={component.id}
        type={inputType}
        value={text}
        onChange={handleChange}
        placeholder={placeholder}
      />
    </div>
  );
}
