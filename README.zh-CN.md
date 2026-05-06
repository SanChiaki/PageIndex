<div align="center">
  
<a href="https://vectify.ai/pageindex" target="_blank">
  <img src="https://github.com/user-attachments/assets/46201e72-675b-43bc-bfbd-081cc6b65a1d" alt="PageIndex 横幅" />
</a>

<br/>
<br/>

<p align="center">
  <a href="https://trendshift.io/repositories/14736" target="_blank"><img src="https://trendshift.io/api/badge/repositories/14736" alt="VectifyAI%2FPageIndex | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
</p>

# PageIndex：无向量、基于推理的 RAG

<p align="center"><b>基于推理的 RAG&nbsp; ◦ &nbsp;无需向量数据库&nbsp; ◦ &nbsp;无需 Chunk 切分&nbsp; ◦ &nbsp;类人式检索</b></p>

<h4 align="center">
  <a href="https://vectify.ai">🌐 官网</a>&nbsp; • &nbsp;
  <a href="https://chat.pageindex.ai">🖥️ 聊天平台</a>&nbsp; • &nbsp;
  <a href="https://pageindex.ai/developer">🔌 MCP 与 API</a>&nbsp; • &nbsp;
  <a href="https://docs.pageindex.ai">📖 文档</a>&nbsp; • &nbsp;
  <a href="https://discord.com/invite/VuXuf29EUj">💬 Discord</a>&nbsp; • &nbsp;
  <a href="https://ii2abc2jejf.typeform.com/to/tK3AXl8T">✉️ 联系我们</a>&nbsp;
</h4>
  
</div>


<details open>
<summary><h2>📢 更新</h2></summary>

