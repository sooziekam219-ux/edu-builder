import { injectQuestionBase } from "./base";

const questionImageHandler = {
    typeKey: "question.image",

    normalize(raw) {
        // raw is a single section object from buildPages[i].data
        return {
            ...raw,
            header: raw?.header,
            title: raw?.title || "",
            subtype: raw?.subtype || "이미지형",
            mainQuestion: raw?.mainQuestion || raw?.content?.instruction || "",
            guideText: raw?.guideText || raw?.content?.body || "",
            answer: raw?.answer || (Array.isArray(raw?.answers) ? raw?.answers[0] : ""),
            explanation: raw?.explanation || (Array.isArray(raw?.answers) ? raw?.explanation : ""),
            figure_bounds: raw?.figure_bounds || [0, 0, 0, 0],
            figure_alt: raw?.figure_alt || "",
            contentImageUrl: raw?.contentImageUrl || null
        };
    },

    injectHtmlPage({ doc, manifest, data, strategy }) {
        // Delegate to strategy
        if (strategy && strategy.injectHtmlPage) {
            strategy.injectHtmlPage({ doc, manifest, data });
        } else {
            // Fallback
            injectQuestionBase({ doc, data, manifest: manifest || {} });
        }
        // --- [추가] 정렬을 위한 스타일 주입 ---
        if (!doc.getElementById('mathinput-inline-style')) {
            const $style = doc.createElement('style');
            $style.id = 'mathinput-inline-style';
            $style.textContent = `
                mjx-container, math { margin-top: 8px !important; }
                .inp-wrap p, .inp-wrap2 p { margin-top: -5px !important; }
            `;
            const head = doc.head || doc.getElementsByTagName('head')[0];
            if (head) {
                head.appendChild($style);
            } else {
                (doc.body || doc.documentElement).appendChild($style);
            }
        }
    }
};

export default questionImageHandler;
