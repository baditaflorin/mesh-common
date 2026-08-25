import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type MeshListboxOption = {
  /** Stable domain id; do not use an array index. */
  id: string;
  label: string;
  description?: ReactNode;
  /** Extra text considered by the built-in search. */
  keywords?: readonly string[];
  /** Override search matching when label is not enough. */
  searchText?: string;
  disabled?: boolean;
};

export type MeshListboxOptionState = {
  active: boolean;
  selected: boolean;
  disabled: boolean;
};

export type MeshListboxProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "onChange"
> & {
  options: readonly MeshListboxOption[];
  /** Single selected option, or null before selection. */
  value: string | null;
  onValueChange: (id: string) => void;
  label?: ReactNode;
  ariaLabel?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Controlled query. Omit for internal query state. */
  query?: string;
  onQueryChange?: (query: string) => void;
  emptyMessage?: ReactNode;
  disabled?: boolean;
  onActiveChange?: (id: string | null) => void;
  renderOption?: (
    option: MeshListboxOption,
    state: MeshListboxOptionState,
  ) => ReactNode;
};

function searchableText(option: MeshListboxOption): string {
  return [option.searchText ?? option.label, ...(option.keywords ?? [])]
    .join(" ")
    .toLocaleLowerCase();
}

function matchesQuery(option: MeshListboxOption, query: string): boolean {
  return searchableText(option).includes(query.trim().toLocaleLowerCase());
}

/**
 * Keyboard-operable single-select collection with optional local search.
 * The active option alone is tabbable; arrows, Home, End, Space, and Enter
 * work without a mouse. `id` values form stable element IDs and React keys.
 */
export function MeshListbox({
  options,
  value,
  onValueChange,
  label,
  ariaLabel,
  searchable = false,
  searchPlaceholder = "Search options",
  query,
  onQueryChange,
  emptyMessage = "No matching options.",
  disabled = false,
  onActiveChange,
  renderOption,
  className,
  ...listboxProps
}: MeshListboxProps) {
  const generatedId = useId();
  const listboxId = `mesh-listbox-${generatedId}`;
  const labelId = `${listboxId}-label`;
  const [internalQuery, setInternalQuery] = useState("");
  const activeQuery = query ?? internalQuery;
  const visibleOptions = useMemo(
    () => options.filter((option) => matchesQuery(option, activeQuery)),
    [activeQuery, options],
  );
  const visibleKey = visibleOptions
    .map((option) => `${option.id}:${option.disabled ? "1" : "0"}`)
    .join("|");
  const [activeId, setActiveId] = useState<string | null>(() => {
    return (
      options.find((option) => option.id === value && !option.disabled)?.id ??
      options.find((option) => !option.disabled)?.id ??
      null
    );
  });
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    const activeIsUsable = visibleOptions.some(
      (option) => option.id === activeId && !option.disabled,
    );
    if (activeIsUsable) return;
    const next =
      visibleOptions.find((option) => option.id === value && !option.disabled)
        ?.id ??
      visibleOptions.find((option) => !option.disabled)?.id ??
      null;
    setActiveId(next);
    onActiveChange?.(next);
  }, [activeId, onActiveChange, value, visibleKey, visibleOptions]);

  const setQuery = (nextQuery: string) => {
    if (query === undefined) setInternalQuery(nextQuery);
    onQueryChange?.(nextQuery);
  };

  const activate = (id: string | null, focus = false) => {
    setActiveId(id);
    onActiveChange?.(id);
    if (focus && id) optionRefs.current.get(id)?.focus();
  };

  const enabledOptions = visibleOptions.filter((option) => !option.disabled);
  const moveActive = (direction: 1 | -1) => {
    if (!enabledOptions.length) return;
    const index = enabledOptions.findIndex((option) => option.id === activeId);
    const nextIndex =
      index < 0
        ? direction === 1
          ? 0
          : enabledOptions.length - 1
        : (index + direction + enabledOptions.length) % enabledOptions.length;
    activate(enabledOptions[nextIndex]?.id ?? null, true);
  };

  const select = (option: MeshListboxOption) => {
    if (disabled || option.disabled) return;
    activate(option.id);
    onValueChange(option.id);
  };

  const onOptionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    option: MeshListboxOption,
  ) => {
    if (disabled) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveActive(-1);
        break;
      case "Home":
        event.preventDefault();
        activate(enabledOptions[0]?.id ?? null, true);
        break;
      case "End":
        event.preventDefault();
        activate(enabledOptions.at(-1)?.id ?? null, true);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        select(option);
        break;
      default:
        break;
    }
  };

  return (
    <div className={`mesh-listbox ${className ?? ""}`}>
      {label ? (
        <span id={labelId} className="mesh-listbox-label">
          {label}
        </span>
      ) : null}
      {searchable ? (
        <input
          type="search"
          className="mesh-listbox-search"
          value={activeQuery}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={
            label
              ? `Search ${typeof label === "string" ? label : "options"}`
              : "Search options"
          }
          aria-controls={listboxId}
          disabled={disabled}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              moveActive(event.key === "ArrowDown" ? 1 : -1);
            }
          }}
        />
      ) : null}
      <div
        {...listboxProps}
        id={listboxId}
        className="mesh-listbox-options"
        role="listbox"
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : (ariaLabel ?? "Options")}
        aria-disabled={disabled || undefined}
      >
        {visibleOptions.length ? (
          visibleOptions.map((option) => {
            const optionDisabled = disabled || Boolean(option.disabled);
            const active = option.id === activeId;
            const selected = option.id === value;
            return (
              <button
                key={option.id}
                ref={(element) => {
                  if (element) optionRefs.current.set(option.id, element);
                  else optionRefs.current.delete(option.id);
                }}
                id={`${listboxId}-option-${option.id}`}
                type="button"
                role="option"
                className={`mesh-listbox-option ${active ? "is-active" : ""} ${selected ? "is-selected" : ""}`}
                aria-selected={selected}
                aria-disabled={optionDisabled || undefined}
                disabled={optionDisabled}
                tabIndex={active && !optionDisabled ? 0 : -1}
                onFocus={() => activate(option.id)}
                onClick={() => select(option)}
                onKeyDown={(event) => onOptionKeyDown(event, option)}
              >
                {renderOption ? (
                  renderOption(option, {
                    active,
                    selected,
                    disabled: optionDisabled,
                  })
                ) : (
                  <>
                    <span className="mesh-listbox-option-label">
                      {option.label}
                    </span>
                    {option.description ? (
                      <span className="mesh-listbox-option-description">
                        {option.description}
                      </span>
                    ) : null}
                  </>
                )}
              </button>
            );
          })
        ) : (
          <p className="mesh-listbox-empty" role="status">
            {emptyMessage}
          </p>
        )}
      </div>
    </div>
  );
}

