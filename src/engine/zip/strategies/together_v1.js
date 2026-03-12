
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
            return {
                headerUrl: options.headerUrl,
                contentImageUrl: options.contentImageUrl || null,
                figureBounds: options.figureBounds || options.figure_bounds,
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

            // Note: zipProcessor might have already injected the image into the DOM 
            // BEFORE this runs.
            // If zipProcessor injected into 'div[translate="no"]', selectHandler.injectHtmlPage
            // clears that container (innerHTML = "").
            // So we must ensure zipProcessor injects OUTSIDE that container 
            // OR we handle image injection HERE (if we can access the saved path).

            // Problem: We don't know the saved Relative Path from here easily 
            // because createTogetherStrategy is called before path generation.

            // Use 'custom-image-container' class if zipProcessor injected it?
        },

        // Delegate patchActJs
        patchActJs: (args) => selectHandler.patchActJs(args)
    };
}
