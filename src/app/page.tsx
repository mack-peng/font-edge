'use client'
import React, { useEffect, useState } from 'react'
import opentype from 'opentype.js'

if (!window.loadOpentypeFonts) {
  window.loadOpentypeFonts = {}
}
const DECIMAL_UNIT = 100

// 全局变量
const loadedFont = null;
const isFontLoading = false;
const loadFontPromise = null;

// 纯同步的 metrics 计算，需 font 已加载好
function getTextMetricsOpentype(font, text, fontSize = 72, transform = 'normal') {
    // 字符串变换
    let transformedText;
    switch(transform) {
        case 'uppercase':
            transformedText = text.toUpperCase();
            break;
        case 'lowercase':
            transformedText = text.toLowerCase();
            break;
        default:
            transformedText = text;
    }

    // 1. 路径与边界盒
    const path = font.getPath(transformedText, 0, 0, fontSize);
    const box = path.getBoundingBox(); // {x1, y1, x2, y2}

    // 2. 文本排版宽度（实际advance width）
    const textWidth = font.getAdvanceWidth(transformedText, fontSize);

    // 3. 跟字体字面框相关的高度
    const fontAscender = font.ascender / font.unitsPerEm * fontSize;
    const fontDescender = Math.abs(font.descender / font.unitsPerEm * fontSize); // 绝对值
    const fontHeight = fontAscender + fontDescender;

    // 4. 实际内容高度
    const actualBoundingBoxAscent = -box.y1; // 路径最高点到baseline上方距离
    const actualBoundingBoxDescent = box.y2; // 路径最低点到baseline下方距离
    const actualHeight = actualBoundingBoxAscent + actualBoundingBoxDescent;

    // 5. 垂直留白空间
    const topWhiteSpaceHeight = fontAscender - actualBoundingBoxAscent;
    const bottomWhiteSpaceHeight = fontDescender - actualBoundingBoxDescent;

    const isMinus = fontAscender > fontDescender;
    let verticalWhiteSpace = 0;
    if (isMinus) {
        verticalWhiteSpace = -(topWhiteSpaceHeight - bottomWhiteSpaceHeight);
    } else {
        verticalWhiteSpace = topWhiteSpaceHeight - bottomWhiteSpaceHeight;
    }

    // 6. 水平留白/修正（与Canvas逻辑保持一致）
    // box.x1 可能为负，表示内容向左越过基点
    // box.x2 右边可能超过 advanceWidth（排版宽度）
    const horizontalLeftSpacing = -box.x1; // 距离起点的负向边距
    const horizontalRightSpacing = box.x2 - textWidth;
    // 保持与 Canvas 中 DECIMAL_UNIT 四舍五入逻辑
    const DECIMAL_UNIT = 1000;
    const horizontalOffsetSpacing =
        Math.round(horizontalRightSpacing * DECIMAL_UNIT) / DECIMAL_UNIT -
        Math.round(horizontalLeftSpacing * DECIMAL_UNIT) / DECIMAL_UNIT;

    return {
        isMinus,
        textWidth,
        fontHeight,
        actualHeight,
        verticalWhiteSpace,
        topWhiteSpaceHeight,
        bottomWhiteSpaceHeight,
        horizontalOffsetSpacing,
        actualBoundingBoxAscent,
        actualBoundingBoxDescent,
        horizontalLeftSpacing: Math.round(horizontalLeftSpacing * DECIMAL_UNIT) / DECIMAL_UNIT,
        horizontalRightSpacing: Math.round(horizontalRightSpacing * DECIMAL_UNIT) / DECIMAL_UNIT,
    };
}

// 你原有的 getTextMetrics 方法
const getTextMetrics = (
  font: any,
  text: string,
  transform = 'normal',
) => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  context.font = font
  let transformedText
      switch (transform) {
    case 'uppercase':
      transformedText = text.toUpperCase();
      break;
    case 'lowercase':
      transformedText = text.toLowerCase();
      break;
    default:
      transformedText = text;
  }
  const metrics = context.measureText(transformedText)
  const textWidth = metrics.width
  const actualHeight =
    metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
  const fontHeight =
    metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent

  const topWhiteSpaceHeight =
    metrics.fontBoundingBoxAscent - metrics.actualBoundingBoxAscent
  const bottomWhiteSpaceHeight =
    metrics.fontBoundingBoxDescent - metrics.actualBoundingBoxDescent
  const isMinus = metrics.fontBoundingBoxAscent > metrics.fontBoundingBoxDescent

  let verticalWhiteSpace = 0

  if (isMinus) {
    verticalWhiteSpace = -(topWhiteSpaceHeight - bottomWhiteSpaceHeight)
  } else {
    verticalWhiteSpace = topWhiteSpaceHeight - bottomWhiteSpaceHeight
  }

  const horizontalLeftSpacing = metrics?.actualBoundingBoxLeft
  const horizontalRightSpacing = metrics.actualBoundingBoxRight - textWidth
  const horizontalOffsetSpacing =
    Math.round(horizontalRightSpacing * DECIMAL_UNIT) / DECIMAL_UNIT -
    Math.round(horizontalLeftSpacing * DECIMAL_UNIT) / DECIMAL_UNIT

  return {
    isMinus,
    textWidth,
    fontHeight,
    actualHeight,
    verticalWhiteSpace,
    topWhiteSpaceHeight,
    bottomWhiteSpaceHeight,
    horizontalOffsetSpacing,
    actualBoundingBoxAscent: metrics.actualBoundingBoxAscent,
    actualBoundingBoxDescent: metrics.actualBoundingBoxDescent,
    horizontalLeftSpacing:
      Math.round(horizontalLeftSpacing * DECIMAL_UNIT) / DECIMAL_UNIT,
    horizontalRightSpacing:
      Math.round(horizontalRightSpacing * DECIMAL_UNIT) / DECIMAL_UNIT,
  }
}

