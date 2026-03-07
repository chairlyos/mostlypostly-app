// src/core/toneVariants.js
// Tone system: 5 main salon tones, each with 4 variants a stylist can select.
// If a stylist has no tone_variant set, the AI caption generator falls back
// to the salon's main tone field automatically.

export const TONE_GROUPS = [
  {
    key: "warm_nurturing",
    label: "Warm & Nurturing",
    description: "Personal, caring, relationship-focused",
    variants: [
      { key: "warm_nurturing",     label: "Warm & Nurturing",     desc: "Salon default — personal, caring" },
      { key: "warm_playful",       label: "Warm & Playful",       desc: "Adds lightness and humor while staying caring" },
      { key: "warm_inspirational", label: "Warm & Inspirational", desc: "Motivating and uplifting with heart" },
      { key: "warm_personal",      label: "Warm & Conversational",desc: "Feels like a text from a trusted friend" },
    ],
  },
  {
    key: "professional_polished",
    label: "Professional & Polished",
    description: "Expert, refined, aspirational",
    variants: [
      { key: "professional_polished",     label: "Professional & Polished",     desc: "Salon default — expert, refined" },
      { key: "professional_approachable", label: "Professional & Approachable", desc: "Expert but warm and easy to connect with" },
      { key: "professional_educational",  label: "Professional & Educational",  desc: "Teaching tone — explains the service or technique" },
      { key: "professional_aspirational", label: "Professional & Aspirational", desc: "Luxury feel — elevated, premium positioning" },
    ],
  },
  {
    key: "fun_energetic",
    label: "Fun & Energetic",
    description: "Upbeat, trendy, high-energy",
    variants: [
      { key: "fun_energetic",   label: "Fun & Energetic",   desc: "Salon default — upbeat, high-energy" },
      { key: "fun_bold",        label: "Fun & Bold",        desc: "Louder, more expressive, unapologetic" },
      { key: "fun_trendy",      label: "Fun & Trendy",      desc: "On-trend, current cultural references" },
      { key: "fun_celebratory", label: "Fun & Celebratory", desc: "Hyped, exclamation-forward, party energy" },
    ],
  },
  {
    key: "bold_edgy",
    label: "Bold & Edgy",
    description: "Fashion-forward, daring, artistic",
    variants: [
      { key: "bold_edgy",    label: "Bold & Edgy",           desc: "Salon default — daring, fashion-forward" },
      { key: "bold_artistic",label: "Bold & Artistic",       desc: "Creative, expressive, talks about the craft" },
      { key: "bold_fashion", label: "Bold & Fashion-Forward",desc: "High-fashion, editorial, magazine-style" },
      { key: "bold_minimal", label: "Bold & Minimal",        desc: "Few words, maximum impact — lets the work speak" },
    ],
  },
  {
    key: "minimalist_clean",
    label: "Minimalist & Clean",
    description: "Quiet luxury, understated, sophisticated",
    variants: [
      { key: "minimalist_clean",    label: "Minimalist & Clean",    desc: "Salon default — quiet, refined" },
      { key: "minimalist_luxe",     label: "Minimalist & Luxe",     desc: "Quiet luxury, premium positioning" },
      { key: "minimalist_modern",   label: "Minimalist & Modern",   desc: "Contemporary, forward-thinking" },
      { key: "minimalist_editorial",label: "Minimalist & Editorial",desc: "Curated, magazine-quality captions" },
    ],
  },
];

/** Flat map: key → { label, desc, groupLabel } */
export const TONE_VARIANT_MAP = Object.fromEntries(
  TONE_GROUPS.flatMap(g =>
    g.variants.map(v => [v.key, { ...v, groupLabel: g.label }])
  )
);

/**
 * Get the effective tone string to pass to the AI.
 * Falls back to the salon's main tone if no stylist variant is set.
 */
export function resolveStyleTone(stylistToneVariant, salonTone) {
  if (stylistToneVariant && TONE_VARIANT_MAP[stylistToneVariant]) {
    return TONE_VARIANT_MAP[stylistToneVariant].label;
  }
  return salonTone || "warm and nurturing";
}

/**
 * Build grouped <optgroup> options for a <select>.
 * Pass currentKey to pre-select.
 */
export function toneSelectOptions(currentKey = "") {
  return TONE_GROUPS.map(g => `
    <optgroup label="${g.label}">
      ${g.variants.map(v => `
        <option value="${v.key}" ${currentKey === v.key ? "selected" : ""}
          title="${v.desc}">
          ${v.label}${v.key === g.key ? " (default)" : ""}
        </option>
      `).join("")}
    </optgroup>
  `).join("");
}
