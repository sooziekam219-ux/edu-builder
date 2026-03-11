import { injectQuestionBase } from "./base";

const questionImageHandler = {
    typeKey: "question.image",

    normalize(raw) {
        // raw is a single section object from buildPages[i].data
        return {
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
    }
};

export default questionImageHandler;
