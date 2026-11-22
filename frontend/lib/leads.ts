export type Lead = {
  id: number;
  nombre: string;
  telefono: string;
  via_contacto: string;
  via_contacto_display: string;
  estado: string;
  estado_display: string;
  interes: string;
  notas: string;
  cliente: number | null;
  cliente_nombre: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string;
  fecha_conversion: string | null;
};

export const VIA_CONTACTO_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "telefono", label: "Teléfono" },
  { value: "personal", label: "Personal" },
  { value: "web", label: "Web" },
  { value: "referido", label: "Referido" },
  { value: "otro", label: "Otro" },
] as const;

export const ESTADO_LEAD_OPTIONS = [
  { value: "nuevo", label: "Nuevo" },
  { value: "contactado", label: "Contactado" },
  { value: "interesado", label: "Interesado" },
  { value: "convertido", label: "Convertido" },
  { value: "perdido", label: "Perdido" },
] as const;