async function loadOpentypeFont(name, fontUrl) {
  if (window.loadOpentypeFonts[name]) {
    return true
  }
  try {
    const res = await fetch(fontUrl);
    const buffer = await res.arrayBuffer();
    const font = opentype.parse(buffer);
    window.loadOpentypeFonts[name] = font;
    return true
  } catch (e) {
    return Promise.reject(e)
  }
}

export default function Home() {
  const [opentypeMetrics, setOpentypeMetrics] = useState<any>(null);
  const [fontReady, setFontReady] = useState(false);

  // 字体参数
  const fontWeight = 400
  const minFontSize = 42
  const fontFamily = 'weilai-yuan'
  const textFont =  `${fontWeight} ${minFontSize}px ${fontFamily}`
  const mainText = '黄河 很长'
  const textCase = 'normal'

  const fontSaveName = `${fontFamily} ${fontWeight} ${mainText}` // maybe use hash

  useEffect(() => {
    const fontUrl = 'https://static-assets.strikinglycdn.com/fontsubset/weilai-yuan/400?text=%E9%BB%84%E6%B2%B3%20%E5%BE%88%E9%95%BF'
    loadOpentypeFont(fontSaveName, fontUrl).then(res => {
      setFontReady(true)
    }).catch((error) => {
      console.log(error)
    })
  }, [])

  useEffect(() => {
    if (fontReady) {
      const font = window.loadOpentypeFonts[fontSaveName]
      const _opentypeMetrics = getTextMetricsOpentype(font, mainText, minFontSize, 'normal')
      setOpentypeMetrics(_opentypeMetrics)
    }
  }, [fontReady])

  // canvas metrics 是同步的
  const {
    isMinus,
    textWidth,
    fontHeight,
    actualHeight,
    verticalWhiteSpace,
    topWhiteSpaceHeight,
    bottomWhiteSpaceHeight,
    horizontalOffsetSpacing,
    actualBoundingBoxAscent,
    actualBoundingBoxDescent,
    horizontalLeftSpacing,
    horizontalRightSpacing
  } = getTextMetrics(
    textFont,
    mainText,
    textCase,
  )

  return (
    <div className="home-container" style={{ fontFamily: fontFamily }}>
      <div style={{ fontSize: minFontSize, fontWeight }}>{mainText}</div>
      <div style={{ fontSize: minFontSize, fontWeight }}>fontFamily: {fontFamily}</div>
      <hr />
      <div className="show-wrapper">
        <div><b>Canvas测量 (getTextMetrics):</b></div>
        <div>isMinus: {isMinus}</div>
        <div>textWidth: {textWidth}</div>
        <div>fontHeight: {fontHeight}</div>
        <div>actualHeight: {actualHeight}</div>
        <div>verticalWhiteSpace: {verticalWhiteSpace}</div>
        <div>topWhiteSpaceHeight: {topWhiteSpaceHeight}</div>
        <div>bottomWhiteSpaceHeight: {bottomWhiteSpaceHeight}</div>
        <div>horizontalOffsetSpacing: {horizontalOffsetSpacing}</div>
        <div>actualBoundingBoxAscent: {actualBoundingBoxAscent}</div>
        <div>actualBoundingBoxDescent: {actualBoundingBoxDescent}</div>
        <div>horizontalLeftSpacing: {horizontalLeftSpacing}</div>
        <div>horizontalRightSpacing: {horizontalRightSpacing}</div>
        <hr />
        <div><b>OpenType测量:</b></div>
        {fontReady && opentypeMetrics ? (
          <>
            <div>isMinus: {opentypeMetrics.isMinus}</div>
            <div>textWidth: {opentypeMetrics.textWidth}</div>
            <div>fontHeight: {opentypeMetrics.fontHeight}</div>
            <div>actualHeight: {opentypeMetrics.actualHeight}</div>
            <div>verticalWhiteSpace: {opentypeMetrics.verticalWhiteSpace}</div>
            <div>topWhiteSpaceHeight: {opentypeMetrics.topWhiteSpaceHeight}</div>
            <div>bottomWhiteSpaceHeight: {opentypeMetrics.bottomWhiteSpaceHeight}</div>
            <div>horizontalOffsetSpacing: {opentypeMetrics.horizontalOffsetSpacing}</div>
            <div>actualBoundingBoxAscent: {opentypeMetrics.actualBoundingBoxAscent}</div>
            <div>actualBoundingBoxDescent: {opentypeMetrics.actualBoundingBoxDescent}</div>
            <div>horizontalLeftSpacing: {opentypeMetrics.horizontalLeftSpacing}</div>
            <div>horizontalRightSpacing: {opentypeMetrics.horizontalRightSpacing}</div>
          </>
        ) : (
          <div>正在加载字体和计算...</div>
        )}
      </div>
    </div>
  );
}

