import { GoogleGenAI, Type } from "@google/genai";
import { Bookmark } from '../types';

if (!process.env.API_KEY) {
  // This is a placeholder for environments where the key is not set.
  // The app will not function correctly without a valid API key.
  console.warn("API_KEY environment variable not set. Gemini API calls will fail.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

// Custom error for unrecoverable quota issues
export class DailyQuotaExceededError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DailyQuotaExceededError';
    }
}


interface CategorizationResult {
  folderName: string;
  bookmarkIds: string[];
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to robustly extract an error message string.
function getFullErrorText(error: any): string {
    if (typeof error === 'string') return error.toLowerCase();
    
    // The Gemini SDK often puts the JSON response in the message.
    if (error?.message && typeof error.message === 'string') {
        return error.message.toLowerCase();
    }
    
    // Fallback to stringifying the whole object to catch nested messages.
    try {
        return JSON.stringify(error).toLowerCase();
    } catch {
        return 'unknown and unstringifiable error';
    }
}

async function processBatch(
    chunk: Bookmark[], 
    batchId: number, 
    totalBatches: number, 
    onProgress: (msg: string) => void
): Promise<CategorizationResult[]> {
    const model = "gemini-2.5-flash";
    const prompt = `You are an expert bookmark organizer. Your task is to organize a list of browser bookmarks into a clean, logical folder structure.

    Guidelines:
    1. **Categories**: Create distinct, high-level categories (e.g., Development, News, Shopping, Finance, Tools, Education, Travel, etc.).
    2. **Coverage**: Assign EVERY bookmark ID from the input list to exactly one category. Do not skip any.
    3. **Integrity**: Return the **EXACT** bookmark ID provided in the input. Do not alter, prefix, or hallucinate IDs.
    4. **Ambiguity**: Use the URL domain and Title to infer the content.
    5. **Structure**: Return a flat list of categories.
    
    Input Bookmarks:
    ${JSON.stringify(chunk.map(({ id, title, url }) => ({ id, title, url })))}
    `;

    let retries = 0;
    const MAX_RETRIES = 3;

    while (retries < MAX_RETRIES) {
        try {
            // console.log(`%c[Gemini] Processing batch ${batchId}/${totalBatches}...`, "color: cyan");
            const response = await ai.models.generateContent({
                model,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    // Explicitly set a high token limit to prevent JSON truncation
                    maxOutputTokens: 8192,
                    // Safety settings to prevent "No text returned" on benign content
                    safetySettings: [
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
                    ],
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                folderName: {
                                    type: Type.STRING,
                                    description: 'The name of the suggested category/folder.',
                                },
                                bookmarkIds: {
                                    type: Type.ARRAY,
                                    items: { type: Type.STRING },
                                    description: 'An array of bookmark IDs that belong in this category.',
                                },
                            },
                            required: ["folderName", "bookmarkIds"],
                        },
                    },
                },
            });

            const text = response.text;
            if (!text) {
                const finishReason = response.candidates?.[0]?.finishReason;
                if (finishReason) {
                    throw new Error(`Model finished with reason: ${finishReason} (Likely Safety or Filter)`);
                }
                throw new Error("No text returned");
            }
            
            const jsonString = text.trim();
            let parsedJson: any;
            try {
                parsedJson = JSON.parse(jsonString);
            } catch (e) {
                console.error(`[Gemini] Batch ${batchId} JSON Parse Error. Length: ${jsonString.length}. Raw text snippet: ${jsonString.slice(0, 100)}...`);
                throw e; // Retry on malformed JSON
            }

            if (!Array.isArray(parsedJson)) throw new Error("Response is not an array");
            
            // Validate structure briefly
            const validItems: CategorizationResult[] = [];
            for (const item of parsedJson) {
                if (item && typeof item.folderName === 'string' && Array.isArray(item.bookmarkIds)) {
                    validItems.push(item as CategorizationResult);
                }
            }
            
            console.log(`%c[Gemini] Batch ${batchId} success.`, "color: lightgreen");
            return validItems;

        } catch (error: any) {
            const fullErrorText = getFullErrorText(error);
            const isDailyQuotaError = fullErrorText.includes('quota') || fullErrorText.includes('billing') || fullErrorText.includes('429');
            
            if (isDailyQuotaError) {
                throw new DailyQuotaExceededError('You have exceeded your daily API quota.');
            }

            retries++;
            if (retries < MAX_RETRIES) {
                const delay = Math.pow(2, retries) * 1000 + Math.random() * 500;
                console.warn(`[Gemini] Batch ${batchId} failed (${error.message}). Retrying in ${Math.round(delay)}ms...`);
                // onProgress(`Batch ${batchId}: Transient error, retrying...`); // Optional: avoid spamming UI
                await sleep(delay);
            } else {
                console.error(`[Gemini] Batch ${batchId} failed permanently.`, error);
                return []; // Return empty for this batch to allow partial success
            }
        }
    }
    return [];
}

