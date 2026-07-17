# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start dev server at localhost:4321
npm run build        # type-check, build, generate pagefind index, copy to public/
npm run preview      # preview the production build locally
npm run lint         # ESLint
npm run format       # Prettier (write)
npm run format:check # Prettier (check only)
npm run sync         # regenerate .astro types (run after changing content.config.ts)
```

The build command is a pipeline: `astro check && astro build && pagefind --site dist && cp -r dist/pagefind public/`. Pagefind (search index) must be built before `npm run preview` works correctly.

## Architecture

### Configuration — two files own all site-wide settings

- **`src/config.ts`** — `SITE` object: domain, author, title, description, pagination, dark mode, OG image, timezone, and the `editPost` toggle. This is the first file to edit for any site-wide change.
- **`src/constants.ts`** — `SOCIALS` (footer/profile social links) and `SHARE_LINKS` (per-post share buttons). Each entry requires a `name`, `href`, `linkTitle`, and an SVG icon imported from `src/assets/icons/`.

### Content — `src/data/blog/`

Posts are Markdown files in `src/data/blog/`. The collection is defined in `src/content.config.ts` using Astro's glob loader. Files prefixed with `_` are ignored by the loader (used for draft folders or release notes).

Required frontmatter fields:

```md
---
author: Your Name
pubDatetime: 2026-02-22T00:00:00Z
title: Post Title
slug: post-slug
featured: false
draft: false
tags:
  - general
description: One-line description shown in post lists.
---
```

Optional: `modDatetime`, `ogImage`, `canonicalURL`, `hideEditPost`, `timezone`.

### Layouts

- `Layout.astro` — base HTML shell with `<head>`, SEO meta, OG tags, JSON-LD, theme script, and `ClientRouter` (view transitions). Every page goes through this.
- `Main.astro` — wraps `Layout.astro` and adds `<Header>` + `<Footer>`.
- `PostDetails.astro` — extends `Main.astro` for individual blog posts; handles prev/next navigation and share links.
- `AboutLayout.astro` — extends `Main.astro` for `src/pages/about.md`.

### Pages & routing

All routes are file-based under `src/pages/`. Key routes:
- `/` → `index.astro` (featured + recent posts)
- `/posts/[...slug]/` → `src/pages/posts/[...slug]/index.astro`
- `/tags/[tag]/` → tag filtered post list
- `/archives/` → full chronological list (toggle via `SITE.showArchives`)
- `/search/` → pagefind-powered client-side search
- `/about` → `src/pages/about.md`
- `/rss.xml`, `/sitemap-index.xml`, `/og.png` → generated at build time

### OG image generation

Dynamic OG images are generated via `src/utils/generateOgImages.ts` using `satori` (SVG) and `@resvg/resvg-js` (PNG). Templates live in `src/utils/og-templates/`. Controlled by `SITE.dynamicOgImage` in `src/config.ts`.

### Tailwind

Uses Tailwind v4 via the `@tailwindcss/vite` plugin — no `tailwind.config.*` file. Global styles and theme tokens are in `src/styles/global.css`. The `@tailwindcss/typography` plugin provides the `prose` class used in post and about layouts.

### Code highlighting

Shiki is configured in `astro.config.ts` with themes `min-light` / `night-owl`. Custom transformers in `src/utils/transformers/` add filename tabs and diff/highlight notation.

### Environment variables

`PUBLIC_GOOGLE_SITE_VERIFICATION` — optional, adds a Google Search Console meta tag when set.

## Adding social links

Edit the `SOCIALS` array in `src/constants.ts`. The icon must be an SVG imported from `src/assets/icons/`. Set `href: ""` to hide a link without removing the entry.
