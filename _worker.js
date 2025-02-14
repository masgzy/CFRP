// 导入必要的模块
import { Request, Response } from 'cloudflare-pages-functions';

// 特殊规则
const specialCases = {
  "*": {
    "Origin": "DELETE",
    "Referer": "DELETE"
  }
};

// 处理特殊规则
function handleSpecialCases(request) {
  const url = new URL(request.url);
  const rules = specialCases[url.hostname] || specialCases["*"];
  for (const [key, value] of Object.entries(rules)) {
    switch (value) {
      case "KEEP":
        break;
      case "DELETE":
        request.headers.delete(key);
        break;
      default:
        request.headers.set(key, value);
        break;
    }
  }
}

// 处理请求
async function handleRequest(request) {
  const url = new URL(request.url);
  if (url.pathname === "/") {
    return new Response("Please enter the link after the /", { status: 400 });
  }

  // 构建实际的请求 URL
  const actualUrlStr = url.pathname.replace("/", "") + url.search + url.hash;
  const actualUrl = new URL(actualUrlStr);

  // 修改请求
  const modifiedRequest = new Request(actualUrl.href, {
    headers: request.headers,
    method: request.method,
    body: request.body,
    redirect: 'follow'
  });

  // 应用特殊规则
  handleSpecialCases(modifiedRequest);

  // 发起请求
  const response = await fetch(modifiedRequest);

  // 修改响应头，添加跨域支持
  const modifiedResponse = new Response(response.body, response);
  modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');

  return modifiedResponse;
}

// Cloudflare Pages Functions 的入口点
export default {
  async fetch(request) {
    return handleRequest(request);
  }
};
