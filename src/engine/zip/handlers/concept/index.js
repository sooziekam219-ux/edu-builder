
import { injectConceptBase } from "./base";
import { TYPE_KEYS } from "../../../typeKeys";

const conceptHandler = {
    typeKey: TYPE_KEYS.CONCEPT,

    normalize(raw) {
        // Concept data normalization
        return {
            header: raw?.header,
            // Use subQuestions or lines depending on extraction
            lines: raw?.subQuestions || raw?.lines || [],
            title: raw?.mainQuestion || raw?.title || "개념 학습",
        };
    },

    injectHtmlPage({ doc, manifest, data, pageIndex }) {
        console.log("injectConceptHtml called", data);

        // Use the base helper for DOM manipulation
        injectConceptBase({ doc, data });
    },

    patchActJs({ actJsText, data, pageIndex }) {
        // Concept pages usually don't have interactive JS logic (answers etc.)
        // So we just return the original text.
        return actJsText;
    }
};

export default conceptHandler;
