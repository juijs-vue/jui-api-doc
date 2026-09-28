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
        fs.writeFileSync(path.join(outDir, `${name}.md`), renderMarkdown(name, meta))
        console.log(`wrote ${path.join(outDir, `${name}.md`)}`)
    }
}

function renderMarkdown(name, meta) {
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
        (meta.events ?? []).map((e) => [`\`${e.name}\``, `\`${esc(e.type)}\``, esc(e.description ?? "")]),
        ["Name", "Type", "Description"]
    )
    table(
        "Slots",
        (meta.slots ?? []).map((s) => [`\`${s.name}\``, esc(s.description ?? "")]),
        ["Name", "Description"]
    )
    return lines.join("\n") + "\n"
}

function esc(t) {
    return String(t).replace(/\|/g, "\\|").replace(/\n/g, " ")
}
