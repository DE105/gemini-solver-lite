
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AnalysisResult, BoundingBox } from '../types';

interface AnalysisOverlayProps {
  imageBase64: string | null;
  imageDimensions?: { width: number; height: number } | null;
  result: AnalysisResult;
}

const BOX_SCALE = 1000;

const clampToBoxScale = (value: number): number => Math.min(BOX_SCALE, Math.max(0, value));

type BboxMode = 'raw' | 'letterbox' | 'fitMax' | 'cover';

type BoxScaleSource = 'unit' | 'percent' | 'norm1000' | 'pixel' | 'unknown';

type BboxModeSetting = 'auto' | BboxMode;

type BoxScaleOverride = Exclude<BoxScaleSource, 'unknown'>;

type BoxScaleSetting = 'auto' | BoxScaleOverride;

const orderBoundingBox = (box: BoundingBox): BoundingBox => {
  const xmin = Math.min(box.xmin, box.xmax);
  const xmax = Math.max(box.xmin, box.xmax);
  const ymin = Math.min(box.ymin, box.ymax);
  const ymax = Math.max(box.ymin, box.ymax);
  return { xmin, xmax, ymin, ymax };
};

const isBboxMode = (value: string): value is BboxMode =>
  value === 'raw' || value === 'letterbox' || value === 'fitMax' || value === 'cover';

const isBboxModeSetting = (value: string): value is BboxModeSetting => value === 'auto' || isBboxMode(value);

const isBoxScaleOverride = (value: string): value is BoxScaleOverride =>
  value === 'unit' || value === 'percent' || value === 'norm1000' || value === 'pixel';

const isBoxScaleSetting = (value: string): value is BoxScaleSetting =>
  value === 'auto' || isBoxScaleOverride(value);

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 忽略
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
};

const clampBoundingBox = (box: BoundingBox): BoundingBox => {
  const xmin = clampToBoxScale(box.xmin);
  const xmax = clampToBoxScale(box.xmax);
  const ymin = clampToBoxScale(box.ymin);
  const ymax = clampToBoxScale(box.ymax);
  return orderBoundingBox({ xmin, xmax, ymin, ymax });
};

