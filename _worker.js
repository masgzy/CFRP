export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("请输入 / 后面的链接", { status: 400 });
    }

    // 提取目标 URL 并检查是否包含协议头
    const targetUrlStr = url.pathname.replace("/", "") + url.search + url.hash;
    const hasProtocol = targetUrlStr.startsWith("http://") || targetUrlStr.startsWith("https://");

    let actualUrlStr;
    if (!hasProtocol) {
      // 如果没有协议头，尝试检测协议
      actualUrlStr = await detectProtocol(targetUrlStr);
    } else {
      actualUrlStr = targetUrlStr;
    }

    try {
      const actualUrl = new URL(actualUrlStr);
      const modifiedRequest = new Request(actualUrl, {
        headers: request.headers,
        method: request.method,
        body: request.body,
        redirect: "follow"
      });

      // 发起请求并获取响应
      const response = await fetch(modifiedRequest);

      // 检查响应内容类型是否为 HTML
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        // 如果是 HTML，加载并修改内容
        const text = await response.text();
        const mirrorUrl = `${url.origin}${url.pathname}`;

        // 使用 DOMParser 解析 HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/html");

        // 修改相对路径
        const links = doc.querySelectorAll("a[href], img[src], script[src], link[href]");
        links.forEach((link) => {
          const attr = link.getAttribute("href") || link.getAttribute("src");
          if (!attr.startsWith("http") && !attr.startsWith("#") && !attr.startsWith("data:")) {
            const newPath = `${mirrorUrl}/${attr.startsWith("/") ? attr.slice(1) : attr}`;
            link.setAttribute(link.getAttribute("href") ? "href" : "src", newPath);
          }
        });

        // 返回修改后的 HTML
        const modifiedText = new XMLSerializer().serializeToString(doc);
        return new Response(modifiedText, {
          headers: {
            ...response.headers,
            "Content-Type": "text/html"
          }
        });
      }

      // 如果不是 HTML 内容，直接返回原始响应
      return response;
    } catch (error) {
      // 捕获错误并返回错误响应
      return new Response("请求失败，请检查目标地址", { status: 500 });
    }
  }
};

async function detectProtocol(domain) {
  const httpsUrl = `https://${domain}`;
  try {
    const response = await fetch(httpsUrl, { method: "HEAD", redirect: "manual" });
    if (response.ok) {
      return httpsUrl;
    }
  } catch (error) {
    console.warn(`HTTPS 请求失败，切换到 HTTP: ${error.message}`);
  }
  return `http://${domain}`;
}
