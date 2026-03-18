import { TYPE_KEYS } from "../engine/typeKeys";

export const generateLogicText = (typeKey, type, subtype, answers) => {
    const hasAnswer = answers && answers.length > 0;
    const answerSection = hasAnswer ? `[정답 설정]\n- 정답: ${answers.join(', ')}\n\n` : '';


    // 2. 함께 풀기 + 스스로 풀기 (복합 유형)
    if (type === '함께 풀기 + 스스로 풀기') {
        const isTogether = subtype === 'together_part' || subtype === '복합형' || subtype === '함께풀기';

        const baseText = isTogether
            ? `[복합형: 함께 풀기]\n1. 하늘색 네모(□) 클릭 시 라벨이 사라지며 정답 텍스트 노출.\n2. [확인] 버튼 없음. [저장] 버튼 클릭 시 학습 완료 처리.\n3. 정오 판별 로직 제외.`
            : `[복합형: 함께 풀기]\n1. 하늘색 네모(□) 클릭 시 라벨이 사라지며 정답 텍스트 노출.\n2. [확인] 버튼 없음. [저장] 버튼 클릭 시 학습 완료 처리.\n3. 정오 판별 로직 제외.`;
        return answerSection + baseText;
    }

    // 3. 함께 풀기 (선택형)
    if (type === '함께 풀기') {
        return answerSection + `[함께 풀기: 선택형]\n1. 빈칸(□) 클릭 시 선택 요소(Pop-up/Picker) 노출.\n2. [확인] 클릭 시 선택값 기반 정오 판별.`;
    }

    // 4. 활동형 (발견/생각)
    if (type.includes('발견') || type.includes('생각')) {
        return answerSection + `[활동형]\n1. [저장] 버튼 클릭 시 입력값 저장.\n2. 정오 판별 없음.\n3. 빈칸 시 "내용을 입력하세요" 알럿.`;
    }

    // 5. 이미지형 문제 (question.image)
    if (typeKey === TYPE_KEYS.QUESTION_IMAGE) {
        return answerSection + `[이미지형 문제]\n1. 삽화(Figure)와 발문이 조화된 레이아웃 구성.\n2. 수식 입력창을 통해 정답 입력 및 정오 판별.\n3. 우측/하단 삽화 영역을 반드시 확인하여 문제 풀이 유도.`;
    }

    // 6. 일반 문제 (수식 입력형)
    return answerSection + `[기능 로직]\n1. 빈칸 클릭 시 수식 입력기 호출.\n2. [확인] 클릭 시 정오답 판별.\n3. 정답 시: 파란색(#0000FF) 변경 + 정답 알럿.\n4. 오답 시: 재도전 알럿 + 오답 붉은색 노출.\n5. 버튼 토글: 확인 -> 풀이/다시하기.`;
};


// [NEW] Draft Config Generator
export const buildDraftInputConfig = ({
    typeKey, // "concept", "together.select", "question.mathinput" etc.
    baseTemplateTypeKey, // zip 베이스. 예: "question.mathinput"
    inputKind = "math", hasImage = false, headerUrl = "", contentImageUrl = "",
    figure_bounds = null, figure_alt = "",
    isTogether = false, // [NEW] Together Mode Flag
    isSelfStudy = false // [NEW] Self Study Flag
}) => {
    // [NEW] JSON 확인용 로그
    console.log("[buildDraftInputConfig] Input:", { typeKey, isTogether, isSelfStudy });


    // 2. Together + Self Type [FIX]
    if (typeKey === TYPE_KEYS.TOGETHER_SELF) {
        return {
            typeKey: TYPE_KEYS.TOGETHER_SELF,
            baseTemplateTypeKey: TYPE_KEYS.TOGETHER_SELF, // [FIX] Use correct key
            manifest: {
                rowTemplate: ".txt1",
            },
            strategy: {
                name: "together_self_v1",
                options: {
                    hasImage,
                    headerUrl,
                    contentImageUrl,
                    figure_bounds,
                    figure_alt,
                    isSelfStudy // [NEW] Pass flag
                }
            }
        };
    }

    // [NEW] 2.5 Image-based Type
    if (typeKey === TYPE_KEYS.QUESTION_IMAGE) {
        return {
            typeKey: TYPE_KEYS.QUESTION_IMAGE,
            baseTemplateTypeKey: TYPE_KEYS.QUESTION_IMAGE,
            manifest: {
                rowTemplate: ".flex-row.ai-s.jc-sb",
            },
            strategy: {
                name: "images_v1",
                options: {
                    inputKind: "math",
                    hasImage: true,
                    headerUrl,
                    contentImageUrl,
                    figure_bounds,
                    figure_alt
                }
            }
        };
    }

    // 3. Together Type or Standard Input
    const finalTypeKey = typeKey || (isTogether ? "together.custom" : "input.custom");

    return {
        typeKey: finalTypeKey,
        baseTemplateTypeKey: isTogether ? TYPE_KEYS.TOGETHER_SELECT : TYPE_KEYS.QUESTION_MATHINPUT,
        manifest: {
            rowTemplate: isTogether ? ".txt1" : ".flex-row.ai-s.jc-sb",
        },
        strategy: {
            name: isTogether ? "together_v1" : "input_v1", // Strategy Name Switch
            options: {
                inputKind,
                hasImage,
                headerUrl,
                contentImageUrl,
                figure_bounds,
                figureBounds: figure_bounds,
                figure_alt
            }
        }
    };
};


