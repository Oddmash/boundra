import { dirname, posix } from "node:path";

export default function remarkDocLinks() {
  return (tree, file) => {
    const path = String(file.path ?? file.history?.[0] ?? "").replaceAll(
      "\\",
      "/",
    );
    const source = path.slice(path.lastIndexOf("/docs/") + 6);
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
        else if (relative === "assets/boundra-mark.svg")
          node.url = "/boundra/boundra-mark.svg";
        else if (relative.endsWith(".md") && !relative.startsWith("../"))
          node.url = `/boundra/docs/${relative.slice(0, -3)}/${hash}`;
      }
      for (const child of node.children ?? []) rewrite(child);
    };
    rewrite(tree);
  };
}
