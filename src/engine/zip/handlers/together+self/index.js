
import { injectTogetherSelfBase } from "./base";
import { TYPE_KEYS } from "../../../typeKeys";

const togetherSelfHandler = {
    typeKey: TYPE_KEYS.TOGETHER_SELF,

    // 데이터를 핸들러가 처리하기 편한 형태로 정규화
    normalize(raw) {
        return {
            title: raw?.mainQuestion || raw?.title || "함께 풀기",
            lines: raw?.subQuestions || raw?.lines || [],
            // Other properties if needed
        };
    },

    // 실제 HTML 파일에 데이터 주입
    injectHtmlPage({ doc, manifest, data, pageIndex }) {
        console.log("injectTogetherSelf HTML called", data);

        // base.js의 함수가 view01(함께)/view02(스스로)를 자동 구분하여 처리
        injectTogetherSelfBase({ doc, data });
    },

    // Act.js 수정 필요 시 (현재는 단순 반환)
    patchActJs({ actJsText, data, pageIndex }) {
        // Collect all blank answers
        const blanks = [];
        (data.lines || []).forEach(line => {
            if (line.parts) {
                line.parts.filter(p => p.type === 'blank').forEach(p => {
                    const options = p.options || [];
                    const correctIdx = (parseInt(p.correctIndex, 10) || 1) - 1;
                    blanks.push(options[correctIdx] || "");
                });
            }
        });

        let out = actJsText;

        // 1. Together Mode (card_array)
        const zeros = blanks.map(() => 0);
        out = out.replace(/var\s+card_array\s*=\s*\[[\s\S]*?\]\s*;/g, `var card_array = ${JSON.stringify(zeros)};`);

        // 2. Self Study Mode (dap_array, latexStr_array)
        out = out.replace(/var\s+dap_array\s*=\s*\[[\s\S]*?\]\s*;/g, `var dap_array = ${JSON.stringify(blanks)};`);
        out = out.replace(/var\s+latexStr_array\s*=\s*dap_array\s*;/g, `var latexStr_array = dap_array;`);
        out = out.replace(/var\s+latexStr_array\s*=\s*\[[\s\S]*?\]\s*;/g, `var latexStr_array = ${JSON.stringify(blanks)};`);

        // 3. Optional: Patch q_len
        out = out.replace(/var\s+q_len\s*=\s*\d+;/, `var q_len = ${blanks.length};`);
        out = out.replace(/var\s+card_len\s*=\s*card_array\.length\s*;/g, `var card_len = ${blanks.length};`);

        return out;
    }
};

export default togetherSelfHandler;