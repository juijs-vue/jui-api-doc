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
        (meta.slots ?? []).map((s) => [`\`${s.name}\``, esc(s.description ?? "")]),
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
    return String(t).replace(/\|/g, "\\|").replace(/\n/g, " ")
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
