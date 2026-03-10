
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

    if ($headerTitle) {
        $headerTitle.src = isSelfStudy ? "images/tit-self.png" : "images/tit-together1.png";
        $headerTitle.setAttribute('alt', isSelfStudy ? "스스로 풀기" : "함께 풀기");
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

    // AI가 준 타이틀이 너무 짧거나 '함께 풀기' 같은 분류명이면 적절한 문장으로 대체
    let displayTitle = data.title || "";
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
                        span.className = "math";
                        span.setAttribute("translate", "no");
                        span.innerHTML = sanitizeLaTeX(part.content);
                        div.appendChild(span);
                    } else if (part.type === 'blank') {
                        blankCount++;
                        const options = part.options || [];
                        const correctIdx = (parseInt(part.correctIndex, 10) || 1) - 1;
                        // [수정] answerLatex 필드도 확인
                        const answer = part.answerLatex || options[correctIdx] || "";

                        const inpWrap = doc.createElement('div');
                        inpWrap.className = "inp-wrap m0 mr10";
                        const explanation = part.explanation || "";

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
                        else if (len <= 9) widthClass = "w300";
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
                        span.className = "math fs40";
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
                        maskWrap.style.marginLeft = "15px";
                        maskWrap.style.marginRight = "15px";
                        maskWrap.style.display = "inline-block";
                        maskWrap.style.verticalAlign = "middle";

                        // [Improved Width Estimation] LaTeX awareness
                        // Width should be based on visual horizontal space. Fractions are vertical.
                        const cleanAnswer = String(answer || "")
                            .replace(/\\\(|\\\)|\\\[|\\\]/g, '') // Strip delimiters
                            .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (match, p1, p2) => {
                                // For width estimation, a fraction is roughly as wide as its widest part
                                return p1.length > p2.length ? p1 : p2;
                            })
                            .replace(/\\dot\{(\w)\}/g, '$1') // Strip dot
                            .replace(/\\[a-zA-Z]+/g, ' ') // Strip other commands
                            .trim();

                        // fs40 is ~40px height. Characters are roughly 22-25px wide for digits/letters.
                        // We use a base width and a per-character width. 
                        // Reduced character multiplier from 20 to 18, and base from 40 to 30.
                        // Min width reduced from 80 to 60 for small fractions/single digits.
                        // (전략...)
                        const estimatedWidth = Math.max(60, (cleanAnswer.length * 18) + 30);

                        // ✅ Builder 연동 변수 유지, 단 기본 넘버링(blankCount)은 제거
                        const showLabel = !!part.labelEnabled;
                        const labelText = part.labelText || ""; // 1, 2, 3, 4 대신 기본값을 빈 문자열로 처리

                        maskWrap.style.position = "relative"; // 라벨 absolute 기준

                        maskWrap.innerHTML = `

      <button type="button" class="btn-mask h90" style="margin-left:2px; margin-right:2px; width: ${estimatedWidth}px">
          딱지를 누르면 딱지가 벗겨집니다.
      </button>

      <span class="math fs40" style="display:none" translate="no">${sanitizeLaTeX(answer)}</span>
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
