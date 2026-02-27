
import { sanitizeLaTeX } from "../../../utils/sanitize";

export const injectTogetherSelfBase = ({ doc, data }) => {
    // 1. Detect View Type (Together vs Self)
    const $headerTitle = doc.querySelector('header img');
    const altText = $headerTitle?.getAttribute('alt') || "";
    const isSelfStudy = altText.includes("스스로 풀기");
    $headerTitle.src = isSelfStudy ? "images/tit-self.png" : "images/tit-together1.png";
    if ($headerTitle) {
        $headerTitle.src = isSelfStudy ? "images/tit-self.png" : "images/tit-together1.png";
    }

    const $main = doc.querySelector('main');
    if (!$main) return;

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
            const parts = line.parts || (typeof line === 'string' ? [{ type: 'text', content: line }] : [{ type: 'text', content: line.text }]);

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
                        const answer = options[correctIdx] || "";

                        const inpWrap = doc.createElement('div');
                        inpWrap.className = "inp-wrap m0 mr10";
                        const explanation = part.explanation || "";
                        inpWrap.innerHTML = `
                            <div class="w150">
                                <button type="button" class="btn-math">${blankCount}번 정답 입력칸</button>
                                <p id="QuizInput${blankCount}" style="padding: 0px 33px;"></p>
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
                        const answer = options[correctIdx] || "";

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
                        const estimatedWidth = Math.max(60, (cleanAnswer.length * 18) + 30);

                        const showLabel = !!part.labelEnabled;   // ✅ Builder에서 이 값을 토글하면 됨
                        const labelText = part.labelText || `${blankCount}`; // 필요하면 커스텀 라벨도 가능

                        maskWrap.style.position = "relative"; // 라벨 absolute 기준

                        maskWrap.innerHTML = `
                        ${showLabel ? `
                            <span
                            class="blank-label"
                            style="
                                position:absolute;
                                top:-18px;
                                left:50%;
                                transform:translateX(-50%);
                                font-size:14px;
                                font-weight:700;
                                background:#111827;
                                color:#fff;
                                padding:2px 8px;
                                border-radius:999px;
                                line-height:1;
                                white-space:nowrap;
                            "
                            >${labelText}</span>
                        ` : ""}

                        <button type="button" class="btn-mask h90" style="margin-left:2px; margin-right:2px; width: ${estimatedWidth}px">
                            ${blankCount}번 딱지를 누르면 딱지가 벗겨집니다.
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