const normalizeBoundingBoxScale = (
  boxes: BoundingBox[],
  imageDimensions: { width: number; height: number } | null,
  override: BoxScaleOverride | null = null,
): { boxes: BoundingBox[]; source: BoxScaleSource } => {
  if (boxes.length === 0) {
    return { boxes: [], source: 'unknown' };
  }

  if (override) {
    if (override === 'pixel') {
      if (!imageDimensions) {
        return { boxes: boxes.map(orderBoundingBox), source: 'unknown' };
      }

      return {
        boxes: boxes.map((box) =>
          orderBoundingBox({
            xmin: (box.xmin / imageDimensions.width) * BOX_SCALE,
            xmax: (box.xmax / imageDimensions.width) * BOX_SCALE,
            ymin: (box.ymin / imageDimensions.height) * BOX_SCALE,
            ymax: (box.ymax / imageDimensions.height) * BOX_SCALE,
          }),
        ),
        source: 'pixel',
      };
    }

    if (override === 'unit') {
      return {
        boxes: boxes.map((box) =>
          orderBoundingBox({
            xmin: box.xmin * BOX_SCALE,
            xmax: box.xmax * BOX_SCALE,
            ymin: box.ymin * BOX_SCALE,
            ymax: box.ymax * BOX_SCALE,
          }),
        ),
        source: 'unit',
      };
    }

    if (override === 'percent') {
      return {
        boxes: boxes.map((box) =>
          orderBoundingBox({
            xmin: box.xmin * 10,
            xmax: box.xmax * 10,
            ymin: box.ymin * 10,
            ymax: box.ymax * 10,
          }),
        ),
        source: 'percent',
      };
    }

    return { boxes: boxes.map(orderBoundingBox), source: 'norm1000' };
  }

  const maxCoord = Math.max(...boxes.map((box) => Math.max(box.xmin, box.xmax, box.ymin, box.ymax)));
  const minCoord = Math.min(...boxes.map((box) => Math.min(box.xmin, box.xmax, box.ymin, box.ymax)));

  // 后备：0-1 归一化
  const isZeroToOne = minCoord >= -0.1 && maxCoord <= 1.5;
  if (isZeroToOne) {
    return {
      boxes: boxes.map((box) =>
        orderBoundingBox({
          xmin: box.xmin * BOX_SCALE,
          xmax: box.xmax * BOX_SCALE,
          ymin: box.ymin * BOX_SCALE,
          ymax: box.ymax * BOX_SCALE,
        }),
      ),
      source: 'unit',
    };
  }

  // 后备：百分比 0-100
  const isPercent = minCoord >= -1 && maxCoord <= 100.5;
  if (isPercent) {
    return {
      boxes: boxes.map((box) =>
        orderBoundingBox({
          xmin: box.xmin * 10,
          xmax: box.xmax * 10,
          ymin: box.ymin * 10,
          ymax: box.ymax * 10,
        }),
      ),
      source: 'percent',
    };
  }

  const looksLikeNorm1000 = minCoord >= -50 && maxCoord <= BOX_SCALE * 1.2;

  // 像素坐标判定：需要避免把 0..1000 的方形坐标误判为像素坐标（尤其是原图尺寸大于 1000 时）。
  if (imageDimensions) {
    const maxXCoord = Math.max(...boxes.map((box) => Math.max(box.xmin, box.xmax)));
    const maxYCoord = Math.max(...boxes.map((box) => Math.max(box.ymin, box.ymax)));
    const pixelTolerance = 50;

    const withinPixelRange =
      maxXCoord <= imageDimensions.width + pixelTolerance &&
      maxYCoord <= imageDimensions.height + pixelTolerance &&
      maxCoord > 10;

    const clearlyPixel = withinPixelRange && (maxXCoord > BOX_SCALE * 1.2 || maxYCoord > BOX_SCALE * 1.2);
    if (clearlyPixel) {
      console.log('定位框坐标：判定为像素坐标，换算到 0-1000 归一化尺度');
      return {
        boxes: boxes.map((box) =>
          orderBoundingBox({
            xmin: (box.xmin / imageDimensions.width) * BOX_SCALE,
            xmax: (box.xmax / imageDimensions.width) * BOX_SCALE,
            ymin: (box.ymin / imageDimensions.height) * BOX_SCALE,
            ymax: (box.ymax / imageDimensions.height) * BOX_SCALE,
          }),
        ),
        source: 'pixel',
      };
    }

    if (looksLikeNorm1000 && withinPixelRange) {
      const maxDim = Math.max(imageDimensions.width, imageDimensions.height);
      const shouldDisambiguate = maxDim >= BOX_SCALE * 1.5 && boxes.length >= 3;

      if (shouldDisambiguate) {
        let maxNormX = Number.NEGATIVE_INFINITY;
        let maxNormY = Number.NEGATIVE_INFINITY;

        for (const box of boxes) {
          const x1 = (box.xmin / imageDimensions.width) * BOX_SCALE;
          const x2 = (box.xmax / imageDimensions.width) * BOX_SCALE;
          const y1 = (box.ymin / imageDimensions.height) * BOX_SCALE;
          const y2 = (box.ymax / imageDimensions.height) * BOX_SCALE;
          maxNormX = Math.max(maxNormX, x1, x2);
          maxNormY = Math.max(maxNormY, y1, y2);
        }

        const seemsTooCompressed = maxNormY < 450 && maxNormX > 550;
        if (seemsTooCompressed) {
          console.log('定位框坐标：像素与 0-1000 坐标存在歧义，倾向判定为 0-1000 归一化坐标');
          return { boxes: boxes.map(orderBoundingBox), source: 'norm1000' };
        }
      }

      console.log('定位框坐标：判定为像素坐标，换算到 0-1000 归一化尺度');
      return {
        boxes: boxes.map((box) =>
          orderBoundingBox({
            xmin: (box.xmin / imageDimensions.width) * BOX_SCALE,
            xmax: (box.xmax / imageDimensions.width) * BOX_SCALE,
            ymin: (box.ymin / imageDimensions.height) * BOX_SCALE,
            ymax: (box.ymax / imageDimensions.height) * BOX_SCALE,
          }),
        ),
        source: 'pixel',
      };
    }

    if (withinPixelRange && maxCoord > 10) {
      console.log('定位框坐标：判定为像素坐标，换算到 0-1000 归一化尺度');
      return {
        boxes: boxes.map((box) =>
          orderBoundingBox({
            xmin: (box.xmin / imageDimensions.width) * BOX_SCALE,
            xmax: (box.xmax / imageDimensions.width) * BOX_SCALE,
            ymin: (box.ymin / imageDimensions.height) * BOX_SCALE,
            ymax: (box.ymax / imageDimensions.height) * BOX_SCALE,
          }),
        ),
        source: 'pixel',
      };
    }
  }

  // 后备：已经是 0-1000 归一化
  if (looksLikeNorm1000) {
    return { boxes: boxes.map(orderBoundingBox), source: 'norm1000' };
  }

  return { boxes: boxes.map(orderBoundingBox), source: 'unknown' };
};

type LetterboxTransform = {
  scaledWidth: number;
  scaledHeight: number;
  padX: number;
  padY: number;
};

const computeLetterboxTransform = (imageWidth: number, imageHeight: number): LetterboxTransform | null => {
  if (!Number.isFinite(imageWidth) || !Number.isFinite(imageHeight) || imageWidth <= 0 || imageHeight <= 0) {
    return null;
  }

  const maxDim = Math.max(imageWidth, imageHeight);
  const scale = BOX_SCALE / maxDim;

  const scaledWidth = imageWidth * scale;
  const scaledHeight = imageHeight * scale;

  const padX = (BOX_SCALE - scaledWidth) / 2;
  const padY = (BOX_SCALE - scaledHeight) / 2;

  return { scaledWidth, scaledHeight, padX, padY };
};

const getBoundingBoxExtents = (boxes: BoundingBox[]) => {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const box of boxes) {
    minX = Math.min(minX, box.xmin, box.xmax);
    maxX = Math.max(maxX, box.xmin, box.xmax);
    minY = Math.min(minY, box.ymin, box.ymax);
    maxY = Math.max(maxY, box.ymin, box.ymax);
  }

  return { minX, maxX, minY, maxY };
};

