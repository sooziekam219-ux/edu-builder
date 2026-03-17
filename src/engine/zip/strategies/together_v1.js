
import selectHandler from "../handlers/together/select";

/**
 * Together Select Strategy (Draft Mode)
 * Wraps the standard 'together.select' handler but provides configuration
 * to zipProcessor for Image Cropping, Saving, and Injection.
 */
export default function createTogetherStrategy(options = {}) {
    return {
        // Delegate normalize
        normalize: (data) => selectHandler.normalize(data),

        // Config for zipProcessor (Image Saving & Injection)
        getSkeletonConfig() {
            const fBounds = options.figureBounds || options.figure_bounds || [0, 0, 0, 0];
            const hasValidBounds = fBounds.some(v => Number(v) !== 0);

            return {
                headerUrl: options.headerUrl,
                contentImageUrl: (options.hasImage || hasValidBounds) ? (options.contentImageUrl || null) : null,
                figureBounds: fBounds,
                figureAlt: options.figureAlt || options.figure_alt,

                // Content Injection Config
                imageTargetSelector: "div[translate='no']",
                imagePosition: "prepend"
            };
        },

        // Delegate injectHtmlPage
        injectHtmlPage: (args) => {
            // Run standard injection
            selectHandler.injectHtmlPage(args);
        },

        // Delegate patchActJs
        patchActJs: (args) => selectHandler.patchActJs(args)
    };
}
