"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { useDynamicComponent } from "../hooks/use-dynamic-component";
import type { TerminologySelectNode } from "../types";
import type { IMessageProcessor } from "../rendering/processor";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
  CommandGroup,
} from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Concept {
  id?: number;
  code: string;
  display: string;
  definition?: string;
  system?: string;
  system_name?: string;
  active?: boolean;
}

interface ServerSearchConfig {
  resource: string;
  field: string;
  minChars?: number;
  debounceMs?: number;
}

interface TerminologySelectProps {
  processor: IMessageProcessor;
  surfaceId: string;
  component: TerminologySelectNode;
  weight?: string | number;
}

export function TerminologySelect({
  processor,
  surfaceId,
  component,
  weight = "initial",
}: TerminologySelectProps) {
  const { resolvePrimitive } = useDynamicComponent(
    processor,
    surfaceId,
    component,
    weight,
  );

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Concept | null>(null);
  const [serverResults, setServerResults] = useState<Concept[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const label = resolvePrimitive(component.properties.label) as
    | string
    | undefined;
  const placeholder =
    (resolvePrimitive(component.properties.placeholder) as
      | string
      | undefined) ?? "Search...";
  const valueType =
    (resolvePrimitive(component.properties.valueType) as string | undefined) ??
    "code";

  // items is pre-resolved from $variable by mapDataToUI — it arrives as an array of raw concept objects
  const rawItems = component.properties.items;
  const items: Concept[] = Array.isArray(rawItems) ? rawItems : [];

  const serverSearch = component.properties.serverSearch as
    | ServerSearchConfig
    | undefined;
  const minChars = serverSearch?.minChars ?? 2;
  const debounceMs = serverSearch?.debounceMs ?? 300;

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (c) =>
        c.display?.toLowerCase().includes(q) ||
        c.code?.toLowerCase().includes(q) ||
        c.definition?.toLowerCase().includes(q),
    );
  }, [items, search]);

  const displayConcepts = serverSearch ? serverResults : filteredItems;

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      if (!serverSearch) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (value.length < minChars) {
        setServerResults([]);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const params = new URLSearchParams({ query: value });
          if (serverSearch.system !== undefined) {
            // Mode B: system search (LOINC / ICD-10 / SNOMED / RxNorm)
            if (serverSearch.system) params.set("system", serverSearch.system);
          } else {
            // Mode A: field value set
            params.set("resource", serverSearch.resource ?? "");
            params.set("field", serverSearch.field ?? "");
          }
          const res = await fetch(`/api/workflow/terminology?${params}`);
          if (res.ok) {
            const data = await res.json();
            setServerResults(data.concepts ?? []);
          }
        } catch {
          setServerResults([]);
        } finally {
          setIsSearching(false);
        }
      }, debounceMs);
    },
    [serverSearch, minChars, debounceMs],
  );

  const handleSelect = useCallback((concept: Concept) => {
    setSelected(concept);
    setOpen(false);
    setSearch("");
    setServerResults([]);
  }, []);

  const triggerWidth = triggerRef.current?.offsetWidth;

  // For code type: single hidden input using the component id.
  // For CodeableConcept: four flattened hidden inputs prefixed by component id.
  const fieldId = component.id;

  return (
    <div className="space-y-2" style={{ flex: weight }}>
      {label && <Label htmlFor={fieldId}>{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            id={`${fieldId}-trigger`}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {selected ? (
              <span>{selected.display}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0"
          align="start"
          style={{ width: triggerWidth ?? "100%" }}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={placeholder}
              value={search}
              onValueChange={handleSearchChange}
            />
            <CommandList>
              <CommandEmpty>
                {isSearching
                  ? "Searching…"
                  : serverSearch && search.length < minChars
                    ? `Type at least ${minChars} characters to search`
                    : "No results found."}
              </CommandEmpty>
              <CommandGroup>
                {displayConcepts.map((concept) => (
                  <CommandItem
                    key={concept.code}
                    value={concept.code}
                    onSelect={() => handleSelect(concept)}
                    className="flex items-start gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{concept.display}</div>
                      {concept.definition && (
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {concept.definition}
                        </div>
                      )}
                    </div>
                    {/* <span className="shrink-0 font-mono text-xs text-muted-foreground mt-0.5">
                      {concept.code}
                    </span> */}
                    <Check
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        selected?.code === concept.code
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Hidden inputs collected by form.tsx collectFormData */}
      {valueType === "code" ? (
        <input id={fieldId} type="hidden" value={selected?.code ?? ""} />
      ) : (
        <>
          <input
            id={`${fieldId}_code`}
            type="hidden"
            value={selected?.code ?? ""}
          />
          <input
            id={`${fieldId}_system`}
            type="hidden"
            value={selected?.system ?? ""}
          />
          <input
            id={`${fieldId}_display`}
            type="hidden"
            value={selected?.display ?? ""}
          />
          <input
            id={`${fieldId}_text`}
            type="hidden"
            value={selected?.display ?? ""}
          />
        </>
      )}
    </div>
  );
}
