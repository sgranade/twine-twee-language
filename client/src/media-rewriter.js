/**
 * Rewrite media links in Twine games to Webview-approved URIs.
 */
(function () {
    const CONFIG = {
        base: window.__MEDIA_BASE__ || "",
        debug: false,
    };

    function log(...args) {
        if (CONFIG.debug) {
            console.log("[media-rewriter]", ...args);
        }
    }

    function shouldRewrite(url) {
        return url && !/^(https?:|data:|blob:|vscode-webview:)/.test(url);
    }

    function normalize(url) {
        return url
            .replace(/^\.?\//, "") // ./foo → foo
            .replace(/^\/+/, ""); // /foo → foo
    }

    function rewriteUrl(url) {
        if (!shouldRewrite(url)) return url;
        const rewritten = CONFIG.base + normalize(url);
        log("rewrite:", url, "->", rewritten);
        return rewritten;
    }

    function mark(el) {
        el.dataset.vscodeRewritten = "true";
    }

    function isMarked(el) {
        return el.dataset.vscodeRewritten === "true";
    }

    function rewriteElement(el, attr = "src") {
        if (!el || isMarked(el)) return;

        const val = el.getAttribute(attr);
        if (!val) return;

        const newVal = rewriteUrl(val);
        if (newVal !== val) {
            el.setAttribute(attr, newVal);
        }

        mark(el);
    }

    function rewriteMedia(root) {
        if (!root.querySelectorAll) return;

        // IMG
        root.querySelectorAll("img").forEach((img) => {
            rewriteElement(img, "src");
        });

        // AUDIO / VIDEO
        root.querySelectorAll("audio, video").forEach((media) => {
            rewriteElement(media, "src");

            media.querySelectorAll("source").forEach((source) => {
                rewriteElement(source, "src");
            });

            media.load();
        });
    }

    function processNode(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        // If node itself is media
        if (node.matches?.("img, audio, video, source")) {
            rewriteElement(node, "src");

            if (node.tagName === "AUDIO" || node.tagName === "VIDEO") {
                node.load();
            }
        }

        rewriteMedia(node);
    }

    function startObserver() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                // New nodes
                mutation.addedNodes.forEach(processNode);

                // Attribute changes (b/c Chapbook sometimes does this)
                if (mutation.type === "attributes") {
                    processNode(mutation.target);
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["src"],
        });

        log("MutationObserver started");
    }

    function initialPass() {
        rewriteMedia(document);
    }

    function hookSugarCube() {
        // For optimization under SugarCube, hook into the `:passagerender` event
        if (window.jQuery) {
            jQuery(document).on(":passagerender", function (ev) {
                log("SugarCube :passagerender");
                rewriteMedia(ev.content);
            });
        }
    }

    function init() {
        log("init with base:", CONFIG.base);

        initialPass();
        hookSugarCube();
        startObserver();
    }

    // Wait until DOM is ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
