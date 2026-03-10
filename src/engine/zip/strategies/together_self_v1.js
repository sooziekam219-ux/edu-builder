
import { injectTogetherSelfBase } from "../handlers/together+self/base";
import togetherSelfHandler from "../handlers/together+self/index";
// import { TYPE_KEYS } from "../../typeKeys";

const createTogetherSelfStrategy = (config) => {
    const { strategy } = config;
    const options = strategy.options || {}; // { hasImage, contentImageUrl, headerUrl, ... }

    return {
        // _typeKey: TYPE_KEYS.TOGETHER_SELF,

        // [Required] Returns the HTML template path inside the ZIP
        getSkeletonConfig() {
            // Determine which view to clone based on content type
            // [FIX] Use explicit isSelfStudy flag or fallback to headerUrl check
            const isSelfStudy = options.isSelfStudy || (options.headerUrl && options.headerUrl.includes("self"));

            return {
                headerUrl: options.headerUrl,
                contentImageUrl: options.hasImage ? (options.contentImageUrl || null) : null,
                figureBounds: options.figureBounds,
                figureAlt: options.figureAlt,
                // [HINT] Tell zipProcessor which view to use as base
                sourceHtml: isSelfStudy ? "view02.html" : "view01.html"
            };
        },

        normalize(raw) {
            return {
                title: raw?.mainQuestion || raw?.title || "함께 풀기",
                lines: raw?.lines || raw?.subQuestions || [],
            };
        },

        // [Required] Manipulates the cloned HTML
        injectHtmlPage({ doc, data, pageIndex }) {
            // Apply DOM changes using base handler logic
            injectTogetherSelfBase({ doc, data });

            // Additional Together+Self specific logic can go here (e.g., specialized act.js patching if needed)
        },

        // [추가] act.js 수정을 위해 핸들러의 메서드 호출
        patchActJs({ actJsText, data, pageIndex }) {
            return togetherSelfHandler.patchActJs({ actJsText, data, pageIndex });
        },

        // [Optional] Updates manifest.json (if needed)
        updateManifest(manifest) {
            // Usually returns modified manifest
            return manifest;
        }
    };
};

export default createTogetherSelfStrategy;
