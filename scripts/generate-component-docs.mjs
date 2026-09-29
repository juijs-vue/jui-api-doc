import vueComponentMeta from "vue-component-meta"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const DOCS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const sib = (...p) => path.resolve(DOCS_ROOT, "..", ...p)

const TARGETS = [
    {
        tsconfigPath: sib("jui-grid-vue/tsconfig.lib.json"),
        outDir: path.join(DOCS_ROOT, "components/grid-vue"),
        components: [
            ["DataGrid", sib("jui-grid-vue/src/components/DataGrid.vue")],
            ["VirtualGrid", sib("jui-grid-vue/src/components/VirtualGrid.vue")],
            ["ColumnMenu", sib("jui-grid-vue/src/components/ColumnMenu.vue")]
        ]
    },
    {
        tsconfigPath: sib("jui-chart-vue/tsconfig.lib.json"),
        outDir: path.join(DOCS_ROOT, "components/chart-vue"),
        components: [["Chart", sib("jui-chart-vue/src/Chart.vue")]]
    },
    {
        tsconfigPath: sib("jui-ui-vue/tsconfig.lib.json"),
        outDir: path.join(DOCS_ROOT, "components/ui-vue"),
        // jui-ui-vue's public entry point (src/index.js) order - the 24 components it exports.
        components: [
            "Switch", "ButtonGroup", "Tab", "NumberChecker", "Accordion", "Progress",
            "AutoComplete", "StringChecker", "Paging", "Notify", "Tooltip", "Select",
            "Modal", "TimePicker", "Window", "Splitter", "Dropdown", "Combo",
            "Colorpicker", "Slider", "Layout", "Datepicker", "Property", "Tree"
        ].map((name) => [name, sib(`jui-ui-vue/src/components/${name}.vue`)])
    }
]

const { createChecker } = vueComponentMeta

for (const { tsconfigPath, outDir, components } of TARGETS) {
    const checker = createChecker(tsconfigPath)
    fs.mkdirSync(outDir, { recursive: true })
    for (const [name, file] of components) {
        const meta = checker.getComponentMeta(file)
        fs.writeFileSync(path.join(outDir, `${name}.md`), renderMarkdown(name, meta, file))
        console.log(`wrote ${path.join(outDir, `${name}.md`)}`)
    }
}

function renderMarkdown(name, meta, file) {
    // WORKAROUND: vue-component-meta (as of 3.3.11, the latest version) never populates
    // `events[].description` for a `defineEmits<{...}>()` type-literal event map - confirmed by
    // an isolated repro (both tuple-style `name: [args]` and call-signature-style
    // `name: (args) => void` events come back with an empty description and `declarations: []`,
    // even though the exact same file's `props`/`exposed` descriptions extract correctly from
    // their own JSDoc). Real JSDoc already exists above every event in this project's source, so
    // rather than lose it, parse it directly out of the `defineEmits<{...}>()` block's source text
    // and use it as a fallback wherever vue-component-meta's own description is empty.
    const emitDescriptions = extractEmitDescriptions(file)
    // Same class of workaround, for a different reason: these components declare their slots only
    // via `<slot name="...">` in the template (no `defineSlots<{...}>()` type literal), so there's
    // no TS declaration for vue-component-meta to read a JSDoc comment from at all - not a tooling
    // gap, just nowhere to put one. Rather than introduce `defineSlots<{...}>()` everywhere (a much
    // bigger, unnecessary change just to get a doc string), parse the HTML comment directly above
    // each `<slot>` tag in the template instead - same lightweight source-of-truth approach as the
    // emits workaround above.
    const slotDescriptions = extractSlotDescriptions(file)

    const lines = [`# ${name}`, ""]
    const table = (title, rows, cols) => {
        if (!rows.length) return
        lines.push(`## ${title}`, "", `| ${cols.join(" | ")} |`, `|${cols.map(() => "---").join("|")}|`)
        for (const r of rows) lines.push(`| ${r.join(" | ")} |`)
        lines.push("")
    }
    table(
        "Props",
        (meta.props ?? []).filter((p) => !p.global).map((p) => [`\`${p.name}\``, `\`${esc(p.type)}\``, p.default ?? "-", esc(p.description ?? "")]),
        ["Name", "Type", "Default", "Description"]
    )
    table(
        "Emits",
        (meta.events ?? []).map((e) => [
            `\`${e.name}\``,
            `\`${esc(e.type)}\``,
            esc(e.description || emitDescriptions[e.name] || "")
        ]),
        ["Name", "Type", "Description"]
    )
    table(
        "Slots",
        (meta.slots ?? []).map((s) => [`\`${s.name}\``, esc(s.description || slotDescriptions[s.name] || "")]),
        ["Name", "Description"]
    )
    table(
        "Exposed Methods",
        (meta.exposed ?? []).map((m) => [`\`${m.name}\``, `\`${esc(m.type)}\``, esc(m.description ?? "")]),
        ["Name", "Signature", "Description"]
    )
    return lines.join("\n") + "\n"
}

