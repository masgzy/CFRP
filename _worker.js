export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("请输入 / 后面的链接", { status: 400 });
    }

    const targetUrlStr = url.pathname.replace("/", "") + url.search + url.hash;
    const hasProtocol = targetUrlStr.startsWith("http://") || targetUrlStr.startsWith("https://");

    let actualUrlStr;
    if (!hasProtocol) {
      actualUrlStr = await detectProtocol(targetUrlStr);
    } else {
      actualUrlStr = targetUrlStr;
    }

    const actualUrl = new URL(actualUrlStr);
    const modifiedRequest = new Request(actualUrl, {
      headers: request.headers,
      method: request.method,
      body: request.body,
      redirect: "follow"
    });

    try {
      const response = await fetch(modifiedRequest);
      const contentType = response.headers.get("content-type");

      if (contentType && contentType.includes("text/html")) {
        const text = await response.text();
        const mirrorUrl = `${url.origin}${url.pathname}`;
        const modifiedText = text
          // 处理所有 src 属性
          。replace(/src="([^"]+)"/g, (match, srcValue) => {
            let cleanedSrc = srcValue.replace(/<[^>]+>/g, ""); // 清理 HTML 标签
            if (!cleanedSrc.startsWith("http") && !cleanedSrc.startsWith("#") && !cleanedSrc.startsWith("data:")) {
              if (!cleanedSrc.startsWith("/")) {
                cleanedSrc = `/${cleanedSrc}`;
              }
              return `src="${mirrorUrl}${cleanedSrc}"`;
            }
            return match; // 保留原始值
          })
          // 处理 href 属性
          。replace(/href="([^"]+)"/g, (match, value) => {
            if (!value.startsWith("http") && !value.startsWith("#") && !value.startsWith("data:")) {
              return `href="${mirrorUrl}/${value.startsWith("/") ? value.slice(1) : value}"`;
            }
            return match;
          });

        return new Response(modifiedText, {
          headers: {
            ...response.headers,
            "Content-Type": "text/html"
          }
        });
      }

      return response;
    } catch (error) {
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
