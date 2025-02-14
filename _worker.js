export default {
  async fetch(request, env) {
    // 解析请求的 URL
    const url = new URL(request.url);

    // 如果路径是根路径（即只有"/"），返回提示信息
    if (url.pathname === "/") {
      return new Response("请输入 / 后面的链接", { status: 400 });
    }

    // 构造目标 URL，将路径、查询参数和锚点拼接起来
    const actualUrlStr = url.pathname.replace("/", "") + url.search + url.hash;
    const actualUrl = new URL(actualUrlStr);

    // 创建一个新的请求对象，目标是上面构造的 URL
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

      return modifiedResponse; // 返回修改后的响应
    } catch (error) {
      // 如果请求失败，返回错误信息
      return new Response("请求失败，请检查目标地址", { status: 500 });
    }
  }
};
