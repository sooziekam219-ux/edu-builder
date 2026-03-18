import React, { useState, useEffect, useRef } from 'react';

// [NEW] 로컬 수식 렌더링 컴포넌트 (외부 이미지 API 사용 안 함)
export const LocalMath = ({ latex }) => {
    const [renderedHtml, setRenderedHtml] = React.useState(latex); // 초기값은 원본 텍스트

    React.useEffect(() => {
        const renderMath = () => {
            if (window.katex) {
                try {
                    // KaTeX를 사용해 LaTeX 텍스트를 수식 HTML로 변환
                    const html = window.katex.renderToString(latex, {
                        throwOnError: false, // 에러가 나도 터지지 않고 붉은 글씨로 렌더링
                        displayMode: false   // 인라인 형태 유지
                    });
                    setRenderedHtml(html);
                } catch (e) {
                    console.error("KaTeX Error:", e);
                }
            }
        };

        // 스크립트 로딩 체크 로직
        if (window.katex) {
            renderMath();
        } else {
            // 아직 로드 전이면 0.1초마다 체크해서 로드 완료 시 렌더링
            const interval = setInterval(() => {
                if (window.katex) {
                    renderMath();
                    clearInterval(interval);
                }
            }, 100);
            return () => clearInterval(interval);
        }
    }, [latex]);

    return (
        <span
            className="inline-block align-middle mx-1 text-slate-800"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
    );
};