export type MeshCommand = MeshListboxOption & {
  shortcut?: string;
};

export type MeshCommandListProps = Omit<
  MeshListboxProps,
  "options" | "value" | "onValueChange" | "searchable" | "renderOption"
> & {
  commands: readonly MeshCommand[];
  /** Selected command for a controlled command palette. */
  value?: string | null;
  onValueChange?: (id: string) => void;
  onCommand: (command: MeshCommand) => void;
};

/**
 * Search-first command palette built on MeshListbox's focus and disabled-item
 * rules. Commands remain local UI callbacks; this component never broadcasts.
 */
export function MeshCommandList({
  commands,
  value,
  onValueChange,
  onCommand,
  label = "Commands",
  ...props
}: MeshCommandListProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState<string | null>(
    null,
  );
  const selected = value === undefined ? uncontrolledValue : value;
  return (
    <MeshListbox
      {...props}
      options={commands}
      value={selected}
      label={label}
      searchable
      onValueChange={(id) => {
        const command = commands.find((candidate) => candidate.id === id);
        if (!command || command.disabled) return;
        if (value === undefined) setUncontrolledValue(id);
        onValueChange?.(id);
        onCommand(command);
      }}
      renderOption={(option) => {
        const command = commands.find(
          (candidate) => candidate.id === option.id,
        );
        return (
          <>
            <span className="mesh-command-label">{option.label}</span>
            {command?.shortcut ? (
              <kbd className="mesh-command-shortcut">{command.shortcut}</kbd>
            ) : null}
            {option.description ? (
              <span className="mesh-command-description">
                {option.description}
              </span>
            ) : null}
          </>
        );
      }}
    />
  );
}
