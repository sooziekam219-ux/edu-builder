
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
        // [TODO] 스스로 풀기(View02)는 정답 확인 로직이 필요할 수 있음
        // 하지만 초기 버전에서는 복잡한 JS 수정보다는 HTML 구조 생성에 집중
        return actJsText;
    }
};

export default togetherSelfHandler;