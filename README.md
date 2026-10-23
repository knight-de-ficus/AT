<div align="center">
  <h1>AI Model Tester</h1>
</div>

## 测试内容

- **基础响应**：发送“你好”，记录首个有效输出时间（TTFT）、总耗时和生成速度。
- **流式输出**：检查模型是否产生多个文本增量，而非一次性返回完整正文。
- **思考能力**：发送协议对应的 reasoning/thinking 参数，检查思考增量、摘要或 reasoning token 计数。
- **长上下文**：测试长下文下模型的首个有效输出时间（TTFT）、总耗时和生成速度。
- **工具调用**：声明并强制调用 `report_probe`，检查响应产生函数调用情况。
- **图片理解**：发送PNG，检查协议和模型是否接受图片内容。
- **音频理解**：发送内置短 WAV，检查协议和模型是否接受音频内容。

```bash
git clone https://github.com/knight-de-ficus/AT.git
cd AT
bash scripts/setup-linux.sh
```

部署后可在“设置”中开启登录鉴权、修改密码，以及按 IP 或 IPv4 CIDR 限制访问源。本机回环地址始终允许访问。若服务运行在可信反向代理后，可设置 `AT_TRUST_PROXY=1` 读取代理传递的客户端地址。

“平台日志”会在服务端保留最近 500 次模型请求交换。单次请求或响应日志最多保留 128 KB，超出部分会显示截断标记。
