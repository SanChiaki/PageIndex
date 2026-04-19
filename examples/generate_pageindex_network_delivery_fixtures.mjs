#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const outputRoot = path.join(
  repoRoot,
  "examples",
  "documents",
  "pageindex-network-delivery",
);
const markdownDir = path.join(outputRoot, "markdown");
const htmlDir = path.join(outputRoot, "html");
const pdfDir = path.join(outputRoot, "pdf");

const today = "2026-04-16";

const project = {
  name: "第五元素园区网络改造项目",
  location: "苏州工业园区第五元素园区",
  owner: "第五元素园区管理委员会信息化部",
  contractor: "星炬网络系统集成有限公司",
  period: "2026-05-06 至 2026-07-18",
  maintenance: "2026-07-19 至 2027-07-18",
  summary:
    "本项目面向园区办公楼、研发楼、展示中心与运维机房，完成核心、汇聚、接入、无线、安全与运维体系的整体改造。",
  baseline:
    "现网存在核心设备老化、楼层接入链路无统一标识、无线漫游抖动、访客网络与办公网络隔离不彻底、日志留存不完整等问题。",
  scopeHighlights: [
    "替换 2 台核心交换机、6 台汇聚交换机、28 台接入交换机。",
    "上线 1 套无线控制器，纳管 136 个室内 AP 与 18 个室外 AP。",
    "新增双机热备防火墙 2 套，统一互联网出口、访客网与第三方接入策略。",
    "补齐 DHCP、DNS、NTP、日志审计与配置备份链路，建立统一运维基线。",
  ],
  milestones: [
    ["需求冻结", "2026-05-06", "完成范围确认、图纸冻结与设备下单"],
    ["到货验收", "2026-05-20", "完成设备、辅材与标签模板验收"],
    ["现场实施", "2026-05-23", "完成机柜整改、布线梳理与设备上架"],
    ["核心割接", "2026-06-13", "完成双核心替换、路由与策略迁移"],
    ["无线优化", "2026-06-27", "完成功率、信道、漫游与门禁联调"],
    ["终验移交", "2026-07-18", "完成 KPI 验证、培训与运维移交"],
  ],
};

function p(text) {
  return { type: "paragraph", text };
}

function bullets(items) {
  return { type: "bullets", items };
}

function numbered(items) {
  return { type: "numbered", items };
}

function table(headers, rows) {
  return { type: "table", headers, rows };
}

function note(text) {
  return { type: "note", text };
}

function docInfoSection(doc) {
  return {
    title: "项目概览",
    blocks: [
      p(project.summary),
      table(
        ["字段", "内容"],
        [
          ["项目名称", project.name],
          ["文档标题", doc.title],
          ["文档编号", doc.docCode],
          ["发布日期", today],
          ["版本", doc.version ?? "V1.0"],
          ["编制角色", doc.owner],
          ["建设地点", project.location],
          ["建设周期", project.period],
          ["维保周期", project.maintenance],
        ],
      ),
    ],
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeMdCell(value) {
  return String(value).replaceAll("|", "\\|");
}

function renderBlockMarkdown(block) {
  if (block.type === "paragraph") {
    return `${block.text}\n`;
  }

  if (block.type === "bullets") {
    return `${block.items.map((item) => `- ${item}`).join("\n")}\n`;
  }

  if (block.type === "numbered") {
    return `${block.items
      .map((item, index) => `${index + 1}. ${item}`)
      .join("\n")}\n`;
  }

  if (block.type === "table") {
    const header = `| ${block.headers.map(escapeMdCell).join(" | ")} |`;
    const divider = `| ${block.headers.map(() => "---").join(" | ")} |`;
    const rows = block.rows.map(
      (row) => `| ${row.map(escapeMdCell).join(" | ")} |`,
    );
    return `${[header, divider, ...rows].join("\n")}\n`;
  }

  if (block.type === "note") {
    return `> ${block.text}\n`;
  }

  throw new Error(`Unsupported markdown block type: ${block.type}`);
}

function renderSectionMarkdown(section, level = 2) {
  const heading = `${"#".repeat(level)} ${section.title}`;
  const blockOutput = (section.blocks ?? [])
    .map((block) => renderBlockMarkdown(block).trimEnd())
    .join("\n\n");
  const subsectionOutput = (section.sections ?? [])
    .map((child) => renderSectionMarkdown(child, level + 1))
    .join("\n\n");
  return [heading, blockOutput, subsectionOutput]
    .filter((part) => part && part.trim().length > 0)
    .join("\n\n");
}

function renderBlockHtml(block) {
  if (block.type === "paragraph") {
    return `<p>${escapeHtml(block.text)}</p>`;
  }

  if (block.type === "bullets") {
    const items = block.items
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  }

  if (block.type === "numbered") {
    const items = block.items
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");
    return `<ol>${items}</ol>`;
  }

  if (block.type === "table") {
    const header = block.headers
      .map((item) => `<th>${escapeHtml(item)}</th>`)
      .join("");
    const rows = block.rows
      .map(
        (row) =>
          `<tr>${row
            .map((item) => `<td>${escapeHtml(item)}</td>`)
            .join("")}</tr>`,
      )
      .join("");
    return `<table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  if (block.type === "note") {
    return `<div class="note">${escapeHtml(block.text)}</div>`;
  }

  throw new Error(`Unsupported html block type: ${block.type}`);
}

function renderSectionHtml(section, level = 2) {
  const headingTag = `h${Math.min(level, 6)}`;
  const blocks = (section.blocks ?? []).map(renderBlockHtml).join("\n");
  const children = (section.sections ?? [])
    .map((child) => renderSectionHtml(child, level + 1))
    .join("\n");

  return `
    <section class="doc-section depth-${level}">
      <${headingTag}>${escapeHtml(section.title)}</${headingTag}>
      ${blocks}
      ${children}
    </section>
  `;
}

function renderMarkdown(doc) {
  const intro = [
    `# ${project.name} - ${doc.title}`,
    "",
    `> 文档编号：${doc.docCode}  |  版本：${doc.version ?? "V1.0"}  |  编制角色：${doc.owner}`,
    "",
    doc.abstract,
    "",
  ].join("\n");

  const sections = [docInfoSection(doc), ...doc.sections]
    .map((section) => renderSectionMarkdown(section))
    .join("\n\n");

  return `${intro}${sections}\n`;
}

function renderHtml(doc) {
  const sections = [docInfoSection(doc), ...doc.sections]
    .map((section) => renderSectionHtml(section))
    .join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(project.name)} - ${escapeHtml(doc.title)}</title>
    <style>
      @page {
        size: A4;
        margin: 16mm 14mm 18mm;
      }

      :root {
        --ink: #172033;
        --muted: #5c6475;
        --line: #cfd7e3;
        --soft: #eef3f8;
        --brand: #0f5c78;
        --brand-soft: #d8ecf4;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        color: var(--ink);
        font-family: "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif;
        line-height: 1.68;
        font-size: 12px;
        word-break: break-word;
      }

      .cover {
        margin-bottom: 18px;
        padding: 16px 18px;
        border: 1px solid var(--line);
        border-radius: 14px;
        background:
          linear-gradient(135deg, rgba(216, 236, 244, 0.92), rgba(255, 255, 255, 0.98)),
          linear-gradient(160deg, rgba(15, 92, 120, 0.09), rgba(15, 92, 120, 0));
      }

      .eyebrow {
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--brand);
        margin-bottom: 8px;
      }

      h1 {
        margin: 0 0 8px;
        font-size: 24px;
        line-height: 1.3;
      }

      .cover-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 12px;
        color: var(--muted);
        margin: 10px 0 0;
      }

      .cover-meta span {
        padding: 4px 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.75);
        border: 1px solid rgba(15, 92, 120, 0.12);
      }

      p {
        margin: 0 0 10px;
      }

      ul,
      ol {
        margin: 0 0 10px 20px;
        padding: 0;
      }

      li + li {
        margin-top: 4px;
      }

      .doc-section {
        margin-bottom: 14px;
        page-break-inside: avoid;
      }

      h2,
      h3,
      h4,
      h5,
      h6 {
        color: var(--ink);
        page-break-after: avoid;
      }

      h2 {
        margin: 18px 0 8px;
        padding-bottom: 6px;
        border-bottom: 2px solid var(--brand-soft);
        font-size: 18px;
      }

      h3 {
        margin: 14px 0 8px;
        font-size: 15px;
      }

      h4 {
        margin: 12px 0 8px;
        font-size: 13px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin: 10px 0 14px;
        font-size: 11px;
      }

      th,
      td {
        border: 1px solid var(--line);
        padding: 7px 8px;
        vertical-align: top;
        text-align: left;
      }

      th {
        background: var(--soft);
        font-weight: 700;
      }

      .note {
        margin: 10px 0 14px;
        padding: 10px 12px;
        border-left: 4px solid var(--brand);
        background: rgba(216, 236, 244, 0.52);
        color: var(--ink);
      }
    </style>
  </head>
  <body>
    <header class="cover">
      <div class="eyebrow">Network Delivery Document</div>
      <h1>${escapeHtml(project.name)} - ${escapeHtml(doc.title)}</h1>
      <p>${escapeHtml(doc.abstract)}</p>
      <div class="cover-meta">
        <span>文档编号：${escapeHtml(doc.docCode)}</span>
        <span>版本：${escapeHtml(doc.version ?? "V1.0")}</span>
        <span>编制角色：${escapeHtml(doc.owner)}</span>
        <span>发布日期：${escapeHtml(today)}</span>
      </div>
    </header>
    ${sections}
  </body>
