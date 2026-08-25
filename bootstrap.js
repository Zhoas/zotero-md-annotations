if (typeof Zotero === 'undefined') {
    var Zotero;
}

const logFile = "C:\\Users\\zhaoyang\\Desktop\\temp\\plugin_log.txt";

async function logToFile(msg) {
    try {
        let text = new Date().toISOString() + " - " + msg + "\n";
        let encoder = new TextEncoder();
        let array = encoder.encode(text);
        if (typeof IOUtils !== 'undefined') {
            await IOUtils.write(logFile, array, { append: true });
        }
    } catch(e) {}
}

var ZoteroMarkdownAnnotations = {
    id: 'md-annotations-final@zhaoyang.com',
    
    init({ id, version, rootURI }) {
        this.rootURI = rootURI;
        this.initialized = false;
        this.timers = [];
    },

    async startup() {
        if (this.initialized) return;
        let mainWindow = Zotero.getMainWindow();
        if (mainWindow) {
            this.injectIntoMainWindow(mainWindow);
        }
        this.initialized = true;
    },

    shutdown() {
        let mainWindow = Zotero.getMainWindow();
        if (mainWindow) {
            this.timers.forEach(t => mainWindow.clearInterval(t));
            this.timers = [];
        }
        this.initialized = false;
    },

    injectIntoMainWindow(win) {
        if (!win || !win.document) return;

        try {
            Services.scriptloader.loadSubScript(this.rootURI + 'lib/markdown-it.min.js', win);
            try { Services.scriptloader.loadSubScript(this.rootURI + 'lib/katex.min.js', win); } catch(e){}
            try { Services.scriptloader.loadSubScript(this.rootURI + 'lib/katex-fonts.js', win); } catch(e){}
            
            let md = null;
            if (win.markdownit) {
                md = win.markdownit({ html: false, linkify: true, breaks: true });
                if (win.katex) {
                    md.use(function(md) {
                        let katex = win.katex;
                        function isValidDelim(state, pos) {
                            let max = state.posMax, can_open = true, can_close = true;
                            let prevChar = pos > 0 ? state.src.charCodeAt(pos - 1) : -1;
                            let nextChar = pos + 1 <= max ? state.src.charCodeAt(pos + 1) : -1;
                            if (prevChar === 0x20 || prevChar === 0x09 || (nextChar >= 0x30 && nextChar <= 0x39)) can_close = false;
                            if (nextChar === 0x20 || nextChar === 0x09) can_open = false;
                            return { can_open: can_open, can_close: can_close };
                        }
                        function math_inline(state, silent) {
                            if (state.src[state.pos] !== "$") return false;
                            let res = isValidDelim(state, state.pos);
                            if (!res.can_open) { if (!silent) state.pending += "$"; state.pos += 1; return true; }
                            let start = state.pos + 1, match = start;
                            while ((match = state.src.indexOf("$", match)) !== -1) {
                                let pos = match - 1;
                                while (state.src[pos] === "\\\\") pos -= 1;
                                if ((match - pos) % 2 == 1) break;
                                match += 1;
                            }
                            if (match === -1) { if (!silent) state.pending += "$"; state.pos = start; return true; }
                            if (match - start === 0) { if (!silent) state.pending += "$$"; state.pos = start + 1; return true; }
                            res = isValidDelim(state, match);
                            if (res.can_close) {
                                if (!silent) {
                                    let token = state.push('math_inline', 'math', 0);
                                    token.markup = "$"; token.content = state.src.slice(start, match);
                                }
                                state.pos = match + 1; return true;
                            }
                            if (!silent) state.pending += "$"; state.pos = start; return true;
                        }
                        function math_block(state, startLine, endLine, silent) {
                            let nextLine, markup, params, token,
                                haveEndMarker = false,
                                pos = state.bMarks[startLine] + state.tShift[startLine],
                                max = state.eMarks[startLine];
                            if (pos + 2 > max) { return false; }
                            if (state.src.slice(pos, pos + 2) !== '$$') { return false; }
                            pos += 2;
                            markup = state.src.slice(state.bMarks[startLine] + state.tShift[startLine], pos);
                            params = state.src.slice(pos, max);
                            if (silent) { return true; }
                            nextLine = startLine;
                            for (;;) {
                                nextLine++;
                                if (nextLine >= endLine) { break; }
                                pos = state.bMarks[nextLine] + state.tShift[nextLine];
                                max = state.eMarks[nextLine];
                                if (pos < max && state.tShift[nextLine] < state.blkIndent) { break; }
                                if (state.src.slice(pos, max).trim().slice(-2) === '$$') {
                                    haveEndMarker = true;
                                    break;
                                }
                            }
                            state.line = nextLine + (haveEndMarker ? 1 : 0);
                            token = state.push('math_block', 'math', 0);
                            token.block = true;
                            token.content = (state.getLines(startLine + 1, nextLine, state.tShift[startLine], true)).trim();
                            if (!haveEndMarker) {
                                token.content = (state.src.slice(state.bMarks[startLine] + state.tShift[startLine] + 2, state.eMarks[startLine])).trim() + "\\n" + token.content;
                            } else {
                                let lastLine = state.src.slice(state.bMarks[nextLine] + state.tShift[nextLine], state.eMarks[nextLine]).trim();
                                if (lastLine.length > 2) {
                                    token.content += "\\n" + lastLine.slice(0, -2).trim();
                                }
                            }
                            token.map = [ startLine, state.line ];
                            token.markup = markup;
                            return true;
                        }
                        md.inline.ruler.after('escape', 'math_inline', math_inline);
                        md.block.ruler.after('blockquote', 'math_block', math_block, {
                            alt: [ 'paragraph', 'reference', 'blockquote', 'list' ]
                        });
                        md.renderer.rules.math_inline = function(tokens, idx) {
                            try { return katex.renderToString(tokens[idx].content, { throwOnError: false, displayMode: false, output: 'html' }); }
                            catch (err) { return tokens[idx].content; }
                        };
                        md.renderer.rules.math_block = function(tokens, idx) {
                            try { return "<p>" + katex.renderToString(tokens[idx].content, { throwOnError: false, displayMode: true, output: 'html' }) + "</p>"; }
                            catch (err) { return "<p>" + tokens[idx].content + "</p>"; }
                        };
                    });
                }
            }

            let styleCSS = `
                .my-markdown-rendered-view { 
                    padding: 8px; 
                    cursor: text; 
                    min-height: 1.5em; 
                    word-wrap: break-word; 
                    overflow: auto !important;  
                    background: transparent; 
                    color: inherit; 
                    line-height: 1.5; 
                    font-size: 13px; 
                    resize: both !important; /* Allow resizing the text area itself */
                }
                .my-markdown-rendered-view.md-in-sidebar { width: 100% !important; resize: none !important; box-sizing: border-box !important; }
                [contenteditable].md-in-sidebar { width: 100% !important; resize: vertical !important; box-sizing: border-box !important; }
                .my-markdown-rendered-view.md-in-popup { resize: both !important; overflow: auto !important; max-width: none !important; max-height: none !important; box-sizing: border-box !important; }
                [contenteditable].md-in-popup { resize: both !important; overflow: auto !important; max-width: none !important; max-height: none !important; box-sizing: border-box !important; }
                
                .my-markdown-rendered-view h1 { font-size: 1.5em; font-weight: bold; margin: 0.5em 0; border-bottom: 1px solid #ccc; padding-bottom: 0.3em; }
                .my-markdown-rendered-view h2 { font-size: 1.3em; font-weight: bold; margin: 0.5em 0; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
                
                /* FIX LISTS: Use inside position so numbers are physically inside the box */
                .my-markdown-rendered-view ol, .my-markdown-rendered-view ul {
                    padding-left: 10px !important;
                    margin-left: 0 !important;
                    margin-bottom: 0.5em !important;
                    list-style-position: inside !important;
                }
                .my-markdown-rendered-view ol { list-style-type: decimal !important; }
                .my-markdown-rendered-view ul { list-style-type: disc !important; }
                .my-markdown-rendered-view li { margin-bottom: 0.2em !important; display: list-item !important; }
                .katex { font-family: "Cambria Math", "Latin Modern Math", serif !important; font-size: 1.1em; }
                
                [data-testid="annotation-popup"] { width: fit-content !important; max-width: none !important; max-height: none !important; }
                
                .md-toggle-btn { position: absolute; top: -24px; right: 0px; z-index: 9999; background: #f0f0f0; border: 1px solid #ccc; border-radius: 3px; padding: 2px 6px; font-size: 11px; cursor: pointer; color: #333; }
                .md-toggle-btn:hover { background: #e0e0e0; }
.my-markdown-rendered-view table { border-collapse: collapse; margin: 0.5em 0; width: 100%; } .my-markdown-rendered-view th, .my-markdown-rendered-view td { border: 1px solid #ccc; padding: 4px 8px; } .my-markdown-rendered-view th { background: rgba(150,150,150,0.1); font-weight: bold; }
@font-face{font-family:KaTeX_AMS;font-style:normal;font-weight:400;src:url(fonts/KaTeX_AMS-Regular.woff2) format("woff2"),url(fonts/KaTeX_AMS-Regular.woff) format("woff"),url(fonts/KaTeX_AMS-Regular.ttf) format("truetype")}@font-face{font-family:KaTeX_Caligraphic;font-style:normal;font-weight:700;src:url(fonts/KaTeX_Caligraphic-Bold.woff2) format("woff2"),url(fonts/KaTeX_Caligraphic-Bold.woff) format("woff"),url(fonts/KaTeX_Caligraphic-Bold.ttf) format("truetype")}@font-face{font-family:KaTeX_Caligraphic;font-style:normal;font-weight:400;src:url(fonts/KaTeX_Caligraphic-Regular.woff2) format("woff2"),url(fonts/KaTeX_Caligraphic-Regular.woff) format("woff"),url(fonts/KaTeX_Caligraphic-Regular.ttf) format("truetype")}@font-face{font-family:KaTeX_Fraktur;font-style:normal;font-weight:700;src:url(fonts/KaTeX_Fraktur-Bold.woff2) format("woff2"),url(fonts/KaTeX_Fraktur-Bold.woff) format("woff"),url(fonts/KaTeX_Fraktur-Bold.ttf) format("truetype")}@font-face{font-family:KaTeX_Fraktur;font-style:normal;font-weight:400;src:url(fonts/KaTeX_Fraktur-Regular.woff2) format("woff2"),url(fonts/KaTeX_Fraktur-Regular.woff) format("woff"),url(fonts/KaTeX_Fraktur-Regular.ttf) format("truetype")}@font-face{font-family:KaTeX_Main;font-style:normal;font-weight:700;src:url(fonts/KaTeX_Main-Bold.woff2) format("woff2"),url(fonts/KaTeX_Main-Bold.woff) format("woff"),url(fonts/KaTeX_Main-Bold.ttf) format("truetype")}@font-face{font-family:KaTeX_Main;font-style:italic;font-weight:700;src:url(fonts/KaTeX_Main-BoldItalic.woff2) format("woff2"),url(fonts/KaTeX_Main-BoldItalic.woff) format("woff"),url(fonts/KaTeX_Main-BoldItalic.ttf) format("truetype")}@font-face{font-family:KaTeX_Main;font-style:italic;font-weight:400;src:url(fonts/KaTeX_Main-Italic.woff2) format("woff2"),url(fonts/KaTeX_Main-Italic.woff) format("woff"),url(fonts/KaTeX_Main-Italic.ttf) format("truetype")}@font-face{font-family:KaTeX_Main;font-style:normal;font-weight:400;src:url(fonts/KaTeX_Main-Regular.woff2) format("woff2"),url(fonts/KaTeX_Main-Regular.woff) format("woff"),url(fonts/KaTeX_Main-Regular.ttf) format("truetype")}@font-face{font-family:KaTeX_Math;font-style:italic;font-weight:700;src:url(fonts/KaTeX_Math-BoldItalic.woff2) format("woff2"),url(fonts/KaTeX_Math-BoldItalic.woff) format("woff"),url(fonts/KaTeX_Math-BoldItalic.ttf) format("truetype")}@font-face{font-family:KaTeX_Math;font-style:italic;font-weight:400;src:url(fonts/KaTeX_Math-Italic.woff2) format("woff2"),url(fonts/KaTeX_Math-Italic.woff) format("woff"),url(fonts/KaTeX_Math-Italic.ttf) format("truetype")}@font-face{font-family:"KaTeX_SansSerif";font-style:normal;font-weight:700;src:url(fonts/KaTeX_SansSerif-Bold.woff2) format("woff2"),url(fonts/KaTeX_SansSerif-Bold.woff) format("woff"),url(fonts/KaTeX_SansSerif-Bold.ttf) format("truetype")}@font-face{font-family:"KaTeX_SansSerif";font-style:italic;font-weight:400;src:url(fonts/KaTeX_SansSerif-Italic.woff2) format("woff2"),url(fonts/KaTeX_SansSerif-Italic.woff) format("woff"),url(fonts/KaTeX_SansSerif-Italic.ttf) format("truetype")}@font-face{font-family:"KaTeX_SansSerif";font-style:normal;font-weight:400;src:url(fonts/KaTeX_SansSerif-Regular.woff2) format("woff2"),url(fonts/KaTeX_SansSerif-Regular.woff) format("woff"),url(fonts/KaTeX_SansSerif-Regular.ttf) format("truetype")}@font-face{font-family:KaTeX_Script;font-style:normal;font-weight:400;src:url(fonts/KaTeX_Script-Regular.woff2) format("woff2"),url(fonts/KaTeX_Script-Regular.woff) format("woff"),url(fonts/KaTeX_Script-Regular.ttf) format("truetype")}@font-face{font-family:KaTeX_Size1;font-style:normal;font-weight:400;src:url(fonts/KaTeX_Size1-Regular.woff2) format("woff2"),url(fonts/KaTeX_Size1-Regular.woff) format("woff"),url(fonts/KaTeX_Size1-Regular.ttf) format("truetype")}@font-face{font-family:KaTeX_Size2;font-style:normal;font-weight:400;src:url(fonts/KaTeX_Size2-Regular.woff2) format("woff2"),url(fonts/KaTeX_Size2-Regular.woff) format("woff"),url(fonts/KaTeX_Size2-Regular.ttf) format("truetype")}@font-face{font-family:KaTeX_Size3;font-style:normal;font-weight:400;src:url(fonts/KaTeX_Size3-Regular.woff2) format("woff2"),url(fonts/KaTeX_Size3-Regular.woff) format("woff"),url(fonts/KaTeX_Size3-Regular.ttf) format("truetype")}@font-face{font-family:KaTeX_Size4;font-style:normal;font-weight:400;src:url(fonts/KaTeX_Size4-Regular.woff2) format("woff2"),url(fonts/KaTeX_Size4-Regular.woff) format("woff"),url(fonts/KaTeX_Size4-Regular.ttf) format("truetype")}@font-face{font-family:KaTeX_Typewriter;font-style:normal;font-weight:400;src:url(fonts/KaTeX_Typewriter-Regular.woff2) format("woff2"),url(fonts/KaTeX_Typewriter-Regular.woff) format("woff"),url(fonts/KaTeX_Typewriter-Regular.ttf) format("truetype")}.katex{text-rendering:auto;font:normal 1.21em KaTeX_Main,Times New Roman,serif;line-height:1.2;text-indent:0}.katex *{-ms-high-contrast-adjust:none!important;border-color:currentColor}.katex .katex-version:after{content:"0.16.8"}.katex .katex-mathml{clip:rect(1px,1px,1px,1px);border:0;height:1px;overflow:hidden;padding:0;position:absolute;width:1px}.katex .katex-html>.newline{display:block}.katex .base{position:relative;white-space:nowrap;width:-webkit-min-content;width:-moz-min-content;width:min-content}.katex .base,.katex .strut{display:inline-block}.katex .textbf{font-weight:700}.katex .textit{font-style:italic}.katex .textrm{font-family:KaTeX_Main}.katex .textsf{font-family:KaTeX_SansSerif}.katex .texttt{font-family:KaTeX_Typewriter}.katex .mathnormal{font-family:KaTeX_Math;font-style:italic}.katex .mathit{font-family:KaTeX_Main;font-style:italic}.katex .mathrm{font-style:normal}.katex .mathbf{font-family:KaTeX_Main;font-weight:700}.katex .boldsymbol{font-family:KaTeX_Math;font-style:italic;font-weight:700}.katex .amsrm,.katex .mathbb,.katex .textbb{font-family:KaTeX_AMS}.katex .mathcal{font-family:KaTeX_Caligraphic}.katex .mathfrak,.katex .textfrak{font-family:KaTeX_Fraktur}.katex .mathtt{font-family:KaTeX_Typewriter}.katex .mathscr,.katex .textscr{font-family:KaTeX_Script}.katex .mathsf,.katex .textsf{font-family:KaTeX_SansSerif}.katex .mathboldsf,.katex .textboldsf{font-family:KaTeX_SansSerif;font-weight:700}.katex .mathitsf,.katex .textitsf{font-family:KaTeX_SansSerif;font-style:italic}.katex .mainrm{font-family:KaTeX_Main;font-style:normal}.katex .vlist-t{border-collapse:collapse;display:inline-table;table-layout:fixed}.katex .vlist-r{display:table-row}.katex .vlist{display:table-cell;position:relative;vertical-align:bottom}.katex .vlist>span{display:block;height:0;position:relative}.katex .vlist>span>span{display:inline-block}.katex .vlist>span>.pstrut{overflow:hidden;width:0}.katex .vlist-t2{margin-right:-2px}.katex .vlist-s{display:table-cell;font-size:1px;min-width:2px;vertical-align:bottom;width:2px}.katex .vbox{align-items:baseline;display:inline-flex;flex-direction:column}.katex .hbox{width:100%}.katex .hbox,.katex .thinbox{display:inline-flex;flex-direction:row}.katex .thinbox{max-width:0;width:0}.katex .msupsub{text-align:left}.katex .mfrac>span>span{text-align:center}.katex .mfrac .frac-line{border-bottom-style:solid;display:inline-block;width:100%}.katex .hdashline,.katex .hline,.katex .mfrac .frac-line,.katex .overline .overline-line,.katex .rule,.katex .underline .underline-line{min-height:1px}.katex .mspace{display:inline-block}.katex .clap,.katex .llap,.katex .rlap{position:relative;width:0}.katex .clap>.inner,.katex .llap>.inner,.katex .rlap>.inner{position:absolute}.katex .clap>.fix,.katex .llap>.fix,.katex .rlap>.fix{display:inline-block}.katex .llap>.inner{right:0}.katex .clap>.inner,.katex .rlap>.inner{left:0}.katex .clap>.inner>span{margin-left:-50%;margin-right:50%}.katex .rule{border:0 solid;display:inline-block;position:relative}.katex .hline,.katex .overline .overline-line,.katex .underline .underline-line{border-bottom-style:solid;display:inline-block;width:100%}.katex .hdashline{border-bottom-style:dashed;display:inline-block;width:100%}.katex .sqrt>.root{margin-left:.27777778em;margin-right:-.55555556em}.katex .fontsize-ensurer.reset-size1.size1,.katex .sizing.reset-size1.size1{font-size:1em}.katex .fontsize-ensurer.reset-size1.size2,.katex .sizing.reset-size1.size2{font-size:1.2em}.katex .fontsize-ensurer.reset-size1.size3,.katex .sizing.reset-size1.size3{font-size:1.4em}.katex .fontsize-ensurer.reset-size1.size4,.katex .sizing.reset-size1.size4{font-size:1.6em}.katex .fontsize-ensurer.reset-size1.size5,.katex .sizing.reset-size1.size5{font-size:1.8em}.katex .fontsize-ensurer.reset-size1.size6,.katex .sizing.reset-size1.size6{font-size:2em}.katex .fontsize-ensurer.reset-size1.size7,.katex .sizing.reset-size1.size7{font-size:2.4em}.katex .fontsize-ensurer.reset-size1.size8,.katex .sizing.reset-size1.size8{font-size:2.88em}.katex .fontsize-ensurer.reset-size1.size9,.katex .sizing.reset-size1.size9{font-size:3.456em}.katex .fontsize-ensurer.reset-size1.size10,.katex .sizing.reset-size1.size10{font-size:4.148em}.katex .fontsize-ensurer.reset-size1.size11,.katex .sizing.reset-size1.size11{font-size:4.976em}.katex .fontsize-ensurer.reset-size2.size1,.katex .sizing.reset-size2.size1{font-size:.83333333em}.katex .fontsize-ensurer.reset-size2.size2,.katex .sizing.reset-size2.size2{font-size:1em}.katex .fontsize-ensurer.reset-size2.size3,.katex .sizing.reset-size2.size3{font-size:1.16666667em}.katex .fontsize-ensurer.reset-size2.size4,.katex .sizing.reset-size2.size4{font-size:1.33333333em}.katex .fontsize-ensurer.reset-size2.size5,.katex .sizing.reset-size2.size5{font-size:1.5em}.katex .fontsize-ensurer.reset-size2.size6,.katex .sizing.reset-size2.size6{font-size:1.66666667em}.katex .fontsize-ensurer.reset-size2.size7,.katex .sizing.reset-size2.size7{font-size:2em}.katex .fontsize-ensurer.reset-size2.size8,.katex .sizing.reset-size2.size8{font-size:2.4em}.katex .fontsize-ensurer.reset-size2.size9,.katex .sizing.reset-size2.size9{font-size:2.88em}.katex .fontsize-ensurer.reset-size2.size10,.katex .sizing.reset-size2.size10{font-size:3.45666667em}.katex .fontsize-ensurer.reset-size2.size11,.katex .sizing.reset-size2.size11{font-size:4.14666667em}.katex .fontsize-ensurer.reset-size3.size1,.katex .sizing.reset-size3.size1{font-size:.71428571em}.katex .fontsize-ensurer.reset-size3.size2,.katex .sizing.reset-size3.size2{font-size:.85714286em}.katex .fontsize-ensurer.reset-size3.size3,.katex .sizing.reset-size3.size3{font-size:1em}.katex .fontsize-ensurer.reset-size3.size4,.katex .sizing.reset-size3.size4{font-size:1.14285714em}.katex .fontsize-ensurer.reset-size3.size5,.katex .sizing.reset-size3.size5{font-size:1.28571429em}.katex .fontsize-ensurer.reset-size3.size6,.katex .sizing.reset-size3.size6{font-size:1.42857143em}.katex .fontsize-ensurer.reset-size3.size7,.katex .sizing.reset-size3.size7{font-size:1.71428571em}.katex .fontsize-ensurer.reset-size3.size8,.katex .sizing.reset-size3.size8{font-size:2.05714286em}.katex .fontsize-ensurer.reset-size3.size9,.katex .sizing.reset-size3.size9{font-size:2.46857143em}.katex .fontsize-ensurer.reset-size3.size10,.katex .sizing.reset-size3.size10{font-size:2.96285714em}.katex .fontsize-ensurer.reset-size3.size11,.katex .sizing.reset-size3.size11{font-size:3.55428571em}.katex .fontsize-ensurer.reset-size4.size1,.katex .sizing.reset-size4.size1{font-size:.625em}.katex .fontsize-ensurer.reset-size4.size2,.katex .sizing.reset-size4.size2{font-size:.75em}.katex .fontsize-ensurer.reset-size4.size3,.katex .sizing.reset-size4.size3{font-size:.875em}.katex .fontsize-ensurer.reset-size4.size4,.katex .sizing.reset-size4.size4{font-size:1em}.katex .fontsize-ensurer.reset-size4.size5,.katex .sizing.reset-size4.size5{font-size:1.125em}.katex .fontsize-ensurer.reset-size4.size6,.katex .sizing.reset-size4.size6{font-size:1.25em}.katex .fontsize-ensurer.reset-size4.size7,.katex .sizing.reset-size4.size7{font-size:1.5em}.katex .fontsize-ensurer.reset-size4.size8,.katex .sizing.reset-size4.size8{font-size:1.8em}.katex .fontsize-ensurer.reset-size4.size9,.katex .sizing.reset-size4.size9{font-size:2.16em}.katex .fontsize-ensurer.reset-size4.size10,.katex .sizing.reset-size4.size10{font-size:2.5925em}.katex .fontsize-ensurer.reset-size4.size11,.katex .sizing.reset-size4.size11{font-size:3.11em}.katex .fontsize-ensurer.reset-size5.size1,.katex .sizing.reset-size5.size1{font-size:.55555556em}.katex .fontsize-ensurer.reset-size5.size2,.katex .sizing.reset-size5.size2{font-size:.66666667em}.katex .fontsize-ensurer.reset-size5.size3,.katex .sizing.reset-size5.size3{font-size:.77777778em}.katex .fontsize-ensurer.reset-size5.size4,.katex .sizing.reset-size5.size4{font-size:.88888889em}.katex .fontsize-ensurer.reset-size5.size5,.katex .sizing.reset-size5.size5{font-size:1em}.katex .fontsize-ensurer.reset-size5.size6,.katex .sizing.reset-size5.size6{font-size:1.11111111em}.katex .fontsize-ensurer.reset-size5.size7,.katex .sizing.reset-size5.size7{font-size:1.33333333em}.katex .fontsize-ensurer.reset-size5.size8,.katex .sizing.reset-size5.size8{font-size:1.6em}.katex .fontsize-ensurer.reset-size5.size9,.katex .sizing.reset-size5.size9{font-size:1.92em}.katex .fontsize-ensurer.reset-size5.size10,.katex .sizing.reset-size5.size10{font-size:2.30444444em}.katex .fontsize-ensurer.reset-size5.size11,.katex .sizing.reset-size5.size11{font-size:2.76444444em}.katex .fontsize-ensurer.reset-size6.size1,.katex .sizing.reset-size6.size1{font-size:.5em}.katex .fontsize-ensurer.reset-size6.size2,.katex .sizing.reset-size6.size2{font-size:.6em}.katex .fontsize-ensurer.reset-size6.size3,.katex .sizing.reset-size6.size3{font-size:.7em}.katex .fontsize-ensurer.reset-size6.size4,.katex .sizing.reset-size6.size4{font-size:.8em}.katex .fontsize-ensurer.reset-size6.size5,.katex .sizing.reset-size6.size5{font-size:.9em}.katex .fontsize-ensurer.reset-size6.size6,.katex .sizing.reset-size6.size6{font-size:1em}.katex .fontsize-ensurer.reset-size6.size7,.katex .sizing.reset-size6.size7{font-size:1.2em}.katex .fontsize-ensurer.reset-size6.size8,.katex .sizing.reset-size6.size8{font-size:1.44em}.katex .fontsize-ensurer.reset-size6.size9,.katex .sizing.reset-size6.size9{font-size:1.728em}.katex .fontsize-ensurer.reset-size6.size10,.katex .sizing.reset-size6.size10{font-size:2.074em}.katex .fontsize-ensurer.reset-size6.size11,.katex .sizing.reset-size6.size11{font-size:2.488em}.katex .fontsize-ensurer.reset-size7.size1,.katex .sizing.reset-size7.size1{font-size:.41666667em}.katex .fontsize-ensurer.reset-size7.size2,.katex .sizing.reset-size7.size2{font-size:.5em}.katex .fontsize-ensurer.reset-size7.size3,.katex .sizing.reset-size7.size3{font-size:.58333333em}.katex .fontsize-ensurer.reset-size7.size4,.katex .sizing.reset-size7.size4{font-size:.66666667em}.katex .fontsize-ensurer.reset-size7.size5,.katex .sizing.reset-size7.size5{font-size:.75em}.katex .fontsize-ensurer.reset-size7.size6,.katex .sizing.reset-size7.size6{font-size:.83333333em}.katex .fontsize-ensurer.reset-size7.size7,.katex .sizing.reset-size7.size7{font-size:1em}.katex .fontsize-ensurer.reset-size7.size8,.katex .sizing.reset-size7.size8{font-size:1.2em}.katex .fontsize-ensurer.reset-size7.size9,.katex .sizing.reset-size7.size9{font-size:1.44em}.katex .fontsize-ensurer.reset-size7.size10,.katex .sizing.reset-size7.size10{font-size:1.72833333em}.katex .fontsize-ensurer.reset-size7.size11,.katex .sizing.reset-size7.size11{font-size:2.07333333em}.katex .fontsize-ensurer.reset-size8.size1,.katex .sizing.reset-size8.size1{font-size:.34722222em}.katex .fontsize-ensurer.reset-size8.size2,.katex .sizing.reset-size8.size2{font-size:.41666667em}.katex .fontsize-ensurer.reset-size8.size3,.katex .sizing.reset-size8.size3{font-size:.48611111em}.katex .fontsize-ensurer.reset-size8.size4,.katex .sizing.reset-size8.size4{font-size:.55555556em}.katex .fontsize-ensurer.reset-size8.size5,.katex .sizing.reset-size8.size5{font-size:.625em}.katex .fontsize-ensurer.reset-size8.size6,.katex .sizing.reset-size8.size6{font-size:.69444444em}.katex .fontsize-ensurer.reset-size8.size7,.katex .sizing.reset-size8.size7{font-size:.83333333em}.katex .fontsize-ensurer.reset-size8.size8,.katex .sizing.reset-size8.size8{font-size:1em}.katex .fontsize-ensurer.reset-size8.size9,.katex .sizing.reset-size8.size9{font-size:1.2em}.katex .fontsize-ensurer.reset-size8.size10,.katex .sizing.reset-size8.size10{font-size:1.44027778em}.katex .fontsize-ensurer.reset-size8.size11,.katex .sizing.reset-size8.size11{font-size:1.72777778em}.katex .fontsize-ensurer.reset-size9.size1,.katex .sizing.reset-size9.size1{font-size:.28935185em}.katex .fontsize-ensurer.reset-size9.size2,.katex .sizing.reset-size9.size2{font-size:.34722222em}.katex .fontsize-ensurer.reset-size9.size3,.katex .sizing.reset-size9.size3{font-size:.40509259em}.katex .fontsize-ensurer.reset-size9.size4,.katex .sizing.reset-size9.size4{font-size:.46296296em}.katex .fontsize-ensurer.reset-size9.size5,.katex .sizing.reset-size9.size5{font-size:.52083333em}.katex .fontsize-ensurer.reset-size9.size6,.katex .sizing.reset-size9.size6{font-size:.5787037em}.katex .fontsize-ensurer.reset-size9.size7,.katex .sizing.reset-size9.size7{font-size:.69444444em}.katex .fontsize-ensurer.reset-size9.size8,.katex .sizing.reset-size9.size8{font-size:.83333333em}.katex .fontsize-ensurer.reset-size9.size9,.katex .sizing.reset-size9.size9{font-size:1em}.katex .fontsize-ensurer.reset-size9.size10,.katex .sizing.reset-size9.size10{font-size:1.20023148em}.katex .fontsize-ensurer.reset-size9.size11,.katex .sizing.reset-size9.size11{font-size:1.43981481em}.katex .fontsize-ensurer.reset-size10.size1,.katex .sizing.reset-size10.size1{font-size:.24108004em}.katex .fontsize-ensurer.reset-size10.size2,.katex .sizing.reset-size10.size2{font-size:.28929605em}.katex .fontsize-ensurer.reset-size10.size3,.katex .sizing.reset-size10.size3{font-size:.33751205em}.katex .fontsize-ensurer.reset-size10.size4,.katex .sizing.reset-size10.size4{font-size:.38572806em}.katex .fontsize-ensurer.reset-size10.size5,.katex .sizing.reset-size10.size5{font-size:.43394407em}.katex .fontsize-ensurer.reset-size10.size6,.katex .sizing.reset-size10.size6{font-size:.48216008em}.katex .fontsize-ensurer.reset-size10.size7,.katex .sizing.reset-size10.size7{font-size:.57859209em}.katex .fontsize-ensurer.reset-size10.size8,.katex .sizing.reset-size10.size8{font-size:.69431051em}.katex .fontsize-ensurer.reset-size10.size9,.katex .sizing.reset-size10.size9{font-size:.83317261em}.katex .fontsize-ensurer.reset-size10.size10,.katex .sizing.reset-size10.size10{font-size:1em}.katex .fontsize-ensurer.reset-size10.size11,.katex .sizing.reset-size10.size11{font-size:1.19961427em}.katex .fontsize-ensurer.reset-size11.size1,.katex .sizing.reset-size11.size1{font-size:.20096463em}.katex .fontsize-ensurer.reset-size11.size2,.katex .sizing.reset-size11.size2{font-size:.24115756em}.katex .fontsize-ensurer.reset-size11.size3,.katex .sizing.reset-size11.size3{font-size:.28135048em}.katex .fontsize-ensurer.reset-size11.size4,.katex .sizing.reset-size11.size4{font-size:.32154341em}.katex .fontsize-ensurer.reset-size11.size5,.katex .sizing.reset-size11.size5{font-size:.36173633em}.katex .fontsize-ensurer.reset-size11.size6,.katex .sizing.reset-size11.size6{font-size:.40192926em}.katex .fontsize-ensurer.reset-size11.size7,.katex .sizing.reset-size11.size7{font-size:.48231511em}.katex .fontsize-ensurer.reset-size11.size8,.katex .sizing.reset-size11.size8{font-size:.57877814em}.katex .fontsize-ensurer.reset-size11.size9,.katex .sizing.reset-size11.size9{font-size:.69453376em}.katex .fontsize-ensurer.reset-size11.size10,.katex .sizing.reset-size11.size10{font-size:.83360129em}.katex .fontsize-ensurer.reset-size11.size11,.katex .sizing.reset-size11.size11{font-size:1em}.katex .delimsizing.size1{font-family:KaTeX_Size1}.katex .delimsizing.size2{font-family:KaTeX_Size2}.katex .delimsizing.size3{font-family:KaTeX_Size3}.katex .delimsizing.size4{font-family:KaTeX_Size4}.katex .delimsizing.mult .delim-size1>span{font-family:KaTeX_Size1}.katex .delimsizing.mult .delim-size4>span{font-family:KaTeX_Size4}.katex .nulldelimiter{display:inline-block;width:.12em}.katex .delimcenter,.katex .op-symbol{position:relative}.katex .op-symbol.small-op{font-family:KaTeX_Size1}.katex .op-symbol.large-op{font-family:KaTeX_Size2}.katex .accent>.vlist-t,.katex .op-limits>.vlist-t{text-align:center}.katex .accent .accent-body{position:relative}.katex .accent .accent-body:not(.accent-full){width:0}.katex .overlay{display:block}.katex .mtable .vertical-separator{display:inline-block;min-width:1px}.katex .mtable .arraycolsep{display:inline-block}.katex .mtable .col-align-c>.vlist-t{text-align:center}.katex .mtable .col-align-l>.vlist-t{text-align:left}.katex .mtable .col-align-r>.vlist-t{text-align:right}.katex .svg-align{text-align:left}.katex svg{fill:currentColor;stroke:currentColor;fill-rule:nonzero;fill-opacity:1;stroke-width:1;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:1;display:block;height:inherit;position:absolute;width:100%}.katex svg path{stroke:none}.katex img{border-style:none;max-height:none;max-width:none;min-height:0;min-width:0}.katex .stretchy{display:block;overflow:hidden;position:relative;width:100%}.katex .stretchy:after,.katex .stretchy:before{content:""}.katex .hide-tail{overflow:hidden;position:relative;width:100%}.katex .halfarrow-left{left:0;overflow:hidden;position:absolute;width:50.2%}.katex .halfarrow-right{overflow:hidden;position:absolute;right:0;width:50.2%}.katex .brace-left{left:0;overflow:hidden;position:absolute;width:25.1%}.katex .brace-center{left:25%;overflow:hidden;position:absolute;width:50%}.katex .brace-right{overflow:hidden;position:absolute;right:0;width:25.1%}.katex .x-arrow-pad{padding:0 .5em}.katex .cd-arrow-pad{padding:0 .55556em 0 .27778em}.katex .mover,.katex .munder,.katex .x-arrow{text-align:center}.katex .boxpad{padding:0 .3em}.katex .fbox,.katex .fcolorbox{border:.04em solid;box-sizing:border-box}.katex .cancel-pad{padding:0 .2em}.katex .cancel-lap{margin-left:-.2em;margin-right:-.2em}.katex .sout{border-bottom-style:solid;border-bottom-width:.08em}.katex .angl{border-right:.049em solid;border-top:.049em solid;box-sizing:border-box;margin-right:.03889em}.katex .anglpad{padding:0 .03889em}.katex .eqn-num:before{content:"(" counter(katexEqnNo) ")";counter-increment:katexEqnNo}.katex .mml-eqn-num:before{content:"(" counter(mmlEqnNo) ")";counter-increment:mmlEqnNo}.katex .mtr-glue{width:50%}.katex .cd-vert-arrow{display:inline-block;position:relative}.katex .cd-label-left{display:inline-block;position:absolute;right:calc(50% + .3em);text-align:left}.katex .cd-label-right{display:inline-block;left:calc(50% + .3em);position:absolute;text-align:right}.katex-display{display:block;margin:1em 0;text-align:center}.katex-display>.katex{display:block;text-align:center;white-space:nowrap}.katex-display>.katex>.katex-html{display:block;position:relative}.katex-display>.katex>.katex-html>.tag{position:absolute;right:0}.katex-display.leqno>.katex>.katex-html>.tag{left:0;right:auto}.katex-display.fleqn>.katex{padding-left:2em;text-align:left}body{counter-reset:katexEqnNo mmlEqnNo}

            `;

            let injectStyle = (doc) => {
                if(!doc || doc.getElementById('md-annotations-style')) return;
                
                // Inject our custom styles
                let style = doc.createElement('style');
                style.id = 'md-annotations-style';
                style.textContent = styleCSS;
                if (doc.head) doc.head.appendChild(style);
                else if (doc.documentElement) doc.documentElement.appendChild(style);
                
                // Inject KaTeX CSS
                if(!doc.getElementById('katex-css')) {
                    let link = doc.createElement('link');
                    link.id = 'katex-css';
                    link.rel = 'stylesheet';
                    link.href = this.rootURI + 'lib/katex.min.css';
                    if (doc.head) doc.head.appendChild(link);
                    else if (doc.documentElement) doc.documentElement.appendChild(link);
                }
                
                // Load KaTeX Fonts into memory
                if (win.loadKaTeXFonts) {
                    win.loadKaTeXFonts(doc);
                }
            };

            let timerId = win.setInterval(() => {
                if (!md) return;
                try {
                    let mainDoc = win.document;
                    injectStyle(mainDoc);
                    
                    let targets = [];
                    function scan(root, docName) {
                        if (!root || !root.querySelectorAll) return;
                        let found = root.querySelectorAll('[contenteditable="true"], [contenteditable=""], [data-testid="annotation-comment"]');
                        for (let i = 0; i < found.length; i++) {
                            let node = found[i];
                            if (node.classList.contains('my-markdown-rendered-view')) continue;
                            
                            let inPopup = false;
                            let isComment = false;
                            let p = node;
                            while(p) {
                                let testid = (p.dataset && p.dataset.testid) ? p.dataset.testid.toLowerCase() : '';
                                let cname = (p.className || '').toString().toLowerCase();
                                if (testid.includes('popup') || cname.includes('popup')) inPopup = true;
                                if (testid.includes('comment') || cname.includes('comment')) isComment = true;
                                p = p.parentElement;
                            }
                            
                            if (!inPopup && !isComment) continue;
                            targets.push({node, docName, inPopup});
                        }
                    }

                    scan(mainDoc.documentElement, "mainDoc");
                    let frames = mainDoc.querySelectorAll('iframe, browser');
                    for (let frame of frames) {
                        if (frame.contentDocument) {
                            injectStyle(frame.contentDocument);
                            scan(frame.contentDocument.documentElement, "frame");
                        }
                    }

                    targets.forEach(({node, docName, inPopup}) => {
                            if (node.dataset.mdRendered === 'true') return;
                            node.dataset.mdRendered = 'true';
                            
                            let isEditable = node.hasAttribute('contenteditable');
                            let doc = node.ownerDocument || win.document;
                            let viewWin = doc.defaultView || win;

                            let renderedDiv = doc.createElement('div');
                            renderedDiv.className = (node.className ? node.className + ' ' : '') + 'my-markdown-rendered-view';
                            renderedDiv.setAttribute('contenteditable', 'true');
                            
                            let innerDiv = doc.createElement('div');
                            innerDiv.setAttribute('contenteditable', 'false');
                            innerDiv.style.width = '100%';
                            innerDiv.style.height = '100%';
                            innerDiv.style.outline = 'none';
                            renderedDiv.appendChild(innerDiv);
                            
                            // Prevent typing but allow copy/paste/selection
                            renderedDiv.addEventListener('keydown', e => {
                                if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key !== 'Escape') {
                                    e.preventDefault();
                                }
                            });
                            renderedDiv.addEventListener('paste', e => e.preventDefault());
                            renderedDiv.addEventListener('cut', e => e.preventDefault());
                            
                            if (node.parentNode) {
                                node.parentNode.insertBefore(renderedDiv, node.nextSibling);
                            }
                                
                            function updateRenderedView(rawText) {
                                if (!rawText || rawText.trim() === '') {
                                    renderedDiv.style.display = 'none';
                                    node.style.display = '';
                                } else {
                                    let html = md.render(rawText);
                                    innerDiv.innerHTML = html;
                                    node.style.display = 'none';
                                    renderedDiv.style.display = 'block';
                                }
                            }
                            
                            if (inPopup) {
                                renderedDiv.classList.add('md-in-popup');
                                node.classList.add('md-in-popup');
                                
                                try {
                                    let p = null;
                                    let parent = node.parentElement;
                                    for(let i=0; i<6; i++) {
                                        if(parent && parent.style) {
                                            let compStyle = viewWin.getComputedStyle(parent);
                                            if((compStyle && compStyle.position === 'absolute') || parent.dataset.testid === 'annotation-popup') {
                                                p = parent;
                                                break;
                                            }
                                        }
                                        parent = parent.parentElement;
                                    }
                                    
                                    if (viewWin.ResizeObserver) {
                                        let ro = new viewWin.ResizeObserver(() => {
                                            if (p && (node.style.width || renderedDiv.style.width || node.style.height || renderedDiv.style.height)) {
                                                p.style.width = "fit-content";
                                                p.style.maxWidth = "none";
                                                p.style.maxHeight = "none";
                                            }
                                            if (renderedDiv.style.display !== 'none') {
                                                if (node.style.width !== renderedDiv.style.width) node.style.width = renderedDiv.style.width;
                                                if (node.style.height !== renderedDiv.style.height) node.style.height = renderedDiv.style.height;
                                            } else {
                                                if (renderedDiv.style.width !== node.style.width) renderedDiv.style.width = node.style.width;
                                                if (renderedDiv.style.height !== node.style.height) renderedDiv.style.height = node.style.height;
                                            }
                                        });
                                        ro.observe(renderedDiv);
                                        ro.observe(node);
                                    }
                                } catch(e) {}
                            } else {
                                renderedDiv.classList.add('md-in-sidebar');
                                node.classList.add('md-in-sidebar');
                            }

                            if (isEditable) {
                                try {
                                    let toggleBtn = doc.createElement('button');
                                    toggleBtn.className = 'md-toggle-btn';
                                    toggleBtn.innerText = 'MD预览';
                                    
                                    if (node.parentNode) {
                                        if(viewWin.getComputedStyle(node.parentNode).position === 'static') {
                                            node.parentNode.style.position = 'relative';
                                        }
                                        node.parentNode.appendChild(toggleBtn);
                                    }

                                    let isEditing = true;
                                    renderedDiv.style.display = 'none';
                                    node.style.display = '';

                                    toggleBtn.addEventListener('click', (e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        isEditing = !isEditing;
                                        
                                        if (isEditing) {
                                            let w = renderedDiv.style.width || viewWin.getComputedStyle(renderedDiv).width;
                                            let h = renderedDiv.style.height || viewWin.getComputedStyle(renderedDiv).height;
                                            renderedDiv.style.display = 'none';
                                            node.style.display = '';
                                            if (w && w !== 'auto') node.style.width = w;
                                            if (h && h !== 'auto') node.style.height = h;
                                            toggleBtn.innerText = 'MD预览';
                                            node.focus();
                                        } else {
                                            let w = node.style.width || viewWin.getComputedStyle(node).width;
                                            let h = node.style.height || viewWin.getComputedStyle(node).height;
                                            let currentText = node.value !== undefined ? node.value : (node.innerText || node.textContent);
                                            if (renderedDiv.dataset.lastRawText !== currentText) {
                                                updateRenderedView(currentText);
                                                renderedDiv.dataset.lastRawText = currentText;
                                            }
                                            node.style.display = 'none';
                                            renderedDiv.style.display = 'block';
                                            if (w && w !== 'auto') renderedDiv.style.width = w;
                                            if (h && h !== 'auto') renderedDiv.style.height = h;
                                            toggleBtn.innerText = '源码编辑';
                                        }
                                    });
                                } catch(err) { }
                            } else {
                                let rawText = node.innerText || node.textContent;
                                if (renderedDiv.dataset.lastRawText !== rawText) {
                                    updateRenderedView(rawText);
                                    renderedDiv.dataset.lastRawText = rawText;
                                }
                            }
                        });
                } catch(e) { }
            }, 500);
            this.timers.push(timerId);
            
        } catch (e) { }
    }
};

function install(data, reason) {}
function uninstall(data, reason) {}
function startup(data, reason) {
    ZoteroMarkdownAnnotations.init(data);
    ZoteroMarkdownAnnotations.startup();
}
function shutdown(data, reason) {
    ZoteroMarkdownAnnotations.shutdown();
    
    try {
        let win = Zotero.getMainWindow();
        if (!win) return;
        
        let docs = [win.document];
        let frames = win.document.querySelectorAll('iframe, browser');
        frames.forEach(f => { if(f.contentDocument) docs.push(f.contentDocument); });
        
        docs.forEach(doc => {
            if (!doc) return;
            doc.querySelectorAll('#md-annotations-style, #katex-css').forEach(e => e.remove());
            doc.querySelectorAll('.my-markdown-rendered-view').forEach(e => e.remove());
            doc.querySelectorAll('.md-toggle-btn').forEach(e => e.remove());
            doc.querySelectorAll('[data-md-rendered="true"]').forEach(e => {
                delete e.dataset.mdRendered;
                e.style.display = '';
            });
            delete doc.katexFontsLoaded;
        });
    } catch (e) {}
}
