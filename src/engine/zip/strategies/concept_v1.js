import { injectConceptBase } from "../handlers/concept/base";

const createConceptStrategy = (config) => {
    const { typeKey, strategy } = config;
    const options = strategy.options || {}; // { hasImage, contentImageUrl, ... }

    return {
        typeKey,

        // ZIP Processor calls this to know how to modify the skeleton
        getSkeletonConfig() {
            return {
                viewTemplate: "view01.html", // Always start with view01 for text-based concept
                contentImageUrl: options.hasImage ? (options.contentImageUrl || null) : null,
                figureBounds: options.figureBounds,
                figureAlt: options.figureAlt
            };
        },

        normalize(raw) {
            // raw is the JSON extraction from Gemini
            // Normalize into a standard structure for the handler
            return {
                title: raw?.mainQuestion || raw?.title || "개념 학습",
                lines: raw?.subQuestions || raw?.lines || [], // subQuestions keys might differ based on extraction
                hasImage: options.hasImage
            };
        },

        // [REQUIRED] Interface for zipProcessor.js
        injectHtmlPage({ doc, data, pageIndex }) {
            // 1. Call Handler to manipulate DOM
            injectConceptBase({ doc, data });

            // 2. (Phase 2) Image Injection if needed
            // if (data.hasImage) ...
        },

        // [REQUIRED] Interface for zipProcessor.js
        patchActJs({ actJsText, data, pageIndex }) {
            // Concept pages usually don't have interactive JS logic (answers etc.)
            // So we just return the original text, or maybe clear existing logic if any.
            // view01's act.js is usually simple or empty for concepts.
            // We can return as is.
            return actJsText;
        }
    };
};

export default createConceptStrategy;
