export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("请输入有效的链接！", { status: 400 });
    }

    const targetUrlStr = url.pathname.replace("/", "") + url.search + url.hash;
    const hasProtocol = targetUrlStr.startsWith("http://") || targetUrlStr.startsWith("https://");

    let actualUrlStr;
    if (!hasProtocol) {
      actualUrlStr = await detectProtocol(targetUrlStr);
    } else {
      actualUrlStr = targetUrlStr;
    }

    try {
      const actualUrl = new URL(actualUrlStr);
      const modifiedRequest = new Request(actualUrl, {
        headers: new Headers({
          ...request.headers,
          "User-Agent": "Mozilla/5.0",
          "X-Forwarded-For": "0.0.0.0"
        }),
        method: request.method,
        body: request.body,
        redirect: "follow"
      });

      const response = await fetch(modifiedRequest);
      const contentType = response.headers.get("content-type");

      if (contentType && contentType.includes("text/html")) {
        const text = await response.text(); // 默认以 UTF-8 解码
        const mirrorUrl = `${url.origin}${url.pathname}`;

        // 使用正则表达式修改 HTML 内容
        const modifiedText = text.replace(/(href|src)="([^"]+)"/g, (match, attr, value) => {
          if (!value.startsWith("http") && !value.startsWith("#") && !value.startsWith("data:")) {
            return `${attr}="${mirrorUrl}/${value.startsWith("/") ? value.slice(1) : value}"`;
          }
          return match;
        });

        // 返回修改后的 HTML，明确指定字符编码
        return new Response(modifiedText, {
          headers: {
            ...response.headers,
            "Content-Type": "text/html; charset=utf-8" // 明确指定编码
          }
        });
      }

      return response;
    } catch (error) {
      console.error("请求失败，错误信息:", error);
      return new Response("请求失败，请检查目标地址是否有效！", { status: 500 });
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
