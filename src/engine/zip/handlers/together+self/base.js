
import { sanitizeLaTeX } from "../../../utils/sanitize";
export const injectTogetherSelfBase = ({ doc, data }) => {
    // 1. Detect View Type (Together vs Self)
    const $headerTitle = doc.querySelector('header img');
    const altText = $headerTitle?.getAttribute('alt') || "";
    const dType = data.type || "";
    const dTitle = data.title || "";

    // [FIX] '함께 풀기 + 스스로 풀기' 문자열 간섭 방지
    const isSelfStudy =
        altText === "스스로 풀기" ||
        dType === "스스로 풀기" ||
        (dTitle.includes("스스로") && !dTitle.includes("함께"));

    // [FIX] 우선순위: data.header.src > 동적 매칭 > 기본 이미지
    const explicitSrc = data?.header?.src;
    let hasDynamicMatch = false;

    if ($headerTitle) {
        if (isSelfStudy) {
            $headerTitle.src = "images/tit-self.png";
            $headerTitle.setAttribute('alt', "스스로 풀기");
            doc.title = "스스로 풀기";
            hasDynamicMatch = true;
        } else {
            // 함께 풀기 섹션: 번호 분석 (title + mainQuestion 모두 확인)
            const fullText = (data.title || "") + (data.mainQuestion || "");
            const match = fullText.match(/함께\s*풀기\s*(\d+)/) || fullText.match(/문제\s*(\d+)/);
            if (match) {
                const num = match[1];
                $headerTitle.src = `images/tit-together${num}.png`;
                $headerTitle.setAttribute('alt', `함께 풀기 ${num}`);
                doc.title = `함께 풀기 ${num}`;
                hasDynamicMatch = true;
            }
        }

        // 개별 설정이 있으면 덮어쓰기
        if (explicitSrc) {
            $headerTitle.src = explicitSrc;
            if (data.header?.alt) $headerTitle.setAttribute('alt', data.header.alt);
        } else if (!hasDynamicMatch && !isSelfStudy) {
            // 동적 매칭 실패 시 기본값
            $headerTitle.src = "images/tit-together1.png";
            $headerTitle.setAttribute('alt', "함께 풀기");
            doc.title = "함께 풀기";
        }
    }


    const $main = doc.querySelector('main');
    if (!$main) return;

    // [추가] 스스로 풀기 전용 공통 스타일 주입 (한 번만)
    if (isSelfStudy) {
        let $style = doc.querySelector('style#self-study-inline-style');
        if (!$style) {
            $style = doc.createElement('style');
            $style.id = 'self-study-inline-style';
            $style.textContent = `
                mjx-container, math { margin-top: 8px; }
                .inp-wrap p, .inp-wrap2 p { margin-top: -5px; }
            `;
            (doc.head || doc.body).appendChild($style);
        }
    }

    // 2. Title (H1)
    let $title = doc.querySelector('main > h1');
    if (!$title) {
        $title = doc.createElement('h1');
        $title.className = "fs40 mb10";
        $main.prepend($title);
    }

    // [수정] 발문은 mainQuestion(사용자 편집값)을 최우선으로 사용
    let displayTitle = data.mainQuestion || data.title || "";
    if (!displayTitle || displayTitle === "함께 풀기" || displayTitle === "함께 풀기 + 스스로 풀기") {
        displayTitle = isSelfStudy ? "단계별로 빈칸을 입력해 봅시다." : "빈칸을 눌러 문제의 해결 과정을 알아 봅시다.";
    }
    $title.innerHTML = sanitizeLaTeX(displayTitle);

    // 3. Guide Text (stxt) - Always Ensure presence
    let $stxt = doc.querySelector('main > .stxt');
    if (!$stxt) {
        $stxt = doc.createElement('span');
        $stxt.className = "stxt mb60";
        $main.insertBefore($stxt, $title.nextSibling);
    }
    $stxt.textContent = isSelfStudy ? "▷ 빈칸에 들어갈 값을 입력해 보세요." : "▷ 빈칸을 눌러 보세요.";
    $stxt.style.display = "block"; // Ensure visibility

    // [Cleanup] Remove old elements except H1, STXT, BTN-WRAP, POP
    Array.from($main.children).forEach(child => {
        if (child === $title || child === $stxt || child.classList.contains('btn-wrap') || child.classList.contains('pop')) return;
        child.remove();
    });

    // 4. Inject Content Lines
    let blankCount = 0;

    if (Array.isArray(data.lines)) {
        data.lines.forEach(line => {
            // [수정] parts가 없거나 비어있으면 promptLatex나 text를 기반으로 기본 구조 생성
            let parts = line.parts;
            if (!parts || parts.length === 0) {
                parts = [];
                const content = line.promptLatex || line.text || line.content || (typeof line === 'string' ? line : "");
                if (content) {
                    parts.push({ type: 'text', content: content });
                }
                // answerLatex가 있으면 빈칸으로 추가
                if (line.answerLatex || line.answer) {
                    parts.push({
                        type: 'blank',
                        answerLatex: line.answerLatex || line.answer
                    });
                }
            }

            if (isSelfStudy) {
                // [Self Study Style] <div class="txt1 mb20 ml50 fw300">
                const div = doc.createElement('div');
                div.className = "txt1 mb20 ml50 flex-row ai-c fw300";

                parts.forEach(part => {
                    if (part.type === 'text') {
                        const span = doc.createElement('span');
                        span.className = "math math-tex tex2jax_process";
                        span.setAttribute("translate", "no");
                        span.innerHTML = sanitizeLaTeX(part.content);
                        div.appendChild(span);
                    } else if (part.type === 'blank') {
                        blankCount++;
                        const options = part.options || [];
                        const correctIdx = (parseInt(part.correctIndex, 10) || 1) - 1;
                        // [수정] answerLatex 필드도 확인
                        const answer = part.answerLatex || options[correctIdx] || "";
                        const explanation = part.explanation || "";

                        // [NEW] inputEnabled 가 false 인 경우 입력칸 대신 정답 노출
                        if (part.inputEnabled === false) {
                            const span = doc.createElement('span');
                            span.className = "math math-tex tex2jax_process ml10 mr10";
                            span.style.fontWeight = "bold";
                            span.style.color = "#00bcf1";
                            span.setAttribute("translate", "no");
                            span.innerHTML = sanitizeLaTeX(answer);
                            div.appendChild(span);
                        } else {
                            const inpWrap = doc.createElement('div');
                            inpWrap.className = "inp-wrap m0 mr10";

                            // [추가] 정답 길이에 따른 너비 자동 계산 (Self Study용)
                            const cleanAns = String(answer || "")
                                .replace(/\\\(|\\\)|\\\[|\\\]/g, '')
                                .replace(/\\left|\\right/g, '')

                                .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (match, a, b) => {
                                    return a.length >= b.length ? a : b;
                                })
                                .replace(/\\sqrt(\{[^{}]*\}|.)/g, (match, p1) => {
                                    return p1 ? p1.replace(/[{}]/g, '') : "";
                                })
                                .replace(/\\circ/g, '')
                                .replace(/\\[a-zA-Z]+/g, ' ')
                                .trim();

                            let widthClass = "w150";

                            const len = cleanAns.length;
                            if (len <= 4) widthClass = "w150";
                            else if (len <= 6) widthClass = "w250";
                            else if (len <= 9) widthClass = "w350";
                            else if (len <= 13) widthClass = "w400";
                            else if (len <= 16) widthClass = "w500";
                            else widthClass = "w600";

                            // [수정] onclick 제거, ID와 클래스(너비/마진) 적용
                            inpWrap.innerHTML = `
                                <div class="${widthClass} ml10 mr10">
                                    <button type="button" class="btn-math">${blankCount}번 정답 입력칸</button>
                                    <p id="QuizInput${blankCount}" 
                                    class="QuizInput${blankCount}" 
                                    data-no_idx="${blankCount}" 
                                    data-class_idx="1" 
                                    style="padding: 0px 33px;"></p>
                                    <div class="correct">${sanitizeLaTeX(answer)}</div>
                                    ${explanation ? `<p class="explanation-text" style="display:none">${sanitizeLaTeX(explanation)}</p>` : ''}
                                </div>
                            `;
                            div.appendChild(inpWrap);
                        }
                    }
                });

                const $btnWrap = $main.querySelector('.btn-wrap');
                if ($btnWrap) $main.insertBefore(div, $btnWrap);
                else $main.appendChild(div);

            } else {
                // [Together Study Style] <p class="fs40 mb50">
                const p = doc.createElement('p');
                p.className = "fs40 mb50";
                p.style.marginLeft = "50px";

                parts.forEach(part => {
                    if (part.type === 'text') {
                        const span = doc.createElement('span');
                        span.className = "math math-tex mathjax tex2jax_process fs40";
                        span.setAttribute("translate", "no");
                        span.innerHTML = sanitizeLaTeX(part.content);
                        p.appendChild(span);
                    } else if (part.type === 'blank') {
                        blankCount++;
                        const options = part.options || [];
                        const correctIdx = (parseInt(part.correctIndex, 10) || 1) - 1;
                        // [수정] answerLatex 필드도 확인
                        const answer = part.answerLatex || options[correctIdx] || "";

                        const maskWrap = doc.createElement('span');
                        maskWrap.className = "btn-mask-wrap";
                        maskWrap.style.marginLeft = "10px";
                        maskWrap.style.marginRight = "10px";
                        maskWrap.style.display = "inline-block";
                        maskWrap.style.verticalAlign = "middle";

                        // [Improved Width Estimation] LaTeX awareness
                        // 복잡한 수식 기호들의 시각적 너비를 고려하여 보정합니다. (정밀 축소 정적용)
                        const cleanAnswer = String(answer || "")
                            .replace(/\\\(|\\\)|\\\[|\\\]/g, '') // 구분자 제거
                            .replace(/\\times/g, 'X') // 곱하기 기호 (1자)
                            .replace(/\\div/g, 'D') // 나누기 기호 (1자)
                            .replace(/\\circ/g, 'o') // 도(°) 기호
                            .replace(/\\cos|\\sin|\\tan/g, 'c') // 삼각함수는 1자로 축소 (MathJax 렌더링 특성 반영)
                            .replace(/\\angle/g, 'A') // 각도 기호 (1자)
                            .replace(/\\pm|\\mp/g, 'P') // 플러스마이너스 (1자)
                            .replace(/\\sqrt\{([^{}]*)\}/g, (match, p1) => {
                                // 루트 기호 자체 너비(약 1자) + 내부 내용
                                return 'V' + p1;
                            })
                            .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (match, p1, p2) => {
                                // 분수는 분자/분모 중 긴 쪽 기준
                                return p1.length > p2.length ? p1 : p2;
                            })
                            .replace(/\\dot\{(\w)\}/g, '$1')
                            .replace(/\\[a-zA-Z]+/g, ' ') // 기타 명령어 공백 처리
                            .trim();

                        // fs40(40px) 폰트 크기 기준, 문자당 평균 16px + 기본 여백 25px 적용 (기존보다 타이트하게)
                        let estimatedWidth = Math.max(70, (cleanAnswer.length * 16) + 25);

                        // [NEW] 삼각함수(cos, sin, tan)가 포함된 경우 추가로 3/4 수준(75%)으로 더 축소 (사용자 요청 반영)
                        if (answer.includes('\\cos') || answer.includes('\\sin') || answer.includes('\\tan')) {
                            estimatedWidth = Math.round(estimatedWidth * 0.75);
                        }

                        // ✅ Builder 연동 변수 유지, 단 기본 넘버링(blankCount)은 제거
                        // const showLabel = !!part.labelEnabled;
                        // const labelText = part.labelText || ""; // 1, 2, 3, 4 대신 기본값을 빈 문자열로 처리

                        //                     maskWrap.style.position = "relative"; // 라벨 absolute 기준

                        //                     maskWrap.innerHTML = `

                        //   <button type="button" class="btn-mask h90" style="margin-left:2px; margin-right:2px; width: ${estimatedWidth}px">
                        //       딱지를 누르면 딱지가 벗겨집니다.
                        //   </button>

                        //   <span class="math math-tex tex2jax_process mathjax fs40" style="display:none" translate="no">${sanitizeLaTeX(answer)}</span>
                        //   `;
                        maskWrap.style.position = "relative";
                        maskWrap.style.minWidth = `${estimatedWidth}px`;

                        // 수식 폭 추정용 보조 요소 + 실제 표시 요소 분리
                        maskWrap.innerHTML = `
  <span
    class="mask-sizer math math-tex tex2jax_process mathjax fs40"
    style="visibility:hidden; display:inline-block; white-space:nowrap; pointer-events:none;"
    translate="no"
  >${sanitizeLaTeX(answer)}</span>

  <button
    type="button"
    class="btn-mask h90"
    style="
      position:absolute;
      left:0;
      top:50%;
      transform:translateY(-50%);
      width:100%;
      margin-left:0;
      margin-right:0;
      z-index:2;
    "
  >
    딱지를 누르면 딱지가 벗겨집니다.
  </button>

  <span
    class="mask-answer math math-tex tex2jax_process mathjax fs40"
    style="
      display:none;
      position:absolute;
      left:0;
      top:50%;
      transform:translateY(-50%);
      white-space:nowrap;
      z-index:1;
    "
    translate="no"
  >${sanitizeLaTeX(answer)}</span>
`;


                        p.appendChild(maskWrap);
                    }
                });

                const $btnWrap = $main.querySelector('.btn-wrap');
                if ($btnWrap) $main.insertBefore(p, $btnWrap);
                else $main.appendChild(p);
            }
        });
    }
};
