
import { sanitizeLaTeX } from "../../../utils/sanitize";

export const injectTogetherSelfBase = ({ doc, data }) => {
    // 1. Detect View Type (Together vs Self)
    const $headerTitle = doc.querySelector('header img');
    const altText = $headerTitle?.getAttribute('alt') || "";
    const isSelfStudy = altText.includes("스스로 풀기");

    // 2. Title (H1)
    const $title = doc.querySelector('main > h1');
    if ($title) {
        $title.innerHTML = sanitizeLaTeX(data.title || (isSelfStudy ? "스스로 풀기" : "함께 풀기"));
    }

    // 3. Main Content Injection
    const $main = doc.querySelector('main');
    if (!$main) return;

    // Remove existing content (Preserve key elements like buttons/title)
    const children = Array.from($main.children);
    children.forEach(child => {
        if (child.tagName === 'H1') return;
        if (child.classList.contains('btn-wrap')) return;
        // Don't remove Feedback Popup if it exists in main (usually outside, but check)
        if (child.classList.contains('pop')) return;
        child.remove();
    });

    // 4. Inject Content Lines
    // Guide Text
    const $guide = doc.createElement('span');
    $guide.className = "stxt mb30";
    $guide.textContent = isSelfStudy ? "▷ 빈칸에 들어갈 값을 입력해 보세요." : "▷ 빈칸을 눌러 보세요.";

    // Insert Guide after H1
    if ($title && $title.nextSibling) {
        $main.insertBefore($guide, $title.nextSibling);
    } else {
        $main.appendChild($guide);
    }

    if (Array.isArray(data.lines)) {
        data.lines.forEach(line => {
            const content = typeof line === 'string' ? line : line.text;

            if (isSelfStudy) {
                // [Self Study Style]
                // Use <div class="txt1 mb20 ml50 fw300">
                const div = doc.createElement('div');
                div.className = "txt1 mb20 ml50 fw300";
                div.innerHTML = sanitizeLaTeX(content);

                // Insert before buttons
                const $btnWrap = $main.querySelector('.btn-wrap');
                if ($btnWrap) $main.insertBefore(div, $btnWrap);
                else $main.appendChild(div);

            } else {
                // [Together Study Style]
                // Use <p class="fs40 mb50" style="margin-left: 50px;">
                const p = doc.createElement('p');
                p.className = "fs40 mb50";
                p.style.marginLeft = "50px";
                p.innerHTML = sanitizeLaTeX(content);

                // Insert before buttons
                const $btnWrap = $main.querySelector('.btn-wrap');
                if ($btnWrap) $main.insertBefore(p, $btnWrap);
                else $main.appendChild(p);
            }
        });
    }

    // 5. [Self Study] Feedback Popup Handling (Optional)
    // If feedback logic requires specific IDs (QuizInput1, feedbacktext),
    // we might need more advanced logic here to generate inputs.
    // For now, this handles text injection cleanly.
};
