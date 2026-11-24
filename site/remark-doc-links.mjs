import { dirname, posix, relative as relativePath, resolve } from "node:path";
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
          node.url = `/boundra/docs/example/${hash}`;
        else if (relative.startsWith("assets/"))
          node.url = `/boundra/docs/${relative}${hash}`;
        else if (relative.endsWith(".md") && !relative.startsWith("../"))
          node.url = `/boundra/docs/${relative.slice(0, -3)}/${hash}`;
      }
      for (const child of node.children ?? []) rewrite(child);
    };
    rewrite(tree);
  };
}
