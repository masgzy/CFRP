## CFRP(全称 Cloudflare Reverse Proxy,Cloudflare反代)
## 顾名思义,即使用Cloudflare提供的免费服务进行反向代理(镜像)
## Cloudflare Pages使用方法
复刻仓库，选择该仓库，等待部署完成，然后设置自定义域，建议使用优选域名/IP，提高速度
## Cloudflare Workers暂无
## 使用方法
只需要在/后面加入域名或者URL就行了
它会自动在请求时加上协议头
网页中的链接应该会添加镜像地址(使用正则表达式进行修改)
如有需要可自行修改首页内容
