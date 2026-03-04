import { injectQuestionBase } from "./base";
import { sanitizeLaTeX } from "../../../utils/sanitize";

const imageHandler = {
    typeKey: "question.image",

    normalize(raw) {
        // subQuestions(빌더) OR questions(표준)
        const qs = raw?.subQuestions || raw?.questions || [];

        // [question.image 특화] 단일 문항 원칙 (프롬프트 규칙 준수)
        // 만약 여러 개라면 첫 번째 것만 사용하거나, passage에 합칠 수 있음.
        // 여기서는 첫 번째 객체를 기반으로 정규화
        const firstQ = qs[0] || {};

        return {
            header: raw?.header,
            guideText: raw?.guideText ?? "",
            mainQuestion: raw?.mainQuestion ?? raw?.questionText ?? "",
            questions: [{
                label: firstQ.label || "",
                promptLatex: firstQ.promptLatex ?? firstQ.passage ?? firstQ.prompt ?? "",
                answerLatex: firstQ.answerLatex ?? firstQ.answer ?? "",
                explanation: firstQ.explanation ?? "",
                inputWidth: firstQ.inputWidth || "w100", // 템플릿 기본값에 맞춰 w100
            }],
            figure_bounds: raw?.figure_bounds || [0, 0, 0, 0],
            figure_alt: raw?.figure_alt || "",
            contentImageUrl: raw?.contentImageUrl || null
        };
    },

    getSkeletonConfig(data) {
        return {
            hasImage: true, // question.image는 항상 이미지가 있다고 가정
            contentImageUrl: data?.contentImageUrl || null,
            figureBounds: data?.figure_bounds || [0, 0, 0, 0],
            figureAlt: data?.figure_alt || "문제 삽화"
        };
    },

    injectHtmlPage({ doc, manifest, data, pageIndex }) {
        // 1. 공통 헤더/가이드/발문
        injectQuestionBase({ doc, data, manifest });

        // 2. question.image 특화 DOM 주입
        // 템플릿의 .q p 영역 (발문)
        const qText = doc.querySelector(".q p");
        if (qText) {
            // 기존 텍스트 유지하거나 mainQuestion으로 교체
            // 템플릿 구조상 p 안에 span.stxt가 있으므로 주의해서 처리
            const stxt = qText.querySelector(".stxt");
            qText.innerHTML = sanitizeLaTeX(data.mainQuestion || "");
            if (stxt) qText.appendChild(stxt);
        }

        // 삽화 주입 (div.text-center img)
        const illustrationImg = doc.querySelector(".flex-col.ai-c .text-center img");
        if (illustrationImg && data.contentImageUrl) {
            illustrationImg.src = data.contentImageUrl;
            illustrationImg.alt = data.figure_alt || "문제 삽화";
        }

        // 입력창 및 지문 주입 (.inp-wrap)
        const qStr = data.questions[0];
        if (qStr) {
            const inpWrap = doc.querySelector(".inp-wrap");
            if (inpWrap) {
                // 템플릿 구조: span(지문) + div(입력창) + span(단위)
                // 여기서는 promptLatex를 지문으로 사용
                const promptSpan = inpWrap.querySelector("span:first-child");
                if (promptSpan) {
                    promptSpan.innerHTML = sanitizeLaTeX(qStr.promptLatex);
                }

                const inputDisplay = doc.querySelector("#QuizInput1");
                if (inputDisplay) {
                    // 초기값 비움
                    inputDisplay.innerHTML = "";
                }

                const correctDiv = inpWrap.querySelector(".correct");
                if (correctDiv) {
                    correctDiv.setAttribute("aria-label", `정답은 ${qStr.answerLatex}입니다.`);
                }
            }
        }

        // 3. 해설 팝업 (.pop.solution .solution-cont .cont)
        const solCont = doc.querySelector(".pop.solution .solution-cont .cont");
        if (solCont && qStr?.explanation) {
            solCont.innerHTML = sanitizeLaTeX(qStr.explanation);
        }
    },

    patchActJs({ actJsText, data, pageIndex }) {
        let out = actJsText;
        const qStr = data.questions[0];
        if (!qStr) return out;

        const val = qStr.answerLatex;
        const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

        // act.js의 dap_array 등 패치
        // question-image 템플릿의 act.js는 var dap_array = ["70"]; 형태
        out = out.replace(/var\s+dap_array\s*=\s*\[[^\]]*\];?/, `var dap_array = ["${esc(val)}"];`);

        // altDap_array (접근성 정답 읽기)
        out = out.replace(/var\s+altDap_array\s*=\s*\[[^\]]*\];?/, `var altDap_array = ["정답은 ${esc(val)}입니다."];`);

        return out;
    },
};

export default imageHandler;
