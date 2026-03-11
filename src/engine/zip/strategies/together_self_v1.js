
import { injectTogetherSelfBase } from "../handlers/together+self/base";
import togetherSelfHandler from "../handlers/together+self/index";
// import { TYPE_KEYS } from "../../typeKeys";

const createTogetherSelfStrategy = (config) => {
    const { strategy } = config;
    const options = strategy.options || {}; // { hasImage, contentImageUrl, headerUrl, ... }

    return {
        // _typeKey: TYPE_KEYS.TOGETHER_SELF,

        // [Required] Returns the HTML template path inside the ZIP
        getSkeletonConfig(data) {
            // Determine which view to clone based on content type
            // [FIX] Determine from page data dynamically, not static options
            const dTitle = data?.title || "";
            const isSelfStudy = (dTitle.includes("스스로") && !dTitle.includes("함께"));

            let hUrl = options.headerUrl;
            if (isSelfStudy) {
                hUrl = "images/tit-self.png";
            } else {
                // 함께 풀기 번호 분석
                const match = dTitle.match(/함께\s*풀기\s*(\d+)/) || dTitle.match(/문제\s*(\d+)/);
                if (match) hUrl = `images/tit-together${match[1]}.png`;
            }

            return {
                headerUrl: hUrl,
                contentImageUrl: options.hasImage ? (options.contentImageUrl || null) : null,
                figureBounds: options.figureBounds,
                figureAlt: options.figureAlt,
                // [HINT] Tell zipProcessor which view to use as base
                sourceHtml: isSelfStudy ? "view02.html" : "view01.html"
            };
        },

        normalize(raw) {
            return {
                header: raw?.header,
                title: raw?.title || "",
                mainQuestion: raw?.mainQuestion || "", // 필드 분리
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