- 🔥 [**Agentic Vectorless RAG**](https://github.com/VectifyAI/PageIndex/blob/main/examples/agentic_vectorless_rag_demo.py) —— 一个简单的 *agentic、无向量 RAG* [示例](https://github.com/VectifyAI/PageIndex/blob/main/examples/agentic_vectorless_rag_demo.py)，基于自托管的 PageIndex 和 OpenAI Agents SDK。
- [PageIndex Chat](https://chat.pageindex.ai) —— 面向专业长文档的人类式文档分析智能体[平台](https://chat.pageindex.ai)。同时支持通过 [MCP](https://pageindex.ai/developer) 或 [API](https://pageindex.ai/developer) 接入。
- [PageIndex Framework](https://pageindex.ai/blog/pageindex-intro) —— 深入介绍 PageIndex：一种 *agentic、上下文内树索引* 框架，让 LLM 可以对长文档进行 *基于推理、类人式检索*。

 <!-- **🧪 Cookbook：**
- [Vectorless RAG](https://docs.pageindex.ai/cookbook/vectorless-rag-pageindex)：一个极简、可上手的基于推理的 RAG 示例，使用 PageIndex。无需向量，无需 chunk 切分，并支持类人式检索。
- [Vision-based Vectorless RAG](https://docs.pageindex.ai/cookbook/vision-rag-pageindex)：无需 OCR、纯视觉的 RAG 流程，采用 PageIndex 的原生推理式检索，可直接处理 PDF 页面图像。 -->

</details>

---

# 📑 PageIndex 简介

你是否对长篇专业文档上的向量数据库检索准确率感到失望？传统基于向量的 RAG 依赖的是语义 *相似性*，而不是真正的 *相关性*。但 **相似性 ≠ 相关性**。我们真正需要的是 **相关性**，而相关性的判断离不开 **推理**。在处理需要领域知识与多步推理的专业文档时，相似度搜索往往并不够好用。

受 AlphaGo 启发，我们提出了 **[PageIndex](https://vectify.ai/pageindex)** —— 一个 **无向量**、**基于推理的 RAG** 系统。它会为长文档构建一个 **层次化树索引**，并让 LLM 基于这个索引进行 **推理**，实现 **agentic、上下文感知的检索**。
它模拟了 *人类专家* 在复杂文档中通过 *树搜索* 导航和提取知识的方式，使 LLM 能够一步步 *思考* 并 *推理* 到最相关的文档部分。PageIndex 的检索分为两步：

1. 为文档生成类似“目录”的 **树结构索引**
2. 通过 **树搜索** 执行基于推理的检索

<div align="center">
  <a href="https://pageindex.ai/blog/pageindex-intro" target="_blank" title="PageIndex Framework">
    <img src="https://docs.pageindex.ai/images/cookbook/vectorless-rag.png" width="70%">
  </a>
</div>

### 🎯 核心特性

与传统基于向量的 RAG 相比，**PageIndex** 具有以下特点：
- **无需向量数据库**：不依赖向量相似度搜索，而是基于文档结构和 LLM 推理来完成检索。
- **无需 Chunk 切分**：文档按自然章节组织，而不是被人工切成零散片段。
- **类人式检索**：模拟人类专家在复杂文档中导航和提取知识的方式。
- **更强的可解释性与可追溯性**：检索依据是推理过程，可解释、可追溯，并带有页码和章节引用。不再是那种不透明、近似性的向量检索（“vibe retrieval”）。

PageIndex 支撑的基于推理的 RAG 系统，在 FinanceBench 上达到了最先进的 [98.7% 准确率](https://github.com/VectifyAI/Mafin2.5-FinanceBench)，展示了其在专业文档分析中相较于向量 RAG 方案的明显优势。详情可参考我们的[博客文章](https://vectify.ai/blog/Mafin2.5)。

### 📍 进一步了解 PageIndex

如需了解更多，请阅读 [PageIndex framework](https://pageindex.ai/blog/pageindex-intro) 的详细介绍。你也可以查看本 GitHub 仓库中的开源代码，以及配套的 [cookbook](https://docs.pageindex.ai/cookbook)、[tutorial](https://docs.pageindex.ai/tutorials) 和 [博客](https://pageindex.ai/blog)，获取更多用法说明与示例。

PageIndex 服务既可以作为类 ChatGPT 的[聊天平台](https://chat.pageindex.ai)使用，也可以通过 [MCP](https://pageindex.ai/developer) 或 [API](https://pageindex.ai/developer) 集成到你的系统中。

### 🛠️ 部署方式
- Self-host —— 使用本开源仓库在本地运行。
- Cloud Service —— 通过我们的[聊天平台](https://chat.pageindex.ai/)直接体验，或通过 [MCP](https://pageindex.ai/developer) / [API](https://pageindex.ai/developer) 接入。
- _Enterprise_ —— 私有化或本地部署。如需更多信息，请[联系我们](https://ii2abc2jejf.typeform.com/to/tK3AXl8T)或[预约演示](https://calendly.com/pageindex/meet)。

### 🧪 快速上手

- 🔥 [**Agentic Vectorless RAG**](examples/agentic_vectorless_rag_demo.py)（**最新**）—— 一个简单但完整的 **agentic 无向量 RAG** [示例](https://github.com/VectifyAI/PageIndex/blob/main/examples/agentic_vectorless_rag_demo.py)，基于 *自托管* 的 PageIndex 与 OpenAI Agents SDK。
- 试试 [Vectorless RAG](https://github.com/VectifyAI/PageIndex/blob/main/cookbook/pageindex_RAG_simple.ipynb) notebook —— 一个 *极简*、可动手运行的基于推理的 RAG 示例。
- 查看 [Vision-based Vectorless RAG](https://github.com/VectifyAI/PageIndex/blob/main/cookbook/vision_RAG_pageindex.ipynb) —— 无需 OCR；一个极简、基于视觉且推理原生的 RAG 流程，可直接处理页面图像。
  
<div align="center">
  <a href="https://github.com/VectifyAI/PageIndex/blob/main/examples/agentic_vectorless_rag_demo.py" target="_blank" rel="noopener">
    <img src="https://img.shields.io/badge/View_on_GitHub-Agentic_Vectorless_RAG-blue?style=for-the-badge&logo=github" alt="在 GitHub 上查看：Agentic Vectorless RAG" />
  </a>
  <br/>
  <a href="https://colab.research.google.com/github/VectifyAI/PageIndex/blob/main/cookbook/pageindex_RAG_simple.ipynb" target="_blank" rel="noopener">
    <img src="https://img.shields.io/badge/Open_In_Colab-Vectorless_RAG-orange?style=for-the-badge&logo=googlecolab" alt="在 Colab 中打开：Vectorless RAG" />
  </a>
  &nbsp;&nbsp;
  <a href="https://colab.research.google.com/github/VectifyAI/PageIndex/blob/main/cookbook/vision_RAG_pageindex.ipynb" target="_blank" rel="noopener">
    <img src="https://img.shields.io/badge/Open_In_Colab-Vision_RAG-orange?style=for-the-badge&logo=googlecolab" alt="在 Colab 中打开：Vision RAG" />
  </a>
</div>

---

# 🌲 PageIndex 树结构

PageIndex 可以把冗长的 PDF 文档转换成一种语义化的 **树结构**，它类似于一个 *“目录”*，但专门针对大语言模型（LLM）使用场景进行了优化。它尤其适合以下文档：财务报告、监管文件、学术教材、法律或技术手册，以及任何超出 LLM 上下文窗口限制的长文档。

下面是一个 PageIndex 树结构示例。你也可以查看更多示例[文档](https://github.com/VectifyAI/PageIndex/tree/main/examples/documents)以及生成后的[树结构结果](https://github.com/VectifyAI/PageIndex/tree/main/examples/documents/results)。

```jsonc
...
{
  "title": "Financial Stability",
  "node_id": "0006",
  "start_index": 21,
  "end_index": 22,
  "summary": "The Federal Reserve ...",
  "nodes": [
    {
      "title": "Monitoring Financial Vulnerabilities",
      "node_id": "0007",
      "start_index": 22,
      "end_index": 28,
      "summary": "The Federal Reserve's monitoring ..."
    },
    {
      "title": "Domestic and International Cooperation and Coordination",
      "node_id": "0008",
      "start_index": 28,
      "end_index": 31,
      "summary": "In 2023, the Federal Reserve collaborated ..."
    }
  ]
}
...
```

你可以使用本开源仓库生成 PageIndex 树结构，也可以直接调用我们的 [API](https://pageindex.ai/developer)。

---

# ⚙️ 包使用方式

你可以按照下面的步骤，为 PDF 文档生成一个 PageIndex 树。

### 1. 安装依赖

```bash
pip3 install --upgrade -r requirements.txt
```

### 2. 配置你的 LLM API 凭据

在项目根目录创建 `.env` 文件，并写入你的 LLM API 凭据。PageIndex 会在内部为 LiteLLM 映射这些变量：

```bash
PAGEINDEX_LLM_API_KEY=your_llm_key_here
PAGEINDEX_LLM_BASE_URL=https://your-provider.example/v1
```

### 3. 为 PDF 生成 PageIndex 结构

```bash
python3 run_pageindex.py --pdf_path /path/to/your/document.pdf
```

<details>
<summary>可选参数</summary>
<br>
你可以通过额外的参数自定义处理流程：

```
--model                 使用的 LLM 模型（默认：gpt-4o-2024-11-20）
--toc-check-pages       用于检查目录页的页数（默认：20）
--max-pages-per-node    每个节点允许的最大页数（默认：10）
--max-tokens-per-node   每个节点允许的最大 token 数（默认：20000）
--if-add-node-id        是否添加节点 ID（yes/no，默认：yes）
--if-add-node-summary   是否添加节点摘要（yes/no，默认：yes）
--if-add-doc-description 是否添加文档描述（yes/no，默认：yes）
```
</details>

<details>
<summary>Markdown 支持</summary>
<br>
PageIndex 也支持 Markdown。你可以使用 `--md_path` 参数为 Markdown 文件生成树结构。

```bash
python3 run_pageindex.py --md_path /path/to/your/document.md
```

> 注意：在这个模式下，我们使用 `#` 的数量来判断节点标题及其层级。例如，`##` 表示 2 级标题，`###` 表示 3 级标题，依此类推。请确保你的 Markdown 文件格式正确。如果你的 Markdown 文件是从 PDF 或 HTML 转换而来，我们并不推荐直接使用这个模式，因为现有的大多数转换工具都无法完整保留原始层级。更推荐先使用我们的 [PageIndex OCR](https://pageindex.ai/blog/ocr) 把 PDF 转为能保留层级的 Markdown，再使用这个模式。
</details>

## Agentic Vectorless RAG：示例

如果你想看一个简单、端到端的 _**agentic vectorless RAG**_ 示例，使用 PageIndex 配合 OpenAI Agents SDK，请查看 [`examples/agentic_vectorless_rag_demo.py`](examples/agentic_vectorless_rag_demo.py)。

```bash
# 安装可选依赖
pip3 install openai-agents

# 运行示例
python3 examples/agentic_vectorless_rag_demo.py
```

<!--
# ☁️ 借助 PageIndex OCR 提升树结构生成效果

这个仓库适合为简单 PDF 生成 PageIndex 树结构，但在很多真实场景中，PDF 往往更复杂，使用传统 Python 工具并不容易解析。高质量地从 PDF 中抽取文本本身就不是一件简单的事。多数 OCR 工具只能提取页级内容，丢失更高层级的全局结构与层次关系。

为了解决这个问题，我们推出了 PageIndex OCR —— 首个专门为保留文档全局结构而设计的长上下文 OCR 模型。PageIndex OCR 在识别真实层级关系和跨页语义结构方面显著优于其他主流 OCR 工具，例如 Mistral 和 Contextual AI 的方案。

- 在我们的 [Dashboard](https://dash.pageindex.ai/) 中体验更高质量的 OCR。
- 通过我们的 [API](https://docs.pageindex.ai/quickstart) 将 PageIndex OCR 无缝集成到你的工作流中。

<p align="center">
  <img src="https://github.com/user-attachments/assets/eb35d8ae-865c-4e60-a33b-ebbd00c41732" width="80%">
</p>
-->

---

# 📈 案例研究：PageIndex 在金融问答基准中领先

[Mafin 2.5](https://vectify.ai/mafin) 是一个面向金融文档分析的基于推理的 RAG 系统，由 **PageIndex** 提供支持。它在 [FinanceBench](https://arxiv.org/abs/2311.11944) 基准上取得了最先进的 [**98.7% 准确率**](https://vectify.ai/blog/Mafin2.5)，显著优于传统基于向量的 RAG 系统。

PageIndex 的层级化索引和推理驱动检索，使其能够精确导航并提取复杂财务报告中的相关上下文，例如 SEC 文件和财报披露。

查看完整的[基准结果](https://github.com/VectifyAI/Mafin2.5-FinanceBench)以及我们的[博客文章](https://vectify.ai/blog/Mafin2.5)，了解更详细的对比与性能指标。

<div align="center">
  <a href="https://github.com/VectifyAI/Mafin2.5-FinanceBench">
    <img src="https://github.com/user-attachments/assets/571aa074-d803-43c7-80c4-a04254b782a3" width="70%">
  </a>
</div>

---

# 🧭 资源

* 📝 [博客](https://pageindex.ai/blog)：技术文章、研究洞察与产品更新。
* 🔧 [开发者页面](https://pageindex.ai/developer)：MCP 配置、API 文档与集成指南。
* 🧪 [Cookbook](https://docs.pageindex.ai/cookbook)：可运行的上手示例与进阶用法。
* 📖 [教程](https://docs.pageindex.ai/tutorials)：实用指南与策略，包括 *Document Search* 和 *Tree Search*。

---

# ⭐ 支持我们

如果你喜欢这个项目，欢迎给我们点个 Star 🌟，谢谢支持！  

<p>
  <img src="https://github.com/user-attachments/assets/eae4ff38-48ae-4a7c-b19f-eab81201d794" width="80%">
</p>

如需引用本工作，请使用：
```
Mingtian Zhang, Yu Tang and PageIndex Team,
"PageIndex: Next-Generation Vectorless, Reasoning-based RAG",
PageIndex Blog, Sep 2025.
```

<details>
<summary>或使用 BibTeX 引用。</summary>

```bibtex
@article{zhang2025pageindex,
  author = {Mingtian Zhang and Yu Tang and PageIndex Team},
  title = {PageIndex: Next-Generation Vectorless, Reasoning-based RAG},
  journal = {PageIndex Blog},
  year = {2025},
  month = {September},
  note = {https://pageindex.ai/blog/pageindex-intro},
}
```
</details>


### 联系我们

<div align="center">

[![Twitter](https://img.shields.io/badge/Twitter-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/PageIndexAI)&ensp;
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/company/vectify-ai/)&ensp;
[![Discord](https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.com/invite/VuXuf29EUj)&ensp;
[![Contact Us](https://img.shields.io/badge/Contact_Us-3B82F6?style=for-the-badge&logo=envelope&logoColor=white)](https://ii2abc2jejf.typeform.com/to/tK3AXl8T)

</div>

---

© 2026 [Vectify AI](https://vectify.ai)
