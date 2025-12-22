<div align="center">
<img width="1200" height="475" alt="项目横幅" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Gemini-Solver-Lite

> **Gemini 3 驱动的多模态解题引擎**
> 
> 本项目通过“视觉感知 -> Python 代码推演计算 -> 运行校验”的逻辑闭环，实现全领域题目的深度拆解与精准实证，彻底消除大模型在复杂推演中的计算幻觉。

**本项目使用 Gemini 3 Flash 进行 Vibe Coding 。**

---

## 🛠️ 技术核心：解题逻辑闭环

不同于传统的“文本生成”型 AI，本项目深度利用了 Gemini 3 的 **Agent 能力（工具调用）** 以确保解答的严谨性：

* **视觉感知 (Vision)：** 利用 Gemini 3 原生多模态能力，精准识别题目文本、手写痕迹、几何图形及复杂的公式排版。
* **代码推演 (Reasoning & Coding)：** 针对逻辑运算或数理题目，AI 自动编写相应的 Python 脚本进行逻辑建模，拒绝模糊推理。
* **运行校验 (Execution & Validation)：** 代码在云端沙箱环境中实时运行。Gemini 获取确切的计算结果后，将其与识别到的用户输入进行比对验证。
* **深度拆解 (Output)：** 最终根据系统指令，输出包含正确答案、Python 验证逻辑、启发式引导及详细步骤的结构化解析。

---

## ✨ 核心特性

* **全领域逻辑解码：** 不再局限于特定学段，支持从基础算术到高等数学、物理、化学以及人文社科的全领域题目解读。
* **计算零幻觉：** 引入 Python 代码实证引擎，确保所有数值计算和逻辑推导均经过程序校验，大幅提升结果的可靠性。
* **多模态深度解析：** 支持图片上传批改与纯文本解析，实现像素级的逻辑对齐与原件还原。
* **极简 Lite 设计：** 专注于“解题思维”的透视，提供自适应 UI 布局，完美适配移动端与桌面端。

---

## 🚀 运行与部署你的 AI Studio 应用

本项目包含在本地运行应用所需的一切环境配置。

**在 AI Studio 中查看应用：** [https://ai.studio/apps/drive/1vcPSN2y5CMLWpC2yxbaCJ8rjEW73qG44](https://ai.studio/apps/drive/1vcPSN2y5CMLWpC2yxbaCJ8rjEW73qG44)

### 本地运行指南

**前提条件：** 已安装 **Node.js**

1.  **安装依赖：**
    ```bash
    npm install
    ```
2.  **配置 API 密钥：**
    在 `.env.local` 文件中，将 `GEMINI_API_KEY` 设置为你的 Gemini API 密钥。
3.  **启动开发环境：**
    ```bash
    npm run dev
    ```