function esc(t) {
    // VitePress compiles each markdown page into a Vue SFC, so a literal `{{ ... }}` anywhere in
    // the body (not just inside a fenced/inline code span) gets parsed as a real Vue interpolation
    // expression - a description that quotes actual template syntax (e.g. "the default
    // `{{ x.title }}` label") crashed the SSR build with a real, silent-looking failure (the build
    // still printed "build complete", the error only showed up in the log above it - always read
    // the actual build output, not just its exit status). Escape the braces as HTML entities so
    // they render as literal text instead of being interpreted.
    return String(t)
        .replace(/\|/g, "\\|")
        .replace(/\n/g, " ")
        .replace(/\{\{/g, "&#123;&#123;")
        .replace(/\}\}/g, "&#125;&#125;")
}

/** Parses `defineEmits<{ ... }>()`'s type-literal body directly out of the component's source and
 * returns a `{ eventName: description }` map from each event's own `/** ... *\/` JSDoc - see the
 * WORKAROUND note in `renderMarkdown()` for why this is necessary. Returns `{}` if the file has no
 * `defineEmits<{...}>()` call at all. */
function extractEmitDescriptions(file) {
    const src = fs.readFileSync(file, "utf8")
    const start = src.match(/defineEmits\s*<\s*\{/)
    if (!start) return {}

    const braceStart = start.index + start[0].length - 1
    let depth = 0
    let braceEnd = -1
    for (let i = braceStart; i < src.length; i++) {
        if (src[i] === "{") depth++
        else if (src[i] === "}") {
            depth--
            if (depth === 0) {
                braceEnd = i
                break
            }
        }
    }
    if (braceEnd === -1) return {}

    const body = src.slice(braceStart + 1, braceEnd)
    const descriptions = {}
    const entryRe = /\/\*\*([\s\S]*?)\*\/\s*['"]?([\w:-]+)['"]?\s*:/g
    let m
    while ((m = entryRe.exec(body))) {
        const cleaned = m[1]
            .split("\n")
            .map((line) => line.replace(/^\s*\*\s?/, ""))
            .join(" ")
            .replace(/\s+/g, " ")
            .trim()
        descriptions[m[2]] = cleaned
    }
    return descriptions
}

/** Parses every static `<slot name="...">` (and the unnamed/`default` `<slot>`) directly out of
 * the component's `<template>` and returns a `{ slotName: description }` map, taken from the
 * nearest preceding HTML comment (`<!-- ... -->`) separated from the `<slot` tag only by
 * whitespace - see the WORKAROUND note in `renderMarkdown()`. A dynamic name (`:name="..."`) is
 * skipped, since it can't be resolved to a fixed string statically (matches what
 * vue-component-meta itself reports for such slots). If the same slot name appears more than once
 * (e.g. a slot reused across two rendering modes), the first commented occurrence wins. */
function extractSlotDescriptions(file) {
    const src = fs.readFileSync(file, "utf8")
    const descriptions = {}
    const slotRe = /<slot\b([^>]*)>/g
    let m
    while ((m = slotRe.exec(src))) {
        const attrs = m[1]
        if (/:name\s*=/.test(attrs)) continue // dynamic slot name - not statically resolvable

        const nameMatch = attrs.match(/\bname="([\w-]+)"/)
        const name = nameMatch ? nameMatch[1] : "default"
        if (descriptions[name]) continue

        // BUG TRAP (caught only by actually building the site, not by checking for non-empty
        // descriptions): `before.match(/<!--([\s\S]*?)-->\s*$/)` looks non-greedy, but
        // String.prototype.match still finds the LEFTMOST possible match start in the whole file,
        // not the nearest one to the slot - so it swallowed everything from the very FIRST `<!--`
        // in the file through to the last `-->` right before this slot, dumping raw Vue template
        // markup (including `{{ }}` expressions) into the doc table and crashing VitePress's SSR
        // render. Anchor from the END instead: find the last `-->` before the slot, require only
        // whitespace between it and the slot tag, then find ITS matching `<!--` going backward.
        const before = src.slice(0, m.index)
        const lastCommentEnd = before.lastIndexOf("-->")
        if (lastCommentEnd === -1) continue
        if (!/^\s*$/.test(before.slice(lastCommentEnd + 3))) continue
        const lastCommentStart = before.lastIndexOf("<!--", lastCommentEnd)
        if (lastCommentStart === -1) continue

        descriptions[name] = before.slice(lastCommentStart + 4, lastCommentEnd).trim().replace(/\s+/g, " ")
    }
    return descriptions
}
