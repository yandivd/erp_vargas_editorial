"use client";

import Select, { type StylesConfig } from "react-select";

export type SelectBuscadorOption = {
  value: string;
  label: string;
};

export type SelectBuscadorProps = {
  options: readonly SelectBuscadorOption[];
  value: SelectBuscadorOption | null;
  onChange: (option: SelectBuscadorOption | null) => void;
  placeholder?: string;
  isClearable?: boolean;
  isDisabled?: boolean;
  inputId?: string;
  name?: string;
  className?: string;
  ariaLabel?: string;
};

const selectStyles: StylesConfig<SelectBuscadorOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: "38px",
    borderRadius: "0.5rem",
    borderColor: state.isFocused ? "#3b82f6" : "#e2e8f0",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(59, 130, 246, 0.2)" : "none",
    backgroundColor: state.isDisabled ? "#f8fafc" : "#ffffff",
    "&:hover": {
      borderColor: state.isFocused ? "#3b82f6" : "#cbd5e1",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "2px 12px",
    fontSize: "0.875rem",
  }),
  placeholder: (base) => ({
    ...base,
    color: "#94a3b8",
    margin: 0,
  }),
  singleValue: (base) => ({
    ...base,
    color: "#1e293b",
    margin: 0,
  }),
  input: (base) => ({
    ...base,
    color: "#1e293b",
    margin: 0,
  }),
  indicatorSeparator: (base) => ({
    ...base,
    backgroundColor: "#e2e8f0",
  }),
  dropdownIndicator: (base) => ({
    ...base,
    color: "#64748b",
    padding: "0 8px",
    ":hover": { color: "#1e293b" },
  }),
  clearIndicator: (base) => ({
    ...base,
    color: "#94a3b8",
    padding: "0 8px",
    ":hover": { color: "#ef4444" },
  }),
  menu: (base) => ({
    ...base,
    borderRadius: "0.5rem",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.12)",
  }),
  menuList: (base) => ({
    ...base,
    maxHeight: 240,
    padding: 4,
  }),
  option: (base, state) => ({
    ...base,
    borderRadius: "0.375rem",
    backgroundColor: state.isSelected
      ? "#dbeafe"
      : state.isFocused
        ? "#f1f5f9"
        : "transparent",
    color: state.isSelected ? "#1e3a8a" : "#1e293b",
    cursor: "pointer",
    fontSize: "0.875rem",
    padding: "8px 10px",
    ":active": { backgroundColor: "#bfdbfe" },
  }),
  noOptionsMessage: (base) => ({
    ...base,
    color: "#64748b",
    fontSize: "0.875rem",
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 80,
  }),
};

export default function SelectBuscador({
  options,
  value,
  onChange,
  placeholder = "Selecciona...",
  isClearable = false,
  isDisabled = false,
  inputId,
  name,
  className,
  ariaLabel,
}: SelectBuscadorProps) {
  const portalTarget =
    typeof document === "undefined" ? undefined : document.body;

  return (
    <Select<SelectBuscadorOption, false>
      inputId={inputId}
      name={name}
      aria-label={ariaLabel}
      options={[...options]}
      value={value}
      onChange={(option) => onChange(option)}
      placeholder={placeholder}
      isClearable={isClearable}
      isDisabled={isDisabled}
      isSearchable
      className={`w-full ${className ?? ""}`}
      classNamePrefix="erp-select"
      styles={selectStyles}
      menuPortalTarget={portalTarget}
      menuPosition="fixed"
      noOptionsMessage={() => "Sin resultados"}
    />
  );
}
