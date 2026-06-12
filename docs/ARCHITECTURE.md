# System Architecture

## Overview

SuperAhorro IA is a client-side React application (PWA) for extracting supermarket prices from brochures/receipts using Google Gemini AI, comparing unit prices across stores, and generating optimized shopping lists.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   React UI   │  │  State Mgmt  │  │   Service Layer      │  │
│  │  (App.tsx)   │◄─┤ (useState/   │◄─┤  • Gemini API        │  │
│  │  Components  │  │  useEffect)  │  │  • LocalStorage DB   │  │
│  └──────────────┘  └──────────────┘  │  • Camera/Files API  │  │
│                                      │  • GSheets Sync      │  │
│                                      └──────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  IndexedDB   │  │  LocalStorage│  │  Service Worker      │  │
│  │  (optional)  │  │  (primary)   │  │  (PWA Offline)       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    HTTPS + JSON
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Google Gemini API                            │
│  • generateContent (structured JSON output)                    │
│  • Models: gemini-2.5-flash-lite, gemini-2.5-flash, etc.       │
└─────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

1. **Client-only**: No backend server required. All logic runs in browser.
2. **Local-first**: Data persists in localStorage; optional Google Sheets sync.
3. **AI-powered**: Uses Gemini structured output for reliable parsing.
4. **PWA**: Works offline via Service Worker caching.
5. **Unit-price normalization**: Core feature for fair comparison across units.