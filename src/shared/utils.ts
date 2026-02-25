export interface Point {
  x: number;
  y: number;
}

/**
 * 鞋带算法 (Shoelace Formula) 计算多边形面积
 * Area = 0.5 * |Σ(x_i * y_{i+1} - x_{i+1} * y_i)|
 * 支持异形窗户 (任意闭合多边形)
 */
export const calculateArea = (points: Point[]): number => {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    area += points[i].x * points[next].y - points[next].x * points[i].y;
  }
  return Math.abs(area) / 2.0;
};

/**
 * 计算多边形周长
 */
export const calculatePerimeter = (points: Point[]): number => {
  if (points.length < 2) return 0;
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    const dx = points[next].x - points[i].x;
    const dy = points[next].y - points[i].y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  return perimeter;
};

/**
 * 获取最小外接矩形 (Bounding Box) 的宽和高
 */
export const calculateBoundingBox = (points: Point[]): { width: number; height: number } => {
  if (points.length === 0) return { width: 0, height: 0 };
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;

  points.forEach((p) => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  });

  return {
    width: maxX - minX,
    height: maxY - minY,
  };
};