// 判断坐标是否更像“先按 `letterbox` 方式缩放到 1000×1000 再输出”的坐标系
const isLikelyLetterboxedSquare = (boxes: BoundingBox[], transform: LetterboxTransform): boolean => {
  if (boxes.length === 0) return false;

  const { padX, padY } = transform;
  const hasPadX = padX > 2;
  const hasPadY = padY > 2;
  if (!hasPadX && !hasPadY) return false;

  const { minX, maxX, minY, maxY } = getBoundingBoxExtents(boxes);
  const tolerance = 12;

  const withinX = !hasPadX || (minX >= padX - tolerance && maxX <= BOX_SCALE - padX + tolerance);
  const withinY = !hasPadY || (minY >= padY - tolerance && maxY <= BOX_SCALE - padY + tolerance);

  return withinX && withinY;
};

// 判断坐标是否更像“等比缩放到最长边=1000（短边 < 1000），不做补边”的坐标系
const isLikelyFitToMaxScale = (boxes: BoundingBox[], transform: LetterboxTransform): boolean => {
  if (boxes.length === 0) return false;

  const hasShrinkX = transform.scaledWidth < BOX_SCALE - 2;
  const hasShrinkY = transform.scaledHeight < BOX_SCALE - 2;
  if (!hasShrinkX && !hasShrinkY) return false;

  const { minX, maxX, minY, maxY } = getBoundingBoxExtents(boxes);
  const tolerance = 12;

  const withinX = !hasShrinkX || (minX >= -tolerance && maxX <= transform.scaledWidth + tolerance);
  const withinY = !hasShrinkY || (minY >= -tolerance && maxY <= transform.scaledHeight + tolerance);

  return withinX && withinY;
};

// 将“正方形 `letterbox` 坐标系（0..1000）”换算为“按原图宽高分别归一化（0..1000）”
const convertFromLetterboxedSquare = (box: BoundingBox, transform: LetterboxTransform): BoundingBox => {
  const safeScaledWidth = transform.scaledWidth > 0 ? transform.scaledWidth : 1;
  const safeScaledHeight = transform.scaledHeight > 0 ? transform.scaledHeight : 1;

  const toX = (x: number) => ((x - transform.padX) / safeScaledWidth) * BOX_SCALE;
  const toY = (y: number) => ((y - transform.padY) / safeScaledHeight) * BOX_SCALE;

  return orderBoundingBox({
    xmin: toX(Math.min(box.xmin, box.xmax)),
    xmax: toX(Math.max(box.xmin, box.xmax)),
    ymin: toY(Math.min(box.ymin, box.ymax)),
    ymax: toY(Math.max(box.ymin, box.ymax)),
  });
};

// 将“`fitMax` 坐标系（短边 < 1000）”换算为“按原图宽高分别归一化（0..1000）”
const convertFromFitToMaxScale = (box: BoundingBox, transform: LetterboxTransform): BoundingBox => {
  const safeScaledWidth = transform.scaledWidth > 0 ? transform.scaledWidth : BOX_SCALE;
  const safeScaledHeight = transform.scaledHeight > 0 ? transform.scaledHeight : BOX_SCALE;

  const toX = (x: number) => (x / safeScaledWidth) * BOX_SCALE;
  const toY = (y: number) => (y / safeScaledHeight) * BOX_SCALE;

  return orderBoundingBox({
    xmin: toX(Math.min(box.xmin, box.xmax)),
    xmax: toX(Math.max(box.xmin, box.xmax)),
    ymin: toY(Math.min(box.ymin, box.ymax)),
    ymax: toY(Math.max(box.ymin, box.ymax)),
  });
};

// 将“`cover` 模式裁剪到 1000×1000 的正方形坐标系（0..1000）”换算为“按原图宽高分别归一化（0..1000）”
// `cover` 的含义：等比缩放到短边=1000，并从中心裁剪出 1000×1000
const convertFromCoverSquare = (
  box: BoundingBox,
  imageDimensions: { width: number; height: number },
): BoundingBox => {
  const { width: imageWidth, height: imageHeight } = imageDimensions;
  if (imageWidth <= 0 || imageHeight <= 0) return orderBoundingBox(box);

  if (imageWidth >= imageHeight) {
    const scaleX = imageWidth / imageHeight;
    const offsetX = (BOX_SCALE * (scaleX - 1)) / 2;
    return orderBoundingBox({
      xmin: (box.xmin + offsetX) / scaleX,
      xmax: (box.xmax + offsetX) / scaleX,
      ymin: box.ymin,
      ymax: box.ymax,
    });
  }

  const scaleY = imageHeight / imageWidth;
  const offsetY = (BOX_SCALE * (scaleY - 1)) / 2;
  return orderBoundingBox({
    xmin: box.xmin,
    xmax: box.xmax,
    ymin: (box.ymin + offsetY) / scaleY,
    ymax: (box.ymax + offsetY) / scaleY,
  });
};

