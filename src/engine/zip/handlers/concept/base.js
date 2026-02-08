
import { sanitizeLaTeX } from "../../../utils/sanitize";

export const injectConceptBase = ({ doc, data }) => {
    // 1. Title (Heading)
    const $title = doc.querySelector('h1.tit-bl3');
    if ($title) {
        // Use textContent directly or innerHTML if we want to allow some formatting/math in title
        // view01 typically has text.
        $title.textContent = data.title || "";
    }

    // 2. Main Content
    const $main = doc.querySelector('main');
    if ($main) {
        // Clear existing content (paragraphs), but keep the title if it's inside main (in view01 it is)
        // In view01.html:
        // <main>
        //    <h1 class="mb20 tit-bl3">...</h1>
        //    <p ...>...</p>
        // </main>
        // So we should remove all children EXCEPT h1.tit-bl3

        const children = Array.from($main.children);
        children.forEach(child => {
            if (!child.classList.contains('tit-bl3')) {
                child.remove();
            }
        });

        // 3. Append Lines
        if (Array.isArray(data.lines)) {
            data.lines.forEach(line => {
                let content = "";
                if (typeof line === 'string') content = line;
                else if (line.passage) content = line.passage;
                else if (line.text) content = line.text;
                else if (line.body) content = line.body;

                if (content) {
                    // Create <p> element with standard View01 styling
                    // Class: fs35 fw500 ml80 mb20 lh200
                    const p = doc.createElement('p');
                    p.className = "fs35 fw500 ml80 mb20 lh200";

                    // Use sanitizeLaTeX or just set innerHTML if we trust the source (Builder input)
                    // We should probably sanitize or at least handle MathJax
                    // sanitizeLaTeX usually escapes HTML but preserves LaTeX.
                    // But if we want simple HTML-safe text:
                    p.innerHTML = sanitizeLaTeX(content);

                    $main.appendChild(p);
                }
            });
        }
    }
};
