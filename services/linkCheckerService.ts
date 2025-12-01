import { GoogleGenAI, Type } from "@google/genai";
import { Bookmark, HealthAuditReport, LinkHealthIssue, LinkStatus } from '../types';

// Custom error for unrecoverable quota issues, mirroring geminiService
class DailyQuotaExceededError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DailyQuotaExceededError';
    }
}

// Helper utilities, duplicated from geminiService to keep services decoupled
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function getFullErrorText(error: any): string {
    if (typeof error === 'string') return error.toLowerCase();
    if (error?.message && typeof error.message === 'string') return error.message.toLowerCase();
    try {
        return JSON.stringify(error).toLowerCase();
    } catch {
        return 'unknown and unstringifiable error';
    }
}

export interface AuditProgress {
    stage: 'PRECHECK' | 'AICHECK' | 'DONE';
    checked: number;
    issuesFound: number;
    total: number;
    // AI Check specific
    currentBatch?: number;
    totalBatches?: number;
}

type ProgressCallback = (progress: AuditProgress) => void;

export type RawHealthAuditReport = Omit<HealthAuditReport, 'issues'> & {
    issues: Omit<LinkHealthIssue, 'path'>[];
};

if (!process.env.API_KEY) {
  console.warn("API_KEY environment variable not set. Gemini API calls will fail.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

// --- HYBRID AI + PRE-CHECK AUDIT IMPLEMENTATION ---

export async function runAudit(
  bookmarks: Bookmark[],
  onProgress: ProgressCallback
): Promise<RawHealthAuditReport> {
    const allIssues: Omit<LinkHealthIssue, 'path'>[] = [];
    const total = bookmarks.length;

    // === STAGE 1: RAPID PRE-CHECK ===
    console.log(`[HealthAudit] Starting Stage 1: Pre-checking ${total} bookmarks...`);
    onProgress({ stage: 'PRECHECK', checked: 0, issuesFound: 0, total });
    
    const bookmarksToAiCheck: Bookmark[] = [];
    const preCheckPromises = bookmarks.map(bookmark => 
        fetch(bookmark.url, { method: 'HEAD', mode: 'no-cors' })
            .then(() => ({ status: 'fulfilled', bookmark }))
            .catch(() => ({ status: 'rejected', bookmark }))
    );

    const results = await Promise.all(preCheckPromises);
    let preCheckChecked = 0;
    
    for (const result of results) {
        preCheckChecked++;
        if (result.status === 'rejected') {
            allIssues.push({ bookmark: result.bookmark, status: 'Network Error' });
        } else {
            bookmarksToAiCheck.push(result.bookmark);
        }
        if (preCheckChecked % 50 === 0) { // Update progress periodically
             onProgress({ stage: 'PRECHECK', checked: preCheckChecked, issuesFound: allIssues.length, total });
        }
    }

    console.log(`[HealthAudit] Stage 1 Complete. ${allIssues.length} network errors found. ${bookmarksToAiCheck.length} links passed to AI.`);
    onProgress({ stage: 'PRECHECK', checked: total, issuesFound: allIssues.length, total });
    await sleep(500); // Give user a moment to see pre-check is done

    // === STAGE 2: AI DEEP SCAN ===
    if (bookmarksToAiCheck.length === 0) {
        console.log("[HealthAudit] No bookmarks require AI check. Finalizing report.");
    } else {
        console.log(`[HealthAudit] Starting Stage 2: AI Deep Scan for ${bookmarksToAiCheck.length} bookmarks.`);
        const CHUNK_SIZE = 25;
        const chunks: Bookmark[][] = [];
        for (let i = 0; i < bookmarksToAiCheck.length; i += CHUNK_SIZE) {
            chunks.push(bookmarksToAiCheck.slice(i, i + CHUNK_SIZE));
        }
        const totalBatches = chunks.length;
        let aiCheckedBookmarksInBatches = 0;

        const validStatuses: LinkStatus[] = ['OK', '404 Not Found', '301 Permanent Redirect', '503 Service Unavailable', 'Timeout', 'Content Shift', 'Paywall Detected', 'Domain For Sale', 'Parked Domain', 'Unknown Error'];

        for (const [index, chunk] of chunks.entries()) {
            const currentBatch = index + 1;
            onProgress({ stage: 'AICHECK', checked: total - bookmarksToAiCheck.length + aiCheckedBookmarksInBatches, issuesFound: allIssues.length, total, currentBatch, totalBatches });
            
            const prompt = `You are a web-auditing assistant. Analyze this list of bookmarks and determine the status of each URL.
            Your response MUST be a JSON array. Each object in the array must have "id", "status", and optional "newUrl" properties.
            - "id" must be the original bookmark ID.
            - "status" must be one of these exact strings: ${validStatuses.join(', ')}.
            - "newUrl" should be provided only if the status is '301 Permanent Redirect'.
            
            Analyze for these specific conditions:
            - 'OK': The URL is live and serves relevant content.
            - '404 Not Found': The URL is a dead link.
            - '301 Permanent Redirect': The URL permanently redirects elsewhere. Provide the final destination URL.
            - 'Paywall Detected': The content requires a subscription.
            - 'Domain For Sale': The domain is listed for sale.
            - 'Parked Domain': The domain shows ads or a 'coming soon' page with no real content.
            - '503 Service Unavailable', 'Timeout', 'Content Shift', 'Unknown Error': Use for other appropriate issues.
            
            Here is the list of bookmarks to audit:
            ${JSON.stringify(chunk.map(({ id, url }) => ({ id, url })))}
            `;

            let retries = 0;
            const MAX_RETRIES = 3;
            let success = false;

            while (retries < MAX_RETRIES && !success) {
                try {
                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: prompt,
                        config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, status: { type: Type.STRING, enum: validStatuses }, newUrl: { type: Type.STRING } }, required: ["id", "status"] } } },
                    });

                    const jsonString = response.text.trim();
                    const results = JSON.parse(jsonString) as { id: string, status: LinkStatus, newUrl?: string }[];
                    
                    for (const result of results) {
                        if (result.status !== 'OK') {
                            const originalBookmark = chunk.find(b => b.id === result.id);
                            if (originalBookmark) {
                                allIssues.push({ bookmark: originalBookmark, status: result.status, newUrl: result.newUrl });
                            }
                        }
                    }
                    aiCheckedBookmarksInBatches += chunk.length;
                    success = true;

                } catch (error: any) {
                    const fullErrorText = getFullErrorText(error);
                    if (fullErrorText.includes('quota')) {
                        throw new DailyQuotaExceededError('You have exceeded your daily API quota for health audits.');
                    }

                    retries++;
                    if (retries >= MAX_RETRIES) {
                        console.error(`[HealthAudit] Max retries exceeded for AI batch ${currentBatch}. Skipping this batch.`, error);
                        break; 
                    }
                    
                    const delay = Math.pow(2, retries) * 1000 + Math.random() * 1000;
                    console.warn(`[HealthAudit] Error on AI batch ${currentBatch}. Retrying in ${Math.round(delay/1000)}s...`, error);
                    await sleep(delay);
                }
            }
        }
    }
    
    const totalChecked = total; // We attempted to check every bookmark one way or another.
    onProgress({ stage: 'DONE', checked: totalChecked, issuesFound: allIssues.length, total });

    const healthScore = totalChecked > 0 ? Math.round(((totalChecked - allIssues.length) / totalChecked) * 100) : 100;

    return {
        issues: allIssues,
        stats: {
            totalChecked: totalChecked,
            totalIssues: allIssues.length,
            healthScore,
        },
    };
}