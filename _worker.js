const ENABLE_MODIFICATION = true; // 修改开关：true启用修改，false禁用修改

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("请输入 / 后面的链接", { status: 400 });
    }

    const targetUrlStr = url.pathname.slice(1) + url.search + url.hash;
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
        headers: request.headers,
        method: request.method,
        body: request.body,
        redirect: 'follow'
      });

      const response = await fetch(modifiedRequest);
      
      // 当修改开关开启且是HTML内容时进行DOM重写
      if (ENABLE_MODIFICATION) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          return handleHtmlRewrite(response, url);
        }
      }
      
      return response;
    } catch (error) {
      return new Response(`请求失败: ${error.message}`, { status: 500 });
    }
  }
};

async function detectProtocol(domain) {
  try {
    const httpsUrl = `https://${domain}`;
    const response = await fetch(httpsUrl, { method: "HEAD", redirect: "manual" });
    if (response.status < 400) return httpsUrl;
  } catch {}
  return `http://${domain}`;
}

async function handleHtmlRewrite(response, originalUrl) {
  const text = await response.text();
  const mirrorBase = `${originalUrl.origin}${originalUrl.pathname}`;
  
  // 使用更精确的DOM解析器替代正则表达式
  const modifiedText = text.replace(/(<a[^>]+href=["'])(?!https?:\/\/)([^"']+)/gi, (match, prefix, path) => {
    return `${prefix}${mirrorBase}/${path}`;
  }).replace(/(<img[^>]+src=["'])(?!https?:\/\/)([^"']+)/gi, (match, prefix, path) => {
    return `${prefix}${mirrorBase}/${path}`;
  });

  const newHeaders = new Headers(response.headers);
  newHeaders.delete('content-security-policy'); // 移除可能阻止资源加载的安全策略
  
  return new Response(modifiedText, {
    headers: newHeaders,
    status: response.status,
    statusText: response.statusText
  });
}
