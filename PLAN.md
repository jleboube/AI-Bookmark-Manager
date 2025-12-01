# Project Plan: Overhaul Bookmark Health Audit

## Status: Complete

### 1. The Problem

The initial AI-powered "Bookmark Health Audit" feature, while functional, was inefficient. It sent every single bookmark URL to the Gemini API for analysis, leading to rapid consumption of the API quota and frequent rate-limit errors, especially with large bookmark collections. This approach was not cost-effective or scalable. The core challenge is to check thousands of links accurately without exhausting API limits.

### 2. Solution: Hybrid Two-Stage Auditing

To address this, the feature has been re-architected into a more intelligent, two-stage hybrid model that significantly reduces API calls while improving accuracy and speed.

**Stage 1: Mass Client-Side Pre-Check**
- The application first performs a rapid, parallel pre-check on all bookmarks using the browser's `fetch` API with `mode: 'no-cors'`.
- This lightweight request can't read the response, but it can instantly detect network-level failures like DNS resolution errors or refused connections.
- These links are immediately flagged as `'Network Error'` without ever touching the Gemini API, providing a fast, free, and efficient first pass that filters out a significant number of dead links.

**Stage 2: Targeted AI Deep Scan**
- Only the bookmarks that pass the initial pre-check (i.e., a server responded) are collected and sent to the Gemini API for a more nuanced "deep scan."
- The Gemini model acts as a server-side proxy to bypass CORS, analyzing the content of these remaining pages for complex issues that a simple network request cannot identify, such as `'404 Not Found'`, `'Domain For Sale'`, `'Parked Domain'`, or `'Paywall Detected'`.
- This targeted approach ensures that the expensive, powerful AI is used only for the tasks that require its intelligence.

### 3. Key Changes & Implementation Details

**a. Service Layer (`services/linkCheckerService.ts`):**
-   The `runAudit` function was completely rewritten to implement the two-stage pipeline. It now uses `Promise.allSettled` for the parallel pre-check and then sends a much smaller, pre-filtered list of URLs to Gemini.
-   Verbose logging has been added to provide clear insight into the process, tracking how many links are handled at each stage.
-   Progress reporting is now more granular, informing the user about both the pre-check and deep scan phases.
-   Error handling and final report aggregation have been updated to correctly combine results from both stages, ensuring the final health score is accurate.

**b. Type Definitions (`types.ts`):**
-   The `LinkStatus` type has been updated to include `'Network Error'`, a new status for links that fail the initial client-side check.

**c. User Interface (`components/HealthAuditReportView.tsx` & `components/icons.tsx`):**
-   The UI now recognizes and displays `'Network Error'` as a distinct issue category, complete with a new `ServerSlashIcon`. This gives users a clearer understanding of why a link has failed.

**d. State Management (`AppContext.tsx`):**
-   The loading overlay has been enhanced to display messages from the new multi-stage process (e.g., "Stage 1: Pre-checking links...", "Stage 2: AI deep scan..."), improving transparency for the user.

### 4. Benefits

-   **API Quota Preservation:** API calls have been dramatically reduced, making the feature sustainable and virtually eliminating quota-related errors.
-   **Increased Performance:** The initial pre-check is significantly faster than waiting for API responses, providing quicker feedback for many dead links.
-   **Improved Accuracy:** The system now distinguishes between fundamental network failures and server-side content issues, providing more precise and actionable feedback.
-   **Efficient & Scalable Architecture:** The hybrid approach demonstrates a best-practice model for integrating AI: use traditional logic for simple tasks and reserve AI for complex analysis, resulting in a robust, efficient, and scalable solution.