// 用于渲染单个数学片段的内部组件
const MathRenderer: React.FC<{ content: string }> = ({ content }) => {
  const [html, setHtml] = useState<string>('');

  useEffect(() => {
    if (!(window as any).katex) {
      setHtml(content); // KaTeX 未就绪时降级为直接显示原文本
      return;
    }

    let str = content;
    let displayMode = false;

    // 判断渲染模式并去除分隔符
    if (str.startsWith('$$') && str.endsWith('$$')) {
      str = str.slice(2, -2);
      displayMode = true;
    } else if (str.startsWith('\\[') && str.endsWith('\\]')) {
      str = str.slice(2, -2);
      displayMode = true;
    } else if (str.startsWith('\\(') && str.endsWith('\\)')) {
      str = str.slice(2, -2);
      displayMode = false;
    } else if (str.startsWith('$') && str.endsWith('$')) {
      str = str.slice(1, -1);
      displayMode = false;
    } else if (str.startsWith('\\begin')) {
      // 如 aligned、bmatrix 等环境通常应按块级/展示模式渲染
      displayMode = true;
    }

    try {
      const rendered = (window as any).katex.renderToString(str, {
        displayMode,
        throwOnError: false,
        output: 'html', // 确保输出 HTML（而非 MathML 等）
        macros: { "\\bm": "\\boldsymbol" }
      });
      setHtml(rendered);
    } catch (e) {
      console.warn('KaTeX 渲染失败：', content, e);
      setHtml(content); // 渲染失败时降级为直接显示原文本
    }
  }, [content]);

  // 使用 dangerouslySetInnerHTML 注入 KaTeX 生成的 HTML
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
};

// 预处理文本：规范化来自 JSON 的 LaTeX 转义
const normalizeLatexText = (text: string): string => {
  if (!text) return '';

  // 修正常见的 JSON 转义问题：
  // 1. \\$ → $（JSON 中转义的美元符号）
  // 2. \\\\ → \\（双重转义的反斜杠）
  // 3. 移除多余转义，避免破坏 LaTeX 命令
  let normalized = text;

  // 调试：打印原始文本，便于排查解析问题
  // console.debug('用于排查 LaTeX 解析的原始文本：', text);

  return normalized;
};