export async function categorizeBookmarks(
    bookmarks: Bookmark[],
    onProgress: (message: string) => void
): Promise<CategorizationResult[]> {
    // Reduced Batch Size to 20 to prevent JSON truncation errors and timeouts.
    // 20 bookmarks * ~50 chars ID + metadata is safely within output limits.
    const CHUNK_SIZE = 20; 
    // Increased Concurrency to 5 to maintain speed with smaller batches.
    const CONCURRENCY = 5;

    const chunks: Bookmark[][] = [];
    for (let i = 0; i < bookmarks.length; i += CHUNK_SIZE) {
        chunks.push(bookmarks.slice(i, i + CHUNK_SIZE));
    }
    
    const initialMessage = `AI is analyzing ${bookmarks.length} bookmarks in ${chunks.length} batches (processing ${CONCURRENCY} at a time)...`;
    onProgress(initialMessage);
    console.log(initialMessage);

    const allResults: CategorizationResult[] = [];

    // Process chunks in parallel groups
    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
        const batchGroup = chunks.slice(i, i + CONCURRENCY);
        const batchPromises = batchGroup.map((chunk, index) => {
            const globalBatchId = i + index + 1;
            // Update progress for the group start
            onProgress(`Analyzing batches ${i + 1}-${Math.min(i + CONCURRENCY, chunks.length)} of ${chunks.length}...`);
            return processBatch(chunk, globalBatchId, chunks.length, onProgress);
        });

        const groupResults = await Promise.all(batchPromises);
        
        // Flatten and collect results
        groupResults.forEach(res => {
            if (res) allResults.push(...res);
        });

        // Small breather between large concurrent bursts to be nice to the API
        if (i + CONCURRENCY < chunks.length) {
            await sleep(500);
        }
    }

    // Merge categories with the same folderName from different chunks, case-insensitive
    const mergedCategories = new Map<string, CategorizationResult>();
    
    for (const category of allResults) {
        if (!category || !category.folderName || !category.bookmarkIds) continue;
        
        const folderName = category.folderName.trim();
        if (!folderName) continue;

        // Use lowercase key for consistent grouping (e.g., "Shopping" == "shopping")
        const key = folderName.toLowerCase();
        
        if (mergedCategories.has(key)) {
            const existing = mergedCategories.get(key)!;
            existing.bookmarkIds.push(...category.bookmarkIds);
            
            // Prefer the Capitalized version if the existing one is not
            if (folderName[0] === folderName[0].toUpperCase() && existing.folderName[0] !== existing.folderName[0].toUpperCase()) {
                existing.folderName = folderName;
            }
        } else {
            mergedCategories.set(key, { 
                folderName: folderName, // Keep original casing for display
                bookmarkIds: [...category.bookmarkIds] 
            });
        }
    }

    return Array.from(mergedCategories.values());
}