</html>`;
}

async function ensureDirectories() {
  for (const dir of [outputRoot, markdownDir, htmlDir, pdfDir]) {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function renderPdf(markdownPath, pdfPath) {
  const result = spawnSync(
    "/usr/sbin/cupsfilter",
    ["-m", "application/pdf", markdownPath],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  if (result.status !== 0) {
    throw new Error(
      `PDF export failed for ${path.basename(pdfPath)}: ${
        result.stderr?.toString("utf8") ||
        result.stdout?.toString("utf8") ||
        "unknown cupsfilter error"
      }`,
    );
  }

  if (!result.stdout || result.stdout.length === 0) {
    throw new Error(`PDF export failed for ${path.basename(pdfPath)}: empty output`);
  }

  await fs.writeFile(pdfPath, result.stdout);
}

const docs = [
  {
    slug: "01_project_overview_scope",
    docCode: "FE-NET-001",
    title: "项目总览与交付范围说明",
    owner: "交付经理",
    abstract:
      "本文档用于明确第五元素园区网络改造项目的建设背景、交付边界、关键里程碑与验收原则，作为后续设计、实施与终验的统一依据。",
    sections: [
      {
        title: "文档目的",
        blocks: [
          p(
            "本说明书聚焦本次网络改造交付边界，帮助业主、总包、集成商与运维团队对目标范围形成一致认知，并为实施排期与资源协调提供正式输入。",
          ),
          bullets([
            "定义本次项目覆盖的区域、系统、设备类别与交付成果。",
            "说明与弱电、机房、安防和应用系统之间的接口关系。",
            "明确验收基线、关键风险与依赖项，减少交付过程中的范围争议。",
          ]),
        ],
      },
      {
        title: "项目背景",
        blocks: [
          p(project.baseline),
          p(
            "园区过去三年逐步扩容，网络建设由不同供应商分期交付，导致地址规划、链路命名、无线策略和安全边界缺乏统一标准。随着研发办公区与展示接待区同时扩容，原有网络在稳定性、可视化和访问控制方面已无法满足当前运营需求。",
          ),
        ],
        sections: [
          {
            title: "改造触发因素",
            blocks: [
              bullets([
                "核心交换机平均在线时长超过七年，维护窗口内经常出现风扇与电源告警。",
                "楼层接入链路无统一命名，现场故障定位依赖个人经验，恢复时间不稳定。",
                "访客网与办公网通过历史 ACL 叠加实现隔离，策略复杂且存在例外规则。",
                "无线 AP 布局未随装修变化同步调整，会议区与展厅出现明显漫游抖动。",
              ]),
            ],
          },
          {
            title: "交付目标",
            blocks: [
              table(
                ["目标维度", "目标描述"],
                [
                  ["稳定性", "核心、出口与无线控制器均具备双机冗余，关键业务中断时间控制在 15 分钟内。"],
                  ["安全性", "实现办公、访客、IoT 与第三方运维网络的分区隔离，统一纳入日志审计。"],
                  ["可运维性", "形成资产台账、配置备份、巡检模板与培训手册，运维团队可独立执行日常变更。"],
                  ["可扩展性", "IP 地址、VLAN 与 PoE 容量预留至少 25%，满足未来两年办公区扩容。"],
                ],
              ),
            ],
          },
        ],
      },
      {
        title: "交付范围",
        blocks: [bullets(project.scopeHighlights)],
        sections: [
          {
            title: "本次纳入交付的系统边界",
            blocks: [
              bullets([
                "核心、汇聚、接入与无线网络硬件替换及配置迁移。",
                "互联网出口、访客认证、远程运维接入与基础安全策略梳理。",
                "机柜整理、跳线重构、标签标准化与关键链路冗余校验。",
                "监控、日志、配置备份、基础培训与维保衔接。",
              ]),
            ],
          },
          {
            title: "本次不包含内容",
            blocks: [
              bullets([
                "办公终端、打印机、视频会议终端与摄像头设备的集中换新。",
                "应用系统账号体系改造与身份源整合。",
                "园区广域网专线调整以及运营商公网链路合同变更。",
                "弱电竖井新增桥架施工与楼宇装修恢复工程。",
              ]),
            ],
          },
        ],
      },
      {
        title: "里程碑与主要交付件",
        blocks: [
          table(["里程碑", "计划日期", "说明"], project.milestones),
          table(
            ["交付件", "输出形式", "责任人"],
            [
              ["调研与差距分析报告", "Markdown/PDF", "售前架构师"],
              ["详细设计与实施方案", "Markdown/PDF", "网络架构师"],
              ["设备到货与资产验收记录", "Markdown/PDF", "仓储与实施主管"],
              ["割接方案、测试报告、终验报告", "Markdown/PDF", "交付经理"],
            ],
          ),
        ],
      },
      {
        title: "验收原则与项目依赖",
        blocks: [
          p(
            "项目以“功能完成、指标达标、资料齐套、运维可接手”为终验标准。若出现范围新增、现场条件不足或第三方系统配合延迟，应通过正式变更流程确认是否影响工期与验收。",
          ),
          bullets([
            "业主需在每次高风险窗口前完成应用冻结确认与业务联系人待命。",
            "物业与总包需保证机房、弱电井和重点楼层夜间可施工，且门禁权限提前开通。",
            "互联网与专线运营商需配合出口切换与链路健康检查。",
            "无线门禁与 IoT 设备厂商需在联调阶段共同验证兼容性。",
          ]),
          note(
            "若依赖项在计划日期前 48 小时仍未满足，交付经理有权提出延期建议，避免在条件不完整的情况下强行上线。",
          ),
        ],
      },
    ],
  },
  {
    slug: "02_site_survey_gap_analysis",
    docCode: "FE-NET-002",
    title: "网络现状调研与差距分析报告",
    owner: "售前架构师",
    abstract:
      "本文档汇总园区现网调研结果、典型故障征兆与容量评估结论，用于识别改造优先级并为详细设计提供依据。",
    sections: [
      {
        title: "调研方法与覆盖区域",
        blocks: [
          p(
            "调研采用“现场走查、配置导出、链路核对、无线热力图抽样、运维访谈”五步法，覆盖研发 A/B 楼、办公 C/D 楼、展示中心、主机房与两处弱电间。",
          ),
          table(
            ["调研活动", "覆盖内容", "输出"],
            [
              ["设备清点", "设备型号、序列号、板卡、光模块、PoE 余量", "资产草表与到货对比基线"],
              ["配置审计", "VLAN、STP、OSPF、ACL、DHCP、NTP", "配置差异清单"],
              ["无线抽测", "覆盖、漫游、并发、信道重叠", "热点区域热力图描述"],
              ["运维访谈", "故障痛点、值班流程、变更记录", "问题场景与恢复时间样本"],
            ],
          ),
        ],
      },
      {
        title: "现网主要发现",
        sections: [
          {
            title: "核心与汇聚层",
            blocks: [
              p(
                "主机房双核心设备采用早期型号，虽然仍维持双机互联，但板卡资源紧张，VRRP、OSPF 与静态路由共存，存在历史策略残留。汇聚设备由三批次不同型号组成，接口命名与 Trunk 允许 VLAN 列表缺乏统一规范。",
              ),
              bullets([
                "核心 CPU 峰值利用率在工作日午后达到 72%，广播风暴抑制参数未统一。",
                "研发 A 楼与展示中心汇聚上联仍有单链路场景，未达到当前冗余标准。",
                "部分楼层交换机启用了生成树边缘口，但未同步开启环路保护与 BPDU Guard。",
              ]),
            ],
          },
          {
            title: "接入与无线层",
            blocks: [
              p(
                "接入层交换机端口使用率分布不均，部分会议区 PoE 供电已接近上限。无线网络沿用旧 SSID 策略，访客、办公与 IoT 广播域边界不清，且 AP 安装位置与最新工位布局不完全匹配。",
              ),
              bullets([
                "36 个抽样 AP 中有 11 个在午高峰出现信道重叠，5GHz 资源利用不足。",
                "展厅与大会议室的漫游切换时间波动较大，最差样本达到 560ms。",
                "门禁、投屏与打印等物联网终端混入办公地址池，影响故障定位与访问控制。",
              ]),
            ],
          },
          {
            title: "安全与运维体系",
            blocks: [
              p(
                "互联网出口策略存在大量历史放通项，命名规则不统一；日志平台仅保留关键设备系统日志，未覆盖策略变更与认证日志。配置备份依赖人工导出，无法满足快速回退与审计要求。",
              ),
              bullets([
                "防火墙对象与策略条目存在重复命名，跨系统端口放通审批链不完整。",
                "访客网认证页由第三方维护，但失败告警未对接园区值班群组。",
                "周巡检仅关注链路 Up/Down，缺少 CPU、温度、PoE、日志量等阈值检查。",
              ]),
            ],
          },
        ],
      },
      {
        title: "差距分析",
        blocks: [
          table(
            ["问题类别", "现场证据", "业务影响", "建议优先级"],
            [
              ["核心稳定性", "老旧核心设备告警频繁，板卡余量不足", "一旦故障将影响全园区办公与门禁", "高"],
              ["无线体验", "会议区高密场景吞吐下降、漫游抖动", "影响视频会议与访客接待", "高"],
              ["安全边界", "访客、办公、IoT ACL 累积叠加", "存在误放通与策略回归风险", "高"],
              ["可运维性", "资产信息与配置备份不完整", "故障恢复依赖个别人员经验", "中高"],
              ["容量规划", "PoE 与地址池剩余不足", "扩容时容易触发局部瓶颈", "中"],
            ],
          ),
          p(
            "综合评估后，项目应优先解决影响业务连续性的核心、出口与无线高风险问题，同时在改造过程中将资产、命名、日志与备份能力一次性补齐，否则交付后仍会在运维阶段反复暴露历史隐患。",
          ),
        ],
      },
      {
        title: "优先级建议与调研结论",
        sections: [
          {
            title: "优先级建议",
            blocks: [
              numbered([
                "第一优先级：完成核心双机、出口防火墙与无线控制器的统一替换，先消除全局风险点。",
                "第二优先级：重构 VLAN、地址规划、链路命名与配置备份机制，保证改造后可运维。",
                "第三优先级：通过无线优化和 IoT 分区治理，提升会议场景与展厅场景的体验一致性。",
              ]),
            ],
          },
          {
            title: "调研结论",
            blocks: [
              p(
                "第五元素园区现网仍可维持日常运行，但已经进入“业务增长快于网络治理”的阶段。如果继续沿用旧架构，未来六个月内较大概率出现局部扩容受阻、策略回归和跨楼层无线体验波动等问题。本次改造宜按统一架构、统一命名、统一验收的原则推进。",
              ),
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "03_detailed_design_implementation_plan",
    docCode: "FE-NET-003",
    title: "详细设计与实施方案",
    owner: "网络架构师",
    abstract:
      "本文档描述目标网络架构、地址与策略规划、实施步骤及回退原则，是现场实施和配置生成的直接依据。",
    sections: [
      {
        title: "设计原则",
        blocks: [
          bullets([
            "关键设备双机或双链路部署，核心路径不存在单点故障。",
            "地址、VLAN、SSID、设备命名与日志字段采用统一规范，便于自动化检索。",
            "办公、访客、IoT、运维与第三方接入网络严格分区，东西向与南北向访问均可审计。",
            "实施优先采用平滑迁移与窗口切换方案，尽量避免工作日中断。",
          ]),
        ],
      },
      {
        title: "目标架构",
        sections: [
          {
            title: "核心与汇聚架构",
            blocks: [
              p(
                "主机房部署两台核心交换机组成虚拟化双机，所有汇聚设备通过双上联接入核心，业务网关上移到核心层统一维护。展示中心与研发 A 楼保留本地汇聚，其他楼层接入直接双归到楼宇汇聚。",
              ),
              table(
                ["层级", "设备角色", "关键设计点"],
                [
                  ["核心层", "双核心交换机", "承担三层网关、动态路由、堆叠心跳与网段汇总"],
                  ["汇聚层", "楼宇汇聚交换机", "承载楼层接入汇总、环路保护与链路冗余"],
                  ["接入层", "PoE/非 PoE 接入交换机", "终端接入、端口模板、边缘安全与广播控制"],
                ],
              ),
            ],
          },
          {
            title: "无线与出口架构",
            blocks: [
              p(
                "无线控制器部署在主机房，采用双链路接入核心；所有 AP 按办公、访客、IoT 三类业务模板统一下发。双机热备防火墙承担互联网出口、访客认证回源与远程运维 VPN 接入，日志统一送往审计平台。",
              ),
              bullets([
                "办公 SSID 采用 802.1X 认证，访客 SSID 对接短信或企业微信访客登记。",
                "IoT SSID 与有线 IoT VLAN 统一纳入专用安全域，只放通必要上游接口。",
                "出口链路切换采用策略路由与健康检测联动，避免单运营商抖动影响办公网。",
              ]),
            ],
          },
        ],
      },
      {
        title: "地址、VLAN 与 SSID 规划",
        blocks: [
          table(
            ["业务域", "VLAN", "网段", "接入方式", "说明"],
            [
              ["办公有线", "110-139", "10.26.110.0/23 至 10.26.139.0/24", "有线接入", "按楼层与办公区拆分，预留扩容"],
              ["办公无线", "210", "10.26.210.0/23", "SSID: FE-Office", "统一认证，支持跨楼层漫游"],
              ["访客无线", "220", "10.26.220.0/23", "SSID: FE-Guest", "仅放通互联网与访客门户"],
              ["IoT 设备", "310-315", "10.26.310.0/24 至 10.26.315.0/24", "有线/无线混合", "门禁、打印、投屏等设备独立管理"],
              ["运维管理", "410", "10.26.410.0/24", "运维终端与跳板机", "仅授权管理员可进入"],
            ],
          ),
          note(
            "所有地址池预留不少于 25% 的可用空间；核心层统一配置 DHCP Relay、NTP 与 DNS 指向，禁止楼层侧私设地址服务。",
          ),
        ],
      },
      {
        title: "实施步骤与回退原则",
        sections: [
          {
            title: "实施前准备",
            blocks: [
              numbered([
                "完成配置模板冻结、端口映射表确认与设备命名复核。",
                "在实验环境完成核心、汇聚、出口与无线控制器的联调抽测。",
                "将回退配置、原网导出文件和现场通信录同步到值守笔记本与共享目录。",
              ]),
            ],
          },
          {
            title: "现场实施顺序",
            blocks: [
              numbered([
                "先整理机柜、替换理线与标签，再完成新设备上架和链路预插接。",
                "先完成新网络平行上线与管理面验证，再执行窗口内网关切换。",
                "窗口结束前完成业务验证、监控检查与备份留档。",
              ]),
            ],
          },
          {
            title: "回退触发条件",
            blocks: [
              bullets([
                "核心双机堆叠或心跳异常且 20 分钟内无法恢复。",
                "关键业务网段网关切换后无法在 15 分钟内恢复通信。",
                "无线控制器纳管失败导致办公无线不可用超过 30% 区域。",
                "出口切换后 VPN、访客认证或门禁云平台连续验证失败。",
              ]),
            ],
          },
        ],
      },
      {
        title: "设计确认项",
        blocks: [
          p(
            "详细设计提交评审前，需由业主信息化部确认地址规划与安全分区，由物业确认机房供电与上架条件，由弱电总包确认标签编号与布线改造范围。所有确认项应在设计版次中显式体现，避免现场临时调整。",
          ),
        ],
      },
    ],
  },
  {
    slug: "04_asset_arrival_acceptance",
    docCode: "FE-NET-004",
    title: "设备到货与资产验收记录",
    owner: "实施主管",
    abstract:
      "本文档记录本项目硬件设备、辅材与随机资料的到货验收结果，作为后续上架施工和质保追溯依据。",
    sections: [
      {
        title: "验收范围与依据",
        blocks: [
          p(
            "本次到货验收覆盖核心交换机、汇聚与接入交换机、无线控制器、AP、防火墙、光模块、配线附件及标签耗材。验收依据包括采购清单、装箱单、序列号表、外包装检查规范和厂商质保条款。",
          ),
          bullets([
            "先做数量与箱单核对，再做外观与配件核验，最后完成上电抽检。",
            "所有序列号应与资产模板绑定，未绑定设备不得直接进入上架环节。",
            "发现损伤、短缺或序列号不一致时，须在 24 小时内形成异常单。",
          ]),
        ],
      },
      {
        title: "到货清单总览",
        blocks: [
          table(
            ["设备类别", "计划数量", "实收数量", "抽检比例", "结果"],
            [
              ["核心交换机", "2", "2", "100%", "通过"],
              ["汇聚交换机", "6", "6", "50%", "通过"],
              ["接入交换机", "28", "28", "30%", "通过"],
              ["无线控制器", "1", "1", "100%", "通过"],
              ["室内 AP", "136", "136", "10%", "通过"],
              ["室外 AP", "18", "18", "20%", "通过"],
              ["防火墙", "4", "4", "100%", "通过"],
              ["光模块与辅材", "若干", "齐套", "抽样", "通过"],
            ],
          ),
        ],
      },
      {
        title: "核验记录",
        sections: [
          {
            title: "外观与配件核验",
            blocks: [
              bullets([
                "包装箱无明显挤压、破损和二次封箱痕迹，设备铭牌清晰可辨。",
                "随机电源线、安装导轨、控制台线、说明书与质保卡齐全。",
                "核心与防火墙设备备件标签完整，双电源序列号与箱单一致。",
              ]),
            ],
          },
          {
            title: "序列号与资产标签核验",
            blocks: [
              table(
                ["抽样设备", "序列号状态", "资产标签状态", "备注"],
                [
                  ["核心交换机 A", "一致", "已绑定 FE-CORE-01", "通过"],
                  ["核心交换机 B", "一致", "已绑定 FE-CORE-02", "通过"],
                  ["汇聚交换机 A1", "一致", "已绑定 FE-DIST-A1", "通过"],
                  ["防火墙主设备", "一致", "已绑定 FE-FW-01", "通过"],
                ],
              ),
            ],
          },
          {
            title: "上电抽检",
            blocks: [
              p(
                "对核心交换机、防火墙和控制器执行全量上电，对汇聚、接入与 AP 执行抽样上电。检查项目包括启动自检、风扇与电源告警、管理口登录、版本显示与基础接口状态。",
              ),
              bullets([
                "抽检设备全部通过基础上电检查，未发现硬件告警。",
                "一台室内 AP 包装箱标签印刷偏差，但设备序列号与资产表一致，不影响使用。",
              ]),
            ],
          },
        ],
      },
      {
        title: "异常处理与结论",
        blocks: [
          p(
            "本次到货验收未发现影响实施计划的重大异常。针对标签印刷偏差和两件辅材缺少批次贴纸的问题，已在仓储台账中记录并由供应商补充确认函，不影响后续上架与质保追溯。",
          ),
          note(
            "设备未完成资产绑定前不得出库到现场楼层；如需提前上架，必须由实施主管与资产管理员双签确认。",
          ),
        ],
      },
    ],
  },
  {
    slug: "05_construction_change_management",
    docCode: "FE-NET-005",
    title: "施工组织与变更管理计划",
    owner: "交付经理",
    abstract:
      "本文档定义现场施工组织、作业规范、沟通机制和变更审批流程，确保网络改造过程可控、可追溯、可回退。",
    sections: [
      {
        title: "施工组织架构",
        blocks: [
          table(
            ["角色", "职责", "现场要求"],
            [
              ["交付经理", "统筹计划、窗口申请、风险控制与业主沟通", "全程值守高风险窗口"],
              ["网络架构师", "配置审核、技术决策、疑难问题处理", "关键节点到场确认"],
              ["实施工程师", "设备上架、布线整理、配置下发与联调", "按楼层划片负责"],
              ["资产管理员", "设备出入库、序列号绑定、标签发放", "每日更新台账"],
              ["业主代表", "业务确认、窗口审批、跨部门协调", "验收节点签字"],
            ],
          ),
        ],
      },
      {
        title: "现场管理要求",
        sections: [
          {
            title: "进场与作业控制",
            blocks: [
              bullets([
                "所有施工人员须提前一天提交进场名单、身份证明与作业时间。",
                "机房及弱电井施工采用双人作业制，夜间施工须保留现场签到记录。",
                "拆旧与新装不得交叉进行，核心窗口前 2 小时内禁止新增临时变更。",
              ]),
            ],
          },
          {
            title: "线缆与标签规范",
            blocks: [
              bullets([
                "跳线采用颜色区分管理面、上联链路、业务链路与测试链路。",
                "每一端口、配线架和面板标签应与端口映射表保持一致，禁止手写临时名称长期保留。",
                "拆除旧链路前须先拍照并记录原端口关系，确保回退时可快速复原。",
              ]),
            ],
          },
          {
            title: "高风险作业管控",
            blocks: [
              bullets([
                "核心、出口、防火墙与无线控制器变更均视为高风险作业，需单独审批。",
                "高风险窗口必须同步准备回退配置、USB 启动介质和带外管理链路。",
                "窗口开始后每 30 分钟向沟通群播报一次进展，发现异常立即升级。",
              ]),
            ],
          },
        ],
      },
      {
        title: "变更流程",
        blocks: [
          p(
            "所有超出既定详细设计的配置调整、时间变更或范围新增，均需纳入正式变更流程。轻微标签调整或不影响业务的备注修正可在日报中备案，无需单独立项。",
          ),
          table(
            ["变更等级", "示例", "审批要求", "通知范围"],
            [
              ["一级", "核心割接时间调整、地址规划变更", "业主负责人 + 交付经理审批", "全项目组"],
              ["二级", "楼层施工顺序调整、AP 点位微调", "交付经理审批", "相关楼层负责人"],
              ["三级", "文档错字修订、标签补录", "实施主管备案", "项目资料组"],
            ],
          ),
        ],
        sections: [
          {
            title: "变更闭环要求",
            blocks: [
              numbered([
                "提交变更申请，说明背景、风险、影响范围与回退方案。",
                "评估是否影响窗口、工期、材料、业务与终验指标。",
                "审批通过后同步更新计划、图纸、端口表与值班清单。",
                "变更实施后 24 小时内补齐验证记录和结果说明。",
              ]),
            ],
          },
        ],
      },
      {
        title: "周计划与沟通机制",
        blocks: [
          p(
            "项目采用“周计划 + 日站会 + 窗口复盘”机制。每周一发布三周滚动计划，每日施工前后各进行一次简短对齐，高风险窗口结束后形成复盘记录和待办闭环。",
          ),
          bullets([
            "周计划包含楼层范围、设备清单、风险项、依赖条件和责任人。",
            "日报需说明完成情况、未完成原因、次日计划和需协调事项。",
            "窗口复盘需沉淀成功经验、异常触发点和后续优化建议。",
          ]),
        ],
      },
    ],
  },
  {
    slug: "06_core_cutover_plan",
    docCode: "FE-NET-006",
    title: "核心网络割接方案",
    owner: "网络架构师",
    abstract:
      "本文档用于指导核心交换机、网关与出口相关配置的正式割接，明确窗口步骤、验证动作、回退条件与应急分工。",
    sections: [
      {
        title: "割接目标与窗口范围",
        blocks: [
          p(
            "本次窗口计划在 2026 年 6 月 13 日 22:00 至 2026 年 6 月 14 日 04:00 完成双核心替换、楼宇汇聚上联切换、网关迁移、出口联动验证及无线控制器重新注册。",
          ),
          bullets([
            "目标是在不改变终端地址的前提下完成三层网关上移与策略统一。",
            "窗口结束前必须恢复办公、访客、IoT、门禁云平台、打印服务与远程运维访问。",
            "若核心链路、网关或出口任一环节未达标，应在窗口内完成回退。",
          ]),
        ],
      },
      {
        title: "割接前提条件",
        blocks: [
          bullets([
            "新核心、防火墙和无线控制器已在实验环境完成版本核对与互通验证。",
            "所有楼宇汇聚端口映射表、链路标签、光模块插位与序列号已复核。",
            "旧核心配置、运行状态截图、日志与备份文件已落地保存到两份介质。",
            "业主业务窗口通知已发出，关键业务联系人与厂商支持均处于待命状态。",
          ]),
        ],
      },
      {
        title: "详细割接步骤",
        blocks: [
          table(
            ["时刻", "执行动作", "责任人", "验证要点"],
            [
              ["21:30", "现场签到、设备健康检查、回退资料确认", "交付经理", "通信录、配置包、带外链路齐备"],
              ["22:00", "冻结变更、断开旧核心非关键链路", "网络架构师", "确认业务已进入窗口状态"],
              ["22:20", "接入新核心并建立核心双机关系", "实施工程师", "堆叠/虚拟化状态正常"],
              ["23:00", "迁移汇聚上联与网关配置", "网络架构师", "关键 VLAN 网关与 ARP 正常"],
              ["00:10", "切换防火墙互联与出口策略", "安全工程师", "互联网、VPN、访客门户可用"],
              ["01:10", "无线控制器重新注册并抽测 SSID", "无线工程师", "办公、访客、IoT 终端可连接"],
              ["02:00", "全量业务验证与监控观察", "联合值守", "门禁、打印、业务系统连通"],
              ["03:30", "归档日志、导出配置、宣布窗口结束", "交付经理", "所有验证项闭环"],
            ],
          ),
        ],
        sections: [
          {
            title: "关键验证动作",
            blocks: [
              numbered([
                "从核心与汇聚查看链路聚合、邻居状态、网关与地址池工作是否正常。",
                "从办公、访客、IoT 三类终端分别验证 DHCP、DNS、内外网访问与策略隔离。",
                "在展厅与会议区完成无线漫游、投屏、门禁与视频会议抽测。",
                "检查日志平台、监控平台和配置备份任务是否恢复并产生新记录。",
              ]),
            ],
          },
        ],
      },
      {
        title: "回退条件与应急分工",
        blocks: [
          table(
            ["触发条件", "回退动作", "负责人"],
            [
              ["核心双机异常持续超过 20 分钟", "恢复旧核心上联，回灌旧配置并恢复原网关", "网络架构师"],
              ["出口切换后互联网与 VPN 同时失败", "断开新出口，恢复旧防火墙与原路由策略", "安全工程师"],
              ["无线控制器注册失败导致大面积无线不可用", "恢复旧控制器业务 VLAN 与 AP 纳管关系", "无线工程师"],
              ["任一关键业务未在 03:00 前恢复", "启动整体验证回退，放弃本次窗口", "交付经理"],
            ],
          ),
          note(
            "回退并不视为交付失败，但必须在 24 小时内完成原因复盘、配置差异比对与二次窗口建议。",
          ),
        ],
      },
    ],
  },
  {
    slug: "07_wireless_optimization_test_report",
    docCode: "FE-NET-007",
    title: "无线网络优化与测试报告",
    owner: "无线工程师",
    abstract:
      "本文档记录无线网络优化动作、抽测方法与 KPI 结果，用于验证会议区、展厅和办公区的覆盖与漫游质量是否达到交付标准。",
    sections: [
      {
        title: "测试范围与环境",
        blocks: [
          p(
            "测试覆盖研发 A/B 楼会议区、办公 C/D 楼开放办公区、展示中心、食堂前厅及主入口外广场。抽测时间包含工作日上午、午高峰和傍晚访客较多时段，终端包含 Windows 笔记本、iPhone、Android 工牌机和投屏盒子。",
          ),
          table(
            ["测试类型", "工具/方式", "说明"],
            [
              ["覆盖测试", "现场走测 + 热力图抽样", "验证主区域 RSSI、弱覆盖与重叠覆盖"],
              ["吞吐测试", "内网服务器 + 互联网双向测速", "验证上下行吞吐与抖动"],
              ["漫游测试", "视频会议 + 语音通话连续移动", "观察切换时延与丢包"],
              ["认证测试", "办公、访客、IoT 三类终端", "验证认证时延与策略隔离"],
            ],
          ),
        ],
      },
      {
        title: "优化动作",
        sections: [
          {
            title: "信道与功率优化",
            blocks: [
              bullets([
                "将高密区域优先收敛到 5GHz，减少 2.4GHz 过度重叠。",
                "对展厅与大会议室 AP 进行低功率精细调优，避免远距离黏连。",
                "对大厅和走廊 AP 采用错层信道策略，降低同层干扰。",
              ]),
            ],
          },
          {
            title: "漫游与认证优化",
            blocks: [
              bullets([
                "办公 SSID 启用快速漫游与邻居列表优化，缩短切换时间。",
                "访客 SSID 优化 Portal 回源路径，减少认证重定向耗时。",
                "IoT 模板关闭不必要的高级特性，提升低功耗终端兼容性。",
              ]),
            ],
          },
        ],
      },
      {
        title: "测试结果",
        blocks: [
          table(
            ["测试指标", "目标值", "实际结果", "判定"],
            [
              ["办公区 RSSI", "不少于 -65dBm", "-57dBm 至 -64dBm", "通过"],
              ["会议区 5GHz 覆盖", "弱覆盖点不超过 5%", "3.1%", "通过"],
              ["漫游切换时间", "不高于 150ms", "92ms 至 136ms", "通过"],
              ["办公无线下行吞吐", "不低于 300Mbps", "328Mbps 至 412Mbps", "通过"],
              ["访客认证时延", "不高于 8 秒", "4.3 秒至 6.2 秒", "通过"],
              ["IoT 在线稳定性", "连续 8 小时无大面积掉线", "未发现异常", "通过"],
            ],
          ),
          p(
            "优化后，高密区域的主观体验明显改善。视频会议在会议室内移动和跨楼层电梯口切换时保持稳定；展厅访客高峰时段仍能维持较好的访问成功率和页面加载速度。",
          ),
        ],
      },
      {
        title: "遗留问题与建议",
        blocks: [
          bullets([
            "食堂前厅因装修金属立面较多，局部角落仍有轻微反射影响，建议在后续装修完成后复测一次。",
            "入口外广场受园区外来热点影响较大，建议在重大活动前单独调整临时功率模板。",
            "访客门户仍依赖第三方短信通道，若出现运营商通道拥塞，需与应用方联合排查。",
          ]),
          note(
            "从整体结果看，无线网络已达到本项目交付标准，可作为终验输入；遗留项不影响现阶段正式上线。",
          ),
        ],
      },
    ],
  },
  {
    slug: "08_security_compliance_remediation",
    docCode: "FE-NET-008",
    title: "安全策略与合规整改交付报告",
    owner: "安全工程师",
    abstract:
      "本文档说明园区网络安全边界梳理、访问控制整改、日志留存补齐和合规映射结果，作为安全专项验收依据。",
    sections: [
      {
        title: "整改范围",
        blocks: [
          p(
            "安全整改覆盖互联网出口、防火墙策略库、访客认证、远程运维接入、办公与 IoT 分区、日志审计以及配置备份留痕。整改目标不是一次性堆叠策略，而是在保证业务可用的前提下建立可维护、可审计的安全基线。",
          ),
        ],
      },
      {
        title: "整改动作",
        sections: [
          {
            title: "边界策略治理",
            blocks: [
              bullets([
                "对历史策略按业务系统、源安全域、目标安全域和端口服务四维重新命名与归档。",
                "清理重复对象与过期放通规则，将临时策略单独标记并设置到期复核日期。",
                "将访客、办公、IoT 与第三方运维流量拆分到独立安全域，默认拒绝未授权访问。",
              ]),
            ],
          },
          {
            title: "认证与运维接入治理",
            blocks: [
              bullets([
                "办公无线启用 802.1X 认证并保留有限的访客旁路策略。",
                "远程运维统一收敛到 VPN 与跳板机，禁用历史直连暴露口。",
                "管理地址仅允许从运维网段访问，所有高权限操作必须留存日志。",
              ]),
            ],
          },
          {
            title: "日志与审计补齐",
            blocks: [
              bullets([
                "新增防火墙策略命中、认证日志、配置变更日志与设备告警日志采集。",
                "统一时间同步，保证审计日志与业务工单时间一致。",
                "配置备份纳入每日计划任务，保留最近 30 天版本。",
              ]),
            ],
          },
        ],
      },
      {
        title: "合规映射结果",
        blocks: [
          table(
            ["控制点", "整改措施", "交付状态"],
            [
              ["网络分区隔离", "办公、访客、IoT、运维独立 VLAN 与安全域", "已完成"],
              ["访问控制最小化", "边界策略重构，清理冗余规则", "已完成"],
              ["身份鉴别", "办公无线接入认证、远程运维 VPN 统一收敛", "已完成"],
              ["日志留存", "统一采集系统、策略、认证与变更日志", "已完成"],
              ["配置备份", "每日自动备份并定期核验恢复", "已完成"],
            ],
          ),
          p(
            "整改后，网络侧核心控制点已形成闭环，后续若需要面向更高等级的制度化审计，可在现有日志与备份体系上继续扩展账号审计和自动化基线校验。",
          ),
        ],
      },
      {
        title: "验证结果与残余风险",
        blocks: [
          bullets([
            "办公终端、IoT 终端与访客终端之间的隔离策略抽测通过，未发现横向误通。",
            "远程运维仅能通过 VPN 和跳板机进入，直接暴露口已下线。",
            "日志平台已收到边界、安全与认证三类日志，时间戳对齐正常。",
          ]),
          note(
            "残余风险主要来自第三方系统临时放通申请的持续积累。建议项目转维后按月审查临时策略，避免再次形成历史包袱。",
          ),
        ],
      },
    ],
  },
  {
    slug: "09_om_training_handover_manual",
    docCode: "FE-NET-009",
    title: "运维培训与知识转移手册",
    owner: "运维服务经理",
    abstract:
      "本文档面向园区运维团队，沉淀改造后网络的日常巡检、常见操作、故障定位思路和升级路径，确保项目结束后能够独立运维。",
    sections: [
      {
        title: "培训目标与对象",
        blocks: [
          p(
            "培训对象包括园区信息化部工程师、物业弱电值班人员和外包驻场人员。培训目标是让一线团队理解新网络的分区逻辑、掌握常见故障排查路径，并具备在受控范围内执行小规模变更的能力。",
          ),
          bullets([
            "了解核心、汇聚、接入、无线与安全设备的逻辑关系。",
            "掌握巡检表、资产台账、配置备份和告警平台的使用方法。",
            "熟悉常见操作，如新增端口、替换 AP、核查访客认证和恢复单链路故障。",
          ]),
        ],
      },
      {
        title: "培训议程",
        blocks: [
          table(
            ["模块", "时长", "重点内容"],
            [
              ["架构总览", "1.5 小时", "网络分层、地址规划、安全域与关键链路说明"],
              ["平台与台账", "1 小时", "监控、日志、备份、资产与标签台账使用"],
              ["日常运维", "2 小时", "巡检项、告警判断、常见变更操作"],
              ["故障演练", "2 小时", "出口异常、AP 离线、楼层接入中断的排查流程"],
              ["问答与交接", "0.5 小时", "开放问题、责任边界与维保联络方式"],
            ],
          ),
        ],
      },
      {
        title: "日常巡检与常见操作",
        sections: [
          {
            title: "日常巡检清单",
            blocks: [
              numbered([
                "检查核心、汇聚、防火墙与无线控制器是否存在硬件告警或主备异常。",
                "查看关键链路状态、CPU/内存、PoE 余量、AP 在线率与访客认证成功率。",
                "确认前一日配置备份是否完成，日志平台是否持续收到新数据。",
                "复核变更队列、临时策略到期项与当周维护窗口安排。",
              ]),
            ],
          },
          {
            title: "常见操作说明",
            blocks: [
              bullets([
                "新增办公工位时，优先从标准接入口模板开通，不得直接复制历史非标准端口。",
                "替换 AP 前先在资产台账中登记旧设备下线和新设备上线时间，再执行纳管校验。",
                "访客认证异常时，先判断是否为门户、短信通道、DHCP 或 DNS 问题，再决定升级。",
                "临时业务放通必须通过工单申请，由信息化部审批后再实施。",
              ]),
            ],
          },
          {
            title: "故障定位思路",
            blocks: [
              bullets([
                "先判断影响范围是单终端、单楼层、单业务域还是全园区，再逐层缩小范围。",
                "优先查看告警、链路与认证状态，不建议未经确认直接重启核心设备。",
                "涉及出口、门禁或访客门户时，应同步确认第三方系统状态，避免误判为网络故障。",
              ]),
            ],
          },
        ],
      },
      {
        title: "升级路径与交接要求",
        blocks: [
          table(
            ["事件等级", "示例", "响应要求", "升级对象"],
            [
              ["P1", "核心或出口全园区中断", "15 分钟内升级", "信息化负责人 + 厂商专家"],
              ["P2", "单楼层接入异常或无线大面积波动", "30 分钟内升级", "驻场工程师 + 集成商二线"],
              ["P3", "单终端、单 AP 或标签问题", "当天闭环", "驻场工程师"],
            ],
          ),
          note(
            "培训结束后应完成签到、问答记录、交接清单与满意度回收；未参加的值班人员须安排补训，否则不建议直接移交。",
          ),
        ],
      },
    ],
  },
  {
    slug: "10_final_acceptance_handover_report",
    docCode: "FE-NET-010",
    title: "项目终验与运维移交报告",
    owner: "交付经理",
    abstract:
      "本文档汇总项目完成情况、KPI 达成结果、遗留事项和运维移交结论，作为第五元素园区网络改造项目正式收尾依据。",
    sections: [
      {
        title: "终验范围",
        blocks: [
          p(
            "终验覆盖网络架构、硬件上线、地址与策略规划、生效测试、无线优化、安全整改、文档资料、培训交接和维保衔接八个方面。终验不只关注设备是否点亮，更关注是否达到项目目标、资料是否齐套以及运维团队是否可独立接手。",
          ),
        ],
      },
      {
        title: "完成情况总览",
        blocks: [
          table(
            ["交付模块", "目标", "完成情况", "状态"],
            [
              ["核心与汇聚改造", "完成双核心替换和汇聚双上联", "已按设计完成并稳定运行", "完成"],
              ["接入与无线整改", "完成 AP 纳管与高密区域优化", "抽测结果满足 KPI", "完成"],
              ["安全与日志体系", "完成分区隔离、策略梳理和日志补齐", "已纳入统一审计", "完成"],
              ["资料与培训", "形成台账、配置备份、手册和培训记录", "资料齐套，培训已完成", "完成"],
            ],
          ),
        ],
      },
      {
        title: "KPI 验证结果",
        blocks: [
          table(
            ["验收指标", "目标值", "最终结果", "结论"],
            [
              ["关键业务割接中断时间", "不超过 15 分钟", "12 分钟", "达标"],
              ["办公无线漫游时延", "不超过 150ms", "92ms 至 136ms", "达标"],
              ["访客认证成功率", "不少于 98%", "98.7%", "达标"],
              ["日志留存完整性", "覆盖关键设备与策略变更", "已全部覆盖", "达标"],
              ["运维团队接手能力", "可独立完成日常巡检与常见变更", "培训后演练通过", "达标"],
            ],
          ),
        ],
      },
      {
        title: "遗留事项与建议",
        blocks: [
          bullets([
            "食堂前厅与广场区域建议在装修和活动场景稳定后补做一次无线复测。",
            "第三方系统的临时放通策略需纳入月度审查，避免再次累积例外规则。",
            "建议在三个月内完成一次联合演练，验证运维团队对出口故障和 AP 批量离线场景的处置能力。",
          ]),
        ],
      },
      {
        title: "运维移交结论",
        blocks: [
          p(
            "经终验核查，第五元素园区网络改造项目已完成合同约定和双方确认的交付目标，相关文档、资产、配置备份、培训记录和维保联络信息已正式移交。项目建议进入质保运维阶段，由信息化部组织月度复盘，持续巩固改造成果。",
          ),
          table(
            ["移交项", "状态", "备注"],
            [
              ["资产台账", "已移交", "含序列号、位置、标签与责任人"],
              ["配置与备份", "已移交", "共享目录和本地备份双份保留"],
              ["监控与日志账号", "已移交", "按最小权限发放"],
              ["培训签到与手册", "已移交", "含补训计划"],
              ["维保联系人清单", "已移交", "含 7x24 升级路径"],
            ],
          ),
          note(
            "建议业主于 2026 年 10 月组织一次运行回访，检查策略漂移、地址池消耗和新增业务接入情况，确保交付成果长期稳定。",
          ),
        ],
      },
    ],
  },
];

async function writeReadme() {
  const lines = [
    "# PageIndex Network Delivery Fixtures",
    "",
    `本目录包含基于“${project.name}”生成的 10 份网络交付测试样本。`,
    "",
    "## 目录说明",
    "",
    "- `markdown/`: 10 份 Markdown 文档",
    "- `html/`: 打印中间产物，便于排查 PDF 排版",
    "- `pdf/`: 与 Markdown 对应的 10 份 PDF 文件",
    "",
    "## 重新生成",
    "",
    "```bash",
    "node examples/generate_pageindex_network_delivery_fixtures.mjs",
    "```",
    "",
    "## 文档清单",
    "",
    ...docs.map(
      (doc) => `- \`${doc.slug}\`: ${project.name} - ${doc.title}`,
    ),
    "",
  ];

  await fs.writeFile(path.join(outputRoot, "README.md"), lines.join("\n"), "utf8");
}

async function main() {
  await ensureDirectories();
  for (const doc of docs) {
    const markdown = renderMarkdown(doc);
    const html = renderHtml(doc);
    const mdPath = path.join(markdownDir, `${doc.slug}.md`);
    const htmlPath = path.join(htmlDir, `${doc.slug}.html`);
    const pdfPath = path.join(pdfDir, `${doc.slug}.pdf`);

    await fs.writeFile(mdPath, markdown, "utf8");
    await fs.writeFile(htmlPath, html, "utf8");
    await renderPdf(mdPath, pdfPath);
  }

  await writeReadme();

  console.log(`Generated ${docs.length} markdown files in ${markdownDir}`);
  console.log(`Generated ${docs.length} PDF files in ${pdfDir}`);
}

await main();
