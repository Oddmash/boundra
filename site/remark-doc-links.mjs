import { dirname, posix, relative as relativePath, resolve } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const docsRoot = fileURLToPath(new URL("../docs/", import.meta.url));

export default function remarkDocLinks() {
  return (tree, file) => {
    const path = String(file.path ?? file.history?.[0] ?? "").replaceAll(
      "\\",
      "/",
    );
    const source = relativePath(docsRoot, resolve(path)).replaceAll("\\", "/");
    if (source.startsWith("../") || !source.endsWith(".md")) return;
    const locale = source.match(/\.(ko|ja|zh-cn)\.md$/)?.[1];
    if (/^user-guide(?:\.(?:ko|ja|zh-cn))?\.md$/.test(source)) {
      tree.children = tree.children.filter(node => {
        if (node.type !== "paragraph") return true;
        const links = node.children?.filter(child => child.type === "link") ?? [];
        return !(links.length >= 2 && links.every(link => /^user-guide(?:\.(?:ko|ja|zh-cn))?\.md$/.test(link.url)) && node.children.every(child => child.type === "link" || (child.type === "text" && /^[·\s]+$/.test(child.value))));
      });
    }
    const rewrite = (node) => {
      if (
        (node.type === "link" || node.type === "image") &&
        node.url &&
        !/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(node.url)
      ) {
        const [target, fragment] = node.url.split("#");
        const relative = posix.normalize(posix.join(dirname(source), target));
        const hash = fragment ? `#${fragment}` : "";
        if (relative === "../examples/order-billing")
          node.url = `/boundra/docs/${locale ? locale + "/" : ""}example/${hash}`;
        else if (relative.startsWith("assets/"))
          node.url = `/boundra/docs/${relative}${hash}`;
        else if (relative.endsWith(".md") && !relative.startsWith("../")) {
          const localized = locale && !/\.(?:ko|ja|zh-cn)\.md$/.test(relative) ? relative.replace(/\.md$/, `.${locale}.md`) : null;
          if (localized && !fragment && existsSync(resolve(docsRoot, localized))) node.url = `/boundra/docs/${localized.slice(0, -3)}/`;
          else {
            node.url = `/boundra/docs/${relative.slice(0, -3)}/${hash}`;
            if (localized && node.type === "link") node.children.push({type:"text",value:" (EN)"});
          }
        }
      }
      for (const child of node.children ?? []) rewrite(child);
    };
    rewrite(tree);
  };
}
