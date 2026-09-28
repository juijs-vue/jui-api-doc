import { defineConfig } from "vitepress"
import coreTsSidebar from "../core-ts/typedoc-sidebar.json"
import graphTsSidebar from "../graph-ts/typedoc-sidebar.json"
import chartVueRegisterSidebar from "../chart-vue-register/typedoc-sidebar.json"

export default defineConfig({
    title: "juijs-vue API",
    description: "Generated API reference for the juijs-vue library ecosystem",
    srcExclude: ["**/node_modules/**"],
    // Generated markdown (from legacy jsduck-era JSDoc prose, e.g. "@returns NodeListOf<Element>")
    // routinely contains stray "<Word>" text that isn't real HTML - without this, VitePress's Vue
    // SFC compiler chokes on it as an unclosed tag. Disabling raw HTML passthrough makes markdown-it
    // escape it as text instead, which is what all of this generated content actually needs.
    markdown: { html: false },
    themeConfig: {
        nav: [
            { text: "jui-core-ts", link: "/core-ts/" },
            { text: "jui-graph-ts", link: "/graph-ts/" },
            { text: "jui-chart-vue (brush/widget/...)", link: "/chart-vue-register/" },
            { text: "Components", link: "/components/grid-vue/DataGrid" }
        ],
        sidebar: {
            "/core-ts/": coreTsSidebar,
            "/graph-ts/": graphTsSidebar,
            "/chart-vue-register/": chartVueRegisterSidebar,
            "/components/": [
                {
                    text: "jui-grid-vue",
                    items: [
                        { text: "DataGrid", link: "/components/grid-vue/DataGrid" },
                        { text: "VirtualGrid", link: "/components/grid-vue/VirtualGrid" },
                        { text: "ColumnMenu", link: "/components/grid-vue/ColumnMenu" }
                    ]
                },
                {
                    text: "jui-chart-vue",
                    items: [{ text: "Chart", link: "/components/chart-vue/Chart" }]
                },
                {
                    text: "jui-ui-vue",
                    items: [
                        "Switch", "ButtonGroup", "Tab", "NumberChecker", "Accordion", "Progress",
                        "AutoComplete", "StringChecker", "Paging", "Notify", "Tooltip", "Select",
                        "Modal", "TimePicker", "Window", "Splitter", "Dropdown", "Combo",
                        "Colorpicker", "Slider", "Layout", "Datepicker", "Property", "Tree"
                    ].map((name) => ({ text: name, link: `/components/ui-vue/${name}` }))
                }
            ]
        }
    }
})
