// 动态检测域名是否支持 SSL 证书
async function detectProtocol(domain) {
  const httpsUrl = `https://${domain}`;
  try {
    // 尝试发起 HTTPS 请求
    const response = await fetch(httpsUrl, { method: "HEAD", redirect: "manual" });
    if (response.ok || response.status >= 300 && response.status < 400) {
      // 如果成功，使用 HTTPS
      return httpsUrl;
    }
  } catch (error) {
    // 如果失败，使用 HTTP
    console.warn(`HTTPS 请求失败，切换到 HTTP: ${error.message}`);
  }
  return `http://${domain}`;
}

// 主模块：处理 HTTP 请求和响应
export default {
  async fetch(request, env) {
    // 解析请求的 URL
    const url = new URL(request.url);

    // 如果路径是根路径（即只有"/"），返回提示信息
    if (url.pathname === "/") {
      return new Response("请输入 / 后面的链接", { status: 400 });
    }

    // 构造目标 URL，将路径、查询参数和锚点拼接起来
    const targetUrlStr = url.pathname.replace("/", "") + url.search + url.hash;

    // 检查是否已经有协议头
    const hasProtocol = targetUrlStr.startsWith("http://") || targetUrlStr.startsWith("https://");

    // 如果没有协议头，尝试动态判断
    let actualUrlStr;
    if (!hasProtocol) {
      actualUrlStr = await detectProtocol(targetUrlStr);
    } else {
      actualUrlStr = targetUrlStr;
    }

    // 确保目标 URL 的路径部分以 / 开头
    const actualUrl = new URL(actualUrlStr);
    if (!actualUrl.pathname.startsWith("/")) {
      actualUrl.pathname = `/${actualUrl.pathname}`;
    }

    // 创建新的请求对象
    const modifiedRequest = new Request(actualUrl, {
      headers: request.headers,
      method: request.method,
      body: request.body,
      redirect: 'follow'
    });

    // 特殊请求头处理规则
    const specialCases = {
      "*": {
        "Origin": "DELETE",
        "Referer": "DELETE"
      }
    };

    // 根据特殊规则修改请求头
    function handleSpecialCases(request) {
      const url = new URL(request.url);
      const rules = specialCases[url.hostname] || specialCases["*"];
      for (const [key, value] of Object.entries(rules)) {
        switch (value) {
          case "KEEP":
            break; // 保留原始头
          case "DELETE":
            request.headers.delete(key); // 删除头
            break;
          default:
            request.headers.set(key, value); // 设置新的头值
            break;
        }
      }
    }

    // 应用特殊规则处理请求头
    handleSpecialCases(modifiedRequest);

    try {
      // 发起请求并获取响应
      const response = await fetch(modifiedRequest);

      // 修改响应头以支持跨域访问
      const modifiedResponse = new Response(response.body, response);
      modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');

      // 如果返回的是 HTML 页面，修改页面中的链接
      if (response.headers.get('content-type')?.includes('text/html')) {
        const text = await response.text();
        const mirrorUrl = `${url.origin}${url.pathname}`; // 获取当前请求的镜像地址
        const targetBase = actualUrl.origin + actualUrl.pathname; // 获取目标网站的协议头和路径

        // 替换相对链接为绝对路径，并加上镜像路径
        const modifiedText = text.replace(/(href|src)="([^"]+)"/g, (match, attr, value) => {
          // 如果链接是相对路径且没有以 / 开头
          if (!value.startsWith('http') && !value.startsWith('//') && !value.startsWith('/')) {
            value = `/${value}`; // 确保路径以 / 开头
          }

          // 将相对路径转换为绝对路径
          const absoluteUrl = new URL(value, targetBase).href;

          // 替换为镜像路径
          return `${attr}="${mirrorUrl}${absoluteUrl.replace(targetBase, "")}"`;
        });

        return new Response(modifiedText, {
          headers: {
            ...modifiedResponse.headers,
            'Content-Type': 'text/html'
          }
        });
      }

      return modifiedResponse; // 返回修改后的响应
    } catch (error) {
      // 如果请求失败，返回错误信息
      return new Response("请求失败，请检查目标地址", { status: 500 });
    }
  }
};
