export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 检查是否提供了目标链接
    if (url.pathname === "/") {
      return new Response("请输入有效的链接！", { status: 400 });
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
      console.log("正在请求的目标 URL:", actualUrl.href); // 调试信息

      // 构造请求并覆盖某些敏感头信息
      const modifiedRequest = new Request(actualUrl, {
        headers: new Headers({
          ...request.headers,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
          "X-Forwarded-For": "0.0.0.0", // 隐藏真实 IP
          "Via": "1.1 proxy" // 模拟代理头
        }),
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
        console.log("代理服务器的 URL:", mirrorUrl); // 调试信息

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
      console.error("请求失败，错误信息:", error);
      return new Response("请求失败，请检查目标地址是否有效！", { status: 500 });
    }
  }
};

async function detectProtocol(domain) {
  const httpsUrl = `https://${domain}`;
  console.log("尝试 HTTPS URL:", httpsUrl);

  try {
    const response = await fetch(httpsUrl, { method: "HEAD", redirect: "manual" });
    if (response.ok) {
      console.log("HTTPS URL 有效:", httpsUrl);
      return httpsUrl;
    }
  } catch (error) {
    console.warn(`HTTPS 请求失败，切换到 HTTP: ${error.message}`);
  }

  console.log("回退到 HTTP URL:", `http://${domain}`);
  return `http://${domain}`;
}
