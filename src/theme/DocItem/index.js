import React, { useEffect } from "react";
import DocItem from "@theme-original/DocItem";
import { useColorMode } from "@docusaurus/theme-common";

export default function DocItemWrapper(props) {
  const { colorMode } = useColorMode();

  useEffect(() => {

    const existing = document.getElementById("giscus-container");
    if (existing) existing.remove();


    const script = document.createElement("script");
    script.src = "https://giscus.app/client.js";
    script.setAttribute("data-repo", "csms-apply/csgrad");
    script.setAttribute("data-repo-id", "R_kgDOODyzzw");
    script.setAttribute("data-category", "General");
    script.setAttribute("data-category-id", "DIC_kwDOODyzz84CoS8t");
    script.setAttribute("data-mapping", "pathname");
    script.setAttribute("data-strict", "0");
    script.setAttribute("data-reactions-enabled", "1");
    script.setAttribute("data-emit-metadata", "0");
    script.setAttribute("data-input-position", "top");
    script.setAttribute("data-theme", colorMode === "dark" ? "dark" : "light");
    script.setAttribute("data-lang", "zh-CN");
    script.setAttribute("crossorigin", "anonymous");
    script.async = true;

    const container = document.createElement("div");
    container.id = "giscus-container";
    container.style.marginTop = "2rem";
    container.appendChild(script);

    const markdownEl = document.querySelector(".theme-doc-markdown");
    if (markdownEl) {
      markdownEl.insertAdjacentElement("afterend", container);
    }
  }, [colorMode]);

  return <DocItem {...props} />;
}
