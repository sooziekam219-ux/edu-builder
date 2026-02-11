
import { injectQuestionBase } from "../handlers/question/base";
import { sanitizeLaTeX } from "../../utils/sanitize";

// Factory function
const createInputStrategy = (config) => {
    const { typeKey, manifest, strategy } = config;
    const options = strategy.options || {}; // { inputKind, hasImage, headerUrl, contentImageUrl }

    // Selectors
    const SEL = {
        rowTemplate: manifest.rowTemplate || ".flex-row.ai-s.jc-sb",
        label: manifest.label || ".a2 label",
        passage: manifest.passage || ".a2 p",
        inputWrap: manifest.inputWrap || ".inp-wrap > div",
        solveBtn: manifest.solveBtn || ".btn-solve",
        explanationPopup: manifest.explanationPopup || ".pop.solution",
    };

    return {
        typeKey,

        // [NEW] ZIP Processor calls this to know how to modify the skeleton
        getSkeletonConfig() {
            return {
                headerUrl: options.headerUrl,
                contentImageUrl: options.hasImage ? (options.contentImageUrl || null) : null,
                inputKind: options.inputKind || "math", // 'math' | 'text' | 'ocr'
                figureBounds: options.figureBounds, // [NEW] Bounds for cropping
                figureAlt: options.figureAlt // [NEW] Descriptive alt text
            };
        },

        normalize(raw) {
            const qs = raw?.subQuestions || raw?.questions || [];
            return {
                header: raw?.header,
                guideText: raw?.guideText ?? "",
                mainQuestion: raw?.mainQuestion ?? raw?.questionText ?? "",
                questions: qs.map((q) => ({
                    label: q.label,
                    promptLatex: q.promptLatex ?? q.passage ?? q.text ?? q.prompt ?? "",
                    answerLatex: q.answerLatex ?? q.answer ?? "",
                    explanation: q.explanation ?? "",
                    imageUrl: q.imageUrl || null,
                    inputWidth: q.inputWidth || "w200",
                })),
            };
        },

        injectHtmlPage({ doc, manifest: _manifest, data, pageIndex }) {
            // 1. Common Headers
            injectQuestionBase({ doc, data, manifest: _manifest || manifest });

            // 2. Loop Items
            const rowTemplate = doc.querySelector(SEL.rowTemplate);
            if (!rowTemplate) {
                throw new Error(`[input_v1] Selector not found: ${SEL.rowTemplate}`);
            }

            const parent = rowTemplate.parentNode;

            // Clear existing rows
            const existingRows = Array.from(parent.querySelectorAll(SEL.rowTemplate)).filter(r =>
                r.querySelector(SEL.label) || r.querySelector(SEL.passage)
            );
            existingRows.forEach(r => r.remove());

            // Rebuild rows from data
            (data.questions || []).forEach((q, i) => {
                const newRow = rowTemplate.cloneNode(true);

                const label = newRow.querySelector(SEL.label);
                const p = newRow.querySelector(SEL.passage);
                const inp = newRow.querySelector(SEL.inputWrap);
                const solveBtn = newRow.querySelector(SEL.solveBtn);

                if (label) label.textContent = q.label || `(${i + 1})`;

                if (p) {
                    p.innerHTML = sanitizeLaTeX(q.promptLatex);
                    // Note: Content Image is handled by zipProcessor globally or per-page via skeleton modification
                }

                if (inp) {
                    // Note: Input Styling is handled by zipProcessor via skeleton modification

                    // Correct Answer injection
                    const correctEl = inp.querySelector(".correct");
                    if (correctEl) {
                        correctEl.innerHTML = sanitizeLaTeX(q.answerLatex);
                    }
                }

                if (solveBtn) solveBtn.setAttribute("aria-haspopup", "dialog");

                if (i !== (data.questions.length - 1)) {
                    newRow.classList.add("mb80");
                    newRow.style.marginBottom = "80px";
                }

                parent.appendChild(newRow);
            });

            // 3. Explanation Popups
            const solPopups = doc.querySelectorAll(SEL.explanationPopup);
            if (solPopups.length > 0) {
                data.questions.forEach((q, idx) => {
                    if (solPopups[idx]) {
                        const cont = solPopups[idx].querySelector(".cont");
                        if (cont) {
                            cont.innerHTML = sanitizeLaTeX(q.explanation);
                            cont.setAttribute("aria-label", "");
                        }
                    }
                });
            }
        },

        patchActJs({ actJsText, data, pageIndex }) {
            let out = actJsText;
            const questions = data.questions || [];
            const n = questions.length;
            const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

            // 1. dapN_array injection
            for (let i = 0; i < n; i++) {
                const val = questions[i].answerLatex;
                const varName = `dap${i + 1}_array`;
                const newCode = `var ${varName} = ["${esc(val)}"];`;

                if (new RegExp(`var\\s+${varName}\\s*=`).test(out)) {
                    out = out.replace(new RegExp(`var\\s+${varName}\\s*=\\s*\\[[^\\]]*\\]\\s*;`), newCode);
                } else {
                    out = out.replace(/(var\s+qArange)/, `${newCode}\n$1`);
                }
            }

            // 2. q_len
            out = out.replace(/var\s+q_len\s*=\s*\d+\s*;/, `var q_len = ${n};`);

            // 3. qArange construction
            const arangeStr = "[" + Array.from({ length: n }, (_, i) => `[${i + 1}]`).join(", ") + "]";
            out = out.replace(/var\s+qArange\s*=\s*\[[^\]]*\]\s*;/, `var qArange = ${arangeStr};`);

            // 4. dap_array construction
            const concatArgs = Array.from({ length: n }, (_, i) => `dap${i + 1}_array`).join(", ");
            out = out.replace(
                /var\s+dap_array\s*=\s*[^;]*;/,
                `var dap_array = [].concat(${concatArgs});`
            );

            return out;
        }
    };
};

export default createInputStrategy;
