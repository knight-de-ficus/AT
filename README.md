<div align="center">
  <h1>AI Model Tester</h1>
</div>

## 测试内容

- **基础响应**：发送“你好”，记录首个有效输出时间（TTFT）、总耗时和生成速度。
- **长上下文**：测试长下文下模型的首个有效输出时间（TTFT）、总耗时和生成速度。
- **工具调用**：声明并强制调用 `report_probe`，检查响应产生函数调用情况。
- **图片理解**：发送PNG，检查协议和模型是否接受图片内容。
- **音频理解**：发送内置短 WAV，检查协议和模型是否接受音频内容。

```bash
git clone https://github.com/knight-de-ficus/AT.git
cd AT
bash scripts/setup-linux.sh
```
