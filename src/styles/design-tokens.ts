/**
 * Design system tokens – use with Tailwind (values match tailwind.config.js).
 * Reference only; actual values live in Tailwind config.
 */
export const tokens = {
  radius: {
    sm: "0.375rem",   // 6px  – badges, small controls
    md: "0.5rem",     // 8px  – inputs, buttons
    lg: "0.75rem",    // 12px – cards inner, modals
    xl: "1rem",       // 16px – cards
    "2xl": "1.25rem", // 20px – section containers, modals
  },
  spacing: {
    page: "1.5rem",   // 24px – page padding
    section: "2rem",   // 32px – between sections
    block: "1rem",    // 16px – between blocks in section
    card: "1.25rem",  // 20px – card padding (p-5)
    cardLg: "1.5rem", // 24px – card padding large (p-6)
    input: "0.5rem",  // 8px  – gap between label and input
  },
  fontSize: {
    caption: "0.75rem",   // 12px – labels, captions, badges
    body: "0.875rem",     // 14px – body text
    bodyLg: "1rem",      // 16px – lead body
    title: "1.125rem",   // 18px – card/section titles
    pageTitle: "1.5rem", // 24px – page title (sm: 30px)
  },
  icon: {
    xs: "0.875rem",  // 14px
    sm: "1rem",      // 16px
    md: "1.25rem",   // 20px
    lg: "1.5rem",    // 24px
  },
} as const;
