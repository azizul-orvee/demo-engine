// The contract between the /demo pipeline and the template.
// Every client folder has one brand.json that must satisfy this schema.
// Optional sections that are missing or empty are simply not rendered.
import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a 6-digit hex colour like #0b5fff");

export const ICONS = [
  "flame", "wrench", "shield", "calendar", "droplet", "thermometer", "fan",
  "home", "clipboard", "zap", "clock", "pound", "star", "check", "phone", "leaf",
] as const;

export const Service = z.object({
  title: z.string().min(2),
  description: z.string().min(10),
  icon: z.enum(ICONS).default("wrench"),
  priceFrom: z.string().optional(), // e.g. "£79" — only if the business publishes it
});

export const Review = z.object({
  name: z.string(),
  text: z.string().min(10),
  rating: z.number().min(1).max(5).default(5),
  source: z.string().optional(), // "Google", "Checkatrade", "Website"
  location: z.string().optional(),
});

export const Faq = z.object({ q: z.string(), a: z.string() });

export const Stat = z.object({ value: z.string(), label: z.string() });

export const Brand = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  niche: z.literal("heating").default("heating"),
  sourceUrl: z.string().optional(),

  business: z.object({
    name: z.string(),
    shortName: z.string().optional(),
    phone: z.string(),
    emergencyPhone: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    postcode: z.string().optional(),
    hours: z.array(z.object({ days: z.string(), time: z.string() })).default([]),
    companyNumber: z.string().optional(),
    gasSafeNumber: z.string().optional(), // NEVER invent — only if found on their site
    oftecNumber: z.string().optional(),
    yearEstablished: z.number().optional(),
    socials: z.record(z.string(), z.string()).default({}),
  }),

  brand: z.object({
    logo: z.string().optional(), // file in assets/ or absolute URL; omit for a text logo
    logoOnDark: z.string().optional(),
    colors: z.object({
      primary: hex, // main brand colour: buttons, headings accents
      dark: hex, // deep tone for hero/footer backgrounds
      accent: hex, // CTA / emergency highlight, must contrast with primary
    }),
    headingFont: z.string().default("Newsreader"), // any Google Font family
    bodyFont: z.string().default("Hanken Grotesk"),
  }),

  hero: z.object({
    eyebrow: z.string().optional(), // e.g. "Gas Safe registered engineers in Leeds"
    headline: z.string(),
    subheadline: z.string(),
    primaryCta: z.string().default("Get a free quote"),
    image: z.string().optional(),
    bullets: z.array(z.string()).max(4).default([]),
  }),

  emergency: z
    .object({ enabled: z.boolean().default(true), text: z.string() })
    .optional(),

  accreditations: z.array(z.string()).default([]), // only ones evidenced on their site
  stats: z.array(Stat).max(4).default([]),
  services: z.array(Service).min(3).max(9),

  offer: z
    .object({ title: z.string(), text: z.string(), points: z.array(z.string()).default([]) })
    .optional(),

  process: z.array(z.object({ title: z.string(), text: z.string() })).max(4).default([]),

  about: z
    .object({ title: z.string(), text: z.string(), image: z.string().optional() })
    .optional(),

  reviews: z
    .object({
      rating: z.number().optional(),
      count: z.number().optional(),
      source: z.string().optional(),
      items: z.array(Review).default([]),
    })
    .default({ items: [] }),

  gallery: z.array(z.object({ src: z.string(), alt: z.string() })).default([]),
  serviceArea: z.array(z.string()).default([]),
  faqs: z.array(Faq).default([]),

  seo: z.object({ title: z.string(), description: z.string() }),
});

export type Brand = z.infer<typeof Brand>;