// 更健壮的 MathText：手动解析字符串中的数学片段
const MathText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const [isKatexLoaded, setIsKatexLoaded] = useState(false);

  useEffect(() => {
    if ((window as any).katex) {
      setIsKatexLoaded(true);
    } else {
      const interval = setInterval(() => {
        if ((window as any).katex) {
          setIsKatexLoaded(true);
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  // 缓存解析结果：避免 `text` 未变化时每次渲染都重新解析
  const parts = useMemo(() => {
    if (!text) return [];

    const normalized = normalizeLatexText(text);

    // 更健壮的正则：捕获更多 LaTeX 写法
    // 1. $$...$$（块级）- 支持多行
    // 2. \\[...\\]（块级）- 支持多行
    // 3. \\begin{env}...\\end{env}（环境）- 支持任意 LaTeX 环境
    // 4. $...$（行内）- 内容不能包含未转义的 $ 或换行
    // 5. \\(...\\)（行内）- 支持多行
    // 注意：顺序很重要，先匹配块级再匹配行内。
    // 额外处理更多数学符号边界情况
    const regex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\begin\{[a-zA-Z]+\*?\}[\s\S]*?\\end\{[a-zA-Z]+\*?\}|\$(?:[^$\\]|\\.)+\$|\\\([\s\S]*?\\\))/g;

    // 按正则切分文本；由于包含捕获组 ()，split 会保留分隔符（数学块）。
    return normalized.split(regex);
  }, [text]);

  if (!isKatexLoaded) {
    return <div className={`${className} whitespace-pre-wrap`}>{text}</div>;
  }

  // 判断某段是否为数学表达式片段
  const isMath = (str: string): boolean => {
    if (!str || str.length < 2) return false;

    // 块级公式：$$ ... $$
    if (str.startsWith('$$') && str.endsWith('$$') && str.length > 4) return true;

    // 块级公式：\\[ ... \\]
    if (str.startsWith('\\[') && str.endsWith('\\]')) return true;

    // 行内公式：\\( ... \\)
    if (str.startsWith('\\(') && str.endsWith('\\)')) return true;

    // 行内公式：$ ... $（中间必须有内容）
    if (str.startsWith('$') && str.endsWith('$') && str.length > 2 && !str.startsWith('$$')) return true;

    // LaTeX 环境：\\begin{...} ... \\end{...}
    if (str.startsWith('\\begin{') || str.startsWith('\\begin ')) return true;

    return false;
  };

  return (
    <div className={`${className} whitespace-pre-wrap break-words math-content`}>
      {parts.map((part, index) => {
        if (!part) return null;

        if (isMath(part)) {
          return <MathRenderer key={index} content={part} />;
        }

        // 普通文本
        return <span key={index}>{part}</span>;
      })}
    </div>
  );
};

// 图片 + 定位框叠加渲染组件
const ImageWithOverlay: React.FC<{
  imageBase64: string;
  imageDimensions?: { width: number; height: number } | null;
  problems: AnalysisResult['problems'];
  selectedProblemId: string | null;
  onSelectProblem: (id: string) => void;
}> = ({ imageBase64, imageDimensions: imageDimensionsProp, problems, selectedProblemId, onSelectProblem }) => {
  // 坐标约定可能存在差异：有的按原图宽高分别归一化，有的先按 `letterbox` 做正方形预处理后再输出坐标。
  // 这里基于图片 `naturalWidth`/`naturalHeight` 做自动判别，并在需要时做坐标换算，减少“定位框偏移”。
  const imgRef = useRef<HTMLImageElement | null>(null);
  const overlayRef = useRef<SVGSVGElement | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(imageDimensionsProp ?? null);
  const [bboxModeSetting, setBboxModeSetting] = useState<BboxModeSetting>('auto');
  const [bboxScaleSetting, setBboxScaleSetting] = useState<BoxScaleSetting>('auto');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [renderSize, setRenderSize] = useState<{
    img: { width: number; height: number };
    overlay: { width: number; height: number };
  } | null>(null);

  useEffect(() => {
    setImageDimensions(imageDimensionsProp ?? null);
  }, [imageBase64, imageDimensionsProp]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('bboxModeSetting');
      if (saved && isBboxModeSetting(saved)) {
        setBboxModeSetting(saved);
      }
      const savedScale = window.localStorage.getItem('bboxScaleSetting');
      if (savedScale && isBoxScaleSetting(savedScale)) {
        setBboxScaleSetting(savedScale);
      }
    } catch {
      // 忽略
    }
  }, []);

  const rawBoxes = useMemo(() => problems.map((problem) => orderBoundingBox(problem.boundingBox)), [problems]);

  const bboxScaleOverrideFromQuery = useMemo(() => {
    const scale = new URLSearchParams(window.location.search).get('bboxScale');
    return scale && isBoxScaleOverride(scale) ? scale : null;
  }, []);

  const effectiveScaleOverride: BoxScaleOverride | null =
    bboxScaleOverrideFromQuery ?? (bboxScaleSetting !== 'auto' ? bboxScaleSetting : null);

  const normalizedScaleResult = useMemo(
    () => normalizeBoundingBoxScale(rawBoxes, imageDimensions, effectiveScaleOverride),
    [rawBoxes, imageDimensions, effectiveScaleOverride],
  );

  const normalizedBoxes = normalizedScaleResult.boxes;
  const normalizedExtents = useMemo(() => getBoundingBoxExtents(normalizedBoxes), [normalizedBoxes]);

  const letterboxTransform = useMemo(() => {
    if (!imageDimensions) return null;
    return computeLetterboxTransform(imageDimensions.width, imageDimensions.height);
  }, [imageDimensions]);

  const bboxDebugEnabled = useMemo(() => {
    const debug = new URLSearchParams(window.location.search).get('bboxDebug');
    return debug === '1' || debug === 'true';
  }, []);

  const bboxModeOverrideFromQuery = useMemo(() => {
    const mode = new URLSearchParams(window.location.search).get('bboxMode');
    return mode && isBboxMode(mode) ? mode : null;
  }, []);

  const measureRenderSize = useCallback(() => {
    const imgEl = imgRef.current;
    if (!imgEl) return;

    const imgRect = imgEl.getBoundingClientRect();
    const overlayEl = overlayRef.current;
    const overlayRect = overlayEl?.getBoundingClientRect() ?? null;
    setRenderSize({
      img: { width: Math.round(imgRect.width), height: Math.round(imgRect.height) },
      overlay: overlayRect
        ? { width: Math.round(overlayRect.width), height: Math.round(overlayRect.height) }
        : { width: 0, height: 0 },
    });
  }, []);

  useEffect(() => {
    const imgEl = imgRef.current;
    if (!imgEl) return;

    measureRenderSize();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureRenderSize) : null;
    if (ro) {
      ro.observe(imgEl);
      const overlayEl = overlayRef.current;
      if (overlayEl) ro.observe(overlayEl);
      return () => ro.disconnect();
    }

    window.addEventListener('resize', measureRenderSize);
    return () => window.removeEventListener('resize', measureRenderSize);
  }, [imageBase64, measureRenderSize]);

  const overlayStyle = useMemo(() => {
    if (!renderSize) {
      return { top: 0, left: 0, right: 0, bottom: 0 };
    }
    return {
      top: 0,
      left: 0,
      width: renderSize.img.width,
      height: renderSize.img.height,
    };
  }, [renderSize]);

  const autoBboxMode = useMemo<BboxMode>(() => {
    if (!letterboxTransform) return 'raw';
    if (normalizedScaleResult.source === 'pixel') return 'raw';

    const extents = getBoundingBoxExtents(normalizedBoxes);

    const edgeMargin = 40;
    const tolerance = 12;

    const hasShrinkX = letterboxTransform.scaledWidth < BOX_SCALE - 2;
    const hasShrinkY = letterboxTransform.scaledHeight < BOX_SCALE - 2;

    const fitMaxPossible = isLikelyFitToMaxScale(normalizedBoxes, letterboxTransform);
    const fitMaxEvidence =
      fitMaxPossible &&
      ((hasShrinkX && (extents.minX <= edgeMargin || extents.maxX >= letterboxTransform.scaledWidth - edgeMargin)) ||
        (hasShrinkY && (extents.minY <= edgeMargin || extents.maxY >= letterboxTransform.scaledHeight - edgeMargin)));

    if (fitMaxEvidence) return 'fitMax';

    const letterboxPossible = isLikelyLetterboxedSquare(normalizedBoxes, letterboxTransform);
    const hasPadX = letterboxTransform.padX > 2;
    const hasPadY = letterboxTransform.padY > 2;

    const nearPadX =
      hasPadX &&
      ((extents.minX >= letterboxTransform.padX - tolerance && extents.minX <= letterboxTransform.padX + edgeMargin) ||
        (extents.maxX <= BOX_SCALE - letterboxTransform.padX + tolerance &&
          extents.maxX >= BOX_SCALE - letterboxTransform.padX - edgeMargin));

    const nearPadY =
      hasPadY &&
      ((extents.minY >= letterboxTransform.padY - tolerance && extents.minY <= letterboxTransform.padY + edgeMargin) ||
        (extents.maxY <= BOX_SCALE - letterboxTransform.padY + tolerance &&
          extents.maxY >= BOX_SCALE - letterboxTransform.padY - edgeMargin));

    const letterboxEvidence = letterboxPossible && (nearPadX || nearPadY);
    if (letterboxEvidence) return 'letterbox';

    const aspectRatio = imageDimensions ? imageDimensions.width / imageDimensions.height : 1;
    const isWide = aspectRatio >= 1.2;
    const isTall = aspectRatio <= 0.8;

    if (
      normalizedScaleResult.source === 'norm1000' &&
      (isWide || isTall) &&
      !fitMaxPossible &&
      !letterboxPossible
    ) {
      return 'cover';
    }

    const coverEvidence =
      (isWide && extents.minX <= edgeMargin && extents.maxX >= BOX_SCALE - edgeMargin) ||
      (isTall && extents.minY <= edgeMargin && extents.maxY >= BOX_SCALE - edgeMargin);

    const coverHeuristic =
      !fitMaxPossible &&
      !letterboxPossible &&
      ((isTall &&
        extents.maxX >= BOX_SCALE - edgeMargin &&
        extents.minY >= edgeMargin * 2 &&
        extents.maxY >= BOX_SCALE * 0.9) ||
        (isWide &&
          extents.maxY >= BOX_SCALE - edgeMargin &&
          extents.minX >= edgeMargin * 2 &&
          extents.maxX >= BOX_SCALE * 0.9));

    if (coverEvidence || coverHeuristic) return 'cover';

    // 兜底：如果两种证据都不足，保持原样渲染，避免误判造成更严重偏移
    return 'raw';
  }, [imageDimensions, letterboxTransform, normalizedBoxes, normalizedScaleResult.source]);

  const effectiveBboxMode: BboxMode =
    bboxModeOverrideFromQuery ?? (bboxModeSetting !== 'auto' ? bboxModeSetting : autoBboxMode);

  const transformedBoxes = useMemo(() => {
    if (!imageDimensions || !letterboxTransform) return normalizedBoxes.map((box) => clampBoundingBox(box));

    if (effectiveBboxMode === 'letterbox') {
      return normalizedBoxes.map((box) => clampBoundingBox(convertFromLetterboxedSquare(box, letterboxTransform)));
    }

    if (effectiveBboxMode === 'fitMax') {
      return normalizedBoxes.map((box) => clampBoundingBox(convertFromFitToMaxScale(box, letterboxTransform)));
    }

    if (effectiveBboxMode === 'cover') {
      return normalizedBoxes.map((box) => clampBoundingBox(convertFromCoverSquare(box, imageDimensions)));
    }

    return normalizedBoxes.map((box) => clampBoundingBox(box));
  }, [effectiveBboxMode, imageDimensions, letterboxTransform, normalizedBoxes]);

  return (
    <div className="relative w-full max-w-2xl shadow-xl rounded-lg overflow-hidden bg-white border border-gray-200 mx-4">
      <img
        src={`data:image/jpeg;base64,${imageBase64}`}
        alt="Homework"
        className="w-full h-auto block"
        ref={imgRef}
        onLoad={(event) => {
          const target = event.currentTarget;
          const width = target.naturalWidth || target.width;
          const height = target.naturalHeight || target.height;
          if (width > 0 && height > 0) {
            setImageDimensions({ width, height });
          }
          window.requestAnimationFrame(measureRenderSize);
        }}
      />
      <div className="absolute right-2 top-2 z-20 flex items-center gap-2 pointer-events-auto">
        <select
          value={bboxScaleSetting}
          onChange={(event) => {
            const next = event.target.value;
            if (!isBoxScaleSetting(next)) return;
            setBboxScaleSetting(next);
            try {
              window.localStorage.setItem('bboxScaleSetting', next);
            } catch {
              // 忽略
            }
          }}
          className="rounded-md border border-gray-200 bg-white/90 px-2 py-1 text-[12px] text-gray-700 shadow-sm backdrop-blur hover:bg-white"
          title="定位框坐标尺度"
          disabled={Boolean(bboxScaleOverrideFromQuery)}
        >
          <option value="auto">自动尺度</option>
          <option value="pixel">像素</option>
          <option value="norm1000">0-1000</option>
          <option value="unit">0-1</option>
          <option value="percent">百分比</option>
        </select>
        <select
          value={bboxModeSetting}
          onChange={(event) => {
            const next = event.target.value;
            if (!isBboxModeSetting(next)) return;
            setBboxModeSetting(next);
            try {
              window.localStorage.setItem('bboxModeSetting', next);
            } catch {
              // 忽略
            }
          }}
          className="rounded-md border border-gray-200 bg-white/90 px-2 py-1 text-[12px] text-gray-700 shadow-sm backdrop-blur hover:bg-white"
          title="定位框校准模式"
          disabled={Boolean(bboxModeOverrideFromQuery)}
        >
          <option value="auto">自动校准</option>
          <option value="raw">原样</option>
          <option value="letterbox">补边</option>
          <option value="fitMax">等比缩放</option>
          <option value="cover">居中裁剪</option>
        </select>
        <button
          type="button"
          className="rounded-md border border-gray-200 bg-white/90 px-2 py-1 text-[12px] text-gray-700 shadow-sm backdrop-blur hover:bg-white"
          onClick={async () => {
            setCopyStatus('idle');
            const payload = {
              bboxMode: {
                queryOverride: bboxModeOverrideFromQuery,
                setting: bboxModeSetting,
                auto: autoBboxMode,
                effective: effectiveBboxMode,
              },
              bboxScale: {
                queryOverride: bboxScaleOverrideFromQuery,
                setting: bboxScaleSetting,
                effectiveOverride: effectiveScaleOverride,
                effective: normalizedScaleResult.source,
              },
              scale: normalizedScaleResult.source,
              image: imageDimensions,
              render: renderSize,
              extents: normalizedExtents,
              sample: problems.slice(0, 5).map((problem) => ({
                id: problem.id,
                subject: problem.subject,
                boundingBox: problem.boundingBox,
              })),
            };

            const ok = await copyToClipboard(JSON.stringify(payload, null, 2));
            setCopyStatus(ok ? 'ok' : 'fail');
            window.setTimeout(() => setCopyStatus('idle'), 1500);
          }}
          title="复制定位框调试信息"
        >
          {copyStatus === 'ok' ? '已复制' : copyStatus === 'fail' ? '复制失败' : '复制调试信息'}
        </button>
      </div>
      {bboxDebugEnabled && (
        <div className="pointer-events-none absolute left-2 top-2 z-20 rounded bg-black/70 px-2 py-1 font-mono text-[10px] leading-4 text-white">
          <div>bboxMode: {effectiveBboxMode}{bboxModeOverrideFromQuery ? ' (query)' : bboxModeSetting !== 'auto' ? ' (setting)' : ' (auto)'}</div>
          <div>scale: {normalizedScaleResult.source}{bboxScaleOverrideFromQuery ? ' (query)' : bboxScaleSetting !== 'auto' ? ' (setting)' : ' (auto)'}</div>
          {imageDimensions && <div>img: {imageDimensions.width}×{imageDimensions.height}</div>}
          {renderSize && <div>render: img {renderSize.img.width}×{renderSize.img.height} svg {renderSize.overlay.width}×{renderSize.overlay.height}</div>}
          {Number.isFinite(normalizedExtents.minX) && (
            <div>
              ext: x {normalizedExtents.minX.toFixed(1)}..{normalizedExtents.maxX.toFixed(1)} y {normalizedExtents.minY.toFixed(1)}..{normalizedExtents.maxY.toFixed(1)}
            </div>
          )}
          {letterboxTransform && (
            <div>
              scaled: {letterboxTransform.scaledWidth.toFixed(1)}×{letterboxTransform.scaledHeight.toFixed(1)} pad: {letterboxTransform.padX.toFixed(1)},{letterboxTransform.padY.toFixed(1)}
            </div>
          )}
        </div>
      )}
      <svg
        ref={overlayRef}
        className="absolute pointer-events-none"
        style={overlayStyle}
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
      >
        {problems.map((problem, index) => {
          const box = transformedBoxes[index];
          if (!box) return null;

          const { ymin, xmin, ymax, xmax } = box;
          const height = ymax - ymin;
          const width = xmax - xmin;
          const isSel = selectedProblemId === problem.id;

          return (
            <g key={problem.id} className="pointer-events-auto cursor-pointer" onClick={() => onSelectProblem(problem.id)}>
              {/* 添加透明点击区域，确保小框也容易点中 */}
              <rect
                x={xmin}
                y={ymin}
                width={width}
                height={height}
                fill="transparent"
                stroke="transparent"
                strokeWidth="0"
              />
              {/* 定位框样式 */}
              <rect
                x={xmin}
                y={ymin}
                width={width}
                height={height}
                fill={problem.isCorrect ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)'}
                stroke={problem.isCorrect ? '#22c55e' : '#ef4444'}
                strokeWidth={isSel ? 3 : 2}
                strokeDasharray={isSel ? "0" : "6,4"}
                rx="4"
              />
              {/* 标记 */}
              <circle cx={xmax} cy={ymin} r="12" fill={problem.isCorrect ? '#22c55e' : '#ef4444'} />
              <text x={xmax} y={ymin + 4} textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">
                {problem.isCorrect ? '✓' : '✗'}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const AnalysisOverlay: React.FC<AnalysisOverlayProps> = ({ imageBase64, imageDimensions, result }) => {
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);

  useEffect(() => {
    // 文本输入或单个结果时，默认选中第一题
    if (result.problems.length > 0) {
      setSelectedProblemId(result.problems[0].id);
    }
  }, [imageBase64, result.problems]);

  const selectedProblem = result.problems.find(p => p.id === selectedProblemId);

  return (
    <div className="flex flex-col md:flex-row h-full bg-gray-50 overflow-hidden">
      {/* 左侧：图片 / 题目列表 */}
      <div className="flex-1 overflow-y-auto bg-gray-50 bg-grid-pattern bg-fixed relative border-b md:border-b-0 md:border-r border-gray-200 flex flex-col items-center justify-start py-8">
        {imageBase64 ? (
          <ImageWithOverlay
            imageBase64={imageBase64}
            imageDimensions={imageDimensions}
            problems={result.problems}
            selectedProblemId={selectedProblemId}
            onSelectProblem={setSelectedProblemId}
          />
        ) : (
          <div className="p-6 w-full max-w-2xl bg-white/90 backdrop-blur-sm shadow-lg rounded-2xl border border-gray-100 mx-4">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800">解析列表</h2>
              <p className="text-sm text-gray-500 mt-1">{result.overallSummary}</p>
            </div>
            <div className="space-y-4">
              {result.problems.map((problem) => (
                <button
                  key={problem.id}
                  onClick={() => setSelectedProblemId(problem.id)}
                  className={`w-full text-left p-5 rounded-2xl border transition-all ${selectedProblemId === problem.id
                    ? 'bg-brand-50 border-brand-500 shadow-md ring-1 ring-brand-500'
                    : 'bg-white border-gray-200 shadow-sm hover:border-brand-300'
                    }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase rounded tracking-wider">{problem.subject}</span>
                    <span className={`text-xs font-bold ${problem.isCorrect ? "text-green-500" : "text-red-500"}`}>
                      {problem.isCorrect ? '✓ 正确' : '✗ 查看解析'}
                    </span>
                  </div>
                  <MathText text={problem.questionText} className="text-gray-800 font-medium line-clamp-3 leading-relaxed" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 右侧：解析详情 */}
      <div className="md:w-[500px] shrink-0 bg-white shadow-2xl z-10 flex flex-col h-[60%] md:h-full overflow-y-auto no-scrollbar border-t md:border-t-0 md:border-l border-gray-100">
        {selectedProblem ? (
          <div className="p-6 space-y-6 animate-fade-in pb-12">
            <div className="flex justify-between items-start">
              <div className="flex-1 mr-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-brand-100 text-brand-700 text-xs font-bold rounded">
                    {selectedProblem.subject}
                  </span>
                </div>
                {/* 题目标题支持公式渲染，并使用衬线字体增强“试卷感” */}
                <MathText
                  text={selectedProblem.questionText}
                  className="text-lg font-bold text-gray-900 leading-relaxed tracking-wide font-serif"
                />

                <div className="mt-4 space-y-2">
                  <div className="text-sm bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">你的回答</span>
                    <MathText
                      text={selectedProblem.studentAnswer || '(无内容)'}
                      className="text-base text-gray-800 font-medium"
                    />
                  </div>
                  {!selectedProblem.isCorrect && (
                    <div className="text-sm bg-green-50 p-3 rounded-xl border border-green-100">
                      <span className="block text-[10px] font-bold text-green-600 uppercase mb-1">正确答案</span>
                      <MathText
                        text={selectedProblem.correctAnswer}
                        className="text-lg font-bold text-green-700 break-words font-serif"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className={`px-4 py-1 rounded-full text-xs font-bold shrink-0 shadow-sm ${selectedProblem.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {selectedProblem.isCorrect ? '正确' : '待纠正'}
              </div>
            </div>

            <div className="p-4 bg-blue-50/30 rounded-2xl border border-blue-100 shadow-sm">
              <p className="text-blue-700 font-bold text-sm mb-2 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs">💡</span>
                思路点拨
              </p>
              <MathText
                text={selectedProblem.hint}
                className="text-gray-800 text-sm leading-7 font-sans"
              />
            </div>

            {selectedProblem.solutionSteps && selectedProblem.solutionSteps.length > 0 && (
              <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-gray-900 font-bold text-sm mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-xs">📜</span>
                  标准解答过程
                </p>
                <div className="space-y-4">
                  {selectedProblem.solutionSteps.map((step, index) => (
                    <div key={index} className="flex gap-4 text-sm text-gray-800 bg-gray-50/50 p-4 rounded-xl border border-gray-50 hover:border-brand-100 transition-colors">
                      <span className="text-brand-400 font-mono font-bold shrink-0 mt-1 text-xs">{index + 1}</span>
                      <div className="w-full min-w-0">
                        <MathText text={step} className="text-gray-900 leading-8 font-serif text-base" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Python 验证代码 */}
            {selectedProblem.verificationCode && (
              <div className="mt-4 opacity-60 hover:opacity-100 transition-opacity">
                <details className="text-[10px] group">
                  <summary className="cursor-pointer text-gray-400 list-none flex items-center gap-1 hover:text-brand-500">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 transition-transform group-open:rotate-90">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                    Python 验证逻辑详情
                  </summary>
                  <div className="mt-2 p-3 bg-gray-800 text-gray-200 rounded-lg overflow-x-auto font-mono text-[9px] leading-relaxed border border-gray-700 shadow-inner">
                    <pre>{selectedProblem.verificationCode}</pre>
                  </div>
                </details>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-10 h-10 text-gray-300">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <p className="font-bold text-gray-600 text-lg">请选择题目查看解析</p>
            <p className="text-sm mt-3 text-gray-400 max-w-xs mx-auto leading-relaxed">{result.overallSummary}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisOverlay;
